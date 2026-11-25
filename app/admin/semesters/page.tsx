'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { authFetch, formatDate } from '@/lib/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PageHeader, StatusBadge, LoadingBlock, ErrorState, EmptyState } from '@/components/dashboard-widgets';
import { Plus, CalendarClock } from 'lucide-react';

interface Semester {
  id: string; name: string; start_date: string; end_date: string;
  attendance_open: string; attendance_close: string; billing_open: string; billing_deadline: string;
  deadline_time: string; timezone: string; extension_date: string | null; extension_remarks: string | null; status: string;
}

const emptyForm = {
  name: '', start_date: '', end_date: '', attendance_open: '', attendance_close: '',
  billing_open: '', billing_deadline: '', deadline_time: '23:59', timezone: 'Asia/Karachi', status: 'Upcoming',
};

export default function AdminSemestersPage() {
  const { session } = useAuth();
  const token = session?.access_token;
  const [rows, setRows] = useState<Semester[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [extendTarget, setExtendTarget] = useState<Semester | null>(null);
  const [extDate, setExtDate] = useState('');
  const [extRemarks, setExtRemarks] = useState('');

  const load = React.useCallback(async () => {
    if (!token) return;
    try {
      const res = await authFetch(token, '/api/semesters');
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message || 'Failed to load');
      setRows(body);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await authFetch(token, '/api/admin/manage', {
        method: 'POST',
        body: JSON.stringify({ entity: 'semester', data: form }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message || 'Save failed');
      setForm(emptyForm);
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const extend = async () => {
    if (!extendTarget || !extDate || extRemarks.length < 5) return;
    setBusy(true);
    try {
      const res = await authFetch(token, '/api/admin/manage', {
        method: 'POST',
        body: JSON.stringify({ entity: 'extension', data: { semester_id: extendTarget.id, extension_date: extDate, extension_remarks: extRemarks } }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message || 'Extension failed');
      setExtendTarget(null);
      setExtDate('');
      setExtRemarks('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Extension failed');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <LoadingBlock rows={4} />;

  return (
    <div>
      <PageHeader
        title="Semesters & Deadlines"
        description="Six-month semesters with attendance windows and billing deadlines. All dates are configurable — nothing is hardcoded."
        actions={<Button className="gap-1.5" onClick={() => setShowForm(true)}><Plus className="h-4 w-4" /> New semester</Button>}
      />
      {error && <p className="mb-3 text-sm text-destructive">{error}</p>}

      {rows.length === 0 ? (
        <EmptyState title="No semesters yet" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {rows.map((s) => (
            <Card key={s.id}>
              <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base">{s.name}</CardTitle>
                <StatusBadge status={s.status} />
              </CardHeader>
              <CardContent className="space-y-1 text-sm text-muted-foreground">
                <p>Semester: {formatDate(s.start_date)} – {formatDate(s.end_date)}</p>
                <p>Attendance: {formatDate(s.attendance_open)} → {formatDate(s.attendance_close)}</p>
                <p>Billing: opens {formatDate(s.billing_open)} · deadline {formatDate(s.billing_deadline)} {s.deadline_time} ({s.timezone})</p>
                {s.extension_date && (
                  <p className="text-amber-700">Extended to {formatDate(s.extension_date)} — {s.extension_remarks}</p>
                )}
                <Button variant="outline" size="sm" className="mt-2 gap-1.5" onClick={() => setExtendTarget(s)}>
                  <CalendarClock className="h-3.5 w-3.5" /> Extend deadline
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader><DialogTitle>Create semester</DialogTitle></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            {([
              ['name', 'Name (e.g. Spring 2027)', 'text'],
              ['start_date', 'Start date', 'date'],
              ['end_date', 'End date', 'date'],
              ['attendance_open', 'Attendance opens', 'date'],
              ['attendance_close', 'Attendance closes', 'date'],
              ['billing_open', 'Billing opens', 'date'],
              ['billing_deadline', 'Billing deadline', 'date'],
              ['deadline_time', 'Deadline time (HH:MM)', 'text'],
            ] as const).map(([key, label, type]) => (
              <div key={key} className="space-y-1.5">
                <Label>{label}</Label>
                <Input type={type} value={(form as Record<string, string>)[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
              </div>
            ))}
            <div className="space-y-1.5">
              <Label>Status</Label>
              <select className="h-9 w-full rounded-md border bg-white px-3 text-sm" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {['Upcoming', 'Active', 'Attendance Closing', 'Billing Open', 'Closed', 'Archived'].map((st) => <option key={st}>{st}</option>)}
              </select>
            </div>
          </div>
          <Button onClick={create} disabled={busy || !form.name || !form.start_date}>{busy ? 'Saving…' : 'Create semester'}</Button>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(extendTarget)} onOpenChange={(open) => !open && setExtendTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Extend billing deadline — {extendTarget?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>New deadline date</Label>
              <Input type="date" value={extDate} onChange={(e) => setExtDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Extension reason (recorded in the audit log)</Label>
              <Input value={extRemarks} onChange={(e) => setExtRemarks(e.target.value)} />
            </div>
            <Button onClick={extend} disabled={busy || !extDate || extRemarks.length < 5}>{busy ? 'Saving…' : 'Authorize extension'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
