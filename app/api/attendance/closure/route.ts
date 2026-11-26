import { NextRequest } from 'next/server';
import { requireAuth, requireRole, json, errorResponse, handleApiError, getFacultyProfile, audit, notify, isStaff, type AuthContext } from '@/lib/api-helpers';
import type { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase-server';
import { z } from 'zod';

function isResponse(v: AuthContext | NextResponse): v is NextResponse {
  return (v as NextResponse).status !== undefined;
}

// GET: semester attendance closure statement (faculty own, staff all for a semester)
export async function GET(req: NextRequest) {
  try {
    const ctx = await requireAuth(req);
    if (isResponse(ctx)) return ctx;
    const service = getServiceClient();
    const { searchParams } = new URL(req.url);
    const semesterId = searchParams.get('semester_id');
    if (isStaff(ctx)) {
      let q = service
        .from('semester_attendance_closures')
        .select('*, faculty_profiles (full_name, user_id), semesters (name)');
      if (semesterId) {
        q = (q as any).eq('semester_id', semesterId);
      }
      const { data } = await (q as any).order('created_at', { ascending: false });
      return json(data || []);
    }
    const profile = await getFacultyProfile(ctx);
    if (!profile) return json(null);
    let q = ctx.client.from('semester_attendance_closures').select('*').eq('faculty_id', profile.id);
    if (semesterId) {
      q = q.eq('semester_id', semesterId);
    } else {
      q = q.order('created_at', { ascending: false }).limit(1);
    }
    const { data } = await q.maybeSingle();
    return json(data);
  } catch (err) {
    return handleApiError(err);
  }
}

// POST: faculty submits final attendance statement
const submitSchema = z.object({
  semester_id: z.string().uuid(),
  total_periods: z.number().int().min(0),
  total_hours: z.number().min(0),
});

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireAuth(req);
    if (isResponse(ctx)) return ctx;
    const profile = await getFacultyProfile(ctx);
    if (!profile) return errorResponse('Faculty profile not found', 404, 'not_found');
    if (profile.application_status !== 'Approved') return errorResponse('Your application must be approved first', 403, 'not_approved');
    const parsed = submitSchema.safeParse(await req.json());
    if (!parsed.success) return errorResponse('Invalid statement details');
    const service = getServiceClient();

    const { data: existing } = await service
      .from('semester_attendance_closures')
      .select('*')
      .eq('faculty_id', profile.id)
      .eq('semester_id', parsed.data.semester_id)
      .maybeSingle();
    if (existing && ['Locked'].includes(existing.statement_status)) {
      return errorResponse('Your attendance statement is locked', 409, 'locked');
    }
    if (existing && ['Submitted', 'Verified'].includes(existing.statement_status)) {
      return errorResponse('Your statement has already been submitted and is awaiting verification', 409, 'already_submitted');
    }

    const values = {
      faculty_id: profile.id,
      semester_id: parsed.data.semester_id,
      total_periods: parsed.data.total_periods,
      total_hours: parsed.data.total_hours,
      statement_status: 'Submitted',
      submitted_by: ctx.userId,
    };
    const { data, error } = await service
      .from('semester_attendance_closures')
      .upsert(values, { onConflict: 'faculty_id,semester_id' })
      .select('*')
      .single();
    if (error) return errorResponse(error.message, 500, 'upsert_failed');
    await audit(ctx, 'attendance.statement.submit', 'semester_attendance_closures', data.id, existing, values);
    return json(data);
  } catch (err) {
    return handleApiError(err);
  }
}

// PATCH: coordinator verifies and locks the statement
const verifySchema = z.object({
  closure_id: z.string().uuid(),
  lock: z.boolean().default(true),
});

export async function PATCH(req: NextRequest) {
  try {
    const staffCtx = await requireRole(req, ['super_admin', 'coordinator']);
    if (isResponse(staffCtx)) return staffCtx;
    const parsed = verifySchema.safeParse(await req.json());
    if (!parsed.success) return errorResponse('Invalid verification details');
    const service = getServiceClient();
    const { data: closure } = await service
      .from('semester_attendance_closures')
      .select('*, faculty_profiles (user_id, full_name)')
      .eq('id', parsed.data.closure_id)
      .maybeSingle();
    if (!closure) return errorResponse('Statement not found', 404, 'not_found');
    if (closure.statement_status === 'Locked') return errorResponse('Statement is already locked', 409, 'locked');

    const newStatus = parsed.data.lock ? 'Locked' : 'Verified';
    const { error } = await service
      .from('semester_attendance_closures')
      .update({ statement_status: newStatus, verified_by: staffCtx.userId, locked_at: parsed.data.lock ? new Date().toISOString() : null })
      .eq('id', parsed.data.closure_id);
    if (error) return errorResponse(error.message, 500, 'update_failed');
    await audit(staffCtx, 'attendance.statement.verify', 'semester_attendance_closures', parsed.data.closure_id, { statement_status: closure.statement_status }, { statement_status: newStatus });
    const fp = closure.faculty_profiles as { user_id: string } | null;
    if (fp?.user_id) {
      await notify(fp.user_id, `Attendance statement ${newStatus.toLowerCase()}`, 'Your final attendance statement has been processed by the department.', 'Attendance', '/faculty/attendance');
    }
    return json({ ok: true, status: newStatus });
  } catch (err) {
    return handleApiError(err);
  }
}
