'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { authFetch, formatDate } from '@/lib/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader, LoadingBlock, ErrorState, EmptyState } from '@/components/dashboard-widgets';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Save, ScrollText } from 'lucide-react';

interface AuditRow {
  id: string;
  action_type: string;
  entity: string;
  entity_id: string | null;
  previous_value: unknown;
  new_value: unknown;
  remarks: string | null;
  created_at: string;
  actor_id: string | null;
  actor_name?: string;
}

export default function AdminSettingsPage() {
  const { session } = useAuth();
  const token = session?.access_token;
  const [settings, setSettings] = useState<{ key: string; value: Record<string, unknown>; updated_at: string }[]>([]);
  const [university, setUniversity] = useState('{\n  "name": "University of Karachi",\n  "program": "Morning Program"\n}');
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const res = await authFetch(token, '/api/reference');
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message || 'Failed to load settings');
      const list: { key: string; value: Record<string, unknown>; updated_at: string }[] = body.settings || [];
      setSettings(list);
      const uni = list.find((s) => s.key === 'university');
      if (uni) setUniversity(JSON.stringify(uni.value, null, 2));

      const aRes = await authFetch(token, '/api/admin/audit');
      const aBody = await aRes.json();
      if (aRes.ok) setAudit(aBody);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setBusy(true);
    setError('');
    setSaved('');
    try {
      let parsed: unknown;
      try {
        parsed = JSON.parse(university);
      } catch {
        throw new Error('University settings must be valid JSON');
      }
      const res = await authFetch(token, '/api/admin/manage', {
        method: 'POST',
        body: JSON.stringify({ entity: 'settings', data: { key: 'university', value: parsed } }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message || 'Save failed');
      setSaved('University settings saved.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <LoadingBlock rows={4} />;

  return (
    <div>
      <PageHeader title="Settings & Audit" description="University-wide configuration and the immutable record of every administrative action." />
      {error && <p className="mb-3 text-sm text-destructive">{error}</p>}
      {saved && <p className="mb-3 text-sm text-green-700">{saved}</p>}

      <Tabs defaultValue="settings">
        <TabsList>
          <TabsTrigger value="settings">University settings</TabsTrigger>
          <TabsTrigger value="audit" className="gap-1.5"><ScrollText className="h-3.5 w-3.5" /> Audit log</TabsTrigger>
        </TabsList>

        <TabsContent value="settings" className="mt-4">
          <Card className="max-w-2xl">
            <CardHeader className="pb-2"><CardTitle className="text-sm">University & program information</CardTitle></CardHeader>
            <CardContent className="space-y-3 py-4">
              <p className="text-xs text-muted-foreground">
                Stored as JSON and shown on the official honorarium form headings. Edit carefully — the form renders the &quot;name&quot; and &quot;program&quot; fields.
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="uni-json">Settings JSON</Label>
                <textarea
                  id="uni-json"
                  className="min-h-[220px] w-full rounded-md border bg-white p-3 font-mono text-xs"
                  value={university}
                  onChange={(e) => setUniversity(e.target.value)}
                />
              </div>
              <Button className="gap-1.5" onClick={save} disabled={busy}><Save className="h-4 w-4" /> {busy ? 'Saving…' : 'Save settings'}</Button>
            </CardContent>
          </Card>
          {settings.length > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              {settings.length} setting key(s) stored. Last updated {formatDate(settings[0].updated_at)}.
            </p>
          )}
        </TabsContent>

        <TabsContent value="audit" className="mt-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Audit log (immutable)</CardTitle></CardHeader>
            <CardContent className="py-4">
              {audit.length === 0 ? (
                <EmptyState title="No audit entries yet" hint="Every administrative action is recorded here automatically." />
              ) : (
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                      <tr><th className="px-3 py-2">When</th><th>User</th><th>Action</th><th>Entity</th><th>Remarks</th></tr>
                    </thead>
                    <tbody>
                      {audit.map((a) => (
                        <tr key={a.id} className="border-t align-top">
                          <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">{formatDate(a.created_at)}</td>
                          <td className="px-3 py-2">{a.actor_name || 'System'}</td>
                          <td className="px-3 py-2 font-medium">{a.action_type}</td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">{a.entity}</td>
                          <td className="px-3 py-2 text-xs">{a.remarks || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
