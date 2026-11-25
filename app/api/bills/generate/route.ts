import { NextRequest } from 'next/server';
import { requireAuth, json, errorResponse, handleApiError, getFacultyProfile, audit, notify, isStaff, type AuthContext } from '@/lib/api-helpers';
import type { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase-server';
import { z } from 'zod';

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
      const { data: bill } = await service
        .from('semester_bills')
        .select('*, faculty_profiles (id, user_id, full_name, designation, grade, department_id, cnic, bank_account_number, bank_name, university_branch, departments (name, code)), semesters (id, name, billing_deadline), bill_items (*), bill_approvals (*, users:bill_approvals (actor_role)), physical_bill_receipts (*), payments (*)')
        .eq('id', id)
        .maybeSingle();
      if (!bill) return errorResponse('Bill not found', 404, 'not_found');
      const fp = bill.faculty_profiles as { user_id: string; department_id: string | null };
      const owns = fp.user_id === ctx.userId;
      const staff = isStaff(ctx);
      const coordinatorSameDept = ctx.roles.includes('coordinator') && fp.department_id && ctx.departmentIds.includes(fp.department_id);
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
      query = query.in('faculty_profiles.department_id', ctx.departmentIds);
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

// POST /api/bills/generate — build a draft bill from approved attendance only
export async function POST(req: NextRequest) {
  try {
    const ctx = await requireAuth(req);
    if (isResponse(ctx)) return ctx;
    const profile = await getFacultyProfile(ctx);
    if (!profile) return errorResponse('Faculty profile not found', 404, 'not_found');
    if (profile.application_status !== 'Approved') {
      return errorResponse('Your application must be approved before generating a bill', 403, 'not_approved');
    }
    const parsed = z.object({ semester_id: z.string().uuid(), is_revision: z.boolean().default(false) }).safeParse(await req.json());
    if (!parsed.success) return errorResponse('Semester is required');
    const service = getServiceClient();

    const { data: semester } = await service.from('semesters').select('*').eq('id', parsed.data.semester_id).maybeSingle();
    if (!semester) return errorResponse('Semester not found', 404, 'not_found');

    const { data: closure } = await service
      .from('semester_attendance_closures')
      .select('*')
      .eq('faculty_id', profile.id)
      .eq('semester_id', parsed.data.semester_id)
      .maybeSingle();
    if (!closure || !['Verified', 'Locked'].includes(closure.statement_status)) {
      return errorResponse('Your final attendance statement must be verified by the department before a bill can be generated', 422, 'attendance_not_verified');
    }

    const { data: existing } = await service
      .from('semester_bills')
      .select('id, status')
      .eq('faculty_id', profile.id)
      .eq('semester_id', parsed.data.semester_id)
      .maybeSingle();
    if (existing && !['Rejected', 'Late Rejected', 'Changes Required', 'Accounts Returned'].includes(existing.status)) {
      return errorResponse(`A bill already exists for this semester (status: ${existing.status})`, 409, 'duplicate');
    }
    if (existing && ['Rejected', 'Late Rejected', 'Changes Required', 'Accounts Returned'].includes(existing.status)) {
      // revision: supersede the old bill by creating a new revision row
      parsed.data.is_revision = true;
    }

    const { data: assignments } = await service
      .from('faculty_assignments')
      .select('id, theory_rate, practical_rate, conveyance, compensation_method, classification, courses (code, title)')
      .eq('faculty_id', profile.id)
      .eq('semester_id', parsed.data.semester_id)
      .eq('status', 'Active');
    if (!assignments || assignments.length === 0) return errorResponse('No course assignments found for this semester', 422, 'no_assignments');

    const { data: approved } = await service
      .from('attendance_records')
      .select('id, assignment_id, scheduled_date, actual_date, start_time, end_time, number_of_periods, number_of_students')
      .eq('faculty_id', profile.id)
      .eq('semester_id', parsed.data.semester_id)
      .eq('status', 'Approved');
    if (!approved || approved.length === 0) {
      return errorResponse('No approved attendance records exist for this semester; a bill cannot be generated', 422, 'no_approved_attendance');
    }

    // Build theory items from verified attendance only
    const theoryItems = approved.map((a, idx) => {
      const asg = assignments.find((x) => x.id === a.assignment_id);
      return {
        item_type: 'Theory',
        course_number: (asg?.courses as unknown as { code: string } | null)?.code || null,
        course_title: (asg?.courses as unknown as { title: string } | null)?.title || null,
        number_of_students: a.number_of_students,
        serial_number: idx + 1,
        entry_date: a.actual_date || a.scheduled_date,
        timings: `${a.start_time || ''}-${a.end_time || ''}`,
        number_of_periods: a.number_of_periods || 0,
        rate: asg?.theory_rate || 0,
        amount: 0,
      };
    });

    const theoryPeriods = theoryItems.reduce((s, i) => s + i.number_of_periods, 0);
    const avgTheoryRate = theoryItems.length > 0 ? theoryItems.reduce((s, i) => s + i.rate, 0) / theoryItems.length : 0;
    const theoryAmount = theoryPeriods * avgTheoryRate;

    // Practical/additional items come from assignment classification Practical with approved attendance
    const practicalApproved = approved.filter((a) => assignments.find((x) => x.id === a.assignment_id)?.classification === 'Practical');
    const practicalPeriods = practicalApproved.reduce((s, a) => s + (a.number_of_periods || 0), 0);
    const practicalRates = practicalApproved.map((a) => assignments.find((x) => x.id === a.assignment_id)?.practical_rate || 0);
    const avgPracticalRate = practicalRates.length > 0 ? practicalRates.reduce((s, r) => s + r, 0) / practicalRates.length : 0;
    const practicalAmount = practicalPeriods * avgPracticalRate;

    const conveyance = assignments.reduce((s, a) => s + (a.conveyance || 0), 0);
    const totalAmount = theoryAmount + practicalAmount;
    const grandTotal = totalAmount + conveyance;

    const billValues = {
      faculty_id: profile.id,
      semester_id: parsed.data.semester_id,
      status: 'Draft',
      theory_periods: theoryPeriods,
      theory_rate: Math.round(avgTheoryRate),
      theory_amount: Math.round(theoryAmount),
      practical_periods: practicalPeriods,
      practical_rate: Math.round(avgPracticalRate),
      practical_amount: Math.round(practicalAmount),
      conveyance: Math.round(conveyance),
      deductions: 0,
      total_amount: Math.round(totalAmount),
      grand_total: Math.round(grandTotal),
      is_revision: parsed.data.is_revision,
    };

    let billId: string;
    if (existing) {
      const { error: updError } = await service.from('semester_bills').update({ ...billValues, updated_at: new Date().toISOString() }).eq('id', existing.id);
      if (updError) return errorResponse(updError.message, 500, 'update_failed');
      billId = existing.id;
      await service.from('bill_items').delete().eq('bill_id', billId);
    } else {
      const billNumber = `TH-${semester.name.replace(/\s+/g, '').toUpperCase()}-${profile.id.slice(0, 8).toUpperCase()}`;
      const { data: created, error: insError } = await service
        .from('semester_bills')
        .insert({ ...billValues, bill_number: billNumber })
        .select('*')
        .single();
      if (insError) return errorResponse(insError.message, 500, 'insert_failed');
      billId = created.id;
    }

    const rows = theoryItems.map((i) => ({ ...i, bill_id: billId }));
    if (rows.length > 0) {
      const { error: itemError } = await service.from('bill_items').insert(rows);
      if (itemError) return errorResponse(itemError.message, 500, 'items_failed');
    }
    await audit(ctx, 'bill.generate', 'semester_bills', billId, existing || null, billValues);
    return json({ id: billId, ...billValues });
  } catch (err) {
    return handleApiError(err);
  }
}
