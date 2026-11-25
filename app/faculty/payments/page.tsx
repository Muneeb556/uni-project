'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { authFetch, formatDate, formatPKR } from '@/lib/shared';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader, StatusBadge, LoadingBlock, ErrorState, EmptyState } from '@/components/dashboard-widgets';
import { Landmark } from 'lucide-react';

interface Payment {
  id: string;
  paid_amount: number;
  approved_amount: number;
  payment_date: string;
  payment_method: string;
  reference_number: string | null;
  status: string;
  remarks: string | null;
  semester_bills: { bill_number: string | null; semesters: { name: string } | null } | null;
}

export default function FacultyPaymentsPage() {
  const { session } = useAuth();
  const token = session?.access_token;
  const [rows, setRows] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    authFetch(token, '/api/payments')
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body?.error?.message || 'Failed to load payments');
        setRows(Array.isArray(body) ? body : []);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <LoadingBlock rows={4} />;
  if (error) return <ErrorState message={error} />;

  return (
    <div>
      <PageHeader title="Payment History" description="Honorarium payments recorded by the Accounts Department." />
      {rows.length === 0 ? (
        <EmptyState title="No payments yet" hint="Payments appear here once Accounts records them." />
      ) : (
        <Card>
          <CardContent className="py-4">
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Bill</th><th className="px-3 py-2">Semester</th>
                    <th className="px-3 py-2">Paid</th><th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Method</th><th className="px-3 py-2">Reference</th><th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => (
                    <tr key={p.id} className="border-t">
                      <td className="px-3 py-2 font-medium">{p.semester_bills?.bill_number || 'Bill'}</td>
                      <td className="px-3 py-2">{p.semester_bills?.semesters?.name || '—'}</td>
                      <td className="px-3 py-2 font-medium">{formatPKR(p.paid_amount)}</td>
                      <td className="px-3 py-2">{formatDate(p.payment_date)}</td>
                      <td className="px-3 py-2">{p.payment_method}</td>
                      <td className="px-3 py-2">{p.reference_number || '—'}</td>
                      <td className="px-3 py-2"><StatusBadge status={p.status === 'Completed' ? 'Paid' : p.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Landmark className="h-3.5 w-3.5" /> Partial payments are supported; a bill shows Paid only when fully settled.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
