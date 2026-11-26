export interface TrackingStage {
  key: string;
  label: string;
  department: string;
  description: string;
  state: 'completed' | 'current' | 'upcoming' | 'action_required' | 'rejected';
  timestamp?: string | null;
  remarks?: string | null;
}

export interface TrackingTimelineEvent {
  id: string;
  title: string;
  status: string;
  actor_role: string;
  department: string;
  remarks: string | null;
  timestamp: string;
  meta?: string | null;
}

export interface ContactDepartmentInfo {
  department: string;
  role_to_contact: string;
  office_location: string;
  guidance: string;
  sla_note: string;
}

export interface BillTrackingPayload {
  bill: {
    id: string;
    tracking_id: string;
    status: string;
    grand_total: number;
    total_amount: number;
    theory_periods: number;
    practical_periods: number;
    theory_amount: number;
    practical_amount: number;
    conveyance: number;
    deductions: number;
    is_revision: boolean;
    created_at: string;
    updated_at: string;
  };
  faculty: {
    full_name: string;
    designation: string | null;
    department_name: string | null;
    department_code: string | null;
  };
  semester: {
    name: string | null;
    billing_deadline: string | null;
    deadline_time: string | null;
  };
  current_stage: {
    stage_label: string;
    current_owner: string;
    status_summary: string;
    next_action: string;
    is_action_required: boolean;
    is_rejected: boolean;
    is_completed: boolean;
  };
  contact_department: ContactDepartmentInfo;
  stages: TrackingStage[];
  timeline: TrackingTimelineEvent[];
  receipts: Array<{
    receipt_number: string;
    dispatch_number: string | null;
    received_at: string;
    remarks: string | null;
  }>;
  payments: Array<{
    id: string;
    paid_amount: number;
    payment_date: string;
    payment_method: string;
    reference_number: string | null;
    status: string;
  }>;
}

interface RawBillInput {
  id: string;
  bill_number: string | null;
  status: string;
  grand_total: number;
  total_amount: number;
  theory_periods: number;
  practical_periods: number;
  theory_amount: number;
  practical_amount: number;
  conveyance: number;
  deductions: number;
  is_revision: boolean;
  created_at: string;
  updated_at: string;
  faculty_profiles?: {
    full_name?: string;
    designation?: string | null;
    departments?: { name?: string | null; code?: string | null } | null;
  } | null;
  semesters?: {
    name?: string | null;
    billing_deadline?: string | null;
    deadline_time?: string | null;
  } | null;
  bill_submissions?: Array<{
    id: string;
    submitted_at: string;
    on_time: boolean;
    deadline_at: string | null;
    remarks: string | null;
  }>;
  bill_approvals?: Array<{
    id: string;
    actor_role: string;
    action: string;
    from_status: string | null;
    to_status: string;
    remarks: string | null;
    created_at: string;
  }>;
  physical_bill_receipts?: Array<{
    id: string;
    receipt_number: string;
    dispatch_number: string | null;
    received_at: string;
    remarks: string | null;
  }>;
  payments?: Array<{
    id: string;
    paid_amount: number;
    payment_date: string;
    payment_method: string;
    reference_number: string | null;
    status: string;
    created_at?: string;
  }>;
}

const ROLE_DEPT_MAP: Record<string, string> = {
  faculty: 'Visiting Faculty',
  coordinator: 'Academic Department (Coordinator)',
  accounts: 'Accounts & Finance Department',
  approver: 'Approving Authority (Director Finance / VC Office)',
  super_admin: 'Registrar / Admin Office',
  staff: 'University Administration',
};

/**
 * Builds the complete faculty-facing tracking view, stage progression,
 * and escalation/contact department guidance for an honorarium bill.
 */
