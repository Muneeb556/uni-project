'use client';

import { BillWorkflowList } from '@/components/bill-workflow-list';

export default function AccountsBillsPage() {
  return (
    <BillWorkflowList
      title="Bills Inbox"
      description="Record the physical bill receipt, verify calculations, return incorrect bills, and forward to the approving authority."
      statuses={['Department Approved', 'Sent to Accounts', 'Physical Bill Received', 'Accounts Review', 'Accounts Verified', 'Changes Required']}
      actions={(bill) => {
        if (['Department Approved', 'Sent to Accounts'].includes(bill.status)) {
          return [{ action: 'receive_physical', label: 'Record physical receipt', extra: 'receipt' }];
        }
        if (['Physical Bill Received', 'Accounts Review'].includes(bill.status)) {
          return [
            { action: 'accounts_verify', label: 'Verify bill' },
            { action: 'accounts_return', label: 'Return with remarks', variant: 'outline', extra: 'remarks' },
          ];
        }
        if (bill.status === 'Accounts Verified') {
          return [{ action: 'forward_final', label: 'Forward for final approval' }];
        }
        return [];
      }}
      emptyHint="Bills approved by departments arrive here."
    />
  );
}
