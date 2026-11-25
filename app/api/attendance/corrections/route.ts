import { NextRequest } from 'next/server';
import { requireAuth, requireRole, json, errorResponse, handleApiError, isStaff, getFacultyProfile, audit, notify, type AuthContext } from '@/lib/api-helpers';
import type { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase-server';
import { z } from 'zod';

function isResponse(v: AuthContext | NextResponse): v is NextResponse {
  return (v as NextResponse).status !== undefined;
}

// Faculty: create correction request. Coordinator/admin: review it.
const requestSchema = z.object({
  attendance_id: z.string().uuid(),
  reason: z.string().min(5).max(500),
  requested_changes: z.record(z.string(), z.unknown()).default({}),
});

const reviewSchema = z.object({
  request_id: z.string().uuid(),
  approve: z.boolean(),
  review_remarks: z.string().max(500).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireAuth(req);
    if (isResponse(ctx)) return ctx;
    if (isStaff(ctx)) {
      const service = getServiceClient();
      const { data } = await service
        .from('attendance_correction_requests')
        .select('*, attendance_records (scheduled_date, start_time, end_time, number_of_periods, status), faculty_profiles (full_name)')
        .eq('status', 'Pending')
        .order('created_at', { ascending: false });
      return json(data || []);
    }
    const profile = await getFacultyProfile(ctx);
    if (!profile) return json([]);
    const { data } = await ctx.client
      .from('attendance_correction_requests')
      .select('*, attendance_records (scheduled_date, start_time, end_time, number_of_periods, status)')
      .eq('faculty_id', profile.id)
      .order('created_at', { ascending: false });
    return json(data || []);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireAuth(req);
    if (isResponse(ctx)) return ctx;
    const body = await req.json();

    if ('request_id' in body) {
      const staffCtx = await requireRole(req, ['super_admin', 'coordinator']);
      if (isResponse(staffCtx)) return staffCtx;
      const parsed = reviewSchema.safeParse(body);
      if (!parsed.success) return errorResponse('Invalid review details');
      const service = getServiceClient();
      const { data: cr } = await service.from('attendance_correction_requests').select('*, attendance_records (id, faculty_id, scheduled_date, start_time, end_time, number_of_periods, status)').eq('id', parsed.data.request_id).maybeSingle();
      if (!cr) return errorResponse('Correction request not found', 404, 'not_found');
      if (cr.status !== 'Pending') return errorResponse('This request has already been reviewed', 409, 'already_reviewed');

      if (parsed.data.approve) {
        const changes = (cr.requested_changes || {}) as Record<string, unknown>;
        const att = cr.attendance_records as { id: string; status: string; start_time: string; end_time: string; number_of_periods: number };
        if (att.status === 'Approved') {
          return errorResponse('Approved attendance can only be changed through an authorized administrative revision', 409, 'locked');
        }
        const update: Record<string, unknown> = { status: 'Approved', reviewed_by: staffCtx.userId, reviewed_at: new Date().toISOString() };
        for (const k of ['start_time', 'end_time', 'number_of_periods', 'actual_date', 'remarks']) {
          if (changes[k] !== undefined) update[k] = changes[k];
        }
        const { error: updError } = await service.from('attendance_records').update(update).eq('id', att.id);
        if (updError) return errorResponse(updError.message, 500, 'update_failed');
      }
      const { error } = await service
        .from('attendance_correction_requests')
        .update({ status: parsed.data.approve ? 'Approved' : 'Rejected', reviewed_by: staffCtx.userId, review_remarks: parsed.data.review_remarks || null })
        .eq('id', parsed.data.request_id);
      if (error) return errorResponse(error.message, 500, 'update_failed');

      await audit(staffCtx, 'attendance.correction.review', 'attendance_correction_requests', parsed.data.request_id, { status: 'Pending' }, { status: parsed.data.approve ? 'Approved' : 'Rejected' }, parsed.data.review_remarks);
      const { data: fp } = await service.from('faculty_profiles').select('user_id').eq('id', cr.faculty_id).maybeSingle();
      if (fp?.user_id) {
        await notify(fp.user_id, `Correction request ${parsed.data.approve ? 'approved' : 'rejected'}`, parsed.data.review_remarks || 'Your attendance correction request has been reviewed.', 'Attendance', '/faculty/attendance');
      }
      return json({ ok: true });
    }

    const profile = await getFacultyProfile(ctx);
    if (!profile) return errorResponse('Faculty profile not found', 404, 'not_found');
    if (profile.application_status !== 'Approved') return errorResponse('Your application must be approved first', 403, 'not_approved');
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) return errorResponse('Please provide a reason of at least 5 characters');
    const service = getServiceClient();
    const { data: att } = await service.from('attendance_records').select('id, faculty_id, status').eq('id', parsed.data.attendance_id).maybeSingle();
    if (!att || att.faculty_id !== profile.id) return errorResponse('Attendance record not found', 404, 'not_found');
    if (att.status === 'Approved') return errorResponse('Approved attendance cannot be edited directly; an authorized administrator must intervene', 409, 'approved_locked');

    const { data: dupPending } = await service
      .from('attendance_correction_requests')
      .select('id')
      .eq('attendance_id', parsed.data.attendance_id)
      .eq('status', 'Pending')
      .maybeSingle();
    if (dupPending) return errorResponse('A correction request for this record is already pending review', 409, 'duplicate');

    const { data: created, error } = await service
      .from('attendance_correction_requests')
      .insert({ attendance_id: parsed.data.attendance_id, faculty_id: profile.id, reason: parsed.data.reason, requested_changes: parsed.data.requested_changes as never })
      .select('*')
      .single();
    if (error) return errorResponse(error.message, 500, 'insert_failed');
    await audit(ctx, 'attendance.correction.request', 'attendance_correction_requests', created.id, null, { attendance_id: parsed.data.attendance_id }, parsed.data.reason);
    return json(created);
  } catch (err) {
    return handleApiError(err);
  }
}

