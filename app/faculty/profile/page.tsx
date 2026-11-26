'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { authFetch, formatDate, DOC_TYPES } from '@/lib/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PageHeader, StatusBadge, LoadingBlock, ErrorState } from '@/components/dashboard-widgets';
import { Upload, Trash2, Eye, FileWarning, ExternalLink } from 'lucide-react';

interface Doc {
  id: string;
  doc_type: string;
  file_name: string;
  status: string;
  remarks: string | null;
  file_size: number | null;
  created_at: string;
}

interface Profile {
  full_name: string;
  phone: string | null;
  cnic: string | null;
  designation: string | null;
  grade: string | null;
  qualification: string | null;
  bank_account_number: string | null;
  bank_name: string | null;
  university_branch: string | null;
  application_status: string;
}

const MAX_SIZE = 5 * 1024 * 1024;

export default function FacultyProfilePage() {
  const { session } = useAuth();
  const token = session?.access_token;
  const [profile, setProfile] = useState<Profile | null>(null);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [docType, setDocType] = useState<string>('CNIC');
  const [previewDoc, setPreviewDoc] = useState<{ file_name: string; mime_type: string | null; url: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({ phone: '', cnic: '', designation: '', grade: '', qualification: '', bank_account_number: '', bank_name: '', university_branch: '' });

  const load = React.useCallback(async () => {
    if (!token) return;
    try {
      const [pRes, dRes] = await Promise.all([
        authFetch(token, '/api/faculty/profile'),
        authFetch(token, '/api/faculty/documents'),
      ]);
      const p = await pRes.json();
      const d = await dRes.json();
      if (!pRes.ok) throw new Error(p?.error?.message || 'Failed to load profile');
      setProfile(p);
      setForm({
        phone: p.phone || '', cnic: p.cnic || '', designation: p.designation || '', grade: p.grade || '',
        qualification: p.qualification || '', bank_account_number: p.bank_account_number || '',
        bank_name: p.bank_name || '', university_branch: p.university_branch || '',
      });
      setDocs(Array.isArray(d) ? d : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError('');
    try {
      const res = await authFetch(token, '/api/faculty/profile', { method: 'PUT', body: JSON.stringify(form) });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message || 'Save failed');
      setProfile(body);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const upload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setUploadError('Choose a file first');
      return;
    }
    if (file.size > MAX_SIZE) {
      setUploadError('File exceeds the 5 MB limit');
      return;
    }
    if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.type)) {
      setUploadError('Only PDF, JPG and PNG files are allowed');
      return;
    }
    setUploading(true);
    setUploadError('');
    try {
      const buffer = await file.arrayBuffer();
      let binary = '';
      const bytes = new Uint8Array(buffer);
      for (let i = 0; i < bytes.length; i += 8192) {
        binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + 8192)) as number[]);
      }
      const res = await authFetch(token, '/api/faculty/documents', {
        method: 'POST',
        body: JSON.stringify({
          doc_type: docType,
          file_name: file.name,
          mime_type: file.type,
          file_size: file.size,
          content_base64: btoa(binary),
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message || 'Upload failed');
      if (fileRef.current) fileRef.current.value = '';
      await load();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const viewDoc = async (id: string) => {
    setUploadError('');
    const res = await authFetch(token, `/api/documents/view?id=${id}`);
    const body = await res.json();
    if (res.ok && body.url) {
      setPreviewDoc({
        file_name: body.file_name || 'Document',
        mime_type: body.mime_type || null,
        url: body.url,
      });
    } else {
      setUploadError(body?.error?.message || 'Could not open document');
    }
  };

  const removeDoc = async (id: string) => {
    const res = await authFetch(token, `/api/faculty/documents?id=${id}`, { method: 'DELETE' });
    if (res.ok) await load();
  };

  if (loading) return <LoadingBlock rows={4} />;
  if (error && !profile) return <ErrorState message={error} />;

  return (
    <div>
      <PageHeader title="Profile & Documents" description="Keep your information current; bills are generated from these details." />

      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-base">
            Professional profile
            <StatusBadge status={profile?.application_status || 'Draft'} />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveProfile} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {([['phone', 'Phone'], ['cnic', 'CNIC'], ['designation', 'Designation'], ['grade', 'Grade'], ['qualification', 'Qualification'], ['bank_account_number', 'Bank account number'], ['bank_name', 'Bank name'], ['university_branch', 'University branch']] as const).map(([key, label]) => (
              <div key={key} className="space-y-1.5">
                <Label>{label}</Label>
                <Input value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
              </div>
            ))}
            <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-3">
              <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save profile'}</Button>
              {saved && <span className="text-sm text-emerald-600">Saved</span>}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Documents</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {profile && ['Approved', 'Rejected'].includes(profile.application_status) ? (
            <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
              Your application is finalized ({profile.application_status}); documents are locked. Contact the registrar to request updates.
            </div>
          ) : (
            <div className="grid gap-3 rounded-md border bg-muted/30 p-4 sm:grid-cols-4">
              <div className="space-y-1.5">
                <Label>Document type</Label>
                <Select value={docType} onValueChange={setDocType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DOC_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>File (PDF, JPG, PNG — max 5 MB)</Label>
                <Input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" />
              </div>
              <div className="flex items-end">
                <Button onClick={upload} disabled={uploading} className="gap-2">
                  <Upload className="h-4 w-4" /> {uploading ? 'Uploading…' : 'Upload'}
                </Button>
              </div>
            </div>
          )}
          {uploadError && <p className="text-sm text-destructive">{uploadError}</p>}

          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">File</th>
                  <th className="px-3 py-2">Uploaded</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Remarks</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {docs.length === 0 && (
                  <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">No documents uploaded yet.</td></tr>
                )}
                {docs.map((d) => (
                  <tr key={d.id} className="border-t">
                    <td className="px-3 py-2 font-medium">{d.doc_type}</td>
                    <td className="max-w-[220px] truncate px-3 py-2">{d.file_name}</td>
                    <td className="px-3 py-2">{formatDate(d.created_at)}</td>
                    <td className="px-3 py-2"><StatusBadge status={d.status} /></td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {d.remarks || '—'}
                      {d.status === 'Changes Required' && <FileWarning className="ml-1 inline h-3.5 w-3.5 text-amber-500" />}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => viewDoc(d.id)} title="View"><Eye className="h-4 w-4" /></Button>
                        {!['Approved', 'Rejected'].includes(profile?.application_status || '') && (
                          <Button variant="ghost" size="icon" onClick={() => removeDoc(d.id)} title="Delete"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={Boolean(previewDoc)} onOpenChange={(open) => !open && setPreviewDoc(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-2 pr-6">
              <span className="truncate">{previewDoc?.file_name}</span>
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
                <iframe src={previewDoc.url} title={previewDoc.file_name} className="h-[460px] w-full rounded border bg-white" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewDoc.url} alt={previewDoc.file_name} className="max-h-[460px] max-w-full rounded object-contain" />
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
