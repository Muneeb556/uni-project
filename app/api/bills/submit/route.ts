import { NextRequest } from 'next/server';
import { requireAuth, json, errorResponse, handleApiError, getFacultyProfile, audit, notify } from '@/lib/api-helpers';
import { getServiceClient } from '@/lib/supabase-server';
import { z } from 'zod';

const submitSchema = z.object({ bill_id: z.string().uuid() });

// Faculty submits the bill; backend enforces the deadline and validates amounts.
export async function POST(req: NextRequest) {
  try {
    const ctx = await requireAuth(req);
    if (ctx instanceof Response) return ctx;
    const profile = await getFacultyProfile(ctx);
    if (!profile) return errorResponse('Faculty profile not found', 404, 'not_found');
    const parsed = submitSchema.safeParse(await req.json());
    if (!parsed.success) return errorResponse('Bill id is required');
    const service = getServiceClient();

    const { data: bill } = await service
      .from('semester_bills')
      .select('*, semesters (name, billing_open, billing_deadline, deadline_time, timezone, extension_date)')
      .eq('id', parsed.data.bill_id)
      .maybeSingle();
    if (!bill) return errorResponse('Bill not found', 404, 'not_found');
    if (bill.faculty_id !== profile.id) return errorResponse('You can only submit your own bill', 403, 'forbidden');
    if (!['Draft', 'Changes Required', 'Accounts Returned'].includes(bill.status)) {
      return errorResponse(`A bill in status "${bill.status}" cannot be submitted`, 409, 'invalid_state');
    }

    const sem = bill.semesters as { name: string; billing_open: string; billing_deadline: string; deadline_time: string; timezone: string; extension_date: string | null };
    const effectiveDeadline = sem.extension_date || sem.billing_deadline;
    const now = new Date();
    const deadlineAt = new Date(`${effectiveDeadline}T${sem.deadline_time}:00`);
    const onTime = now.getTime() <= deadlineAt.getTime();

    // Server-side validation of the saved amounts against approved attendance
    const { data: approvedCount } = await service
      .from('attendance_records')
      .select('id, number_of_periods')
      .eq('faculty_id', profile.id)
      .eq('semester_id', bill.semester_id)
      .eq('status', 'Approved');
    const approvedPeriods = (approvedCount || []).reduce((s, a) => s + (a.number_of_periods || 0), 0);
    if (bill.theory_periods + bill.practical_periods > approvedPeriods) {
      return errorResponse('Bill periods exceed the approved attendance record; regenerate the bill', 422, 'periods_mismatch');
    }
    const recomputedTotal = bill.theory_amount + bill.practical_amount;
    if (Math.abs(recomputedTotal - bill.total_amount) > 1) {
      return errorResponse('Bill totals do not match the recorded rates; regenerate the bill', 422, 'amount_mismatch');
    }

    if (!onTime) {
      // Late submission: recorded and rejected automatically with full trace
      const { error: statusError } = await service
        .from('semester_bills')
        .update({ status: 'Late Rejected', updated_at: new Date().toISOString() })
        .eq('id', bill.id);
      if (statusError) return errorResponse(statusError.message, 500, 'update_failed');
      await service.from('bill_submissions').insert({
        bill_id: bill.id,
        submitted_by: ctx.userId,
        submitted_at: now.toISOString(),
        on_time: false,
        deadline_at: deadlineAt.toISOString(),
        remarks: 'Submitted after the deadline; automatically rejected.',
      });
      await service.from('bill_approvals').insert({
        bill_id: bill.id,
        actor_id: ctx.userId,
        actor_role: 'faculty',
        action: 'Late Rejected',
        from_status: bill.status,
        to_status: 'Late Rejected',
        remarks: `Attempted submission at ${now.toISOString()} after deadline ${deadlineAt.toISOString()}`,
      });
      await audit(ctx, 'bill.submit.late', 'semester_bills', bill.id, { status: bill.status }, { status: 'Late Rejected' }, 'Late submission auto-rejected');
      await notify(ctx.userId, 'Bill rejected: late submission', `Your bill for ${sem.name} was submitted after the deadline and has been recorded as Late Rejected.`, 'Billing', '/faculty/bills');
      return errorResponse(`The submission deadline for ${sem.name} was ${effectiveDeadline} ${sem.deadline_time} (${sem.timezone}). Your bill has been recorded as Late Rejected.`, 422, 'late_rejected');
    }

    const { error: updError } = await service
      .from('semester_bills')
      .update({ status: 'Submitted', updated_at: new Date().toISOString() })
      .eq('id', bill.id);
    if (updError) return errorResponse(updError.message, 500, 'update_failed');
    await service.from('bill_submissions').insert({
      bill_id: bill.id,
      submitted_by: ctx.userId,
      submitted_at: now.toISOString(),
      on_time: true,
      deadline_at: deadlineAt.toISOString(),
    });
    await service.from('bill_approvals').insert({
      bill_id: bill.id,
      actor_id: ctx.userId,
      actor_role: 'faculty',
      action: 'Submitted',
      from_status: bill.status,
      to_status: 'Submitted',
    });
    await audit(ctx, 'bill.submit', 'semester_bills', bill.id, { status: bill.status }, { status: 'Submitted' });
    await notify(ctx.userId, 'Bill submitted', `Your Teaching Honorarium bill for ${sem.name} was submitted on time and is awaiting department review.`, 'Billing', '/faculty/bills');

    // Notify coordinator(s) of the department
    const { data: profileRow } = await service.from('faculty_profiles').select('department_id').eq('id', profile.id).maybeSingle();
    if (profileRow?.department_id) {
      const { data: coords } = await service.from('user_roles').select('user_id').eq('role', 'coordinator').eq('department_id', profileRow.department_id);
      for (const c of coords || []) {
        await notify(c.user_id, 'Bill awaiting department review', `A Teaching Honorarium bill was submitted and awaits your review.`, 'Billing', '/department/bills');
      }
    }
    return json({ ok: true, status: 'Submitted', on_time: true });
  } catch (err) {
    return handleApiError(err);
  }
}
