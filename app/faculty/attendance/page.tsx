'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { authFetch, formatDate } from '@/lib/shared';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { PageHeader, StatCard, StatusBadge, LoadingBlock, ErrorState, EmptyState } from '@/components/dashboard-widgets';
import { CalendarCheck, Clock, CheckCircle2, XCircle } from 'lucide-react';

interface Upcoming {
  schedule_id: string;
  scheduled_date: string;
  course_title: string;
  course_code: string;
  start_time: string;
  end_time: string;
  number_of_periods: number;
}
interface HistoryRow {
  id: string;
  scheduled_date: string;
  status: string;
  number_of_periods: number | null;
  courses: { courses: { title: string; code: string } | null } | null;
}

export default function FacultyAttendancePage() {
  const { session } = useAuth();
  const token = session?.access_token;
  const [data, setData] = useState<{ upcoming: Upcoming[]; history: HistoryRow[]; semester: { name: string } | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  const [markOpen, setMarkOpen] = useState<Upcoming | null>(null);
  const [correctionId, setCorrectionId] = useState<string | null>(null);
  const [correctionReason, setCorrectionReason] = useState('');

  const load = React.useCallback(async () => {
    if (!token) return;
    try {
      const res = await authFetch(token, '/api/attendance');
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message || 'Failed to load attendance');
      setData(body);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const mark = async (u: Upcoming) => {
    setBusyId(u.schedule_id + u.scheduled_date);
    setActionError('');
    try {
      const res = await authFetch(token, '/api/attendance', {
        method: 'POST',
        body: JSON.stringify({ schedule_id: u.schedule_id, scheduled_date: u.scheduled_date }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message || 'Submission failed');
      setMarkOpen(null);
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Submission failed');
    } finally {
      setBusyId(null);
    }
  };

  const requestCorrection = async () => {
    if (!correctionId || correctionReason.length < 5) return;
    setActionError('');
    try {
      const res = await authFetch(token, '/api/attendance/corrections', {
        method: 'POST',
        body: JSON.stringify({ attendance_id: correctionId, reason: correctionReason, requested_changes: {} }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message || 'Request failed');
      setCorrectionId(null);
      setCorrectionReason('');
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Request failed');
    }
  };

  if (loading) return <LoadingBlock rows={4} />;
  if (error) return <ErrorState message={error} />;

  const history = data?.history || [];
  const approved = history.filter((h) => h.status === 'Approved').length;

  return (
    <div>
      <PageHeader title="Attendance" description={data?.semester ? `Semester: ${data.semester.name} — mark attendance for scheduled classes below.` : 'No active semester.'} />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Awaiting submission" value={data?.upcoming.length || 0} icon={CalendarCheck} />
        <StatCard label="Approved" value={approved} icon={CheckCircle2} />
        <StatCard label="Pending review" value={history.filter((h) => ['Submitted', 'Pending'].includes(h.status)).length} icon={Clock} />
        <StatCard label="Rejected / correction" value={history.filter((h) => ['Rejected', 'Correction Required'].includes(h.status)).length} icon={XCircle} />
      </div>

      {actionError && <p className="mb-4 text-sm text-destructive">{actionError}</p>}

      <Card className="mb-6">
        <CardContent className="py-4">
          <h2 className="mb-3 text-sm font-semibold">Scheduled classes ready for attendance</h2>
          {!data || data.upcoming.length === 0 ? (
            <EmptyState title="Nothing to mark" hint="Classes appear here once the department publishes your timetable." />
          ) : (
            <div className="space-y-2">
              {data.upcoming.map((u) => (
                <div key={`${u.schedule_id}-${u.scheduled_date}`} className="flex flex-col gap-2 rounded-md border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium">{u.course_code} — {u.course_title}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(u.scheduled_date)} · {u.start_time}–{u.end_time} · {u.number_of_periods} period(s)
                    </p>
                  </div>
                  <Dialog open={markOpen?.schedule_id === u.schedule_id && markOpen?.scheduled_date === u.scheduled_date} onOpenChange={(open) => !open && setMarkOpen(null)}>
                    <Button size="sm" disabled={busyId === u.schedule_id + u.scheduled_date} onClick={() => setMarkOpen(u)}>
                      Mark attendance
                    </Button>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Confirm attendance</DialogTitle>
                      </DialogHeader>
                      <p className="text-sm text-muted-foreground">
                        {u.course_code} — {formatDate(u.scheduled_date)}, {u.start_time}–{u.end_time}, {u.number_of_periods} period(s). Submitting details that differ from the official timetable will flag the record for review.
                      </p>
                      <Button onClick={() => mark(u)} disabled={busyId === u.schedule_id + u.scheduled_date}>
                        {busyId === u.schedule_id + u.scheduled_date ? 'Submitting…' : 'Submit attendance'}
                      </Button>
                    </DialogContent>
                  </Dialog>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="py-4">
          <h2 className="mb-3 text-sm font-semibold">Attendance history</h2>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr><th className="px-3 py-2">Date</th><th className="px-3 py-2">Course</th><th className="px-3 py-2">Periods</th><th className="px-3 py-2">Status</th><th className="px-3 py-2"></th></tr>
              </thead>
              <tbody>
                {history.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">No attendance records yet.</td></tr>}
                {history.map((h) => (
                  <tr key={h.id} className="border-t">
                    <td className="px-3 py-2">{formatDate(h.scheduled_date)}</td>
                    <td className="px-3 py-2">{h.courses?.courses ? `${h.courses.courses.code} — ${h.courses.courses.title}` : '—'}</td>
                    <td className="px-3 py-2">{h.number_of_periods ?? '—'}</td>
                    <td className="px-3 py-2"><StatusBadge status={h.status} /></td>
                    <td className="px-3 py-2 text-right">
                      {['Approved', 'Rejected', 'Correction Required'].includes(h.status) && (
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm" onClick={() => setCorrectionId(h.id)}>Request correction</Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader><DialogTitle>Attendance correction request</DialogTitle></DialogHeader>
                            <div className="space-y-3">
                              <div className="space-y-1.5">
                                <Label>Reason</Label>
                                <Textarea value={correctionReason} onChange={(e) => setCorrectionReason(e.target.value)} placeholder="Explain what is wrong and what the correct record should be" />
                              </div>
                              <Button onClick={requestCorrection} disabled={correctionReason.length < 5}>Submit request</Button>
                            </div>
                          </DialogContent>
                        </Dialog>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
