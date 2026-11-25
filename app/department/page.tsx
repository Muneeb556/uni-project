'use client';

import { BillWorkflowList } from '@/components/bill-workflow-list';

export default function CoordinatorDashboardPage() {
  return (
    <BillWorkflowList
      title="Department Coordinator"
      description="Bills from your department that need review, recommendation, or correction."
      statuses={['Submitted', 'Under Review', 'Department Approved', 'Changes Required']}
      actions={(bill) => {
        if (['Submitted', 'Under Review'].includes(bill.status)) {
          return [
            { action: 'approve_department', label: 'Approve & forward to Accounts' },
            { action: 'request_changes', label: 'Request changes', variant: 'outline', extra: 'remarks' },
            { action: 'reject', label: 'Reject', variant: 'destructive', extra: 'remarks' },
          ];
        }
        return [];
      }}
      emptyHint="Once faculty submit bills, they appear here for your review."
    />
  );
}
