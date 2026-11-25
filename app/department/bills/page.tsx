'use client';

import { BillWorkflowList } from '@/components/bill-workflow-list';

export default function CoordinatorBillsPage() {
  return (
    <BillWorkflowList
      title="Bill Review"
      description="Review honorarium bills submitted by your department's faculty."
      statuses={['Submitted', 'Under Review']}
      actions={() => [
        { action: 'start_review', label: 'Start review', variant: 'outline' },
        { action: 'approve_department', label: 'Approve' },
        { action: 'request_changes', label: 'Request changes', variant: 'outline', extra: 'remarks' },
        { action: 'reject', label: 'Reject', variant: 'destructive', extra: 'remarks' },
      ]}
      emptyHint="Submitted bills from your department appear here."
    />
  );
}
