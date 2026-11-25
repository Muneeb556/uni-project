'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { authFetch, formatPKR } from '@/lib/shared';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader, LoadingBlock, ErrorState, EmptyState, StatusBadge } from '@/components/dashboard-widgets';
import { BookOpen } from 'lucide-react';

interface Assignment {
  id: string;
  classification: string;
  number_of_students: number;
  number_of_periods: number;
  compensation_method: string;
  theory_rate: number;
  practical_rate: number;
  conveyance: number;
  status: string;
  courses: { title: string; code: string; credit_hours: number } | null;
  semesters: { name: string } | null;
  departments: { name: string } | null;
}

export default function FacultyCoursesPage() {
  const { session } = useAuth();
  const token = session?.access_token;
  const [rows, setRows] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    authFetch(token, '/api/assignments')
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body?.error?.message || 'Failed to load courses');
        setRows(Array.isArray(body) ? body : []);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <LoadingBlock rows={4} />;
  if (error) return <ErrorState message={error} />;

  return (
    <div>
      <PageHeader title="My Courses" description="Course assignments agreed with your department, including compensation." />
      {rows.length === 0 ? (
        <EmptyState title="No assignments" hint="The registrar assigns courses after your application is approved." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {rows.map((a) => (
            <Card key={a.id}>
              <CardContent className="py-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{a.courses?.title || 'Course'}</p>
                    <p className="text-xs text-muted-foreground">
                      {a.courses?.code} · {a.semesters?.name} · {a.departments?.name}
                    </p>
                  </div>
                  <StatusBadge status={a.status} />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <p className="flex items-center gap-1"><BookOpen className="h-3.5 w-3.5" /> {a.classification}</p>
                  <p>Students: {a.number_of_students}</p>
                  <p>Method: {a.compensation_method}</p>
                  <p>Rate: {formatPKR(a.classification === 'Practical' ? a.practical_rate : a.theory_rate)}</p>
                  <p>Conveyance: {formatPKR(a.conveyance)}</p>
                  <p>Periods per class: {a.number_of_periods}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
