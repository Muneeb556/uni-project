'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { authFetch, formatDate, formatPKR } from '@/lib/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PageHeader, StatusBadge, LoadingBlock, ErrorState, EmptyState } from '@/components/dashboard-widgets';
import { Search } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface ReportBill {
  id: string;
  faculty: string;
  semester: string;
  status: string;
  grand_total: number;
}

export default function AdminReportsPage() {
  const { session } = useAuth();
  const token = session?.access_token;
  const [data, setData] = useState<{
    financial: {
      totals: { submittedAmount: number; paidAmount: number; outstandingAmount: number; billCount: number };
      byStatus: Record<string, number>;
      byDepartment: { department: string; faculty: number; approved: number; bills: number; submitted: number; paidAmount: number }[];
      bills: ReportBill[];
    };
    attendance: { byStatus: Record<string, number>; totalApprovedPeriods: number; approvedHours: number };
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const res = await authFetch(token, '/api/reports');
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message || 'Failed to load reports');
      setData(body);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingBlock rows={5} />;
  if (error) return <ErrorState message={error} />;
  if (!data) return null;

  const { financial, attendance } = data;
  const filteredBills = financial.bills.filter((b) => (b.faculty || '').toLowerCase().includes(search.toLowerCase()));

  const totals = [
    ['Total submitted', formatPKR(financial.totals.submittedAmount), `${financial.totals.billCount} bills`],
    ['Paid', formatPKR(financial.totals.paidAmount)],
    ['Outstanding', formatPKR(financial.totals.outstandingAmount)],
    ['Approved teaching hours', String(attendance.approvedHours), `${attendance.totalApprovedPeriods} approved periods`],
  ] as const;

  return (
    <div>
      <PageHeader title="Reports & Analytics" description="Financial and attendance aggregates across the university." />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {totals.map(([label, value, hint]) => (
          <Card key={label}>
            <CardHeader className="pb-1"><CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</CardTitle></CardHeader>
            <CardContent>
              <p className="text-xl font-semibold">{value}</p>
              {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Department-wise honorarium</CardTitle></CardHeader>
          <CardContent className="py-4">
            {financial.byDepartment.length === 0 ? (
              <EmptyState title="No data" />
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                    <tr><th className="px-3 py-2">Department</th><th>Faculty</th><th>Bills</th><th>Submitted</th><th>Paid</th></tr>
                  </thead>
                  <tbody>
                    {financial.byDepartment.map((d) => (
                      <tr key={d.department} className="border-t">
                        <td className="px-3 py-2 font-medium">{d.department}</td>
                        <td className="px-3 py-2">{d.faculty}</td>
                        <td className="px-3 py-2">{d.bills}</td>
                        <td className="px-3 py-2">{formatPKR(d.submitted)}</td>
                        <td className="px-3 py-2">{formatPKR(d.paidAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Bill status distribution</CardTitle></CardHeader>
          <CardContent className="space-y-2 py-4">
            {Object.keys(financial.byStatus).length === 0 ? (
              <EmptyState title="No bills yet" />
            ) : (
              Object.entries(financial.byStatus).sort((a, b) => b[1] - a[1]).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between gap-3">
                  <StatusBadge status={status} />
                  <div className="flex flex-1 items-center gap-2">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-[hsl(var(--primary))]" style={{ width: `${Math.round((count / financial.totals.billCount) * 100)}%` }} />
                    </div>
                    <span className="w-8 text-right text-xs text-muted-foreground">{count}</span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm">All bills</CardTitle>
          <div className="relative w-56">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search faculty…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
          </div>
        </CardHeader>
        <CardContent className="py-4">
          {filteredBills.length === 0 ? (
            <EmptyState title="No bills" />
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                  <tr><th className="px-3 py-2">Faculty</th><th>Semester</th><th>Status</th><th>Amount</th><th></th></tr>
                </thead>
                <tbody>
                  {filteredBills.map((b) => (
                    <tr key={b.id} className="border-t">
                      <td className="px-3 py-2 font-medium">{b.faculty}</td>
                      <td className="px-3 py-2">{b.semester}</td>
                      <td className="px-3 py-2"><StatusBadge status={b.status} /></td>
                      <td className="px-3 py-2">{formatPKR(b.grand_total)}</td>
                      <td className="px-3 py-2">
                        <Link href={`/faculty/bills/${b.id}/form`}><Button variant="outline" size="sm">View form</Button></Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      <p className="mt-3 text-xs text-muted-foreground">Report generated {formatDate(new Date().toISOString())}. Use your browser&apos;s print function for PDF/Excel-ready exports.</p>
    </div>
  );
}
