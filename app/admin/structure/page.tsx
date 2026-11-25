'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { authFetch } from '@/lib/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader, LoadingBlock, ErrorState } from '@/components/dashboard-widgets';
import { Plus } from 'lucide-react';

interface Dept { id: string; name: string; code: string; status: string }
interface Course { id: string; title: string; code: string; credit_hours: number; classification: string; status: string; department_id: string }

export default function AdminStructurePage() {
  const { session } = useAuth();
  const token = session?.access_token;
  const [departments, setDepartments] = useState<Dept[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');

  const [deptForm, setDeptForm] = useState({ name: '', code: '' });
  const [courseForm, setCourseForm] = useState({ department_id: '', title: '', code: '', credit_hours: '3', classification: 'Theory' });

  const load = React.useCallback(async () => {
    if (!token) return;
    try {
      const [dRes, cRes] = await Promise.all([
        authFetch(token, '/api/reference?type=departments'),
        authFetch(token, '/api/reference?type=courses'),
      ]);
      const d = await dRes.json();
      const c = await cRes.json();
      if (!dRes.ok) throw new Error(d?.error?.message || 'Failed to load');
      if (!cRes.ok) throw new Error(c?.error?.message || 'Failed to load');
      setDepartments(d);
      setCourses(c);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const manage = async (entity: string, data: Record<string, unknown>) => {
    setBusy(true);
    setActionError('');
    try {
      const res = await authFetch(token, '/api/admin/manage', { method: 'POST', body: JSON.stringify({ entity, data }) });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message || 'Save failed');
      await load();
      return true;
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Save failed');
      return false;
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <LoadingBlock rows={4} />;
  if (error) return <ErrorState message={error} />;

  return (
    <div>
      <PageHeader title="Departments & Courses" description="University-wide academic structure." />
      {actionError && <p className="mb-3 text-sm text-destructive">{actionError}</p>}

      <Tabs defaultValue="departments">
        <TabsList><TabsTrigger value="departments">Departments</TabsTrigger><TabsTrigger value="courses">Courses</TabsTrigger></TabsList>

        <TabsContent value="departments">
          <Card className="mb-4">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Add department</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="space-y-1.5"><Label>Name</Label>
                <Input value={deptForm.name} onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Code</Label>
                <Input value={deptForm.code} onChange={(e) => setDeptForm({ ...deptForm, code: e.target.value })} className="w-28" /></div>
              <Button className="gap-1.5" disabled={busy || !deptForm.name || !deptForm.code}
                onClick={async () => { if (await manage('department', deptForm)) setDeptForm({ name: '', code: '' }); }}>
                <Plus className="h-4 w-4" /> Add
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-muted-foreground"><tr><th className="py-2">Name</th><th>Code</th><th>Status</th></tr></thead>
                <tbody>
                  {departments.map((d) => (
                    <tr key={d.id} className="border-t"><td className="py-2 font-medium">{d.name}</td><td>{d.code}</td><td>{d.status}</td></tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="courses">
          <Card className="mb-4">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Add course</CardTitle></CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6 sm:items-end">
              <div className="space-y-1.5 sm:col-span-2"><Label>Department</Label>
                <select className="h-9 w-full rounded-md border bg-white px-3 text-sm" value={courseForm.department_id}
                  onChange={(e) => setCourseForm({ ...courseForm, department_id: e.target.value })}>
                  <option value="">Select…</option>
                  {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select></div>
              <div className="space-y-1.5"><Label>Title</Label>
                <Input value={courseForm.title} onChange={(e) => setCourseForm({ ...courseForm, title: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Code</Label>
                <Input value={courseForm.code} onChange={(e) => setCourseForm({ ...courseForm, code: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Type</Label>
                <select className="h-9 w-full rounded-md border bg-white px-3 text-sm" value={courseForm.classification}
                  onChange={(e) => setCourseForm({ ...courseForm, classification: e.target.value })}>
                  {['Theory', 'Practical', 'Theory+Practical'].map((c) => <option key={c}>{c}</option>)}
                </select></div>
              <Button className="gap-1.5" disabled={busy || !courseForm.department_id || !courseForm.title || !courseForm.code}
                onClick={async () => {
                  if (await manage('course', { ...courseForm, credit_hours: Number(courseForm.credit_hours) })) {
                    setCourseForm({ department_id: '', title: '', code: '', credit_hours: '3', classification: 'Theory' });
                  }
                }}>
                <Plus className="h-4 w-4" /> Add
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                    <tr><th className="px-3 py-2">Code</th><th>Title</th><th>Credit hours</th><th>Type</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {courses.map((c) => (
                      <tr key={c.id} className="border-t">
                        <td className="px-3 py-2 font-medium">{c.code}</td><td className="px-3 py-2">{c.title}</td>
                        <td className="px-3 py-2">{c.credit_hours}</td><td className="px-3 py-2">{c.classification}</td><td className="px-3 py-2">{c.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