export function buildBillTracking(raw: RawBillInput): BillTrackingPayload {
  const deptName = raw.faculty_profiles?.departments?.name || 'your Academic Department';
  const deptCode = raw.faculty_profiles?.departments?.code || null;
  const trackingId = raw.bill_number || `TRK-${raw.id.slice(0, 8).toUpperCase()}`;
  const status = raw.status;

  const approvals = [...(raw.bill_approvals || [])].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  const submissions = [...(raw.bill_submissions || [])].sort(
    (a, b) => new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime()
  );
  const receipts = [...(raw.physical_bill_receipts || [])].sort(
    (a, b) => new Date(a.received_at).getTime() - new Date(b.received_at).getTime()
  );
  const payments = [...(raw.payments || [])].sort(
    (a, b) => new Date(a.payment_date).getTime() - new Date(b.payment_date).getTime()
  );

  const latestApproval = approvals[approvals.length - 1] || null;
  const latestReceipt = receipts[receipts.length - 1] || null;

  // Determine active stage index (0..6) & state
  const stageIndexByStatus: Record<string, number> = {
    Draft: 0,
    Submitted: 1,
    'Under Review': 2,
    'Changes Required': 2,
    'Department Approved': 3,
    'Sent to Accounts': 3,
    'Physical Bill Received': 3,
    'Accounts Review': 3,
    'Accounts Returned': 3,
    'Accounts Verified': 4,
    'Awaiting Final Approval': 4,
    'Approved for Payment': 5,
    'Payment Processing': 5,
    'Partially Paid': 5,
    Paid: 6,
    Rejected: 2,
    'Late Rejected': 1,
  };

  // Refine stage index if rejected at final approval
  let activeIndex = stageIndexByStatus[status] ?? 1;
  if (status === 'Rejected' && latestApproval?.actor_role === 'approver') {
    activeIndex = 4;
  }

  const isActionRequired = ['Draft', 'Changes Required', 'Accounts Returned'].includes(status);
  const isRejected = ['Rejected', 'Late Rejected'].includes(status);
  const isCompleted = status === 'Paid';

  const approvalFor = (statuses: string[]) =>
    approvals.find((a) => statuses.includes(a.to_status) || statuses.includes(a.action));

  const stageDefs: Array<{
    key: string;
    label: string;
    department: string;
    description: string;
    timestamp?: string | null;
    remarks?: string | null;
  }> = [
    {
      key: 'draft',
      label: 'Bill Generated',
      department: 'Visiting Faculty Portal',
      description: 'Calculated from verified attendance records.',
      timestamp: raw.created_at,
    },
    {
      key: 'submitted',
      label: 'Submitted Online',
      department: 'Visiting Faculty',
      description: 'Submitted before semester billing deadline.',
      timestamp: submissions[0]?.submitted_at || approvalFor(['Submitted', 'Late Rejected'])?.created_at || null,
      remarks: approvalFor(['Late Rejected'])?.remarks || null,
    },
    {
      key: 'department',
      label: 'Department Review',
      department: `${deptName} (Coordinator)`,
      description: 'Coordinator verifies timetable, periods, and department approval.',
      timestamp: approvalFor(['Department Approved', 'Under Review', 'Changes Required', 'Rejected'])?.created_at || null,
      remarks: approvalFor(['Department Approved', 'Changes Required', 'Rejected'])?.remarks || null,
    },
    {
      key: 'accounts_verify',
      label: 'Physical Receipt & Accounts Verification',
      department: 'Accounts & Finance Department',
      description: 'Physical signed bill received and calculations audited.',
      timestamp:
        approvalFor(['Accounts Verified', 'Accounts Review', 'Physical Bill Received', 'Accounts Returned'])?.created_at ||
        latestReceipt?.received_at ||
        null,
      remarks:
        (latestReceipt ? `Receipt #${latestReceipt.receipt_number}${latestReceipt.dispatch_number ? ` (Dispatch ${latestReceipt.dispatch_number})` : ''}` : null) ||
        approvalFor(['Accounts Verified', 'Accounts Returned'])?.remarks ||
        null,
    },
    {
      key: 'final_approval',
      label: 'Final Authorization',
      department: 'Approving Authority (Director Finance / VC Office)',
      description: 'Final financial sanction for honorarium disbursement.',
      timestamp: approvalFor(['Approved for Payment', 'Awaiting Final Approval'])?.created_at || null,
      remarks: approvalFor(['Approved for Payment'])?.remarks || null,
    },
    {
      key: 'processing',
      label: 'Payment Processing',
      department: 'Accounts & Treasury',
      description: 'Bank transfer / cheque disbursement queued or partially paid.',
      timestamp: approvalFor(['Payment Processing'])?.created_at || payments[0]?.payment_date || null,
    },
    {
      key: 'paid',
      label: 'Paid & Settled',
      department: 'Accounts & Finance Department',
      description: 'Full honorarium amount disbursed to faculty bank account.',
      timestamp: isCompleted ? payments[payments.length - 1]?.payment_date || raw.updated_at : null,
      remarks: payments.length > 0 ? `Ref: ${payments[payments.length - 1].reference_number || payments[payments.length - 1].payment_method}` : null,
    },
  ];

  const stages: TrackingStage[] = stageDefs.map((s, idx) => {
    let state: TrackingStage['state'] = 'upcoming';
    if (isCompleted) {
      state = 'completed';
    } else if (idx < activeIndex) {
      state = 'completed';
    } else if (idx === activeIndex) {
      if (isRejected) state = 'rejected';
      else if (isActionRequired) state = 'action_required';
      else state = 'current';
    }
    return { ...s, state };
  });

  // Determine current stage summary & contact department
  const statusInfoMap: Record<
    string,
    {
      stage_label: string;
      current_owner: string;
      status_summary: string;
      next_action: string;
      contact: ContactDepartmentInfo;
    }
  > = {
    Draft: {
      stage_label: 'Draft — Not Yet Submitted',
      current_owner: 'Visiting Faculty (You)',
      status_summary: 'Your bill has been generated with a unique Tracking ID, but it has not been submitted for review yet.',
      next_action: 'Review the bill form and click "Submit bill" before the semester deadline.',
      contact: {
        department: `${deptName} (Coordinator Office)`,
        role_to_contact: 'Department Coordinator',
        office_location: `${deptName} Office`,
        guidance: `If any periods or rates look incorrect before submitting, contact your ${deptName} Coordinator with Tracking ID ${trackingId}.`,
        sla_note: 'Must be submitted online before the billing deadline.',
      },
    },
    Submitted: {
      stage_label: 'Awaiting Department Review',
      current_owner: `${deptName} Coordinator`,
      status_summary: 'Your bill has been submitted online and is in the queue for your Department Coordinator.',
      next_action: 'Wait for the Department Coordinator to start and approve the review.',
      contact: {
        department: `${deptName} (Coordinator Office)`,
        role_to_contact: 'Department Coordinator',
        office_location: `${deptName} Office`,
        guidance: `If your bill remains in "Submitted" for more than 3 working days, contact the ${deptName} Coordinator and quote Tracking ID ${trackingId}.`,
        sla_note: 'Typical department review time: 2–3 working days.',
      },
    },
    'Under Review': {
      stage_label: 'Under Department Review',
      current_owner: `${deptName} Coordinator`,
      status_summary: 'Your Department Coordinator is currently reviewing your honorarium bill and attendance totals.',
      next_action: 'Once approved by the department, print and sign the physical bill form for Accounts.',
      contact: {
        department: `${deptName} (Coordinator Office)`,
        role_to_contact: 'Department Coordinator',
        office_location: `${deptName} Office`,
        guidance: `For status updates during department review, contact the ${deptName} Coordinator with Tracking ID ${trackingId}.`,
        sla_note: 'Typical department review time: 2–3 working days.',
      },
    },
    'Changes Required': {
      stage_label: 'Action Required — Changes Requested',
      current_owner: 'Visiting Faculty (You)',
      status_summary: latestApproval?.remarks
        ? `Returned with remarks: "${latestApproval.remarks}"`
        : 'Your bill was returned for corrections before it can proceed.',
      next_action: 'Check the remarks, regenerate/correct your bill if needed, and resubmit.',
      contact: {
        department: `${deptName} (Coordinator Office)`,
        role_to_contact: 'Department Coordinator',
        office_location: `${deptName} Office`,
        guidance: `Clarify the requested changes with your ${deptName} Coordinator using Tracking ID ${trackingId}.`,
        sla_note: 'Resubmit promptly so the bill stays within deadline.',
      },
    },
    'Department Approved': {
      stage_label: 'Department Approved — Awaiting Physical Bill at Accounts',
      current_owner: 'Accounts & Finance Department (Honorarium Desk)',
      status_summary: 'Your department has approved the bill. Accounts is waiting to log the signed physical bill form.',
      next_action: 'Ensure your signed physical Honorarium Form (with HOD/Dean signatures) has been dispatched to Accounts.',
      contact: {
        department: 'Accounts & Finance Department (Honorarium Billing Desk)',
        role_to_contact: 'Accounts Officer (Visiting Faculty Bills)',
        office_location: 'Admin Block — Accounts & Finance Wing',
        guidance: `Confirm physical bill delivery with your ${deptName} clerk or Accounts Honorarium Desk, quoting Tracking ID ${trackingId}.`,
        sla_note: 'Physical receipt is logged upon arrival at Accounts.',
      },
    },
    'Sent to Accounts': {
      stage_label: 'Dispatched to Accounts',
      current_owner: 'Accounts & Finance Department (Honorarium Desk)',
      status_summary: 'Your approved bill has been forwarded to the Accounts Department and is awaiting physical receipt logging.',
      next_action: 'Accounts will record the physical receipt number and begin verification.',
      contact: {
        department: 'Accounts & Finance Department (Honorarium Billing Desk)',
        role_to_contact: 'Accounts Officer (Visiting Faculty Bills)',
        office_location: 'Admin Block — Accounts & Finance Wing',
        guidance: `If not logged as received within 3 working days, contact the Accounts Honorarium Desk with Tracking ID ${trackingId}.`,
        sla_note: 'Typical Accounts intake: 2–4 working days.',
      },
    },
    'Physical Bill Received': {
      stage_label: 'Physical Bill Received at Accounts',
      current_owner: 'Accounts & Finance Department (Audit & Verification)',
      status_summary: latestReceipt
        ? `Physical bill logged under Receipt #${latestReceipt.receipt_number}${latestReceipt.dispatch_number ? ` (Dispatch ${latestReceipt.dispatch_number})` : ''}.`
        : 'Accounts has received your physical bill and queued it for calculation audit.',
      next_action: 'Accounts will verify rates, periods, conveyance, and bank details.',
      contact: {
        department: 'Accounts & Finance Department (Honorarium Billing Desk)',
        role_to_contact: 'Accounts Verifier / Audit Desk',
        office_location: 'Admin Block — Accounts & Finance Wing',
        guidance: `Quote Tracking ID ${trackingId}${latestReceipt ? ` and Receipt #${latestReceipt.receipt_number}` : ''} when inquiring with Accounts.`,
        sla_note: 'Typical verification time: 3–5 working days.',
      },
    },
    'Accounts Review': {
      stage_label: 'Under Accounts Audit',
      current_owner: 'Accounts & Finance Department',
      status_summary: 'Accounts is actively verifying your bill calculations, rates, and supporting attendance records.',
      next_action: 'Once verified, Accounts will forward the bill for final approval.',
      contact: {
        department: 'Accounts & Finance Department (Honorarium Billing Desk)',
        role_to_contact: 'Accounts Officer',
        office_location: 'Admin Block — Accounts & Finance Wing',
        guidance: `Contact the Accounts Honorarium Desk with Tracking ID ${trackingId} for verification queries.`,
        sla_note: 'Typical verification time: 3–5 working days.',
      },
    },
    'Accounts Returned': {
      stage_label: 'Action Required — Returned by Accounts',
      current_owner: 'Visiting Faculty (You)',
      status_summary: latestApproval?.remarks
        ? `Accounts returned this bill: "${latestApproval.remarks}"`
        : 'Accounts returned the bill for correction or missing documentation.',
      next_action: 'Resolve the issue noted by Accounts and resubmit your bill.',
      contact: {
        department: 'Accounts & Finance Department (Honorarium Billing Desk)',
        role_to_contact: 'Accounts Officer',
        office_location: 'Admin Block — Accounts & Finance Wing',
        guidance: `Contact the Accounts Honorarium Desk with Tracking ID ${trackingId} to confirm exactly what needs correction.`,
        sla_note: 'Resubmit after addressing the discrepancy.',
      },
    },
    'Accounts Verified': {
      stage_label: 'Accounts Verified — Ready for Final Sanction',
      current_owner: 'Accounts & Finance Department (Forwarding Desk)',
      status_summary: 'Accounts has verified all calculations. The bill is queued to be forwarded to the Approving Authority.',
      next_action: 'Accounts will forward the verified claim for final payment authorization.',
      contact: {
        department: 'Accounts & Finance Department (Honorarium Billing Desk)',
        role_to_contact: 'Accounts Officer',
        office_location: 'Admin Block — Accounts & Finance Wing',
        guidance: `If it stays in "Accounts Verified" for several days, check with Accounts quoting Tracking ID ${trackingId}.`,
        sla_note: 'Forwarded in batch to Approving Authority.',
      },
    },
    'Awaiting Final Approval': {
      stage_label: 'Awaiting Final Financial Authorization',
      current_owner: 'Approving Authority (Director Finance / VC Office)',
      status_summary: 'Your verified bill is with the Approving Authority for final payment sanction.',
      next_action: 'Once authorized, the bill moves to Accounts Treasury for payment disbursement.',
      contact: {
        department: 'Office of Director Finance / Approving Authority',
        role_to_contact: 'Approving Authority Secretariat',
        office_location: 'Admin Block — Directorate of Finance',
        guidance: `For delays at final authorization, inquire through Accounts or the Directorate of Finance quoting Tracking ID ${trackingId}.`,
        sla_note: 'Typical final sanction: 3–5 working days.',
      },
    },
    'Approved for Payment': {
      stage_label: 'Approved for Payment',
      current_owner: 'Accounts & Treasury (Disbursement Desk)',
      status_summary: 'Final approval has been granted! Your honorarium is cleared for payment processing.',
      next_action: 'Accounts Treasury will process the bank transfer / cheque and record the payment reference.',
      contact: {
        department: 'Accounts & Treasury (Disbursement Desk)',
        role_to_contact: 'Treasury / Disbursement Officer',
        office_location: 'Admin Block — Accounts & Treasury Wing',
        guidance: `Ensure your bank account details in Profile are accurate. Quote Tracking ID ${trackingId} when checking payout dates.`,
        sla_note: 'Typical disbursement: 3–7 working days after approval.',
      },
    },
    'Payment Processing': {
      stage_label: 'Payment Processing',
      current_owner: 'Accounts & Treasury (Disbursement Desk)',
      status_summary: 'Your honorarium payment is actively being processed for transfer.',
      next_action: 'Payment receipt and reference number will appear in Payment History once cleared.',
      contact: {
        department: 'Accounts & Treasury (Disbursement Desk)',
        role_to_contact: 'Treasury / Disbursement Officer',
        office_location: 'Admin Block — Accounts & Treasury Wing',
        guidance: `For bank transfer status, contact Accounts Treasury with Tracking ID ${trackingId}.`,
        sla_note: 'Disbursement usually clears within 2–3 working days.',
      },
    },
    'Partially Paid': {
      stage_label: 'Partially Paid',
      current_owner: 'Accounts & Treasury (Disbursement Desk)',
      status_summary: 'A partial payment has been disbursed against this bill; the remaining balance is pending.',
      next_action: 'Accounts will process the remaining installment.',
      contact: {
        department: 'Accounts & Treasury (Disbursement Desk)',
        role_to_contact: 'Treasury / Disbursement Officer',
        office_location: 'Admin Block — Accounts & Treasury Wing',
        guidance: `Contact Accounts Treasury with Tracking ID ${trackingId} for the remaining balance schedule.`,
        sla_note: 'Check Payment History for paid installment details.',
      },
    },
    Paid: {
      stage_label: 'Paid & Settled',
      current_owner: 'Completed',
      status_summary: 'Your honorarium bill has been fully paid and settled.',
      next_action: 'No further action needed. You can download/print your form or view payment references anytime.',
      contact: {
        department: 'Accounts & Treasury (Disbursement Desk)',
        role_to_contact: 'Treasury / Disbursement Officer',
        office_location: 'Admin Block — Accounts & Treasury Wing',
        guidance: `For bank statement reconciliation, reference Tracking ID ${trackingId} and your payment reference number.`,
        sla_note: 'Completed.',
      },
    },
    Rejected: {
      stage_label: 'Rejected',
      current_owner: latestApproval?.actor_role === 'approver' ? 'Approving Authority' : `${deptName} Coordinator`,
      status_summary: latestApproval?.remarks
        ? `Bill was rejected: "${latestApproval.remarks}"`
        : 'This honorarium bill was rejected during review.',
      next_action: 'Contact the reviewing department or regenerate a corrected revision if permitted.',
      contact: {
        department:
          latestApproval?.actor_role === 'approver'
            ? 'Office of Director Finance / Approving Authority'
            : `${deptName} (Coordinator Office)`,
        role_to_contact: latestApproval?.actor_role === 'approver' ? 'Approving Authority' : 'Department Coordinator',
        office_location: latestApproval?.actor_role === 'approver' ? 'Admin Block — Directorate of Finance' : `${deptName} Office`,
        guidance: `Contact the office above with Tracking ID ${trackingId} to discuss the rejection reason.`,
        sla_note: 'Revision allowed if authorized by department/registrar.',
      },
    },
    'Late Rejected': {
      stage_label: 'Auto-Rejected (Late Submission)',
      current_owner: 'Registrar / Admin Office',
      status_summary: 'This bill was submitted after the official semester billing deadline and was automatically rejected.',
      next_action: 'Request a deadline extension from the Registrar / Admin Office if you have valid grounds.',
      contact: {
        department: 'Registrar / Visiting Faculty Cell',
        role_to_contact: 'Registrar / Super Admin',
        office_location: 'Admin Block — Registrar Office',
        guidance: `Request an authorized deadline extension from the Registrar quoting Tracking ID ${trackingId}.`,
        sla_note: 'Resubmission unlocks once an extension date is granted.',
      },
    },
  };

  const info = statusInfoMap[status] || statusInfoMap.Submitted;

  // Build chronological timeline
  const timeline: TrackingTimelineEvent[] = [
    {
      id: `gen-${raw.id}`,
      title: `Bill Generated (${trackingId})`,
      status: 'Draft',
      actor_role: 'System',
      department: 'Visiting Faculty Portal',
      remarks: `${raw.theory_periods} theory / ${raw.practical_periods} practical periods calculated.`,
      timestamp: raw.created_at,
    },
  ];

  for (const sub of submissions) {
    timeline.push({
      id: `sub-${sub.id}`,
      title: sub.on_time ? 'Submitted On Time' : 'Late Submission Attempt',
      status: sub.on_time ? 'Submitted' : 'Late Rejected',
      actor_role: 'faculty',
      department: ROLE_DEPT_MAP.faculty,
      remarks: sub.remarks || (sub.on_time ? 'Submitted before semester deadline.' : 'Submitted after billing deadline.'),
      timestamp: sub.submitted_at,
    });
  }

  for (const app of approvals) {
    // Avoid duplicating pure initial Submitted if submission already logged at nearly same time
    timeline.push({
      id: `app-${app.id}`,
      title: `Moved to ${app.to_status}`,
      status: app.to_status,
      actor_role: app.actor_role,
      department: app.actor_role === 'coordinator' ? `${deptName} (Coordinator)` : ROLE_DEPT_MAP[app.actor_role] || 'University Staff',
      remarks: app.remarks,
      timestamp: app.created_at,
    });
  }

  for (const rec of receipts) {
    timeline.push({
      id: `rec-${rec.id}`,
      title: `Physical Bill Logged (Receipt #${rec.receipt_number})`,
      status: 'Physical Bill Received',
      actor_role: 'accounts',
      department: 'Accounts & Finance Department',
      remarks: rec.remarks || (rec.dispatch_number ? `Dispatch #: ${rec.dispatch_number}` : 'Physical signed copy received at Accounts.'),
      timestamp: rec.received_at,
      meta: rec.dispatch_number ? `Dispatch #${rec.dispatch_number}` : null,
    });
  }

  for (const pay of payments) {
    timeline.push({
      id: `pay-${pay.id}`,
      title: `Payment Recorded (${pay.payment_method})`,
      status: pay.status === 'Completed' ? 'Paid' : pay.status,
      actor_role: 'accounts',
      department: 'Accounts & Treasury',
      remarks: `PKR ${Number(pay.paid_amount || 0).toLocaleString('en-PK')}${pay.reference_number ? ` · Ref: ${pay.reference_number}` : ''}`,
      timestamp: pay.created_at || pay.payment_date,
    });
  }

  timeline.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return {
    bill: {
      id: raw.id,
      tracking_id: trackingId,
      status: raw.status,
      grand_total: raw.grand_total,
      total_amount: raw.total_amount,
      theory_periods: raw.theory_periods,
      practical_periods: raw.practical_periods,
      theory_amount: raw.theory_amount,
      practical_amount: raw.practical_amount,
      conveyance: raw.conveyance,
      deductions: raw.deductions,
      is_revision: raw.is_revision,
      created_at: raw.created_at,
      updated_at: raw.updated_at,
    },
    faculty: {
      full_name: raw.faculty_profiles?.full_name || 'Faculty Member',
      designation: raw.faculty_profiles?.designation || null,
      department_name: raw.faculty_profiles?.departments?.name || null,
      department_code: deptCode,
    },
    semester: {
      name: raw.semesters?.name || null,
      billing_deadline: raw.semesters?.billing_deadline || null,
      deadline_time: raw.semesters?.deadline_time || null,
    },
    current_stage: {
      stage_label: info.stage_label,
      current_owner: info.current_owner,
      status_summary: info.status_summary,
      next_action: info.next_action,
      is_action_required: isActionRequired,
      is_rejected: isRejected,
      is_completed: isCompleted,
    },
    contact_department: info.contact,
    stages,
    timeline,
    receipts: receipts.map((r) => ({
      receipt_number: r.receipt_number,
      dispatch_number: r.dispatch_number,
      received_at: r.received_at,
      remarks: r.remarks,
    })),
    payments: payments.map((p) => ({
      id: p.id,
      paid_amount: p.paid_amount,
      payment_date: p.payment_date,
      payment_method: p.payment_method,
      reference_number: p.reference_number,
      status: p.status,
    })),
  };
}
