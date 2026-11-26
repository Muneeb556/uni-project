'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { authFetch, formatPKR } from '@/lib/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader, StatCard, LoadingBlock, ErrorState } from '@/components/dashboard-widgets';
import { Landmark, FileText, CheckCircle2, Clock } from 'lucide-react';

interface ReportPayload {
  role: string;
  semester: { name: string } | null;
  stats: {
    billsInReview?: number;
    billsWithAccounts?: number;
    billsFinalApproval?: number;
    approvedAmount?: number;
    paidAmount?: number;
    outstandingAmount?: number;
  };
}

export default function AccountsReportsPage() {
  const { session } = useAuth();
  const token = session?.access_token;
  const [data, setData] = useState<ReportPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    authFetch(token, '/api/dashboard')
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body?.error?.message || 'Failed to load financial summary');
        setData(body);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <LoadingBlock rows={4} />;
  if (error) return <ErrorState message={error} />;

  const s = data?.stats || {};

  return (
    <div className="space-y-6">
      <PageHeader
        title="Accounts Financial Reports"
        description={data?.semester ? `Honorarium disbursement summary — ${data.semester.name}` : 'Honorarium disbursement summary'}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Approved for Payment" value={formatPKR(s.approvedAmount)} icon={FileText} />
        <StatCard label="Total Paid" value={formatPKR(s.paidAmount)} icon={CheckCircle2} />
        <StatCard label="Outstanding Balance" value={formatPKR(s.outstandingAmount)} icon={Landmark} />
        <StatCard
          label="In Accounts Queue"
          value={(s.billsWithAccounts || 0) + (s.billsFinalApproval || 0)}
          hint={`${s.billsFinalApproval || 0} awaiting final approval`}
          icon={Clock}
        />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Workflow Queue Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-3">
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Department Review</p>
            <p className="mt-1 text-xl font-bold">{s.billsInReview || 0}</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Accounts Verification</p>
            <p className="mt-1 text-xl font-bold">{s.billsWithAccounts || 0}</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Awaiting Final Sanction</p>
            <p className="mt-1 text-xl font-bold">{s.billsFinalApproval || 0}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
