'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { authFetch, formatPKR } from '@/lib/shared';
import { PageHeader, StatCard, LoadingBlock, ErrorState } from '@/components/dashboard-widgets';
import { BillWorkflowList } from '@/components/bill-workflow-list';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Landmark, FileText, Undo2, BadgeCheck } from 'lucide-react';

function AccountsDashboard() {
  const { session } = useAuth();
  const token = session?.access_token;
  const [bills, setBills] = useState<Array<{ status: string; grand_total: number }>>([]);
  const [payments, setPayments] = useState<Array<{ paid_amount: number; status: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    Promise.all([authFetch(token, '/api/bills'), authFetch(token, '/api/payments')])
      .then(async ([b, p]) => {
        const [bBody, pBody] = await Promise.all([b.json(), p.json()]);
        setBills(Array.isArray(bBody) ? bBody : []);
        setPayments(Array.isArray(pBody) ? pBody : []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <LoadingBlock rows={4} />;
  if (error) return <ErrorState message={error} />;

  const count = (statuses: string[]) => bills.filter((b) => statuses.includes(b.status)).length;
  const paidTotal = payments.reduce((s, p) => s + (p.paid_amount || 0), 0);

  return (
    <div>
      <PageHeader title="Accounts Department" description="Physical bill receipt, verification, forwarding and payment recording." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Incoming bills" value={count(['Department Approved', 'Sent to Accounts'])} icon={FileText} />
        <StatCard label="Physical bills received" value={count(['Physical Bill Received'])} icon={Landmark} />
        <StatCard label="Under verification" value={count(['Physical Bill Received', 'Accounts Review'])} icon={FileText} />
        <StatCard label="Awaiting final approval" value={count(['Awaiting Final Approval'])} icon={BadgeCheck} />
        <StatCard label="Returned bills" value={count(['Accounts Returned'])} icon={Undo2} />
        <StatCard label="Payments pending" value={count(['Approved for Payment', 'Payment Processing', 'Partially Paid'])} icon={Landmark} />
        <StatCard label="Fully paid bills" value={count(['Paid'])} icon={BadgeCheck} />
        <StatCard label="Total recorded payments" value={formatPKR(paidTotal)} icon={Landmark} />
      </div>
      <Card className="mt-6">
        <CardContent className="py-4 text-sm text-muted-foreground">
          Use the Bills Inbox to record physical receipt, verify calculations, return or forward bills, and record payments from the Payments page.
        </CardContent>
      </Card>
    </div>
  );
}

export default AccountsDashboard;
