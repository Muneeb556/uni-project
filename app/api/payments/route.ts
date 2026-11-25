import { NextRequest } from 'next/server';
import { requireRole, requireAuth, json, errorResponse, handleApiError, audit, notify, getFacultyProfile, type AuthContext } from '@/lib/api-helpers';
import type { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase-server';
import { z } from 'zod';

function isResponse(v: AuthContext | NextResponse): v is NextResponse {
  return (v as NextResponse).status !== undefined;
}

// POST /api/payments — accounts records a payment against an approved bill
const paymentSchema = z.object({
  bill_id: z.string().uuid(),
  paid_amount: z.number().min(1),
  payment_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  payment_method: z.enum(['Bank Transfer', 'Cheque', 'Cash']).default('Bank Transfer'),
  reference_number: z.string().max(60).optional(),
  remarks: z.string().max(500).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireRole(req, ['accounts', 'super_admin']);
    if (isResponse(ctx)) return ctx;
    const parsed = paymentSchema.safeParse(await req.json());
    if (!parsed.success) return errorResponse(parsed.error.issues[0]?.message || 'Invalid payment details');
    const d = parsed.data;
    const service = getServiceClient();

    const { data: bill } = await service
      .from('semester_bills')
      .select('*, faculty_profiles (user_id, full_name)')
      .eq('id', d.bill_id)
      .maybeSingle();
    if (!bill) return errorResponse('Bill not found', 404, 'not_found');
    if (!['Approved for Payment', 'Payment Processing', 'Partially Paid'].includes(bill.status)) {
      return errorResponse(`Payments can only be recorded against approved bills (current status: ${bill.status})`, 409, 'invalid_state');
    }

    const { data: existingPayments } = await service.from('payments').select('id, paid_amount').eq('bill_id', d.bill_id);
    const alreadyPaid = (existingPayments || []).reduce((s, p) => s + (p.paid_amount || 0), 0);
    const outstanding = bill.grand_total - alreadyPaid;
    if (d.paid_amount > outstanding + 0.5) {
      return errorResponse(`Paid amount exceeds the outstanding balance of ${Math.round(outstanding)}`, 422, 'overpayment');
    }

    const fullyPaid = alreadyPaid + d.paid_amount >= bill.grand_total - 0.5;
    const paymentStatus = fullyPaid ? 'Completed' : 'Partial';

    const { data: payment, error: payError } = await service
      .from('payments')
      .insert({
        bill_id: d.bill_id,
        faculty_id: bill.faculty_id,
        approved_amount: bill.grand_total,
        paid_amount: d.paid_amount,
        payment_date: d.payment_date,
        payment_method: d.payment_method,
        reference_number: d.reference_number || null,
        remarks: d.remarks || null,
        status: paymentStatus,
        recorded_by: ctx.userId,
      })
      .select('*')
      .single();
    if (payError) return errorResponse(payError.message, 500, 'insert_failed');

    await service.from('payment_transactions').insert({
      payment_id: payment.id,
      bill_id: d.bill_id,
      transaction_type: 'Payment',
      amount: d.paid_amount,
      reference_number: d.reference_number || null,
      remarks: d.remarks || null,
      recorded_by: ctx.userId,
    });

    const newBillStatus = fullyPaid ? 'Paid' : 'Partially Paid';
    await service.from('semester_bills').update({ status: newBillStatus, updated_at: new Date().toISOString() }).eq('id', d.bill_id);
    await service.from('bill_approvals').insert({
      bill_id: d.bill_id,
      actor_id: ctx.userId,
      actor_role: 'accounts',
      action: newBillStatus,
      from_status: bill.status,
      to_status: newBillStatus,
      remarks: `Payment of ${d.paid_amount} recorded (${d.payment_method})${d.reference_number ? `, ref ${d.reference_number}` : ''}`,
    });
    await audit(ctx, 'payment.record', 'payments', payment.id, null, { bill_id: d.bill_id, amount: d.paid_amount, status: paymentStatus });
    const fp = bill.faculty_profiles as { user_id: string };
    await notify(fp.user_id, `Payment ${fullyPaid ? 'completed' : 'received (partial)'}`, fullyPaid
      ? `Your honorarium payment of ${d.paid_amount} has been completed.`
      : `A partial payment of ${d.paid_amount} was recorded against your bill.`, 'Payment', '/faculty/payments');
    return json(payment);
  } catch (err) {
    return handleApiError(err);
  }
}

// GET /api/payments — history (faculty own, staff all)
export async function GET(req: NextRequest) {
  try {
    const ctx = await requireAuth(req);
    if (isResponse(ctx)) return ctx;
    const service = getServiceClient();
    let query = service
      .from('payments')
      .select('*, semester_bills (id, bill_number, grand_total, semesters (name)), faculty_profiles (id, user_id, full_name)')
      .order('payment_date', { ascending: false });
    const { searchParams } = new URL(req.url);
    const billId = searchParams.get('bill_id');
    if (billId) query = query.eq('bill_id', billId);
    const profile = await getFacultyProfile(ctx);
    if (profile && !ctx.roles.some((r) => r !== 'faculty')) {
      query = query.eq('faculty_id', profile.id);
    }
    const { data, error } = await query;
    if (error) return errorResponse(error.message, 500, 'query_failed');
    return json(data || []);
  } catch (err) {
    return handleApiError(err);
  }
}
