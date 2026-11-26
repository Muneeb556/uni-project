'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { authFetch, formatDate, formatPKR } from '@/lib/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader, StatCard, StatusBadge, LoadingBlock, ErrorState, EmptyState } from '@/components/dashboard-widgets';
import { BookOpen, CalendarCheck, Clock, Bell, FileText, Landmark, AlertCircle, GraduationCap, Route } from 'lucide-react';

interface FacultyDashboard {
  role: string;
  profile: { full_name: string; application_status: string } | null;
  semester: { id: string; name: string; billing_deadline: string; deadline_time: string; status: string } | null;
  stats: {
    assignments: Array<{ id: string; courses: { title: string; code: string } | null }>;
    totalScheduled: number;
    submitted: number;
    approved: number;
    pendingReview: number;
    rejected: number;
    approvedPeriods: number;
    approvedHours: number;
    pendingCorrections: number;
    completionPct: number;
    recentBills: Array<{ id: string; status: string; grand_total: number; bill_number: string | null; semesters: { name: string } | null }>;
    recentPayments: Array<{ id: string; paid_amount: number; payment_date: string; status: string }>;
    notifications: Array<{ id: string; title: string; body: string | null; created_at: string; read: boolean }>;
  };
}

export default function FacultyDashboardPage() {
  const { session } = useAuth();
  const [data, setData] = useState<FacultyDashboard | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.access_token) return;
    authFetch(session.access_token, '/api/dashboard')
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body?.error?.message || 'Failed to load dashboard');
        setData(body);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [session?.access_token]);

  if (loading) return <LoadingBlock rows={5} />;
  if (error) return <ErrorState message={error} />;
  if (!data?.profile) {
    return <EmptyState title="Faculty profile not found" hint="Your account is not linked to a faculty profile. Contact the registrar." />;
  }

  const s = data.stats;
  const appStatus = data.profile.application_status;

  return (
    <div>
      <PageHeader
        title={`Welcome, ${data.profile.full_name}`}
        description={data.semester ? `Current semester: ${data.semester.name} (${data.semester.status})` : 'No active semester'}
      />

      {appStatus !== 'Approved' && (
        <Card className="mb-6 border-amber-200 bg-amber-50">
          <CardContent className="flex items-start gap-3 py-4">
            <AlertCircle className="mt-0.5 h-5 w-5 text-amber-600" />
            <div className="text-sm text-amber-800">
              <p className="font-medium">Your application status: {appStatus}</p>
              <p className="mt-0.5">
                {appStatus === 'Submitted' || appStatus === 'Under Review'
                  ? 'The registrar is reviewing your documents. Attendance and billing unlock after approval.'
                  : appStatus === 'Changes Required'
                  ? 'Some documents need to be re-uploaded. Visit Profile & Documents.'
                  : 'Attendance submission and billing are locked until your application is approved.'}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Assigned courses" value={s.assignments.length} icon={BookOpen} />
        <StatCard label="Approved classes" value={s.approved} hint={`${s.pendingReview} awaiting review`} icon={CalendarCheck} />
        <StatCard label="Approved teaching hours" value={s.approvedHours} hint={`${s.approvedPeriods} periods`} icon={Clock} />
        <StatCard label="Attendance completion" value={`${s.completionPct}%`} hint={`${s.rejected} flagged/rejected`} icon={GraduationCap} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Billing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {data.semester && (
              <p className="text-muted-foreground">
                Bill submission deadline for {data.semester.name}:{' '}
                <span className="font-medium text-foreground">
                  {formatDate(data.semester.billing_deadline)} at {data.semester.deadline_time}
                </span>
              </p>
            )}
            {s.recentBills.length === 0 ? (
              <p className="text-muted-foreground">No bills yet. Generate one after your attendance statement is verified.</p>
            ) : (
              s.recentBills.map((b) => (
                <div key={b.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                  <div>
                    <p className="font-medium">{b.bill_number || 'Honorarium bill'}</p>
                    <p className="text-xs text-muted-foreground">{b.semesters?.name} · {formatPKR(b.grand_total)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={b.status} />
                    <Link
                      href={`/faculty/track?id=${encodeURIComponent(b.bill_number || b.id)}`}
                      className="inline-flex items-center gap-1 rounded border border-teal-200 bg-teal-50 px-2 py-0.5 text-[11px] font-medium text-teal-700 hover:bg-teal-100"
                    >
                      <Route className="h-3 w-3" /> Track
                    </Link>
                  </div>
                </div>
              ))
            )}
            <Link href="/faculty/bills" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
              <FileText className="h-4 w-4" /> Go to honorarium bills
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Recent payments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {s.recentPayments.length === 0 ? (
              <p className="text-muted-foreground">No payments recorded yet.</p>
            ) : (
              s.recentPayments.map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                  <div>
                    <p className="font-medium">{formatPKR(p.paid_amount)}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(p.payment_date)}</p>
                  </div>
                  <StatusBadge status={p.status === 'Completed' ? 'Paid' : p.status} />
                </div>
              ))
            )}
            <Link href="/faculty/payments" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
              <Landmark className="h-4 w-4" /> Full payment history
            </Link>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><Bell className="h-4 w-4" /> Recent notifications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {s.notifications.length === 0 ? (
            <p className="text-sm text-muted-foreground">No notifications.</p>
          ) : (
            s.notifications.map((n) => (
              <div key={n.id} className="rounded-md border px-3 py-2">
                <p className="text-sm font-medium">{n.title}</p>
                {n.body && <p className="text-xs text-muted-foreground">{n.body}</p>}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
