'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { authFetch, formatDateTime } from '@/lib/shared';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageHeader, LoadingBlock, ErrorState, EmptyState } from '@/components/dashboard-widgets';
import { Bell } from 'lucide-react';

interface Notification {
  id: string;
  title: string;
  body: string | null;
  category: string;
  link: string | null;
  read: boolean;
  created_at: string;
}

export default function FacultyNotificationsPage() {
  const { session } = useAuth();
  const token = session?.access_token;
  const [rows, setRows] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = React.useCallback(async () => {
    if (!token) return;
    try {
      const res = await authFetch(token, '/api/notifications');
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message || 'Failed to load notifications');
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

  const markAll = async () => {
    await authFetch(token, '/api/notifications', { method: 'PATCH', body: JSON.stringify({ all: true }) });
    await load();
  };

  if (loading) return <LoadingBlock rows={4} />;
  if (error) return <ErrorState message={error} />;

  return (
    <div>
      <PageHeader
        title="Notifications"
        description="Application, attendance, billing and payment updates."
        actions={
          <Button variant="outline" onClick={markAll} disabled={rows.every((r) => r.read)}>Mark all read</Button>
        }
      />
      {rows.length === 0 ? (
        <EmptyState title="No notifications" />
      ) : (
        <div className="space-y-2">
          {rows.map((n) => (
            <Card key={n.id} className={n.read ? 'opacity-70' : 'border-l-4 border-l-primary'}>
              <CardContent className="flex items-start justify-between gap-3 py-3">
                <div>
                  <p className="flex items-center gap-2 text-sm font-medium">
                    <Bell className="h-3.5 w-3.5 text-muted-foreground" /> {n.title}
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">{n.category}</span>
                  </p>
                  {n.body && <p className="mt-0.5 text-sm text-muted-foreground">{n.body}</p>}
                  <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(n.created_at)}</p>
                </div>
                {!n.read && (
                  <Button variant="ghost" size="sm" onClick={async () => {
                    await authFetch(token, '/api/notifications', { method: 'PATCH', body: JSON.stringify({ ids: [n.id] }) });
                    await load();
                  }}>Mark read</Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
