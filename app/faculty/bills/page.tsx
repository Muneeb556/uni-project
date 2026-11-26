'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { authFetch, formatDate, formatPKR } from '@/lib/shared';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { PageHeader, StatusBadge, LoadingBlock, EmptyState } from '@/components/dashboard-widgets';
import { FileText, Printer, Route, Copy, Check } from 'lucide-react';
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
  const [submitBillId, setSubmitBillId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const load = React.useCallback(async (selectedSemId?: string) => {
    if (!token) return;
    try {
      const [bRes, sRes] = await Promise.all([
        authFetch(token, '/api/bills'),
        authFetch(token, '/api/semesters'),
      ]);
      const b = await bRes.json();
      const s = await sRes.json();
      if (!bRes.ok) throw new Error(b?.error?.message || 'Failed to load bills');
      const semList = Array.isArray(s) ? s : [];
      setBills(Array.isArray(b) ? b : []);
      setSemesters(semList);

      const activeSem =
        selectedSemId ||
        semesterId ||
        semList.find((x: { status: string }) => ['Active', 'Billing Open'].includes(x.status))?.id ||
        semList[0]?.id ||
        '';
      if (!semesterId && activeSem) setSemesterId(activeSem);

      const cRes = await authFetch(token, activeSem ? `/api/attendance/closure?semester_id=${activeSem}` : '/api/attendance/closure');
      const c = await cRes.json();
      if (cRes.ok) {
        setClosed(Array.isArray(c) ? c[0] || null : c);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [token, semesterId]);

  useEffect(() => {
    load();
  }, [load]);

  const onSemesterChange = async (nextId: string) => {
    setSemesterId(nextId);
    if (!token) return;
    try {
      const cRes = await authFetch(token, nextId ? `/api/attendance/closure?semester_id=${nextId}` : '/api/attendance/closure');
      const c = await cRes.json();
      if (cRes.ok) setClosed(Array.isArray(c) ? c[0] || null : c);
    } catch {
      // ignore
    }
  };

  const generate = async () => {
    if (!semesterId) return;
    setBusy(true);
    setError('');
    try {
      const res = await authFetch(token, '/api/bills/generate', { method: 'POST', body: JSON.stringify({ semester_id: semesterId }) });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message || 'Generation failed');
      await load(semesterId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setBusy(false);
    }
  };

  const submit = async (billId: string) => {
    setBusy(true);
    setSubmitError('');
    setError('');
    try {
      const res = await authFetch(token, '/api/bills/submit', { method: 'POST', body: JSON.stringify({ bill_id: billId }) });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message || 'Submission failed');
      setSubmitBillId(null);
      await load(semesterId);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Submission failed');
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
              onChange={(e) => onSemesterChange(e.target.value)}
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
              Your final attendance statement must be verified by the department first.{' '}
              <Link href="/faculty/attendance" className="font-medium text-primary hover:underline">Go to Attendance</Link>
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
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">Tracking ID:</p>
                    <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs font-bold text-slate-800 border border-slate-200">
                      {b.bill_number || b.id.slice(0, 8).toUpperCase()}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const val = b.bill_number || b.id;
                        navigator.clipboard?.writeText(val).catch(() => {});
                        setCopiedId(b.id);
                        setTimeout(() => setCopiedId((prev) => (prev === b.id ? null : prev)), 2000);
                      }}
                      className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] text-slate-600 hover:bg-slate-50"
                      title="Copy Tracking ID"
                    >
                      {copiedId === b.id ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                      {copiedId === b.id ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {b.semesters?.name} · {b.theory_periods} theory periods · {formatPKR(b.grand_total)}
                    {b.semesters?.billing_deadline && ` · deadline ${formatDate(b.semesters.billing_deadline)} ${b.semesters.deadline_time}`}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={b.status} />
                  <Link href={`/faculty/track?id=${encodeURIComponent(b.bill_number || b.id)}`}>
                    <Button variant="outline" size="sm" className="gap-1.5 border-teal-200 text-teal-700 hover:bg-teal-50">
                      <Route className="h-3.5 w-3.5" /> Track status
                    </Button>
                  </Link>
                  <Link href={`/faculty/bills/${b.id}/form`}>
                    <Button variant="outline" size="sm" className="gap-1.5"><Printer className="h-3.5 w-3.5" /> View / print form</Button>
                  </Link>
                  {['Draft', 'Changes Required', 'Accounts Returned'].includes(b.status) && (
                    <Dialog
                      open={submitBillId === b.id}
                      onOpenChange={(open) => {
                        if (!open) {
                          setSubmitBillId(null);
                          setSubmitError('');
                        }
                      }}
                    >
                      <DialogTrigger asChild>
                        <Button
                          size="sm"
                          onClick={() => {
                            setSubmitError('');
                            setSubmitBillId(b.id);
                          }}
                        >
                          Submit bill
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Submit for approval?</DialogTitle>
                        </DialogHeader>
                        <p className="text-sm text-muted-foreground">
                          The server enforces the deadline: on-time submissions proceed to department review; late attempts are recorded and rejected automatically.
                        </p>
                        {submitError && <p className="text-xs text-destructive">{submitError}</p>}
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
