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
import { Eye, FileText, Search, CheckCircle2, ExternalLink, ClipboardCheck } from 'lucide-react';

interface FacultyDoc {
  id: string;
  doc_type: string;
  file_name?: string;
  mime_type?: string | null;
  file_size?: number | null;
  status: string;
  remarks: string | null;
}

interface FacultyRow {
  id: string;
  user_id: string;
  full_name: string;
  phone?: string | null;
  cnic?: string | null;
  designation: string | null;
  qualification: string | null;
  application_status: string;
  remarks: string | null;
  departments: { name: string } | null;
  faculty_documents: FacultyDoc[];
}

interface PreviewDocState {
  id: string;
  doc_type: string;
  file_name: string;
  mime_type: string | null;
  url: string;
}

export default function AdminUsersPage() {
  const { session } = useAuth();
  const token = session?.access_token;
  const [rows, setRows] = useState<FacultyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const [reviewDoc, setReviewDoc] = useState<FacultyDoc | null>(null);
  const [docAction, setDocAction] = useState<string>('Approved');
  const [docRemarks, setDocRemarks] = useState('');
  const [docSaving, setDocSaving] = useState(false);

  const [previewDoc, setPreviewDoc] = useState<PreviewDocState | null>(null);
  const [previewLoadingId, setPreviewLoadingId] = useState<string | null>(null);

  const [appReview, setAppReview] = useState<FacultyRow | null>(null);
  const [appDecision, setAppDecision] = useState('Approved');
  const [appRemarks, setAppRemarks] = useState('');
  const [appSaving, setAppSaving] = useState(false);

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

  const openDocumentPreview = async (doc: FacultyDoc) => {
    setActionError('');
    setPreviewLoadingId(doc.id);
    try {
      const res = await authFetch(token, `/api/documents/view?id=${doc.id}`);
      const body = await res.json();
      if (!res.ok || !body?.url) {
        throw new Error(body?.error?.message || 'Could not load document preview');
      }
      setPreviewDoc({
        id: doc.id,
        doc_type: doc.doc_type,
        file_name: body.file_name || doc.file_name || doc.doc_type,
        mime_type: body.mime_type || doc.mime_type || null,
        url: body.url,
      });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not open document');
    } finally {
      setPreviewLoadingId(null);
    }
  };

  const reviewDocument = async () => {
    if (!reviewDoc) return;
    setActionError('');
    setDocSaving(true);
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
    } finally {
      setDocSaving(false);
    }
  };

  const reviewApplication = async () => {
    if (!appReview) return;
    setActionError('');
    setAppSaving(true);
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
    } finally {
      setAppSaving(false);
    }
  };

  if (loading) return <LoadingBlock rows={5} />;
  if (error) return <ErrorState message={error} />;

  const pendingStatuses = ['Submitted', 'Under Review', 'Resubmitted', 'Changes Required'];
  const pendingCount = rows.filter((r) => pendingStatuses.includes(r.application_status)).length;

  const filtered = rows.filter((r) => {
    const matchesSearch =
      r.full_name.toLowerCase().includes(search.toLowerCase()) ||
      (r.departments?.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (r.cnic || '').toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;
    if (statusFilter === 'PENDING') return pendingStatuses.includes(r.application_status);
    if (statusFilter === 'APPROVED') return r.application_status === 'Approved';
    if (statusFilter === 'REJECTED') return r.application_status === 'Rejected';
    return true;
  });

  return (
    <div>
      <PageHeader
        title="Faculty & Applications"
        description="Inspect uploaded documents, preview files, and approve or return faculty applications."
      />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, department, or CNIC…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 bg-white"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {[
            { key: 'ALL', label: `All (${rows.length})` },
            { key: 'PENDING', label: `Needs Review (${pendingCount})` },
            { key: 'APPROVED', label: 'Approved' },
            { key: 'REJECTED', label: 'Rejected' },
          ].map((tab) => (
            <Button
              key={tab.key}
              size="sm"
              variant={statusFilter === tab.key ? 'default' : 'outline'}
              className="text-xs"
              onClick={() => setStatusFilter(tab.key)}
            >
              {tab.label}
            </Button>
          ))}
        </div>
      </div>

      {actionError && (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {actionError}
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState title="No applications match your filter" hint="Try switching the status filter or clearing the search box." />
      ) : (
        <div className="space-y-4">
          {filtered.map((f) => {
            const docs = f.faculty_documents || [];
            const approvedDocsCount = docs.filter((d) => d.status === 'Approved').length;
            return (
              <Card key={f.id} className="glass-card border-slate-200/80">
                <CardContent className="py-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-base font-semibold text-slate-900">{f.full_name}</p>
                        <StatusBadge status={f.application_status} />
                      </div>
                      <p className="text-xs text-slate-600">
                        {f.designation || 'Visiting Faculty'} · {f.departments?.name || 'No department'} · {f.qualification || '—'}
                      </p>
                      {(f.phone || f.cnic) && (
                        <p className="text-[11px] text-slate-500">
                          {f.phone ? `Phone: ${f.phone}` : ''}
                          {f.phone && f.cnic ? ' · ' : ''}
                          {f.cnic ? `CNIC: ${f.cnic}` : ''}
                        </p>
                      )}
                      {f.remarks && (
                        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 mt-1 inline-block">
                          Remarks: {f.remarks}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <Dialog
                        open={appReview?.id === f.id}
                        onOpenChange={(open) => {
                          if (!open) setAppReview(null);
                        }}
                      >
                        <DialogTrigger asChild>
                          <Button
                            size="sm"
                            variant={pendingStatuses.includes(f.application_status) ? 'default' : 'outline'}
                            className="gap-1.5"
                            onClick={() => {
                              setAppReview(f);
                              setAppDecision(
                                ['Approved', 'Under Review', 'Changes Required', 'Rejected'].includes(f.application_status)
                                  ? f.application_status
                                  : 'Approved'
                              );
                              setAppRemarks(f.remarks || '');
                            }}
                          >
                            <ClipboardCheck className="h-3.5 w-3.5" />
                            Review application
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Application decision — {f.full_name}</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-3">
                            <div className="rounded-lg border bg-slate-50 p-3 text-xs text-slate-700 space-y-1">
                              <p className="font-semibold">Document Verification Summary</p>
                              <p>
                                {docs.length === 0
                                  ? 'No documents attached yet.'
                                  : `${approvedDocsCount} of ${docs.length} uploaded document(s) approved.`}
                              </p>
                            </div>
                            <div className="space-y-1.5">
                              <Label>Decision</Label>
                              <select
                                className="h-9 w-full rounded-md border bg-white px-3 text-sm"
                                value={appDecision}
                                onChange={(e) => setAppDecision(e.target.value)}
                              >
                                {['Approved', 'Under Review', 'Changes Required', 'Rejected'].map((d) => (
                                  <option key={d}>{d}</option>
                                ))}
                              </select>
                            </div>
                            <div className="space-y-1.5">
                              <Label>Remarks (sent to the faculty member)</Label>
                              <Textarea
                                value={appRemarks}
                                onChange={(e) => setAppRemarks(e.target.value)}
                                placeholder="Optional notes or instructions for the applicant"
                              />
                            </div>
                            <Button onClick={reviewApplication} disabled={appSaving} className="w-full">
                              {appSaving ? 'Saving…' : 'Record decision'}
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>

                  {/* Uploaded Documents Grid */}
                  <div className="mt-4 border-t border-slate-100 pt-3">
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      Uploaded Documents ({docs.length})
                    </p>
                    {docs.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No documents uploaded by this applicant.</p>
                    ) : (
                      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                        {docs.map((d) => (
                          <div
                            key={d.id}
                            className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 shadow-sm"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                                <FileText className="h-3.5 w-3.5 text-teal-600 shrink-0" />
                                <span className="truncate">{d.doc_type}</span>
                              </p>
                              <p className="truncate text-[11px] text-slate-500 mt-0.5">
                                {d.file_name || d.remarks || d.status}
                              </p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <StatusBadge status={d.status} />
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Preview document"
                                className="h-7 w-7 text-slate-600 hover:text-teal-700"
                                disabled={previewLoadingId === d.id}
                                onClick={() => openDocumentPreview(d)}
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                              <Dialog
                                open={reviewDoc?.id === d.id}
                                onOpenChange={(open) => !open && setReviewDoc(null)}
                              >
                                <DialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    title="Approve / Review document"
                                    className="h-7 w-7 text-slate-600 hover:text-emerald-700"
                                    onClick={() => {
                                      setReviewDoc(d);
                                      setDocAction(d.status === 'Submitted' ? 'Approved' : d.status);
                                      setDocRemarks(d.remarks || '');
                                    }}
                                  >
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>Review document — {reviewDoc?.doc_type}</DialogTitle>
                                  </DialogHeader>
                                  <div className="space-y-3">
                                    {reviewDoc?.file_name && (
                                      <div className="flex items-center justify-between rounded-lg border bg-slate-50 px-3 py-2 text-xs">
                                        <span className="truncate font-medium text-slate-700">{reviewDoc.file_name}</span>
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="outline"
                                          className="h-7 text-xs gap-1"
                                          onClick={() => openDocumentPreview(reviewDoc)}
                                        >
                                          <Eye className="h-3 w-3" /> Preview file
                                        </Button>
                                      </div>
                                    )}
                                    <div className="space-y-1.5">
                                      <Label>Action</Label>
                                      <select
                                        className="h-9 w-full rounded-md border bg-white px-3 text-sm"
                                        value={docAction}
                                        onChange={(e) => setDocAction(e.target.value)}
                                      >
                                        {['Approved', 'Under Review', 'Changes Required', 'Rejected'].map((a) => (
                                          <option key={a}>{a}</option>
                                        ))}
                                      </select>
                                    </div>
                                    <div className="space-y-1.5">
                                      <Label>Remarks</Label>
                                      <Textarea
                                        value={docRemarks}
                                        onChange={(e) => setDocRemarks(e.target.value)}
                                        placeholder="e.g. Certificate is unreadable; upload a clear scan"
                                      />
                                    </div>
                                    <Button onClick={reviewDocument} disabled={docSaving} className="w-full">
                                      {docSaving ? 'Saving…' : 'Save review'}
                                    </Button>
                                  </div>
                                </DialogContent>
                              </Dialog>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Document Preview Modal */}
      <Dialog open={Boolean(previewDoc)} onOpenChange={(open) => !open && setPreviewDoc(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-2 pr-6">
              <span className="truncate">
                {previewDoc?.doc_type} — {previewDoc?.file_name}
              </span>
              {previewDoc?.url && (
                <a
                  href={previewDoc.url}
                  target="_blank"
                  rel="noreferrer"
                  download={previewDoc.file_name}
                  className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  <ExternalLink className="h-3 w-3" /> Open / Download
                </a>
              )}
            </DialogTitle>
          </DialogHeader>
          {previewDoc && (
            <div className="mt-2 rounded-lg border bg-slate-50 p-2 flex items-center justify-center min-h-[420px]">
              {previewDoc.mime_type === 'application/pdf' || previewDoc.url.startsWith('data:application/pdf') ? (
                <iframe
                  src={previewDoc.url}
                  title={previewDoc.file_name}
                  className="h-[460px] w-full rounded border bg-white"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewDoc.url}
                  alt={previewDoc.file_name}
                  className="max-h-[460px] max-w-full rounded object-contain"
                />
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
