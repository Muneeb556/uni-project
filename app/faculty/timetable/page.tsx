'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { authFetch, formatDate, DAY_NAMES } from '@/lib/shared';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader, LoadingBlock, ErrorState, EmptyState } from '@/components/dashboard-widgets';
import { CalendarRange } from 'lucide-react';

interface ScheduleRow {
  id: string;
  day_of_week: number;
  start_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  classroom: string | null;
  number_of_periods: number;
  status: string;
  assignment: { courses: { title: string; code: string } | null } | null;
}

export default function FacultyTimetablePage() {
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
        if (!r.ok) throw new Error(body?.error?.message || 'Failed to load timetable');
        setRows(Array.isArray(body) ? body : []);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <LoadingBlock rows={4} />;
  if (error) return <ErrorState message={error} />;

  const weekDays = [1, 2, 3, 4, 5, 6, 0];
  const byDay = weekDays.map((d) => rows.filter((r) => r.day_of_week === d && r.status === 'Active'));

  return (
    <div>
      <PageHeader title="My Timetable" description="Official teaching schedule published by your department." />
      {rows.length === 0 ? (
        <EmptyState title="No timetable entries yet" hint="Your department coordinator publishes the official timetable here." />
      ) : (
        <>
          <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {byDay.map((dayRows, i) => (
              <Card key={i} className={dayRows.length === 0 ? 'opacity-50' : ''}>
                <CardContent className="py-3">
                  <p className="mb-2 text-sm font-semibold">{DAY_NAMES[weekDays[i]]}</p>
                  {dayRows.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No classes</p>
                  ) : (
                    <div className="space-y-2">
                      {dayRows.map((r) => (
                        <div key={r.id} className="rounded-md border px-2.5 py-2">
                          <p className="text-xs font-medium">{r.assignment?.courses?.code}</p>
                          <p className="text-[11px] text-muted-foreground">{r.start_time}–{r.end_time} · {r.classroom || 'TBA'}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
          <Card>
            <CardContent className="py-4">
              <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold"><CalendarRange className="h-4 w-4" /> Full schedule</h2>
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                    <tr><th className="px-3 py-2">Day</th><th className="px-3 py-2">Course</th><th className="px-3 py-2">Time</th><th className="px-3 py-2">Room</th><th className="px-3 py-2">Effective</th><th className="px-3 py-2">Status</th></tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id} className="border-t">
                        <td className="px-3 py-2">{DAY_NAMES[r.day_of_week]}</td>
                        <td className="px-3 py-2">{r.assignment?.courses ? `${r.assignment.courses.code} — ${r.assignment.courses.title}` : '—'}</td>
                        <td className="px-3 py-2">{r.start_time}–{r.end_time}</td>
                        <td className="px-3 py-2">{r.classroom || '—'}</td>
                        <td className="px-3 py-2">{formatDate(r.start_date)} – {formatDate(r.end_date)}</td>
                        <td className="px-3 py-2">{r.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
