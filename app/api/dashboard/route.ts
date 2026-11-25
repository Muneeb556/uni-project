import { NextRequest } from 'next/server';
import { requireAuth, json, handleApiError, isStaff, getFacultyProfile, type AuthContext } from '@/lib/api-helpers';
import type { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase-server';

function isResponse(v: AuthContext | NextResponse): v is NextResponse {
  return (v as NextResponse).status !== undefined;
}

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireAuth(req);
    if (isResponse(ctx)) return ctx;
    const service = getServiceClient();
    const { searchParams } = new URL(req.url);
    const semesterId = searchParams.get('semester_id');

    let semester: { id: string; name: string; billing_deadline: string; deadline_time: string; attendance_close: string; end_date: string; status: string } | null = null;
    const semQuery = service.from('semesters').select('id, name, billing_deadline, deadline_time, attendance_close, end_date, status');
    const { data: activeSem } = semesterId
      ? await semQuery.eq('id', semesterId).maybeSingle()
      : await semQuery.in('status', ['Active', 'Billing Open', 'Attendance Closing']).order('start_date', { ascending: false }).limit(1).maybeSingle();
    semester = activeSem;

    const [facultyCount, pendingApps, docsPending, activeSemesters, assignmentsCount, attPending, attFlagged, billsReview, billsAccounts, billsFinal, approvedSum, paidSum, outstandingSum] = await Promise.all([
      service.from('faculty_profiles').select('id', { count: 'exact', head: true }),
      service.from('faculty_profiles').select('id', { count: 'exact', head: true }).in('application_status', ['Submitted', 'Under Review', 'Resubmitted']),
      service.from('faculty_documents').select('id', { count: 'exact', head: true }).in('status', ['Submitted', 'Under Review', 'Changes Required']),
      service.from('semesters').select('id', { count: 'exact', head: true }).in('status', ['Active', 'Billing Open', 'Attendance Closing', 'Upcoming']),
      semester ? service.from('faculty_assignments').select('id', { count: 'exact', head: true }).eq('semester_id', semester.id).eq('status', 'Active') : Promise.resolve({ count: 0 } as { count: number }),
      service.from('attendance_records').select('id', { count: 'exact', head: true }).eq('status', 'Submitted'),
      service.from('attendance_records').select('id', { count: 'exact', head: true }).eq('status', 'Pending'),
      service.from('semester_bills').select('id', { count: 'exact', head: true }).in('status', ['Submitted', 'Under Review', 'Changes Required']),
      service.from('semester_bills').select('id', { count: 'exact', head: true }).in('status', ['Department Approved', 'Sent to Accounts', 'Physical Bill Received', 'Accounts Review']),
      service.from('semester_bills').select('id', { count: 'exact', head: true }).eq('status', 'Awaiting Final Approval'),
      service.from('semester_bills').select('grand_total').in('status', ['Approved for Payment', 'Payment Processing', 'Partially Paid', 'Paid']),
      service.from('semester_bills').select('grand_total').eq('status', 'Paid'),
      service.from('semester_bills').select('grand_total').in('status', ['Approved for Payment', 'Payment Processing', 'Partially Paid']),
    ]);

    const sum = (rows: { grand_total: number }[] | { data: { grand_total: number }[] | null } | { data: { grand_total: number }[] | null; count: number | null }) => {
      const data = (rows as { data: { grand_total: number }[] | null }).data;
      return (data || []).reduce((s, r) => s + (r.grand_total || 0), 0);
    };

    if (!isStaff(ctx)) {
      const profile = await getFacultyProfile(ctx);
      if (!profile) return json({ role: 'faculty', profile: null, semester, stats: {}, notifications: [] });

      const [assignments, attendance, corrections, bills, payments, notifications] = await Promise.all([
        service.from('faculty_assignments').select('id, classification, number_of_periods, status, courses (title, code), semesters (name)').eq('faculty_id', profile.id).eq('semester_id', semester?.id || '').neq('status', 'Cancelled'),
        service.from('attendance_records').select('status, number_of_periods').eq('faculty_id', profile.id).eq('semester_id', semester?.id || ''),
        service.from('attendance_correction_requests').select('id, status').eq('faculty_id', profile.id).eq('status', 'Pending'),
        service.from('semester_bills').select('id, status, grand_total, bill_number, semesters (name)').eq('faculty_id', profile.id).order('updated_at', { ascending: false }).limit(5),
        service.from('payments').select('id, paid_amount, payment_date, status').eq('faculty_id', profile.id).order('payment_date', { ascending: false }).limit(5),
        service.from('notifications').select('*').eq('user_id', ctx.userId).order('created_at', { ascending: false }).limit(6),
      ]);

      const att = attendance.data || [];
      const approvedPeriods = att.filter((a) => a.status === 'Approved').reduce((s, a) => s + (a.number_of_periods || 0), 0);
      return json({
        role: 'faculty',
        profile,
        semester,
        stats: {
          assignments: assignments.data || [],
          totalScheduled: att.length,
          submitted: att.filter((a) => a.status === 'Submitted').length,
          approved: att.filter((a) => a.status === 'Approved').length,
          pendingReview: att.filter((a) => ['Submitted', 'Pending'].includes(a.status)).length,
          rejected: att.filter((a) => ['Rejected', 'Correction Required'].includes(a.status)).length,
          approvedPeriods,
          approvedHours: Math.round(approvedPeriods * 1.5 * 10) / 10,
          pendingCorrections: (corrections.data || []).length,
          completionPct: att.length > 0 ? Math.round((att.filter((a) => a.status !== 'Scheduled').length / att.length) * 100) : 0,
          recentBills: bills.data || [],
          recentPayments: payments.data || [],
          notifications: notifications.data || [],
        },
      });
    }

    const { data: notifications } = await ctx.client
      .from('notifications')
      .select('*')
      .eq('user_id', ctx.userId)
      .order('created_at', { ascending: false })
      .limit(6);

    return json({
      role: ctx.roles[0] || 'staff',
      semester,
      stats: {
        totalFaculty: facultyCount.count,
        pendingApplications: pendingApps.count,
        documentsPending: docsPending.count,
        activeSemesters: activeSemesters.count,
        assignments: assignmentsCount.count,
        attendancePending: attPending.count,
        attendanceFlagged: attFlagged.count,
        billsInReview: billsReview.count,
        billsWithAccounts: billsAccounts.count,
        billsFinalApproval: billsFinal.count,
        approvedAmount: sum(approvedSum),
        paidAmount: sum(paidSum),
        outstandingAmount: sum(outstandingSum),
        notifications: notifications || [],
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
