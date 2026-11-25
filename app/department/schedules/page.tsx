'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { authFetch, formatDate, DAY_NAMES } from '@/lib/shared';
import { PageHeader, LoadingBlock, ErrorState, EmptyState } from '@/components/dashboard-widgets';
import { Card, CardContent } from '@/components/ui/card';

interface ScheduleRow {
  id: string;
  day_of_week: number;
  start_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  classroom: string | null;
  status: string;
  assignment: {
    courses: { title: string; code: string } | null;
    faculty_profiles: { full_name: string } | null;
  } | null;
}

export default function DepartmentSchedulesPage() {
  const { session } = useAuth();
  const token = session?.access_token;
  const [rows, setRows] = useState<ScheduleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    authFetch(token, '/api/schedules')
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body?.error?.message || 'Failed to load');
        setRows(Array.isArray(body) ? body : []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <LoadingBlock rows={4} />;
  if (error) return <ErrorState message={error} />;

  const weekDays = [1, 2, 3, 4, 5, 6, 0];

  return (
    <div>
      <PageHeader title="Department Timetable" description="Official weekly teaching schedule across your department." />
      {rows.length === 0 ? (
        <EmptyState title="No timetable entries" hint="Create entries from the Assignments & Timetable admin page." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {weekDays.map((day) => {
            const dayRows = rows.filter((r) => r.day_of_week === day && r.status === 'Active');
            return (
              <Card key={day}>
                <CardContent className="py-3">
                  <p className="mb-2 text-sm font-semibold">{DAY_NAMES[day]}</p>
                  {dayRows.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No classes</p>
                  ) : (
                    <div className="space-y-2">
                      {dayRows.map((r) => (
                        <div key={r.id} className="rounded-md border px-2.5 py-2">
                          <p className="text-xs font-medium">{r.assignment?.faculty_profiles?.full_name}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {r.assignment?.courses?.code} · {r.start_time}–{r.end_time} · {r.classroom || 'TBA'}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
