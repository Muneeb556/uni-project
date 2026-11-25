'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { authFetch, formatDate, formatPKR } from '@/lib/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PageHeader, StatusBadge, LoadingBlock, ErrorState, EmptyState } from '@/components/dashboard-widgets';
import { Landmark } from 'lucide-react';

interface Bill {
  id: string;
  bill_number: string | null;
  status: string;
  grand_total: number;
  faculty_profiles: { full_name: string } | null;
  semesters: { name: string } | null;
}
interface Payment {
  id: string;
  bill_id: string;
  paid_amount: number;
  approved_amount: number;
  payment_date: string;
  payment_method: string;
  reference_number: string | null;
  status: string;
  semester_bills: { bill_number: string | null; faculty_profiles: { full_name: string } | null } | null;
}

export default function AccountsPaymentsPage() {
  const { session } = useAuth();
  const token = session?.access_token;
  const [bills, setBills] = useState<Bill[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [payBill, setPayBill] = useState<Bill | null>(null);
  const [form, setForm] = useState({ paid_amount: '', payment_date: new Date().toISOString().slice(0, 10), payment_method: 'Bank Transfer', reference_number: '', remarks: '' });

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [bRes, pRes] = await Promise.all([authFetch(token, '/api/bills'), authFetch(token, '/api/payments')]);
      const [b, p] = await Promise.all([bRes.json(), pRes.json()]);
      if (!bRes.ok) throw new Error(b?.error?.message || 'Failed to load');
      setBills((Array.isArray(b) ? b : []).filter((x: Bill) => ['Approved for Payment', 'Payment Processing', 'Partially Paid'].includes(x.status)));
      setPayments(Array.isArray(p) ? p : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const recordPayment = async () => {
    if (!payBill || !token) return;
    setBusy(true);
    setError('');
    try {
      const res = await authFetch(token, '/api/payments', {
        method: 'POST',
        body: JSON.stringify({
          bill_id: payBill.id,
          paid_amount: Number(form.paid_amount),
          payment_date: form.payment_date,
          payment_method: form.payment_method,
          reference_number: form.reference_number || undefined,
          remarks: form.remarks || undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message || 'Payment failed');
      setPayBill(null);
      setForm({ paid_amount: '', payment_date: new Date().toISOString().slice(0, 10), payment_method: 'Bank Transfer', reference_number: '', remarks: '' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <LoadingBlock rows={4} />;
  if (error) return <ErrorState message={error} />;

  return (
    <div>
      <PageHeader title="Payments" description="Record payments against bills approved for payment. Partial payments are supported." />

      <Card className="mb-6">
        <CardHeader className="pb-2"><CardTitle className="text-sm">Bills awaiting / processing payment</CardTitle></CardHeader>
        <CardContent className="py-4">
          {bills.length === 0 ? (
            <EmptyState title="No bills awaiting payment" />
          ) : (
            <div className="space-y-2">
              {bills.map((b) => (
                <div key={b.id} className="flex flex-col gap-2 rounded-md border px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium">{b.bill_number} — {b.faculty_profiles?.full_name}</p>
                    <p className="text-xs text-muted-foreground">{b.semesters?.name} · {formatPKR(b.grand_total)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={b.status} />
                    <Button size="sm" className="gap-1.5" onClick={() => { setPayBill(b); setForm({ ...form, paid_amount: String(b.grand_total) }); }}>
                      <Landmark className="h-3.5 w-3.5" /> Record payment
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Payment history</CardTitle></CardHeader>
        <CardContent className="py-4">
          {payments.length === 0 ? (
            <EmptyState title="No payments recorded" />
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                  <tr><th className="px-3 py-2">Bill</th><th>Faculty</th><th>Paid</th><th>Date</th><th>Method</th><th>Reference</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} className="border-t">
                      <td className="px-3 py-2 font-medium">{p.semester_bills?.bill_number || '—'}</td>
                      <td className="px-3 py-2">{p.semester_bills?.faculty_profiles?.full_name || '—'}</td>
                      <td className="px-3 py-2">{formatPKR(p.paid_amount)}</td>
                      <td className="px-3 py-2">{formatDate(p.payment_date)}</td>
                      <td className="px-3 py-2">{p.payment_method}</td>
                      <td className="px-3 py-2">{p.reference_number || '—'}</td>
                      <td className="px-3 py-2">{p.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(payBill)} onOpenChange={(open) => !open && setPayBill(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Record payment — {payBill?.bill_number}</DialogTitle></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5"><Label>Paid amount</Label>
              <Input type="number" min={1} value={form.paid_amount} onChange={(e) => setForm({ ...form, paid_amount: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Payment date</Label>
              <Input type="date" value={form.payment_date} onChange={(e) => setForm({ ...form, payment_date: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Method</Label>
              <select className="h-9 w-full rounded-md border bg-white px-3 text-sm" value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })}>
                {['Bank Transfer', 'Cheque', 'Cash'].map((m) => <option key={m}>{m}</option>)}
              </select></div>
            <div className="space-y-1.5"><Label>Reference number</Label>
              <Input value={form.reference_number} onChange={(e) => setForm({ ...form, reference_number: e.target.value })} /></div>
            <div className="space-y-1.5 sm:col-span-2"><Label>Remarks</Label>
              <Input value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} /></div>
          </div>
          <p className="text-xs text-muted-foreground">A bill is marked Paid only when the accumulated payments cover its grand total.</p>
          <Button onClick={recordPayment} disabled={busy || !form.paid_amount || Number(form.paid_amount) <= 0}>
            {busy ? 'Recording…' : 'Record payment'}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
