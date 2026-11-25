'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { authFetch } from '@/lib/shared';
import { PageHeader, LoadingBlock, ErrorState, EmptyState, StatusBadge } from '@/components/dashboard-widgets';
import { Card, CardContent } from '@/components/ui/card';

interface Row {
  id: string;
  full_name: string;
  designation: string | null;
  qualification: string | null;
  application_status: string;
  departments: { name: string } | null;
  faculty_documents: Array<{ id: string; doc_type: string; status: string }>;
}

export default function DepartmentFacultyPage() {
  const { session } = useAuth();
  const token = session?.access_token;
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    authFetch(token, '/api/faculty/list')
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body?.error?.message || 'Failed to load');
        setRows(body);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <LoadingBlock rows={4} />;
  if (error) return <ErrorState message={error} />;

  return (
    <div>
      <PageHeader title="Department Faculty" description="Visiting faculty assigned to your department and their verification progress." />
      {rows.length === 0 ? (
        <EmptyState title="No faculty in your department yet" />
      ) : (
        <Card>
          <CardContent className="py-4">
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                  <tr><th className="px-3 py-2">Name</th><th>Designation</th><th>Department</th><th>Documents</th><th>Application</th></tr>
                </thead>
                <tbody>
                  {rows.map((f) => (
                    <tr key={f.id} className="border-t">
                      <td className="px-3 py-2 font-medium">{f.full_name}</td>
                      <td className="px-3 py-2">{f.designation || '—'}</td>
                      <td className="px-3 py-2">{f.departments?.name || '—'}</td>
                      <td className="px-3 py-2">
                        {(f.faculty_documents || []).length === 0 ? '—' : (
                          <span className="text-xs text-muted-foreground">
                            {(f.faculty_documents || []).map((d) => `${d.doc_type}: ${d.status}`).join(' · ')}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2"><StatusBadge status={f.application_status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
