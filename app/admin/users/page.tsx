'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { authFetch } from '@/lib/shared';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { PageHeader, StatusBadge, LoadingBlock, ErrorState, EmptyState } from '@/components/dashboard-widgets';
import { Eye, Search } from 'lucide-react';

interface FacultyRow {
  id: string;
  user_id: string;
  full_name: string;
  designation: string | null;
  qualification: string | null;
  application_status: string;
  remarks: string | null;
  departments: { name: string } | null;
  faculty_documents: Array<{ id: string; doc_type: string; status: string; remarks: string | null }>;
}

export default function AdminUsersPage() {
  const { session } = useAuth();
  const token = session?.access_token;
  const [rows, setRows] = useState<FacultyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [search, setSearch] = useState('');
  const [reviewDoc, setReviewDoc] = useState<{ id: string; doc_type: string } | null>(null);
  const [docAction, setDocAction] = useState<string>('Approved');
  const [docRemarks, setDocRemarks] = useState('');
  const [appReview, setAppReview] = useState<FacultyRow | null>(null);
  const [appDecision, setAppDecision] = useState('Approved');
  const [appRemarks, setAppRemarks] = useState('');

  const load = React.useCallback(async () => {
    if (!token) return;
    try {
      const res = await authFetch(token, '/api/faculty/list');
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message || 'Failed to load');
      setRows(Array.isArray(body) ? body : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const reviewDocument = async () => {
    if (!reviewDoc) return;
    setActionError('');
    try {
      const res = await authFetch(token, '/api/admin/review', {
        method: 'PUT',
        body: JSON.stringify({ document_id: reviewDoc.id, action: docAction, remarks: docRemarks || undefined }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message || 'Review failed');
      setReviewDoc(null);
      setDocRemarks('');
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Review failed');
    }
  };

  const reviewApplication = async () => {
    if (!appReview) return;
    setActionError('');
    try {
      const res = await authFetch(token, '/api/admin/review', {
        method: 'POST',
        body: JSON.stringify({ user_id: appReview.user_id, decision: appDecision, remarks: appRemarks || undefined }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message || 'Review failed');
      setAppReview(null);
      setAppRemarks('');
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Review failed');
    }
  };

  if (loading) return <LoadingBlock rows={5} />;
  if (error) return <ErrorState message={error} />;

  const filtered = rows.filter(
    (r) =>
      r.full_name.toLowerCase().includes(search.toLowerCase()) ||
      (r.departments?.name || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <PageHeader title="Faculty & Applications" description="Approve applications and review each document individually." />
      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search by name or department…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
      </div>
      {actionError && <p className="mb-3 text-sm text-destructive">{actionError}</p>}

      {filtered.length === 0 ? (
        <EmptyState title="No applications" />
      ) : (
        <div className="space-y-3">
          {filtered.map((f) => (
            <Card key={f.id}>
              <CardContent className="py-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-medium">{f.full_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {f.designation || 'Visiting Faculty'} · {f.departments?.name || 'No department'} · {f.qualification || ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={f.application_status} />
                    <Dialog open={appReview?.id === f.id} onOpenChange={(open) => !open && setAppReview(null)}>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="outline" onClick={() => setAppReview(f)}>Review application</Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader><DialogTitle>Application decision — {f.full_name}</DialogTitle></DialogHeader>
                        <div className="space-y-3">
                          <div className="space-y-1.5">
                            <Label>Decision</Label>
                            <select className="h-9 w-full rounded-md border bg-white px-3 text-sm" value={appDecision} onChange={(e) => setAppDecision(e.target.value)}>
                              {['Approved', 'Under Review', 'Changes Required', 'Rejected'].map((d) => <option key={d}>{d}</option>)}
                            </select>
                          </div>
                          <div className="space-y-1.5">
                            <Label>Remarks (sent to the faculty member)</Label>
                            <Textarea value={appRemarks} onChange={(e) => setAppRemarks(e.target.value)} />
                          </div>
                          <Button onClick={reviewApplication}>Record decision</Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {(f.faculty_documents || []).length === 0 && (
                    <p className="text-xs text-muted-foreground">No documents uploaded.</p>
                  )}
                  {(f.faculty_documents || []).map((d) => (
                    <div key={d.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium">{d.doc_type}</p>
                        <p className="truncate text-[11px] text-muted-foreground">{d.remarks || d.status}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <StatusBadge status={d.status} />
                        <Dialog open={reviewDoc?.id === d.id} onOpenChange={(open) => !open && setReviewDoc(null)}>
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setReviewDoc(d); setDocAction('Approved'); setDocRemarks(''); }}>
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader><DialogTitle>Review document — {reviewDoc?.doc_type}</DialogTitle></DialogHeader>
                            <div className="space-y-3">
                              <div className="space-y-1.5">
                                <Label>Action</Label>
                                <select className="h-9 w-full rounded-md border bg-white px-3 text-sm" value={docAction} onChange={(e) => setDocAction(e.target.value)}>
                                  {['Approved', 'Under Review', 'Changes Required', 'Rejected'].map((a) => <option key={a}>{a}</option>)}
                                </select>
                              </div>
                              <div className="space-y-1.5">
                                <Label>Remarks</Label>
                                <Textarea value={docRemarks} onChange={(e) => setDocRemarks(e.target.value)} placeholder="e.g. Certificate is unreadable; upload a clear scan" />
                              </div>
                              <Button onClick={reviewDocument}>Save review</Button>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
