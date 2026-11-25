import { NextRequest } from 'next/server';
import { requireAuth, requireRole, json, errorResponse, handleApiError, audit, notify, isStaff, type AuthContext } from '@/lib/api-helpers';
import type { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase-server';
import { z } from 'zod';

function isResponse(v: AuthContext | NextResponse): v is NextResponse {
  return (v as NextResponse).status !== undefined;
}

const scheduleSchema = z.object({
  assignment_id: z.string().uuid(),
  day_of_week: z.number().int().min(0).max(6),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start_time: z.string().min(1),
  end_time: z.string().min(1),
  classroom: z.string().max(60).optional(),
  number_of_periods: z.number().int().min(1).max(12).default(1),
});

const updateSchema = z.object({
  schedule_id: z.string().uuid(),
  reason: z.string().min(5).max(500),
  effective_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  day_of_week: z.number().int().min(0).max(6).optional(),
  start_time: z.string().optional(),
  end_time: z.string().optional(),
  classroom: z.string().max(60).optional(),
  number_of_periods: z.number().int().min(1).max(12).optional(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireAuth(req);
    if (isResponse(ctx)) return ctx;
    const { searchParams } = new URL(req.url);
    const semesterId = searchParams.get('semester_id');
    const service = getServiceClient();

    // Faculty: own schedule only; staff: their departments or all
    let assignmentQuery = service
      .from('faculty_assignments')
      .select('id, faculty_id, semester_id, course_id, classification, courses (title, code), faculty_profiles (id, full_name), departments (name, code), semesters (id, name)');
    if (semesterId) assignmentQuery = assignmentQuery.eq('semester_id', semesterId);
    if (!isStaff(ctx)) {
      const { data: prof } = await service.from('faculty_profiles').select('id').eq('user_id', ctx.userId).maybeSingle();
      if (!prof) return json([]);
      assignmentQuery = assignmentQuery.eq('faculty_id', prof.id);
    } else if (ctx.departmentIds.length > 0 && !ctx.roles.includes('super_admin')) {
      assignmentQuery = assignmentQuery.in('department_id', ctx.departmentIds);
    }
    const { data: assignments } = await assignmentQuery.neq('status', 'Cancelled');
    const ids = (assignments || []).map((a) => a.id);
    if (ids.length === 0) return json([]);

    const { data: schedules } = await service
      .from('schedules')
      .select('*')
      .in('assignment_id', ids)
      .neq('status', 'Cancelled');
    return json(
      (schedules || []).map((s) => {
        const a = (assignments || []).find((x) => x.id === s.assignment_id);
        return { ...s, assignment: a };
      })
    );
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const staffCtx = await requireRole(req, ['super_admin', 'coordinator']);
    if (isResponse(staffCtx)) return staffCtx;
    const parsed = scheduleSchema.safeParse(await req.json());
    if (!parsed.success) return errorResponse(parsed.error.issues[0]?.message || 'Invalid schedule details');
    const d = parsed.data;
    if (d.start_date >= d.end_date) return errorResponse('The schedule end date must be after the start date');

    const service = getServiceClient();
    const { data: asg } = await service
      .from('faculty_assignments')
      .select('id, faculty_id, department_id, status, semesters (start_date, end_date), faculty_profiles (user_id), courses (title)')
      .eq('id', d.assignment_id)
      .maybeSingle();
    if (!asg) return errorResponse('Assignment not found', 404, 'not_found');
    if (asg.status !== 'Active') return errorResponse('Cannot schedule an inactive assignment', 409, 'inactive');
    const sem = asg.semesters as unknown as { start_date: string; end_date: string };
    if (d.start_date < sem.start_date || d.end_date > sem.end_date) {
      return errorResponse('Schedule dates must fall within the semester period', 422, 'out_of_semester');
    }

    // Conflict detection: same faculty, same day, overlapping time in an overlapping date range
    const { data: others } = await service
      .from('schedules')
      .select('*, faculty_assignments!inner (id, faculty_id)')
      .eq('faculty_assignments.faculty_id', asg.faculty_id)
      .eq('day_of_week', d.day_of_week)
      .eq('status', 'Active');
    for (const o of others || []) {
      const overlapsDate = d.start_date <= o.end_date && d.end_date >= o.start_date;
      const overlapsTime = d.start_time < o.end_time && d.end_time > o.start_time;
      if (overlapsDate && overlapsTime) {
        return errorResponse('This schedule conflicts with another class for the same faculty member', 409, 'conflict');
      }
    }

    const { data: created, error } = await service
      .from('schedules')
      .insert({ ...d, classroom: d.classroom || null })
      .select('*')
      .single();
    if (error) return errorResponse(error.message, 500, 'insert_failed');
    await audit(staffCtx, 'schedule.create', 'schedules', created.id, null, d);
    const fp = asg.faculty_profiles as unknown as { user_id: string } | null;
    if (fp?.user_id) {
      await notify(fp.user_id, 'Timetable entry created', `A schedule entry was added for ${(asg.courses as unknown as { title: string } | null)?.title || 'your course'}.`, 'Schedule', '/faculty/timetable');
    }
    return json(created);
  } catch (err) {
    return handleApiError(err);
  }
}

// Schedule change: preserve the old entry, record revision, notify faculty
export async function PATCH(req: NextRequest) {
  try {
    const staffCtx = await requireRole(req, ['super_admin', 'coordinator']);
    if (isResponse(staffCtx)) return staffCtx;
    const parsed = updateSchema.safeParse(await req.json());
    if (!parsed.success) return errorResponse(parsed.error.issues[0]?.message || 'Invalid schedule change');
    const d = parsed.data;
    const service = getServiceClient();

    const { data: schedule } = await service
      .from('schedules')
      .select('*, faculty_assignments (id, faculty_id, faculty_profiles (user_id), courses (title))')
      .eq('id', d.schedule_id)
      .maybeSingle();
    if (!schedule) return errorResponse('Schedule entry not found', 404, 'not_found');
    if (schedule.status !== 'Active') return errorResponse('Only active schedule entries can be changed', 409, 'invalid_state');

    const newValues = {
      day_of_week: d.day_of_week ?? schedule.day_of_week,
      start_time: d.start_time ?? schedule.start_time,
      end_time: d.end_time ?? schedule.end_time,
      classroom: d.classroom ?? schedule.classroom,
      number_of_periods: d.number_of_periods ?? schedule.number_of_periods,
      end_date: d.end_date ?? schedule.end_date,
    };

    // Keep history: mark the old row superseded and insert the changed one
    await service.from('schedules').update({ status: 'Superseded' }).eq('id', d.schedule_id);
    const { data: created, error } = await service
      .from('schedules')
      .insert({
        assignment_id: schedule.assignment_id,
        day_of_week: newValues.day_of_week,
        start_date: d.effective_from,
        end_date: newValues.end_date,
        start_time: newValues.start_time,
        end_time: newValues.end_time,
        classroom: newValues.classroom,
        number_of_periods: newValues.number_of_periods,
        status: 'Active',
        changed_by: staffCtx.userId,
        change_reason: d.reason,
        effective_from: d.effective_from,
      })
      .select('*')
      .single();
    if (error) {
      await service.from('schedules').update({ status: 'Active' }).eq('id', d.schedule_id);
      return errorResponse(error.message, 500, 'insert_failed');
    }
    await service.from('schedule_revisions').insert({
      schedule_id: d.schedule_id,
      previous_values: {
        day_of_week: schedule.day_of_week,
        start_date: schedule.start_date,
        end_date: schedule.end_date,
        start_time: schedule.start_time,
        end_time: schedule.end_time,
        classroom: schedule.classroom,
        number_of_periods: schedule.number_of_periods,
      } as never,
      new_values: newValues as never,
      reason: d.reason,
      changed_by: staffCtx.userId,
      effective_from: d.effective_from,
    });
    await audit(staffCtx, 'schedule.change', 'schedules', d.schedule_id, { day_of_week: schedule.day_of_week, start_time: schedule.start_time, end_time: schedule.end_time }, newValues, d.reason);
    const asg = schedule.faculty_assignments as { faculty_profiles: { user_id: string } | null; courses: { title: string } | null } | null;
    if (asg?.faculty_profiles?.user_id) {
      await notify(asg.faculty_profiles.user_id, 'Timetable changed', `Your schedule for ${asg.courses?.title || 'a course'} changed effective ${d.effective_from}. Reason: ${d.reason}`, 'Schedule', '/faculty/timetable');
    }
    return json(created);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const staffCtx = await requireRole(req, ['super_admin', 'coordinator']);
    if (isResponse(staffCtx)) return staffCtx;
    const { searchParams } = new URL(req.url);
    const scheduleId = searchParams.get('id');
    const reason = searchParams.get('reason');
    if (!scheduleId || !reason || reason.length < 5) return errorResponse('A reason of at least 5 characters is required to cancel a class');
    const service = getServiceClient();
    const { data: schedule } = await service.from('schedules').select('*, faculty_assignments (faculty_profiles (user_id))').eq('id', scheduleId).maybeSingle();
    if (!schedule) return errorResponse('Schedule entry not found', 404, 'not_found');
    const { error } = await service.from('schedules').update({ status: 'Cancelled', change_reason: reason, changed_by: staffCtx.userId }).eq('id', scheduleId);
    if (error) return errorResponse(error.message, 500, 'update_failed');
    await audit(staffCtx, 'schedule.cancel', 'schedules', scheduleId, { status: schedule.status }, { status: 'Cancelled' }, reason);
    const asg = schedule.faculty_assignments as { faculty_profiles: { user_id: string } | null } | null;
    if (asg?.faculty_profiles?.user_id) {
      await notify(asg.faculty_profiles.user_id, 'Class cancelled', `A timetable entry was cancelled. Reason: ${reason}`, 'Schedule', '/faculty/timetable');
    }
    return json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
