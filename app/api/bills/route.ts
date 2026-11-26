import { NextRequest } from 'next/server';
import { requireAuth, json, errorResponse, handleApiError, isStaff, type AuthContext } from '@/lib/api-helpers';
import type { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase-server';

function isResponse(v: AuthContext | NextResponse): v is NextResponse {
  return (v as NextResponse).status !== undefined;
}

// GET /api/bills?id=... or list; faculty own, staff all (with filters)
export async function GET(req: NextRequest) {
  try {
    const ctx = await requireAuth(req);
    if (isResponse(ctx)) return ctx;
    const service = getServiceClient();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const status = searchParams.get('status');
    const semesterId = searchParams.get('semester_id');

    if (id) {
      const { data: bill, error: billError } = await service
        .from('semester_bills')
        .select('*, faculty_profiles (id, user_id, full_name, designation, grade, department_id, cnic, bank_account_number, bank_name, university_branch, departments (name, code)), semesters (id, name, start_date, end_date, billing_deadline), bill_items (*), bill_approvals (*), physical_bill_receipts (*), payments (*)')
        .eq('id', id)
        .maybeSingle();
      if (billError) return errorResponse(billError.message, 500, 'query_failed');
      if (!bill) return errorResponse('Bill not found', 404, 'not_found');
      const fp = bill.faculty_profiles as { user_id: string; department_id: string | null } | undefined;
      const owns = fp?.user_id === ctx.userId;
      const staff = isStaff(ctx);
      const coordinatorSameDept = ctx.roles.includes('coordinator') && fp?.department_id && ctx.departmentIds.includes(fp.department_id);
      if (!owns && !staff && !coordinatorSameDept) return errorResponse('You do not have access to this bill', 403, 'forbidden');
      return json(bill);
    }

    let query = service
      .from('semester_bills')
      .select('*, faculty_profiles (id, user_id, full_name, departments (name, code)), semesters (id, name, billing_deadline)')
      .order('updated_at', { ascending: false });
    if (!isStaff(ctx)) {
      const { data: prof } = await service.from('faculty_profiles').select('id').eq('user_id', ctx.userId).maybeSingle();
      if (!prof) return json([]);
      query = query.eq('faculty_id', prof.id);
    } else if (ctx.roles.includes('coordinator') && !ctx.roles.includes('super_admin') && ctx.departmentIds.length > 0) {
      // For coordinators, filter by their department's faculty profiles
      const { data: deptFaculty } = await service
        .from('faculty_profiles')
        .select('id')
        .in('department_id', ctx.departmentIds);
      const deptFacultyIds = (deptFaculty || []).map((f: { id: string }) => f.id);
      if (deptFacultyIds.length > 0) {
        query = query.in('faculty_id', deptFacultyIds);
      } else {
        return json([]);
      }
    }
    if (status) query = query.eq('status', status);
    if (semesterId) query = query.eq('semester_id', semesterId);
    const { data, error } = await query;
    if (error) return errorResponse(error.message, 500, 'query_failed');
    return json(data || []);
  } catch (err) {
    return handleApiError(err);
  }
}