// Coordinator approves/rejects submitted attendance rows directly
const reviewAttSchema = z.object({
  attendance_id: z.string().uuid(),
  decision: z.enum(['Approved', 'Rejected', 'Correction Required']),
  remarks: z.string().max(500).optional(),
});

export async function PATCH(req: NextRequest) {
  try {
    const staffCtx = await requireRole(req, ['super_admin', 'coordinator']);
    if (isResponse(staffCtx)) return staffCtx;
    const parsed = reviewAttSchema.safeParse(await req.json());
    if (!parsed.success) return errorResponse('Invalid review details');
    const service = getServiceClient();
    const { data: att } = await service.from('attendance_records').select('*, faculty_profiles (user_id, full_name)').eq('id', parsed.data.attendance_id).maybeSingle();
    if (!att) return errorResponse('Attendance record not found', 404, 'not_found');
    if (!['Submitted', 'Pending', 'Correction Required'].includes(att.status)) {
      return errorResponse(`Attendance in status "${att.status}" cannot be reviewed`, 409, 'invalid_state');
    }
    const { error } = await service
      .from('attendance_records')
      .update({ status: parsed.data.decision, remarks: parsed.data.remarks || att.remarks, reviewed_by: staffCtx.userId, reviewed_at: new Date().toISOString() })
      .eq('id', parsed.data.attendance_id);
    if (error) return errorResponse(error.message, 500, 'update_failed');
    await audit(staffCtx, 'attendance.review', 'attendance_records', att.id, { status: att.status }, { status: parsed.data.decision }, parsed.data.remarks);
    const fp = att.faculty_profiles as { user_id: string } | null;
    if (fp?.user_id) {
      await notify(fp.user_id, `Attendance ${parsed.data.decision === 'Approved' ? 'approved' : parsed.data.decision === 'Rejected' ? 'rejected' : 'needs correction'}`, parsed.data.remarks || `Your attendance for ${att.scheduled_date} was reviewed.`, 'Attendance', '/faculty/attendance');
    }
    return json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
