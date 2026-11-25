'use client';

import { BillWorkflowList } from '@/components/bill-workflow-list';

export default function ApproverDashboardPage() {
  return (
    <BillWorkflowList
      title="Approving Authority"
      description="Financial claims verified by Accounts awaiting your authorization."
      statuses={['Awaiting Final Approval']}
      actions={() => [
        { action: 'approve_payment', label: 'Authorize payment' },
        { action: 'reject_final', label: 'Reject claim', variant: 'destructive', extra: 'remarks' },
      ]}
      emptyHint="Bills verified by Accounts arrive here for final authorization."
    />
  );
}
