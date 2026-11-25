import { NextRequest } from 'next/server';
import { requireAuth, json, errorResponse, handleApiError, getFacultyProfile, audit, type AuthContext } from '@/lib/api-helpers';
import type { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase-server';
import { z } from 'zod';

function isResponse(v: AuthContext | NextResponse): v is NextResponse {
  return (v as NextResponse).status !== undefined;
}

const markSchema = z.object({
  schedule_id: z.string().uuid(),
  scheduled_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  actual_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  start_time: z.string().optional(),
  end_time: z.string().optional(),
  number_of_periods: z.number().int().min(1).max(12).optional(),
  number_of_students: z.number().int().min(0).max(1000).optional(),
  remarks: z.string().max(500).optional(),
});

// GET: upcoming scheduled classes (materialized from the official timetable) + recent history
export async function GET(req: NextRequest) {
  try {
    const ctx = await requireAuth(req);
    if (isResponse(ctx)) return ctx;
    const profile = await getFacultyProfile(ctx);
    if (!profile) return json({ upcoming: [], history: [] });

    const service = getServiceClient();
    const { searchParams } = new URL(req.url);
    const semesterId = searchParams.get('semester_id');

    let semester: { id: string; start_date: string; end_date: string; attendance_open: string; attendance_close: string } | null = null;
    if (semesterId) {
      const r = await service.from('semesters').select('id, start_date, end_date, attendance_open, attendance_close').eq('id', semesterId).maybeSingle();
      semester = r.data;
    } else {
      const r = await service.from('semesters').select('id, start_date, end_date, attendance_open, attendance_close').eq('status', 'Active').order('start_date', { ascending: false }).limit(1).maybeSingle();
      semester = r.data;
    }
    if (!semester) return json({ upcoming: [], history: [], semester: null });

    const { data: assignments } = await ctx.client
      .from('faculty_assignments')
      .select('id, semester_id, course_id, number_of_students, classification, number_of_periods, start_time, end_time, status, courses (title, code), semesters (id, name)')
      .eq('faculty_id', profile.id)
      .eq('semester_id', semester.id)
      .neq('status', 'Cancelled');

    const assignmentIds = (assignments || []).map((a) => a.id);
    if (assignmentIds.length === 0) return json({ upcoming: [], history: [], semester });

    const { data: schedules } = await ctx.client
      .from('schedules')
      .select('*')
      .in('assignment_id', assignmentIds)
      .eq('status', 'Active');

    const { data: existing } = await ctx.client
      .from('attendance_records')
      .select('id, assignment_id, scheduled_date, status, actual_date, start_time, end_time, number_of_periods, number_of_students, remarks')
      .in('assignment_id', assignmentIds)
      .gte('scheduled_date', semester.start_date)
      .lte('scheduled_date', semester.end_date);

    const existingMap = new Map<string, { id: string; status: string }>();
    for (const e of existing || []) existingMap.set(`${e.assignment_id}|${e.scheduled_date}`, e);

    const today = new Date().toISOString().slice(0, 10);
    const upcoming: Array<Record<string, unknown>> = [];
    const start = new Date(semester.attendance_open + 'T00:00:00Z');
    const end = new Date(semester.attendance_close + 'T00:00:00Z');
    const cursor = new Date(Math.max(start.getTime(), new Date(today + 'T00:00:00Z').getTime() - 7 * 86400000));
    for (const s of schedules || []) {
      const a = (assignments || []).find((x) => x.id === s.assignment_id);
      if (!a) continue;
      const rangeStart = new Date(Math.max(new Date(s.start_date + 'T00:00:00Z').getTime(), start.getTime()));
      const rangeEnd = new Date(Math.min(new Date(s.end_date + 'T00:00:00Z').getTime(), end.getTime()));
      for (const d = new Date(rangeStart); d <= rangeEnd && d <= new Date(today + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 1)) {
        if (d.getUTCDay() !== s.day_of_week) continue;
        const dateStr = d.toISOString().slice(0, 10);
        const key = `${s.assignment_id}|${dateStr}`;
        if (existingMap.has(key)) continue;
        upcoming.push({
          schedule_id: s.id,
          assignment_id: s.assignment_id,
          scheduled_date: dateStr,
          course_title: (a.courses as unknown as { title: string } | null)?.title,
          course_code: (a.courses as unknown as { code: string } | null)?.code,
          start_time: s.start_time,
          end_time: s.end_time,
          number_of_periods: s.number_of_periods,
          number_of_students: a.number_of_students,
        });
      }
    }
    upcoming.sort((a, b) => String(b.scheduled_date).localeCompare(String(a.scheduled_date)));

    const { data: history } = await ctx.client
      .from('attendance_records')
      .select('*, courses:faculty_assignments (courses (title, code))')
      .eq('faculty_id', profile.id)
      .eq('semester_id', semester.id)
      .order('scheduled_date', { ascending: false });

    return json({ upcoming: upcoming.slice(0, 30), history: history || [], semester });
  } catch (err) {
    return handleApiError(err);
  }
}

// POST: mark attendance for a scheduled class with full backend validation
export async function POST(req: NextRequest) {
  try {
    const ctx = await requireAuth(req);
    if (isResponse(ctx)) return ctx;
    const profile = await getFacultyProfile(ctx);
    if (!profile) return errorResponse('Faculty profile not found', 404, 'not_found');
    if (profile.application_status !== 'Approved') {
      return errorResponse('Your application must be approved before you can submit attendance', 403, 'not_approved');
    }

    const parsed = markSchema.safeParse(await req.json());
    if (!parsed.success) return errorResponse(parsed.error.issues[0]?.message || 'Invalid attendance details');
    const d = parsed.data;

    const { data: schedule } = await ctx.client
      .from('schedules')
      .select('*, faculty_assignments!inner (id, faculty_id, semester_id, number_of_students, semesters (start_date, end_date, attendance_open, attendance_close, status))')
      .eq('id', d.schedule_id)
      .maybeSingle();
    if (!schedule) return errorResponse('Scheduled class not found', 404, 'not_found');
    const asg = schedule.faculty_assignments as unknown as { id: string; faculty_id: string; semester_id: string; number_of_students: number; semesters: { start_date: string; end_date: string; attendance_open: string; attendance_close: string; status: string } };
    if (asg.faculty_id !== profile.id) return errorResponse('This class is not assigned to you', 403, 'forbidden');
    if (schedule.status !== 'Active') return errorResponse('This class has been cancelled or rescheduled', 409, 'cancelled');

    const sem = asg.semesters;
    const scheduledDate = d.scheduled_date;
    if (scheduledDate < sem.attendance_open || scheduledDate > sem.attendance_close) {
      return errorResponse('The date falls outside the attendance window for this semester', 422, 'out_of_window');
    }
    if (scheduledDate < sem.start_date || scheduledDate > sem.end_date) {
      return errorResponse('The date falls outside the semester period', 422, 'out_of_semester');
    }
    const dow = new Date(scheduledDate + 'T00:00:00Z').getUTCDay();
    if (dow !== schedule.day_of_week) {
      return errorResponse('The date does not correspond to the official timetable for this class', 422, 'not_on_timetable');
    }
    if (scheduledDate < schedule.start_date || scheduledDate > schedule.end_date) {
      return errorResponse('The date falls outside the effective date range of this timetable entry', 422, 'outside_range');
    }

    const { data: dup } = await ctx.client
      .from('attendance_records')
      .select('id')
      .eq('assignment_id', asg.id)
      .eq('scheduled_date', scheduledDate)
      .maybeSingle();
    if (dup) return errorResponse('Attendance has already been submitted for this scheduled class', 409, 'duplicate');

    // Compare submitted details with the official timetable; mismatches are flagged for review
    const actualDate = d.actual_date || scheduledDate;
    const startTime = d.start_time || schedule.start_time;
    const endTime = d.end_time || schedule.end_time;
    const periods = d.number_of_periods || schedule.number_of_periods;
    let flagged = false;
    if (actualDate !== scheduledDate || startTime !== schedule.start_time || endTime !== schedule.end_time || periods > schedule.number_of_periods) {
      flagged = true;
    }

    const insert = {
      faculty_id: profile.id,
      assignment_id: asg.id,
      schedule_id: schedule.id,
      semester_id: asg.semester_id,
      scheduled_date: scheduledDate,
      actual_date: actualDate,
      start_time: startTime,
      end_time: endTime,
      number_of_periods: periods,
      number_of_students: d.number_of_students ?? asg.number_of_students,
      status: flagged ? 'Pending' : 'Submitted',
      remarks: flagged
        ? `Flagged for review: submitted details differ from the official timetable. ${d.remarks || ''}`.trim()
        : d.remarks || null,
    };
    const { data: record, error: insertError } = await ctx.client
      .from('attendance_records')
      .insert(insert)
      .select('*')
      .single();
    if (insertError) {
      if (String(insertError.message).includes('duplicate key')) {
        return errorResponse('Attendance has already been submitted for this scheduled class', 409, 'duplicate');
      }
      return errorResponse(insertError.message, 500, 'insert_failed');
    }
    await audit(ctx, 'attendance.submit', 'attendance_records', record.id, null, { scheduled_date: scheduledDate, status: record.status });
    return json(record);
  } catch (err) {
    return handleApiError(err);
  }
}
