'use client';

import { BillWorkflowList } from '@/components/bill-workflow-list';

export default function ApproverBillsPage() {
  return (
    <BillWorkflowList
      title="Final Approvals"
      description="Review and authorize or reject financial claims according to university policy."
      statuses={['Awaiting Final Approval', 'Approved for Payment']}
      actions={(bill) => {
        if (bill.status === 'Awaiting Final Approval') {
          return [
            { action: 'approve_payment', label: 'Authorize payment' },
            { action: 'reject_final', label: 'Reject claim', variant: 'destructive', extra: 'remarks' },
          ];
        }
        return [];
      }}
      emptyHint="Nothing awaiting authorization."
    />
  );
}
