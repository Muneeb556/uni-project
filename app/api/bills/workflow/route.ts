import { NextRequest } from 'next/server';
import { requireAuth, requireRole, json, errorResponse, handleApiError, getFacultyProfile, isStaff, audit, notify, type AuthContext } from '@/lib/api-helpers';
import type { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase-server';
import { z } from 'zod';

function isResponse(v: AuthContext | NextResponse): v is NextResponse {
  return (v as NextResponse).status !== undefined;
}

// Workflow transitions. Every transition checks the actor's role and current status.
const actionSchema = z.object({
  bill_id: z.string().uuid(),
  action: z.enum([
    'start_review',
    'approve_department',
    'request_changes',
    'reject',
    'receive_physical',
    'accounts_verify',
    'accounts_return',
    'forward_final',
    'approve_payment',
    'reject_final',
    'process_payment',
  ]),
  remarks: z.string().max(1000).optional(),
  receipt_number: z.string().max(60).optional(),
  dispatch_number: z.string().max(60).optional(),
});

const TRANSITIONS: Record<string, { from: string[]; roles: string[]; to: string }> = {
  start_review: { from: ['Submitted'], roles: ['coordinator', 'super_admin'], to: 'Under Review' },
  approve_department: { from: ['Under Review'], roles: ['coordinator', 'super_admin'], to: 'Department Approved' },
  request_changes: { from: ['Submitted', 'Under Review'], roles: ['coordinator', 'super_admin', 'accounts'], to: 'Changes Required' },
  reject: { from: ['Submitted', 'Under Review', 'Department Approved'], roles: ['coordinator', 'super_admin'], to: 'Rejected' },
  receive_physical: { from: ['Department Approved', 'Sent to Accounts'], roles: ['accounts', 'super_admin'], to: 'Physical Bill Received' },
  accounts_verify: { from: ['Physical Bill Received', 'Accounts Review'], roles: ['accounts', 'super_admin'], to: 'Accounts Verified' },
  accounts_return: { from: ['Physical Bill Received', 'Accounts Review', 'Accounts Verified'], roles: ['accounts', 'super_admin'], to: 'Accounts Returned' },
  forward_final: { from: ['Accounts Verified'], roles: ['accounts', 'super_admin'], to: 'Awaiting Final Approval' },
  approve_payment: { from: ['Awaiting Final Approval'], roles: ['approver', 'super_admin'], to: 'Approved for Payment' },
  reject_final: { from: ['Awaiting Final Approval'], roles: ['approver', 'super_admin'], to: 'Rejected' },
  process_payment: { from: ['Approved for Payment'], roles: ['accounts', 'super_admin'], to: 'Payment Processing' },
};

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireAuth(req);
    if (isResponse(ctx)) return ctx;
    const parsed = actionSchema.safeParse(await req.json());
    if (!parsed.success) return errorResponse('Invalid workflow action');
    const { bill_id, action, remarks } = parsed.data;
    const t = TRANSITIONS[action];
    if (!t) return errorResponse('Unknown action');

    if (!ctx.roles.some((r) => t.roles.includes(r))) {
      return errorResponse('Your role is not authorized for this action', 403, 'forbidden');
    }
    if (ctx.roles.includes('faculty') && ctx.roles.length === 1) {
      return errorResponse('Faculty cannot approve their own bills', 403, 'forbidden');
    }

    const service = getServiceClient();
    const { data: bill } = await service
      .from('semester_bills')
      .select('*, faculty_profiles (user_id, full_name, department_id)')
      .eq('id', bill_id)
      .maybeSingle();
    if (!bill) return errorResponse('Bill not found', 404, 'not_found');
    const fp = bill.faculty_profiles as { user_id: string; department_id: string | null };

    if (ctx.roles.includes('coordinator') && !ctx.roles.includes('super_admin')) {
      if (!fp.department_id || !ctx.departmentIds.includes(fp.department_id)) {
        return errorResponse('This bill belongs to another department', 403, 'forbidden');
      }
    }
    if (fp.user_id === ctx.userId && action !== 'start_review') {
      return errorResponse('You cannot act on your own bill', 403, 'forbidden');
    }
    if (!t.from.includes(bill.status)) {
      return errorResponse(`This action is not allowed while the bill is in status "${bill.status}"`, 409, 'invalid_transition');
    }

    const newStatus = t.to;
    const { error } = await service
      .from('semester_bills')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', bill_id);
    if (error) return errorResponse(error.message, 500, 'update_failed');

    if (action === 'receive_physical' && parsed.data.receipt_number) {
      await service.from('physical_bill_receipts').insert({
        bill_id,
        receipt_number: parsed.data.receipt_number,
        dispatch_number: parsed.data.dispatch_number || null,
        received_by: ctx.userId,
        remarks: remarks || null,
      });
    }
    await service.from('bill_approvals').insert({
      bill_id,
      actor_id: ctx.userId,
      actor_role: ctx.roles[0] || 'staff',
      action: newStatus,
      from_status: bill.status,
      to_status: newStatus,
      remarks: remarks || null,
    });
    await audit(ctx, `bill.${action}`, 'semester_bills', bill_id, { status: bill.status }, { status: newStatus }, remarks);

    const linkForRole = ctx.roles.includes('faculty') ? '/faculty/bills' : '/faculty/bills';
    await notify(fp.user_id, `Bill status: ${newStatus}`, remarks || `Your Teaching Honorarium bill moved to "${newStatus}".`, 'Billing', linkForRole);
    return json({ ok: true, status: newStatus });
  } catch (err) {
    return handleApiError(err);
  }
}
