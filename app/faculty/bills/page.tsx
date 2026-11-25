'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { authFetch, formatDate, formatPKR } from '@/lib/shared';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { PageHeader, StatusBadge, LoadingBlock, ErrorState, EmptyState } from '@/components/dashboard-widgets';
import { FileText, Printer } from 'lucide-react';
import Link from 'next/link';

interface Bill {
  id: string;
  bill_number: string | null;
  status: string;
  grand_total: number;
  theory_periods: number;
  semesters: { id: string; name: string; billing_deadline: string; deadline_time: string } | null;
}

export default function FacultyBillsPage() {
  const { session } = useAuth();
  const token = session?.access_token;
  const [bills, setBills] = useState<Bill[]>([]);
  const [semesters, setSemesters] = useState<Array<{ id: string; name: string; billing_open: string; billing_deadline: string; status: string }>>([]);
  const [semesterId, setSemesterId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [closed, setClosed] = useState<{ id: string; statement_status: string } | null>(null);

  const load = React.useCallback(async () => {
    if (!token) return;
    try {
      const [bRes, sRes, cRes] = await Promise.all([
        authFetch(token, '/api/bills'),
        authFetch(token, '/api/semesters'),
        authFetch(token, '/api/attendance/closure'),
      ]);
      const b = await bRes.json();
      const s = await sRes.json();
      const c = await cRes.json();
      if (!bRes.ok) throw new Error(b?.error?.message || 'Failed to load bills');
      setBills(Array.isArray(b) ? b : []);
      setSemesters(Array.isArray(s) ? s : []);
      setClosed(Array.isArray(c) ? c[0] || null : c);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const generate = async () => {
    if (!semesterId) return;
    setBusy(true);
    setError('');
    try {
      const res = await authFetch(token, '/api/bills/generate', { method: 'POST', body: JSON.stringify({ semester_id: semesterId }) });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message || 'Generation failed');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setBusy(false);
    }
  };

  const submit = async (billId: string) => {
    setBusy(true);
    setError('');
    try {
      const res = await authFetch(token, '/api/bills/submit', { method: 'POST', body: JSON.stringify({ bill_id: billId }) });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message || 'Submission failed');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <LoadingBlock rows={4} />;

  const statementReady = closed && ['Verified', 'Locked'].includes(closed.statement_status);

  return (
    <div>
      <PageHeader title="Honorarium Bills" description="Generate the official Teaching Honorarium bill from verified attendance, then submit before the deadline." />

      <Card className="mb-6">
        <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-end">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Semester</label>
            <select
              className="h-9 rounded-md border bg-white px-3 text-sm"
              value={semesterId}
              onChange={(e) => setSemesterId(e.target.value)}
            >
              <option value="">Select semester…</option>
              {semesters.map((s) => (
                <option key={s.id} value={s.id}>{s.name} (deadline {formatDate(s.billing_deadline)})</option>
              ))}
            </select>
          </div>
          <Button onClick={generate} disabled={busy || !semesterId} className="gap-2">
            <FileText className="h-4 w-4" /> {busy ? 'Working…' : 'Generate bill'}
          </Button>
          {!statementReady && (
            <p className="text-sm text-muted-foreground">
              Your final attendance statement must be verified by the department first.
            </p>
          )}
        </CardContent>
      </Card>

      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

      {bills.length === 0 ? (
        <EmptyState title="No bills yet" hint="Generate a bill above once your attendance statement is verified." />
      ) : (
        <div className="space-y-3">
          {bills.map((b) => (
            <Card key={b.id}>
              <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">{b.bill_number || 'Teaching Honorarium bill'}</p>
                  <p className="text-xs text-muted-foreground">
                    {b.semesters?.name} · {b.theory_periods} theory periods · {formatPKR(b.grand_total)}
                    {b.semesters?.billing_deadline && ` · deadline ${formatDate(b.semesters.billing_deadline)} ${b.semesters.deadline_time}`}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={b.status} />
                  <Link href={`/faculty/bills/${b.id}/form`}>
                    <Button variant="outline" size="sm" className="gap-1.5"><Printer className="h-3.5 w-3.5" /> View / print form</Button>
                  </Link>
                  {['Draft', 'Changes Required', 'Accounts Returned'].includes(b.status) && (
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button size="sm">Submit bill</Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Submit for approval?</DialogTitle>
                        </DialogHeader>
                        <p className="text-sm text-muted-foreground">
                          The server enforces the deadline: on-time submissions proceed to department review; late attempts are recorded and rejected automatically.
                        </p>
                        <Button onClick={() => submit(b.id)} disabled={busy}>{busy ? 'Submitting…' : 'Confirm submission'}</Button>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
