import { NextRequest } from 'next/server';
import { requireAuth, json, errorResponse, handleApiError, isStaff, type AuthContext } from '@/lib/api-helpers';
import type { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase-server';
import { buildBillTracking } from '@/lib/bill-tracking';

function isResponse(v: AuthContext | NextResponse): v is NextResponse {
  return (v as NextResponse).status !== undefined;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const BILL_TRACK_SELECT =
  '*, faculty_profiles (id, user_id, full_name, designation, department_id, departments (name, code)), semesters (id, name, billing_deadline, deadline_time), bill_submissions (*), bill_approvals (*), physical_bill_receipts (*), payments (*)';

/**
 * GET /api/bills/track?q=<tracking_id | bill_id | receipt_number>
 * Returns full tracking status, stage progression, timeline, and contact department.
 * Without `q`, returns tracking summaries for all bills accessible to the user.
 */
export async function GET(req: NextRequest) {
  try {
    const ctx = await requireAuth(req);
    if (isResponse(ctx)) return ctx;

    const service = getServiceClient();
    const { searchParams } = new URL(req.url);
    const rawQuery = (searchParams.get('q') || '').trim();
    const staff = isStaff(ctx);

    if (!rawQuery) {
      let query = service
        .from('semester_bills')
        .select(BILL_TRACK_SELECT)
        .order('updated_at', { ascending: false });

      if (!staff) {
        const { data: prof } = await service.from('faculty_profiles').select('id').eq('user_id', ctx.userId).maybeSingle();
        if (!prof) return json([]);
        query = query.eq('faculty_id', prof.id);
      } else if (ctx.roles.includes('coordinator') && !ctx.roles.includes('super_admin') && ctx.departmentIds.length > 0) {
        const { data: deptFaculty } = await service
          .from('faculty_profiles')
          .select('id')
          .in('department_id', ctx.departmentIds);
        const ids = (deptFaculty || []).map((f: { id: string }) => f.id);
        if (ids.length === 0) return json([]);
        query = query.in('faculty_id', ids);
      }

      const { data, error } = await query;
      if (error) return errorResponse(error.message, 500, 'query_failed');
      return json((data || []).map((b: any) => buildBillTracking(b)));
    }

    // Lookup by UUID, bill_number (Tracking ID), or physical receipt/dispatch number
    let bill: any = null;
    if (UUID_REGEX.test(rawQuery)) {
      const { data } = await service.from('semester_bills').select(BILL_TRACK_SELECT).eq('id', rawQuery).maybeSingle();
      bill = data;
    }

    if (!bill) {
      const { data } = await service
        .from('semester_bills')
        .select(BILL_TRACK_SELECT)
        .ilike('bill_number', rawQuery)
        .maybeSingle();
      bill = data;
    }

    if (!bill) {
      const { data: receipt } = await service
        .from('physical_bill_receipts')
        .select('bill_id')
        .ilike('receipt_number', rawQuery)
        .maybeSingle();
      if (receipt?.bill_id) {
        const { data } = await service
          .from('semester_bills')
          .select(BILL_TRACK_SELECT)
          .eq('id', receipt.bill_id)
          .maybeSingle();
        bill = data;
      }
    }

    if (!bill) {
      return errorResponse(
        `No honorarium bill found for Tracking ID "${rawQuery}". Check the ID on your Bills page or printed form.`,
        404,
        'not_found'
      );
    }

    const fp = bill.faculty_profiles as { user_id?: string; department_id?: string | null } | undefined;
    const owns = fp?.user_id === ctx.userId;
    const coordinatorSameDept =
      ctx.roles.includes('coordinator') && fp?.department_id && ctx.departmentIds.includes(fp.department_id);
    if (!owns && !(staff && (!ctx.roles.includes('coordinator') || ctx.roles.includes('super_admin'))) && !coordinatorSameDept) {
      return errorResponse('You can only track your own honorarium bills', 403, 'forbidden');
    }

    return json(buildBillTracking(bill));
  } catch (err) {
    return handleApiError(err);
  }
}
