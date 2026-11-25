'use client';

import { useAuth } from '@/lib/auth-context';
import { authFetch, formatDate } from '@/lib/shared';
import { PageHeader, StatusBadge, LoadingBlock, ErrorState, EmptyState, StatCard } from '@/components/dashboard-widgets';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Clock, XCircle } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface AttRow {
  id: string;
  scheduled_date: string;
  status: string;
  number_of_periods: number | null;
  remarks: string | null;
  faculty_profiles: { full_name: string } | null;
  faculty_assignments: { courses: { code: string; title: string } | null } | null;
}
interface CorrectionRow {
  id: string;
  reason: string;
  status: string;
  requested_changes: Record<string, unknown>;
  attendance_records: { scheduled_date: string } | null;
  faculty_profiles: { full_name: string } | null;
}
interface ClosureRow {
  id: string;
  statement_status: string;
  total_periods: number;
  faculty_profiles: { full_name: string } | null;
}

export default function DepartmentAttendancePage() {
  const { session } = useAuth();
  const token = session?.access_token;
  const [attendance, setAttendance] = useState<AttRow[]>([]);
  const [corrections, setCorrections] = useState<CorrectionRow[]>([]);
  const [closures, setClosures] = useState<ClosureRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [reviewRemarks, setReviewRemarks] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      // Department-wide attendance review uses the corrections endpoint for pending queues
      const [cRes, corrRes, cloRes] = await Promise.all([
        authFetch(token, '/api/attendance/review-queue'),
        authFetch(token, '/api/attendance/corrections'),
        authFetch(token, '/api/attendance/closure'),
      ]);
      const [c, corr, clo] = await Promise.all([cRes.json(), corrRes.json(), cloRes.json()]);
      if (!cRes.ok) throw new Error(c?.error?.message || 'Failed to load');
      setAttendance(Array.isArray(c) ? c : []);
      setCorrections(Array.isArray(corr) ? corr : []);
      setClosures(Array.isArray(clo) ? clo : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const review = async (decision: string) => {
    if (!reviewId) return;
    setBusy(true);
    try {
      const res = await authFetch(token, '/api/attendance/corrections', {
        method: 'PATCH',
        body: JSON.stringify({ attendance_id: reviewId, decision, remarks: reviewRemarks || undefined }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message || 'Review failed');
      setReviewId(null);
      setReviewRemarks('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Review failed');
    } finally {
      setBusy(false);
    }
  };

  const reviewCorrection = async (requestId: string, approve: boolean) => {
    setBusy(true);
    try {
      const res = await authFetch(token, '/api/attendance/corrections', {
        method: 'POST',
        body: JSON.stringify({ request_id: requestId, approve }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message || 'Review failed');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Review failed');
    } finally {
      setBusy(false);
    }
  };

  const verifyClosure = async (closureId: string) => {
    setBusy(true);
    try {
      const res = await authFetch(token, '/api/attendance/closure', {
        method: 'PATCH',
        body: JSON.stringify({ closure_id: closureId, lock: true }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message || 'Verification failed');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <LoadingBlock rows={5} />;
  if (error) return <ErrorState message={error} />;

  return (
    <div>
      <PageHeader title="Attendance Review" description="Verify submitted attendance, handle correction requests, and lock final attendance statements." />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Pending review" value={attendance.length} icon={Clock} />
        <StatCard label="Correction requests" value={corrections.filter((c) => c.status === 'Pending').length} icon={XCircle} />
        <StatCard label="Statements to verify" value={closures.filter((c) => c.statement_status === 'Submitted').length} icon={CheckCircle2} />
      </div>

      <Card className="mb-6">
        <CardContent className="py-4">
          <h2 className="mb-3 text-sm font-semibold">Submitted attendance</h2>
          {attendance.length === 0 ? (
            <EmptyState title="Nothing awaiting review" />
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                  <tr><th className="px-3 py-2">Faculty</th><th>Course</th><th>Date</th><th>Periods</th><th>Status</th><th></th></tr>
                </thead>
                <tbody>
                  {attendance.map((a) => (
                    <tr key={a.id} className="border-t">
                      <td className="px-3 py-2 font-medium">{a.faculty_profiles?.full_name}</td>
                      <td className="px-3 py-2">{a.faculty_assignments?.courses?.code || '—'}</td>
                      <td className="px-3 py-2">{formatDate(a.scheduled_date)}</td>
                      <td className="px-3 py-2">{a.number_of_periods ?? '—'}</td>
                      <td className="px-3 py-2"><StatusBadge status={a.status} /></td>
                      <td className="px-3 py-2 text-right">
                        <Dialog open={reviewId === a.id} onOpenChange={(open) => !open && setReviewId(null)}>
                          <DialogTrigger asChild>
                            <Button size="sm" variant="outline" onClick={() => setReviewId(a.id)}>Review</Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader><DialogTitle>Review attendance</DialogTitle></DialogHeader>
                            <div className="space-y-3">
                              <div className="space-y-1.5">
                                <Label>Remarks</Label>
                                <Textarea value={reviewRemarks} onChange={(e) => setReviewRemarks(e.target.value)} />
                              </div>
                              <div className="flex gap-2">
                                <Button onClick={() => review('Approved')} disabled={busy}>Approve</Button>
                                <Button variant="outline" onClick={() => review('Correction Required')} disabled={busy}>Correction required</Button>
                                <Button variant="destructive" onClick={() => review('Rejected')} disabled={busy}>Reject</Button>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardContent className="py-4">
          <h2 className="mb-3 text-sm font-semibold">Attendance correction requests</h2>
          {corrections.filter((c) => c.status === 'Pending').length === 0 ? (
            <EmptyState title="No pending correction requests" />
          ) : (
            <div className="space-y-2">
              {corrections.filter((c) => c.status === 'Pending').map((c) => (
                <div key={c.id} className="flex flex-col gap-2 rounded-md border px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium">{c.faculty_profiles?.full_name} — {formatDate(c.attendance_records?.scheduled_date)}</p>
                    <p className="text-xs text-muted-foreground">{c.reason}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" disabled={busy} onClick={() => reviewCorrection(c.id, true)}>Approve</Button>
                    <Button size="sm" variant="destructive" disabled={busy} onClick={() => reviewCorrection(c.id, false)}>Reject</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="py-4">
          <h2 className="mb-3 text-sm font-semibold">Final attendance statements</h2>
          {closures.length === 0 ? (
            <EmptyState title="No statements submitted" />
          ) : (
            <div className="space-y-2">
              {closures.map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                  <div>
                    <p className="text-sm font-medium">{c.faculty_profiles?.full_name}</p>
                    <p className="text-xs text-muted-foreground">{c.total_periods} periods · status {c.statement_status}</p>
                  </div>
                  {c.statement_status === 'Submitted' ? (
                    <Button size="sm" disabled={busy} onClick={() => verifyClosure(c.id)}>Verify & lock</Button>
                  ) : (
                    <StatusBadge status={c.statement_status === 'Locked' ? 'Approved' : c.statement_status} />
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
