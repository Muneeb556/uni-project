'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { authFetch, formatDate, DAY_NAMES } from '@/lib/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PageHeader, StatusBadge, LoadingBlock, ErrorState, EmptyState } from '@/components/dashboard-widgets';
import { Plus, CalendarPlus, History } from 'lucide-react';

interface Assignment {
  id: string; classification: string; number_of_students: number; start_time: string | null; end_time: string | null;
  status: string;
  courses: { title: string; code: string } | null;
  faculty_profiles: { full_name: string } | null;
  departments: { name: string } | null;
  semesters: { name: string } | null;
}
interface Schedule {
  id: string; assignment_id: string; day_of_week: number; start_date: string; end_date: string;
  start_time: string; end_time: string; classroom: string | null; number_of_periods: number; status: string;
}

export default function AdminAssignmentsPage() {
  const { session } = useAuth();
  const token = session?.access_token;
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [semesters, setSemesters] = useState<Array<{ id: string; name: string }>>([]);
  const [departments, setDepartments] = useState<Array<{ id: string; name: string }>>([]);
  const [courses, setCourses] = useState<Array<{ id: string; title: string; code: string; department_id: string | null }>>([]);
  const [faculty, setFaculty] = useState<Array<{ id: string; full_name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [asgOpen, setAsgOpen] = useState(false);
  const [asgForm, setAsgForm] = useState({
    faculty_id: '', department_id: '', semester_id: '', course_id: '',
    number_of_students: '0', classification: 'Theory', start_time: '09:00', end_time: '10:30',
    number_of_periods: '1', compensation_method: 'Per Period', theory_rate: '1500', practical_rate: '1750', conveyance: '500',
  });

  const [schedOpen, setSchedOpen] = useState<Assignment | null>(null);
  const [schedForm, setSchedForm] = useState({ day_of_week: '1', start_date: '', end_date: '', start_time: '09:00', end_time: '10:30', classroom: '', number_of_periods: '1' });

  const [changeTarget, setChangeTarget] = useState<Schedule | null>(null);
  const [changeForm, setChangeForm] = useState({ effective_from: '', start_time: '', end_time: '', classroom: '', reason: '' });

  const load = React.useCallback(async () => {
    if (!token) return;
    try {
      const [aRes, sRes, semRes, dRes, cRes, fRes] = await Promise.all([
        authFetch(token, '/api/assignments'),
        authFetch(token, '/api/schedules'),
        authFetch(token, '/api/semesters'),
        authFetch(token, '/api/reference?type=departments'),
        authFetch(token, '/api/reference?type=courses'),
        authFetch(token, '/api/faculty/list'),
      ]);
      const [a, s, sem, d, c, f] = await Promise.all([aRes.json(), sRes.json(), semRes.json(), dRes.json(), cRes.json(), fRes.json()]);
      if (!aRes.ok) throw new Error(a?.error?.message || 'Failed to load');
      setAssignments(a);
      setSchedules(Array.isArray(s) ? s : []);
      setSemesters(sem);
      setDepartments(d);
      setCourses(c);
      setFaculty((Array.isArray(f) ? f : []).filter((x: { application_status: string }) => x.application_status === 'Approved').map((x: { id: string; full_name: string }) => ({ id: x.id, full_name: x.full_name })));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const createAssignment = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await authFetch(token, '/api/admin/manage', {
        method: 'POST',
        body: JSON.stringify({
          entity: 'assignment',
          data: {
            faculty_id: asgForm.faculty_id,
            department_id: asgForm.department_id,
            semester_id: asgForm.semester_id,
            course_id: asgForm.course_id,
            number_of_students: Number(asgForm.number_of_students),
            classification: asgForm.classification,
            start_time: asgForm.start_time,
            end_time: asgForm.end_time,
            number_of_periods: Number(asgForm.number_of_periods),
            compensation_method: asgForm.compensation_method,
            theory_rate: Number(asgForm.theory_rate),
            practical_rate: Number(asgForm.practical_rate),
            conveyance: Number(asgForm.conveyance),
          },
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message || 'Save failed');
      setAsgOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const createSchedule = async () => {
    if (!schedOpen) return;
    setBusy(true);
    setError('');
    try {
      const res = await authFetch(token, '/api/schedules', {
        method: 'POST',
        body: JSON.stringify({
          assignment_id: schedOpen.id,
          day_of_week: Number(schedForm.day_of_week),
          start_date: schedForm.start_date,
          end_date: schedForm.end_date,
          start_time: schedForm.start_time,
          end_time: schedForm.end_time,
          classroom: schedForm.classroom || undefined,
          number_of_periods: Number(schedForm.number_of_periods),
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message || 'Save failed');
      setSchedOpen(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const changeSchedule = async () => {
    if (!changeTarget) return;
    setBusy(true);
    setError('');
    try {
      const patch: Record<string, unknown> = {
        schedule_id: changeTarget.id,
        reason: changeForm.reason,
        effective_from: changeForm.effective_from,
      };
      if (changeForm.start_time) patch.start_time = changeForm.start_time;
      if (changeForm.end_time) patch.end_time = changeForm.end_time;
      if (changeForm.classroom) patch.classroom = changeForm.classroom;
      const res = await authFetch(token, '/api/schedules', { method: 'PATCH', body: JSON.stringify(patch) });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message || 'Change failed');
      setChangeTarget(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Change failed');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <LoadingBlock rows={5} />;

  return (
    <div>
      <PageHeader
        title="Assignments & Timetable"
        description="Assign approved faculty to courses and publish the official timetable. Timetable changes preserve history and notify the faculty member."
        actions={<Button className="gap-1.5" onClick={() => setAsgOpen(true)}><Plus className="h-4 w-4" /> New assignment</Button>}
      />
      {error && <p className="mb-3 text-sm text-destructive">{error}</p>}

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Course assignments</CardTitle></CardHeader>
        <CardContent className="py-4">
          {assignments.length === 0 ? (
            <EmptyState title="No assignments" />
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                  <tr><th className="px-3 py-2">Faculty</th><th>Course</th><th>Semester</th><th>Students</th><th>Rate</th><th>Status</th><th></th></tr>
                </thead>
                <tbody>
                  {assignments.map((a) => (
                    <tr key={a.id} className="border-t">
                      <td className="px-3 py-2 font-medium">{a.faculty_profiles?.full_name || '—'}</td>
                      <td className="px-3 py-2">{a.courses ? `${a.courses.code} — ${a.courses.title}` : '—'}</td>
                      <td className="px-3 py-2">{a.semesters?.name}</td>
                      <td className="px-3 py-2">{a.number_of_students}</td>
                      <td className="px-3 py-2">{a.classification === 'Practical' ? 'Practical rate' : 'Theory rate'}</td>
                      <td className="px-3 py-2"><StatusBadge status={a.status} /></td>
                      <td className="px-3 py-2 text-right">
                        <Button size="sm" variant="outline" className="gap-1" onClick={() => setSchedOpen(a)}>
                          <CalendarPlus className="h-3.5 w-3.5" /> Timetable
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader className="pb-2"><CardTitle className="text-sm">Official timetable</CardTitle></CardHeader>
        <CardContent className="py-4">
          {schedules.length === 0 ? (
            <EmptyState title="No timetable entries" hint="Add timetable entries against assignments." />
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                  <tr><th className="px-3 py-2">Faculty / course</th><th>Day</th><th>Time</th><th>Room</th><th>Effective</th><th>Status</th><th></th></tr>
                </thead>
                <tbody>
                  {schedules.map((s) => {
                    const a = assignments.find((x) => x.id === s.assignment_id);
                    return (
                      <tr key={s.id} className="border-t">
                        <td className="px-3 py-2">
                          <span className="font-medium">{a?.faculty_profiles?.full_name}</span>
                          <span className="block text-xs text-muted-foreground">{a?.courses?.code}</span>
                        </td>
                        <td className="px-3 py-2">{DAY_NAMES[s.day_of_week]}</td>
                        <td className="px-3 py-2">{s.start_time}–{s.end_time}</td>
                        <td className="px-3 py-2">{s.classroom || '—'}</td>
                        <td className="px-3 py-2">{formatDate(s.start_date)} – {formatDate(s.end_date)}</td>
                        <td className="px-3 py-2"><StatusBadge status={s.status} /></td>
                        <td className="px-3 py-2 text-right">
                          {s.status === 'Active' && (
                            <Button size="sm" variant="ghost" className="gap-1" onClick={() => { setChangeTarget(s); setChangeForm({ effective_from: '', start_time: s.start_time, end_time: s.end_time, classroom: s.classroom || '', reason: '' }); }}>
                              <History className="h-3.5 w-3.5" /> Change
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={asgOpen} onOpenChange={setAsgOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader><DialogTitle>New course assignment</DialogTitle></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5"><Label>Faculty (approved only)</Label>
              <select className="h-9 w-full rounded-md border bg-white px-3 text-sm" value={asgForm.faculty_id} onChange={(e) => setAsgForm({ ...asgForm, faculty_id: e.target.value })}>
                <option value="">Select…</option>
                {faculty.map((f) => <option key={f.id} value={f.id}>{f.full_name}</option>)}
              </select></div>
            <div className="space-y-1.5"><Label>Semester</Label>
              <select className="h-9 w-full rounded-md border bg-white px-3 text-sm" value={asgForm.semester_id} onChange={(e) => setAsgForm({ ...asgForm, semester_id: e.target.value })}>
                <option value="">Select…</option>
                {semesters.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select></div>
            <div className="space-y-1.5"><Label>Department</Label>
              <select className="h-9 w-full rounded-md border bg-white px-3 text-sm" value={asgForm.department_id} onChange={(e) => setAsgForm({ ...asgForm, department_id: e.target.value })}>
                <option value="">Select…</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select></div>
            <div className="space-y-1.5"><Label>Course</Label>
              <select className="h-9 w-full rounded-md border bg-white px-3 text-sm" value={asgForm.course_id} onChange={(e) => setAsgForm({ ...asgForm, course_id: e.target.value })}>
                <option value="">Select…</option>
                {courses.filter((c) => !asgForm.department_id || c.department_id === asgForm.department_id).map((c) => (
                  <option key={c.id} value={c.id}>{c.code} — {c.title}</option>
                ))}
              </select></div>
            <div className="space-y-1.5"><Label>Number of students</Label>
              <Input type="number" min={0} value={asgForm.number_of_students} onChange={(e) => setAsgForm({ ...asgForm, number_of_students: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Classification</Label>
              <select className="h-9 w-full rounded-md border bg-white px-3 text-sm" value={asgForm.classification} onChange={(e) => setAsgForm({ ...asgForm, classification: e.target.value })}>
                <option>Theory</option><option>Practical</option>
              </select></div>
            <div className="space-y-1.5"><Label>Compensation method</Label>
              <select className="h-9 w-full rounded-md border bg-white px-3 text-sm" value={asgForm.compensation_method} onChange={(e) => setAsgForm({ ...asgForm, compensation_method: e.target.value })}>
                {['Per Hour', 'Per Period', 'Per Course Fixed', 'Custom'].map((m) => <option key={m}>{m}</option>)}
              </select></div>
            <div className="space-y-1.5"><Label>Conveyance</Label>
              <Input type="number" min={0} value={asgForm.conveyance} onChange={(e) => setAsgForm({ ...asgForm, conveyance: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Theory rate</Label>
              <Input type="number" min={0} value={asgForm.theory_rate} onChange={(e) => setAsgForm({ ...asgForm, theory_rate: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Practical rate</Label>
              <Input type="number" min={0} value={asgForm.practical_rate} onChange={(e) => setAsgForm({ ...asgForm, practical_rate: e.target.value })} /></div>
          </div>
          <Button onClick={createAssignment} disabled={busy || !asgForm.faculty_id || !asgForm.semester_id || !asgForm.course_id || !asgForm.department_id}>
            {busy ? 'Saving…' : 'Create assignment'}
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(schedOpen)} onOpenChange={(open) => !open && setSchedOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Timetable entry — {schedOpen?.courses?.title}</DialogTitle></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5"><Label>Day</Label>
              <select className="h-9 w-full rounded-md border bg-white px-3 text-sm" value={schedForm.day_of_week} onChange={(e) => setSchedForm({ ...schedForm, day_of_week: e.target.value })}>
                {DAY_NAMES.map((d, i) => <option key={d} value={i}>{d}</option>)}
              </select></div>
            <div className="space-y-1.5"><Label>Classroom</Label>
              <Input value={schedForm.classroom} onChange={(e) => setSchedForm({ ...schedForm, classroom: e.target.value })} placeholder="e.g. Room 12" /></div>
            <div className="space-y-1.5"><Label>Effective from</Label>
              <Input type="date" value={schedForm.start_date} onChange={(e) => setSchedForm({ ...schedForm, start_date: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Until</Label>
              <Input type="date" value={schedForm.end_date} onChange={(e) => setSchedForm({ ...schedForm, end_date: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Start time</Label>
              <Input value={schedForm.start_time} onChange={(e) => setSchedForm({ ...schedForm, start_time: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>End time</Label>
              <Input value={schedForm.end_time} onChange={(e) => setSchedForm({ ...schedForm, end_time: e.target.value })} /></div>
          </div>
          <Button onClick={createSchedule} disabled={busy || !schedForm.start_date || !schedForm.end_date}>{busy ? 'Saving…' : 'Publish entry'}</Button>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(changeTarget)} onOpenChange={(open) => !open && setChangeTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Change timetable entry</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground">The previous entry is preserved as history and the faculty member is notified. Reason and effective date are mandatory.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5"><Label>Effective from</Label>
              <Input type="date" value={changeForm.effective_from} onChange={(e) => setChangeForm({ ...changeForm, effective_from: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Classroom</Label>
              <Input value={changeForm.classroom} onChange={(e) => setChangeForm({ ...changeForm, classroom: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Start time</Label>
              <Input value={changeForm.start_time} onChange={(e) => setChangeForm({ ...changeForm, start_time: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>End time</Label>
              <Input value={changeForm.end_time} onChange={(e) => setChangeForm({ ...changeForm, end_time: e.target.value })} /></div>
            <div className="space-y-1.5 sm:col-span-2"><Label>Reason</Label>
              <Input value={changeForm.reason} onChange={(e) => setChangeForm({ ...changeForm, reason: e.target.value })} placeholder="e.g. Room allocation revised by the department" /></div>
          </div>
          <Button onClick={changeSchedule} disabled={busy || !changeForm.effective_from || changeForm.reason.length < 5}>{busy ? 'Saving…' : 'Record change'}</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
