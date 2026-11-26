'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { statusBadgeClass } from '@/lib/shared';
import { AlertCircle, Inbox } from 'lucide-react';

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card className="glass-card glass-card-hover relative overflow-hidden border border-slate-200/80 transition-all duration-200">
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-teal-500 via-blue-600 to-indigo-600 opacity-80" />
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2.5 pt-4">
        <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</CardTitle>
        {Icon && (
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-50 text-teal-700 border border-teal-100 shadow-sm">
            <Icon className="h-5 w-5" />
          </div>
        )}
      </CardHeader>
      <CardContent className="pb-4">
        <div className="text-2xl font-bold tracking-tight text-slate-900">{value}</div>
        {hint && (
          <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-teal-500" />
            {hint}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap shadow-sm transition-colors',
        statusBadgeClass(status),
        className
      )}
    >
      {status}
    </span>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 rounded-xl border border-slate-200/70 bg-gradient-to-r from-white via-slate-50/50 to-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-teal-600" />
          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{title}</h1>
        </div>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
    </div>
  );
}

export function LoadingBlock({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3.5 p-4 rounded-xl border border-slate-200/60 bg-white/60">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-11 w-full rounded-lg bg-slate-100" />
      ))}
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white/80 px-6 py-12 text-center shadow-sm">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        <Inbox className="h-6 w-6" />
      </div>
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      {hint && <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">{hint}</p>}
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-rose-200 bg-rose-50/80 px-6 py-8 text-center shadow-sm">
      <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-rose-100 text-rose-600">
        <AlertCircle className="h-5 w-5" />
      </div>
      <p className="text-sm font-semibold text-rose-900">Something went wrong</p>
      <p className="mt-1 text-xs text-rose-700 max-w-md mx-auto">{message}</p>
    </div>
  );
}
