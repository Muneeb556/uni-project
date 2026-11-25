'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { authFetch, formatDate, formatPKR } from '@/lib/shared';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { StatusBadge, LoadingBlock, ErrorState, EmptyState } from '@/components/dashboard-widgets';
import Link from 'next/link';
import { Search } from 'lucide-react';

export interface WorkflowAction {
  action: string;
  label: string;
  variant?: 'default' | 'outline' | 'destructive';
  extra?: 'receipt' | 'remarks';
}

interface BillRow {
  id: string;
  bill_number: string | null;
  status: string;
  grand_total: number;
  theory_periods: number;
  faculty_profiles: { full_name: string; departments: { name: string } | null } | null;
  semesters: { name: string } | null;
}

export function BillWorkflowList({
  title,
  description,
  statuses,
  actions,
  emptyHint,
}: {
  title: string;
  description: string;
  statuses: string[];
  actions: (bill: BillRow) => WorkflowAction[];
  emptyHint: string;
}) {
  const { session } = useAuth();
  const token = session?.access_token;
  const [rows, setRows] = useState<BillRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [actionBill, setActionBill] = useState<BillRow | null>(null);
  const [currentAction, setCurrentAction] = useState<WorkflowAction | null>(null);
  const [remarks, setRemarks] = useState('');
  const [receiptNumber, setReceiptNumber] = useState('');
  const [dispatchNumber, setDispatchNumber] = useState('');

  const load = React.useCallback(async () => {
    if (!token) return;
    try {
      const res = await authFetch(token, '/api/bills');
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message || 'Failed to load bills');
      setRows((Array.isArray(body) ? body : []).filter((b: BillRow) => statuses.includes(b.status)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [token, JSON.stringify(statuses)]);

  useEffect(() => {
    load();
  }, [load]);

  const runAction = async () => {
    if (!actionBill || !currentAction) return;
    if (currentAction.extra === 'receipt' && receiptNumber.length < 2) return;
    if (currentAction.extra === 'remarks' && remarks.length < 3) return;
    setBusy(true);
    setError('');
    try {
      const payload: Record<string, unknown> = { bill_id: actionBill.id, action: currentAction.action };
      if (remarks) payload.remarks = remarks;
      if (receiptNumber) payload.receipt_number = receiptNumber;
      if (dispatchNumber) payload.dispatch_number = dispatchNumber;
      const res = await authFetch(token, '/api/bills/workflow', { method: 'POST', body: JSON.stringify(payload) });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message || 'Action failed');
      setActionBill(null);
      setCurrentAction(null);
      setRemarks('');
      setReceiptNumber('');
      setDispatchNumber('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <LoadingBlock rows={4} />;
  if (error && rows.length === 0) return <ErrorState message={error} />;

  const filtered = rows.filter((r) =>
    (r.faculty_profiles?.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (r.bill_number || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search faculty or bill no…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
        </div>
      </div>
      {error && <p className="mb-3 text-sm text-destructive">{error}</p>}

      {filtered.length === 0 ? (
        <EmptyState title="No bills here" hint={emptyHint} />
      ) : (
        <div className="space-y-3">
          {filtered.map((b) => (
            <Card key={b.id}>
              <CardContent className="flex flex-col gap-3 py-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <p className="font-medium">{b.bill_number || 'Honorarium bill'}</p>
                  <p className="text-xs text-muted-foreground">
                    {b.faculty_profiles?.full_name} · {b.faculty_profiles?.departments?.name} · {b.semesters?.name} ·{' '}
                    {b.theory_periods} periods · {formatPKR(b.grand_total)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={b.status} />
                  <Link href={`/faculty/bills/${b.id}/form`}>
                    <Button variant="outline" size="sm">View form</Button>
                  </Link>
                  {actions(b).map((a) => (
                    <Button
                      key={a.action}
                      size="sm"
                      variant={a.variant || 'default'}
                      onClick={() => {
                        setActionBill(b);
                        setCurrentAction(a);
                        setRemarks('');
                        setReceiptNumber('');
                        setDispatchNumber('');
                      }}
                    >
                      {a.label}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={Boolean(actionBill && currentAction)} onOpenChange={(open) => !open && setActionBill(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{currentAction?.label} — {actionBill?.bill_number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {currentAction?.extra === 'receipt' && (
              <>
                <div className="space-y-1.5">
                  <Label>Physical receipt number</Label>
                  <Input value={receiptNumber} onChange={(e) => setReceiptNumber(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Dispatch number (optional)</Label>
                  <Input value={dispatchNumber} onChange={(e) => setDispatchNumber(e.target.value)} />
                </div>
              </>
            )}
            {currentAction?.extra === 'remarks' && (
              <div className="space-y-1.5">
                <Label>Remarks (required, sent to the faculty member)</Label>
                <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} />
              </div>
            )}
            {!currentAction?.extra && (
              <div className="space-y-1.5">
                <Label>Remarks (optional)</Label>
                <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} />
              </div>
            )}
            <Button onClick={runAction} disabled={busy}>{busy ? 'Recording…' : 'Confirm'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
