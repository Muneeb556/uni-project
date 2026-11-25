import { NextRequest } from 'next/server';
import { requireRole, json, handleApiError } from '@/lib/api-helpers';
import { getServiceClient } from '@/lib/supabase-server';

// Aggregate reports for staff portals (JSON; the UI renders tables and charts)
export async function GET(req: NextRequest) {
  try {
    const ctx = await requireRole(req, ['super_admin', 'coordinator', 'accounts', 'approver']);
    if (ctx instanceof Response) return ctx;
    const service = getServiceClient();
    const { searchParams } = new URL(req.url);
    const semesterId = searchParams.get('semester_id');

    let billQuery = service
      .from('semester_bills')
      .select('id, status, grand_total, theory_periods, practical_periods, faculty_id, faculty_profiles (full_name, departments (name)), semesters (id, name)');
    if (semesterId) billQuery = billQuery.eq('semester_id', semesterId);
    const { data: bills } = await billQuery;

    let attQuery = service
      .from('attendance_records')
      .select('id, status, number_of_periods, faculty_id, faculty_profiles (full_name), faculty_assignments (courses (code, title))');
    if (semesterId) attQuery = attQuery.eq('semester_id', semesterId);
    const { data: attendance } = await attQuery;

    const { data: facultyByDept } = await service
      .from('faculty_profiles')
      .select('id, application_status, departments (name)');

    const deptMap = new Map<string, { department: string; faculty: number; approved: number; bills: number; submitted: number; approvedAmount: number; paidAmount: number }>();
    for (const f of facultyByDept || []) {
      const dept = (f.departments as unknown as { name: string } | null)?.name || 'Unassigned';
      const e = deptMap.get(dept) || { department: dept, faculty: 0, approved: 0, bills: 0, submitted: 0, approvedAmount: 0, paidAmount: 0 };
      e.faculty += 1;
      if (f.application_status === 'Approved') e.approved += 1;
      deptMap.set(dept, e);
    }
    for (const b of bills || []) {
      const fp = b.faculty_profiles as unknown as { full_name: string; departments: { name: string } | null } | null;
      const dept = fp?.departments?.name || 'Unassigned';
      const e = deptMap.get(dept) || { department: dept, faculty: 0, approved: 0, bills: 0, submitted: 0, approvedAmount: 0, paidAmount: 0 };
      e.bills += 1;
      e.submitted += b.grand_total || 0;
      if (['Paid', 'Partially Paid'].includes(b.status)) e.paidAmount += b.grand_total || 0;
      deptMap.set(dept, e);
    }

    const statusCounts: Record<string, number> = {};
    for (const b of bills || []) statusCounts[b.status] = (statusCounts[b.status] || 0) + 1;

    const attStatusCounts: Record<string, number> = {};
    let deliveredPeriods = 0;
    for (const a of attendance || []) {
      attStatusCounts[a.status] = (attStatusCounts[a.status] || 0) + 1;
      if (a.status === 'Approved') deliveredPeriods += a.number_of_periods || 0;
    }

    return json({
      financial: {
        totals: {
          submittedAmount: (bills || []).reduce((s, b) => s + (b.grand_total || 0), 0),
          paidAmount: (bills || []).filter((b) => ['Paid', 'Partially Paid'].includes(b.status)).reduce((s, b) => s + (b.grand_total || 0), 0),
          outstandingAmount: (bills || []).filter((b) => ['Approved for Payment', 'Payment Processing', 'Partially Paid'].includes(b.status)).reduce((s, b) => s + (b.grand_total || 0), 0),
          billCount: (bills || []).length,
        },
        byStatus: statusCounts,
        byDepartment: Array.from(deptMap.values()),
        bills: (bills || []).map((b) => ({
          id: b.id,
          faculty: (b.faculty_profiles as unknown as { full_name: string } | null)?.full_name,
          semester: (b.semesters as unknown as { name: string } | null)?.name,
          status: b.status,
          grand_total: b.grand_total,
        })),
      },
      attendance: {
        byStatus: attStatusCounts,
        totalApprovedPeriods: deliveredPeriods,
        approvedHours: Math.round(deliveredPeriods * 1.5 * 10) / 10,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
