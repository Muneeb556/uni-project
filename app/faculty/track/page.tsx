'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { authFetch, formatDate, formatDateTime, formatPKR } from '@/lib/shared';
import type { BillTrackingPayload } from '@/lib/bill-tracking';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader, StatusBadge, LoadingBlock, EmptyState } from '@/components/dashboard-widgets';
import {
  Search, CheckCircle2, Clock, AlertTriangle, XCircle, Building2,
  PhoneCall, Copy, Check, Printer, FileText, ArrowRight, Receipt, Landmark,
} from 'lucide-react';

export default function FacultyBillTrackPage() {
  const { session } = useAuth();
  const token = session?.access_token;

  const [query, setQuery] = useState('');
  const [myBills, setMyBills] = useState<BillTrackingPayload[]>([]);
  const [selected, setSelected] = useState<BillTrackingPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchByQuery = React.useCallback(
    async (q: string) => {
      if (!token || !q.trim()) return;
      setSearching(true);
      setError('');
      try {
        const res = await authFetch(token, `/api/bills/track?q=${encodeURIComponent(q.trim())}`);
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error?.message || 'Bill not found');
        setSelected(body);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Lookup failed');
      } finally {
        setSearching(false);
      }
    },
    [token]
  );

  useEffect(() => {
    if (!token) return;
    let active = true;
    const urlId = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('id') : null;

    authFetch(token, '/api/bills/track')
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body?.error?.message || 'Failed to load bills');
        const list: BillTrackingPayload[] = Array.isArray(body) ? body : [];
        if (!active) return;
        setMyBills(list);
        if (urlId) {
          setQuery(urlId);
          const match = list.find(
            (b) =>
              b.bill.tracking_id.toLowerCase() === urlId.toLowerCase() ||
              b.bill.id.toLowerCase() === urlId.toLowerCase()
          );
          if (match) {
            setSelected(match);
          } else {
            await fetchByQuery(urlId);
          }
        } else if (list.length > 0) {
          setSelected(list[0]);
          setQuery(list[0].bill.tracking_id);
        }
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : 'Failed to load tracking data');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [token, fetchByQuery]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    await fetchByQuery(query);
  };

  const copyTrackingId = (id: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(id).catch(() => {});
    }
    setCopiedId(id);
    setTimeout(() => setCopiedId((prev) => (prev === id ? null : prev)), 2000);
  };

  if (loading) return <LoadingBlock rows={5} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Track Honorarium Bill"
        description="Enter your unique Tracking ID (or physical receipt number) to see exactly where your bill is and which department to contact."
        actions={
          <Link href="/faculty/bills">
            <Button variant="outline" size="sm" className="gap-1.5">
              <FileText className="h-4 w-4" /> My Bills
            </Button>
          </Link>
        }
      />

      {/* Search by Tracking ID */}
      <Card className="border-teal-200/80 bg-gradient-to-br from-white to-teal-50/40">
        <CardContent className="py-5">
          <form onSubmit={handleSearch} className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Enter Tracking ID (e.g. TRK-FALL2026-... or TH-FALL2026-...) or Receipt #"
                className="bg-white pl-9 font-mono text-sm"
              />
            </div>
            <Button type="submit" disabled={searching || !query.trim()} className="gap-2 bg-teal-600 hover:bg-teal-700">
              <Search className="h-4 w-4" />
              {searching ? 'Searching…' : 'Track Bill'}
            </Button>
          </form>

          {myBills.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Your Bills (click to track)
              </p>
              <div className="flex flex-wrap gap-2">
                {myBills.map((b) => {
                  const isActive = selected?.bill.id === b.bill.id;
                  return (
                    <button
                      key={b.bill.id}
                      type="button"
                      onClick={() => {
                        setSelected(b);
                        setQuery(b.bill.tracking_id);
                        setError('');
                      }}
                      className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs transition-all ${
                        isActive
                          ? 'border-teal-600 bg-teal-600 text-white shadow-sm'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-teal-400 hover:bg-teal-50/50'
                      }`}
                    >
                      <span className="font-mono font-semibold">{b.bill.tracking_id}</span>
                      <span className={isActive ? 'text-teal-100' : 'text-muted-foreground'}>
                        · {b.semester.name || 'Semester'} ({b.bill.status})
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {error && <p className="mt-3 text-sm font-medium text-destructive">{error}</p>}
        </CardContent>
      </Card>

      {!selected ? (
        <EmptyState
          title="No bill selected"
          hint="Generate an honorarium bill on the Honorarium Bills page to receive a unique Tracking ID, or search with an existing Tracking ID above."
        />
      ) : (
        <>
          {/* Current Status + Contact Department Hero */}
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-slate-100 px-2.5 py-1 font-mono text-xs font-bold text-slate-800 border border-slate-200">
                        {selected.bill.tracking_id}
                      </span>
                      <button
                        type="button"
                        onClick={() => copyTrackingId(selected.bill.tracking_id)}
                        className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
                        title="Copy Tracking ID"
                      >
                        {copiedId === selected.bill.tracking_id ? (
                          <><Check className="h-3 w-3 text-emerald-600" /> Copied</>
                        ) : (
                          <><Copy className="h-3 w-3" /> Copy ID</>
                        )}
                      </button>
                      <StatusBadge status={selected.bill.status} />
                    </div>
                    <CardTitle className="mt-3 text-lg">{selected.current_stage.stage_label}</CardTitle>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {selected.semester.name} · {selected.bill.theory_periods} theory / {selected.bill.practical_periods} practical periods ·{' '}
                      <span className="font-semibold text-foreground">{formatPKR(selected.bill.grand_total)}</span>
                    </p>
                  </div>

                  <Link href={`/faculty/bills/${selected.bill.id}/form`}>
                    <Button variant="outline" size="sm" className="gap-1.5">
                      <Printer className="h-3.5 w-3.5" /> View / Print Form
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div
                  className={`rounded-lg border p-4 ${
                    selected.current_stage.is_rejected
                      ? 'border-red-200 bg-red-50/70'
                      : selected.current_stage.is_action_required
                      ? 'border-amber-200 bg-amber-50/70'
                      : selected.current_stage.is_completed
                      ? 'border-emerald-200 bg-emerald-50/70'
                      : 'border-teal-200 bg-teal-50/60'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                    <span>Currently With: {selected.current_stage.current_owner}</span>
                    <span>Updated: {formatDateTime(selected.bill.updated_at)}</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-800">{selected.current_stage.status_summary}</p>
                  <p className="mt-2 flex items-start gap-1.5 text-xs font-medium text-slate-700">
                    <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-700" />
                    <span>Next step: {selected.current_stage.next_action}</span>
                  </p>
                </div>

                {(selected.receipts.length > 0 || selected.payments.length > 0) && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {selected.receipts.map((r, i) => (
                      <div key={i} className="rounded-md border bg-slate-50 p-3 text-xs">
                        <p className="flex items-center gap-1.5 font-semibold text-slate-800">
                          <Receipt className="h-3.5 w-3.5 text-teal-600" /> Physical Receipt #{r.receipt_number}
                        </p>
                        {r.dispatch_number && <p className="mt-0.5 text-muted-foreground">Dispatch #: {r.dispatch_number}</p>}
                        <p className="mt-0.5 text-muted-foreground">Received: {formatDateTime(r.received_at)}</p>
                      </div>
                    ))}
                    {selected.payments.map((p) => (
                      <div key={p.id} className="rounded-md border bg-emerald-50/60 p-3 text-xs">
                        <p className="flex items-center gap-1.5 font-semibold text-emerald-900">
                          <Landmark className="h-3.5 w-3.5 text-emerald-600" /> Payment: {formatPKR(p.paid_amount)}
                        </p>
                        <p className="mt-0.5 text-emerald-800">
                          {p.payment_method} · {formatDate(p.payment_date)}
                          {p.reference_number ? ` · Ref: ${p.reference_number}` : ''}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Who to Contact Card */}
            <Card className="border-slate-200 bg-slate-900 text-slate-100">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base text-white">
                  <PhoneCall className="h-4 w-4 text-teal-400" />
                  Who to Contact
                </CardTitle>
                <p className="text-xs text-slate-400">
                  If your bill is delayed or you need clarification at this stage:
                </p>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="rounded-lg border border-slate-700 bg-slate-800/70 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-teal-400">Department / Office</p>
                  <p className="mt-0.5 font-semibold text-white">{selected.contact_department.department}</p>
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-300">
                    <Building2 className="h-3.5 w-3.5 text-slate-400" />
                    {selected.contact_department.office_location}
                  </p>
                </div>

                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Point of Contact</p>
                  <p className="text-xs font-medium text-slate-200">{selected.contact_department.role_to_contact}</p>
                </div>

                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">What to Mention</p>
                  <p className="text-xs leading-relaxed text-slate-300">{selected.contact_department.guidance}</p>
                </div>

                <div className="border-t border-slate-800 pt-2 text-[11px] text-slate-400">
                  {selected.contact_department.sla_note}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 7-Stage Pipeline Stepper */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Approval & Payment Pipeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-7">
                {selected.stages.map((st, idx) => {
                  const badge =
                    st.state === 'completed' ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    ) : st.state === 'current' ? (
                      <Clock className="h-5 w-5 text-teal-600 animate-pulse" />
                    ) : st.state === 'action_required' ? (
                      <AlertTriangle className="h-5 w-5 text-amber-600" />
                    ) : st.state === 'rejected' ? (
                      <XCircle className="h-5 w-5 text-red-600" />
                    ) : (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 text-[10px] font-bold text-slate-400">
                        {idx + 1}
                      </span>
                    );

                  const cardTone =
                    st.state === 'completed'
                      ? 'border-emerald-200 bg-emerald-50/40'
                      : st.state === 'current'
                      ? 'border-teal-400 bg-teal-50/70 ring-1 ring-teal-400/40'
                      : st.state === 'action_required'
                      ? 'border-amber-300 bg-amber-50/70'
                      : st.state === 'rejected'
                      ? 'border-red-300 bg-red-50/70'
                      : 'border-slate-200 bg-slate-50/50 opacity-75';

                  return (
                    <div key={st.key} className={`rounded-lg border p-3 ${cardTone}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Step {idx + 1}
                        </span>
                        {badge}
                      </div>
                      <p className="mt-2 text-xs font-semibold text-slate-900">{st.label}</p>
                      <p className="mt-0.5 text-[11px] font-medium text-teal-700">{st.department}</p>
                      <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{st.description}</p>
                      {st.timestamp && (
                        <p className="mt-2 text-[10px] font-medium text-slate-600">{formatDate(st.timestamp)}</p>
                      )}
                      {st.remarks && (
                        <p className="mt-1 rounded bg-white/80 px-1.5 py-1 text-[10px] text-slate-700 border">
                          {st.remarks}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Complete Handoff Timeline */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Complete Activity & Handoff Log</CardTitle>
            </CardHeader>
            <CardContent>
              {selected.timeline.length === 0 ? (
                <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
              ) : (
                <div className="space-y-3">
                  {selected.timeline.map((ev) => (
                    <div key={ev.id} className="flex flex-col gap-1 rounded-md border bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium text-slate-900">{ev.title}</p>
                          <StatusBadge status={ev.status} />
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Office: <span className="font-medium text-slate-700">{ev.department}</span>
                          {ev.remarks ? ` · ${ev.remarks}` : ''}
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">{formatDateTime(ev.timestamp)}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
