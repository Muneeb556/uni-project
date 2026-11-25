'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { authFetch, formatPKR } from '@/lib/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader, StatCard, LoadingBlock, ErrorState } from '@/components/dashboard-widgets';
import { Users, FileWarning, BookOpen, CalendarRange, FileText, Landmark, AlertCircle, BadgeCheck } from 'lucide-react';

interface AdminDashboard {
  role: string;
  semester: { name: string; status: string } | null;
  stats: {
    totalFaculty: number | null;
    pendingApplications: number | null;
    documentsPending: number | null;
    activeSemesters: number | null;
    assignments: number | null;
    attendancePending: number | null;
    attendanceFlagged: number | null;
    billsInReview: number | null;
    billsWithAccounts: number | null;
    billsFinalApproval: number | null;
    approvedAmount: number;
    paidAmount: number;
    outstandingAmount: number;
  };
}

export default function AdminDashboardPage() {
  const { session } = useAuth();
  const token = session?.access_token;
  const [data, setData] = useState<AdminDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    authFetch(token, '/api/dashboard')
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body?.error?.message || 'Failed to load dashboard');
        setData(body);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <LoadingBlock rows={5} />;
  if (error) return <ErrorState message={error} />;
  const s = data?.stats;

  return (
    <div>
      <PageHeader
        title="Administration Dashboard"
        description={data?.semester ? `Active semester: ${data.semester.name}` : 'No active semester configured'}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total faculty" value={s?.totalFaculty ?? 0} icon={Users} />
        <StatCard label="Pending applications" value={s?.pendingApplications ?? 0} icon={AlertCircle} />
        <StatCard label="Documents awaiting review" value={s?.documentsPending ?? 0} icon={FileWarning} />
        <StatCard label="Active / upcoming semesters" value={s?.activeSemesters ?? 0} icon={CalendarRange} />
        <StatCard label="Course assignments" value={s?.assignments ?? 0} icon={BookOpen} />
        <StatCard label="Attendance pending verification" value={s?.attendancePending ?? 0} hint={`${s?.attendanceFlagged ?? 0} flagged`} icon={BadgeCheck} />
        <StatCard label="Bills awaiting department review" value={s?.billsInReview ?? 0} icon={FileText} />
        <StatCard label="Bills with Accounts" value={s?.billsWithAccounts ?? 0} hint={`${s?.billsFinalApproval ?? 0} awaiting final approval`} icon={FileText} />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total approved honorarium</CardTitle></CardHeader>
          <CardContent><p className="text-xl font-semibold">{formatPKR((s?.paidAmount || 0) + (s?.outstandingAmount || 0))}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Paid</CardTitle></CardHeader>
          <CardContent><p className="text-xl font-semibold text-emerald-700">{formatPKR(s?.paidAmount || 0)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Outstanding</CardTitle></CardHeader>
          <CardContent><p className="text-xl font-semibold text-amber-700">{formatPKR(s?.outstandingAmount || 0)}</p></CardContent>
        </Card>
      </div>

      <div className="mt-6 flex flex-wrap gap-3 text-sm">
        <Link href="/admin/users" className="font-medium text-primary hover:underline">Review applications →</Link>
        <Link href="/admin/assignments" className="font-medium text-primary hover:underline">Manage assignments →</Link>
        <Link href="/admin/bills" className="font-medium text-primary hover:underline">All bills →</Link>
      </div>
    </div>
  );
}
