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
import { CalendarCheck, Clock, CheckCircle2, XCircle, FileCheck2 } from 'lucide-react';

interface Upcoming {
  schedule_id: string;
  scheduled_date: string;
  course_title: string;
  course_code: string;
  start_time: string;
  end_time: string;
  number_of_periods: number;
  number_of_students?: number;
}
interface HistoryRow {
  id: string;
  scheduled_date: string;
  status: string;
  number_of_periods: number | null;
  remarks?: string | null;
  courses?: { courses: { title: string; code: string } | null; title?: string; code?: string } | null;
  faculty_assignments?: { courses: { title: string; code: string } | null } | null;
}

interface ClosureStatement {
  id: string;
  statement_status: string;
  total_periods: number;
  total_hours?: number;
}

export default function FacultyAttendancePage() {
  const { session } = useAuth();
  const token = session?.access_token;
  const [data, setData] = useState<{
    upcoming: Upcoming[];
    history: HistoryRow[];
    semester: { id: string; name: string } | null;
  } | null>(null);
  const [closure, setClosure] = useState<ClosureStatement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');

  const [markOpen, setMarkOpen] = useState<Upcoming | null>(null);
  const [markForm, setMarkForm] = useState({
    actual_date: '',
    start_time: '',
    end_time: '',
    number_of_periods: 1,
    number_of_students: 0,
    remarks: '',
  });
  const [markError, setMarkError] = useState('');

  const [correctionId, setCorrectionId] = useState<string | null>(null);
  const [correctionReason, setCorrectionReason] = useState('');
  const [correctionError, setCorrectionError] = useState('');
  const [correctionBusy, setCorrectionBusy] = useState(false);

  const [closureBusy, setClosureBusy] = useState(false);

  const load = React.useCallback(async () => {
    if (!token) return;
    try {
      const res = await authFetch(token, '/api/attendance');
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message || 'Failed to load attendance');
      setData(body);

      const semId = body?.semester?.id;
      const cRes = await authFetch(token, semId ? `/api/attendance/closure?semester_id=${semId}` : '/api/attendance/closure');
      const cBody = await cRes.json();
      if (cRes.ok) {
        setClosure(Array.isArray(cBody) ? cBody[0] || null : cBody);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const openMarkDialog = (u: Upcoming) => {
    setMarkError('');
    setMarkForm({
      actual_date: u.scheduled_date,
      start_time: u.start_time,
      end_time: u.end_time,
      number_of_periods: u.number_of_periods || 1,
      number_of_students: u.number_of_students ?? 0,
      remarks: '',
    });
    setMarkOpen(u);
  };

  const mark = async (u: Upcoming) => {
    setBusyId(u.schedule_id + u.scheduled_date);
    setMarkError('');
    setActionError('');
    try {
      const res = await authFetch(token, '/api/attendance', {
        method: 'POST',
        body: JSON.stringify({
          schedule_id: u.schedule_id,
          scheduled_date: u.scheduled_date,
          actual_date: markForm.actual_date || u.scheduled_date,
          start_time: markForm.start_time || u.start_time,
          end_time: markForm.end_time || u.end_time,
          number_of_periods: Number(markForm.number_of_periods) || u.number_of_periods,
          number_of_students: Number(markForm.number_of_students) || 0,
          remarks: markForm.remarks.trim() || undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message || 'Submission failed');
      setMarkOpen(null);
      await load();
    } catch (err) {
      setMarkError(err instanceof Error ? err.message : 'Submission failed');
    } finally {
      setBusyId(null);
    }
  };

  const requestCorrection = async () => {
    if (!correctionId || correctionReason.trim().length < 5) return;
    setCorrectionBusy(true);
    setCorrectionError('');
    setActionError('');
    try {
      const res = await authFetch(token, '/api/attendance/corrections', {
        method: 'POST',
        body: JSON.stringify({ attendance_id: correctionId, reason: correctionReason.trim(), requested_changes: {} }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message || 'Request failed');
      setCorrectionId(null);
      setCorrectionReason('');
      await load();
    } catch (err) {
      setCorrectionError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setCorrectionBusy(false);
    }
  };

  const submitClosureStatement = async () => {
    if (!data?.semester?.id) return;
    setClosureBusy(true);
    setActionError('');
    try {
      const approvedList = (data.history || []).filter((h) => h.status === 'Approved');
      const totalPeriods = approvedList.reduce((s, h) => s + (h.number_of_periods || 0), 0);
      const totalHours = Math.round(totalPeriods * 1.5 * 10) / 10;
      const res = await authFetch(token, '/api/attendance/closure', {
        method: 'POST',
        body: JSON.stringify({
          semester_id: data.semester.id,
          total_periods: totalPeriods,
          total_hours: totalHours,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message || 'Could not submit attendance statement');
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not submit attendance statement');
    } finally {
      setClosureBusy(false);
    }
  };

  if (loading) return <LoadingBlock rows={4} />;
  if (error) return <ErrorState message={error} />;

  const history = data?.history || [];
  const approvedRows = history.filter((h) => h.status === 'Approved');
  const approved = approvedRows.length;
  const approvedPeriods = approvedRows.reduce((s, h) => s + (h.number_of_periods || 0), 0);
  const canSubmitClosure =
    Boolean(data?.semester?.id) &&
    approvedPeriods > 0 &&
    (!closure || !['Submitted', 'Verified', 'Locked'].includes(closure.statement_status));

  const formatCourseLabel = (h: HistoryRow) => {
    const nested = h.courses?.courses || h.faculty_assignments?.courses;
    if (nested) return `${nested.code} — ${nested.title}`;
    if (h.courses?.code) return `${h.courses.code} — ${h.courses.title}`;
    return '—';
  };

  return (
    <div>
      <PageHeader
        title="Attendance"
        description={data?.semester ? `Semester: ${data.semester.name} — mark attendance for scheduled classes below.` : 'No active semester.'}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Awaiting submission" value={data?.upcoming.length || 0} icon={CalendarCheck} />
        <StatCard label="Approved" value={approved} hint={`${approvedPeriods} period(s)`} icon={CheckCircle2} />
        <StatCard label="Pending review" value={history.filter((h) => ['Submitted', 'Pending'].includes(h.status)).length} icon={Clock} />
        <StatCard label="Rejected / correction" value={history.filter((h) => ['Rejected', 'Correction Required'].includes(h.status)).length} icon={XCircle} />
      </div>

      {data?.semester && (
        <Card className="mb-6">
          <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold">
                <FileCheck2 className="h-4 w-4 text-teal-600" />
                Final Attendance Statement ({data.semester.name})
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Approved periods: <span className="font-medium text-foreground">{approvedPeriods}</span> · Required before generating your semester Honorarium Bill.
              </p>
            </div>
            <div className="flex items-center gap-2.5">
              <StatusBadge status={closure?.statement_status || 'Not Submitted'} />
              {canSubmitClosure && (
                <Button size="sm" onClick={submitClosureStatement} disabled={closureBusy}>
                  {closureBusy ? 'Submitting…' : 'Submit final statement'}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

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
                  <Dialog
                    open={markOpen?.schedule_id === u.schedule_id && markOpen?.scheduled_date === u.scheduled_date}
                    onOpenChange={(open) => !open && setMarkOpen(null)}
                  >
                    <DialogTrigger asChild>
                      <Button size="sm" disabled={busyId === u.schedule_id + u.scheduled_date} onClick={() => openMarkDialog(u)}>
                        Mark attendance
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Confirm attendance — {u.course_code}</DialogTitle>
                      </DialogHeader>
                      <p className="text-xs text-muted-foreground">
                        Scheduled: {formatDate(u.scheduled_date)}, {u.start_time}–{u.end_time}, {u.number_of_periods} period(s). Submitting details that differ from the official timetable flags the record for coordinator review.
                      </p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1">
                          <Label className="text-xs">Actual date</Label>
                          <Input type="date" value={markForm.actual_date} onChange={(e) => setMarkForm({ ...markForm, actual_date: e.target.value })} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Students present</Label>
                          <Input type="number" min={0} max={1000} value={markForm.number_of_students} onChange={(e) => setMarkForm({ ...markForm, number_of_students: Number(e.target.value) })} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Start time</Label>
                          <Input value={markForm.start_time} onChange={(e) => setMarkForm({ ...markForm, start_time: e.target.value })} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">End time</Label>
                          <Input value={markForm.end_time} onChange={(e) => setMarkForm({ ...markForm, end_time: e.target.value })} />
                        </div>
                        <div className="space-y-1 sm:col-span-2">
                          <Label className="text-xs">Periods</Label>
                          <Input type="number" min={1} max={12} value={markForm.number_of_periods} onChange={(e) => setMarkForm({ ...markForm, number_of_periods: Number(e.target.value) })} />
                        </div>
                        <div className="space-y-1 sm:col-span-2">
                          <Label className="text-xs">Remarks (optional)</Label>
                          <Textarea rows={2} value={markForm.remarks} onChange={(e) => setMarkForm({ ...markForm, remarks: e.target.value })} placeholder="Topic covered or note for coordinator" />
                        </div>
                      </div>
                      {markError && <p className="text-xs text-destructive">{markError}</p>}
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
                    <td className="px-3 py-2">{formatCourseLabel(h)}</td>
                    <td className="px-3 py-2">{h.number_of_periods ?? '—'}</td>
                    <td className="px-3 py-2"><StatusBadge status={h.status} /></td>
                    <td className="px-3 py-2 text-right">
                      {['Submitted', 'Pending', 'Rejected', 'Correction Required'].includes(h.status) && (
                        <Dialog
                          open={correctionId === h.id}
                          onOpenChange={(open) => {
                            if (!open) {
                              setCorrectionId(null);
                              setCorrectionReason('');
                              setCorrectionError('');
                            }
                          }}
                        >
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setCorrectionError('');
                                setCorrectionReason('');
                                setCorrectionId(h.id);
                              }}
                            >
                              Request correction
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader><DialogTitle>Attendance correction request</DialogTitle></DialogHeader>
                            <div className="space-y-3">
                              <div className="space-y-1.5">
                                <Label>Reason (min 5 characters)</Label>
                                <Textarea value={correctionReason} onChange={(e) => setCorrectionReason(e.target.value)} placeholder="Explain what is wrong and what the correct record should be" />
                              </div>
                              {correctionError && <p className="text-xs text-destructive">{correctionError}</p>}
                              <Button onClick={requestCorrection} disabled={correctionBusy || correctionReason.trim().length < 5}>
                                {correctionBusy ? 'Submitting…' : 'Submit request'}
                              </Button>
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
