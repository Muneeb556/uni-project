'use client';

import { BillWorkflowList } from '@/components/bill-workflow-list';

export default function AdminBillsPage() {
  return (
    <BillWorkflowList
      title="All Bills"
      description="Every honorarium bill in the system, at any stage of the workflow. Use the faculty member's own portal actions to generate or submit bills."
      statuses={[
        'Draft', 'Submitted', 'Under Review', 'Changes Required', 'Department Approved',
        'Rejected', 'Late Rejected', 'Sent to Accounts', 'Physical Bill Received',
        'Accounts Review', 'Accounts Returned', 'Accounts Verified', 'Awaiting Final Approval',
        'Approved for Payment', 'Payment Processing', 'Partially Paid', 'Paid',
      ]}
      actions={() => []}
      emptyHint="No bills exist yet."
    />
  );
}
