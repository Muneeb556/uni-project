'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { homeRouteFor, ROLE_LABELS } from '@/lib/roles';
import {
  LayoutDashboard, GraduationCap, FileText, CalendarCheck, ClipboardList,
  Users, Building2, BookOpen, CalendarRange, Settings, Bell, LogOut,
  Landmark, BadgeCheck, BarChart3, Menu, Sparkles, ChevronRight, Route,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const FACULTY_NAV: NavItem[] = [
  { href: '/faculty', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/faculty/profile', label: 'Profile & Documents', icon: GraduationCap },
  { href: '/faculty/timetable', label: 'My Timetable', icon: CalendarRange },
  { href: '/faculty/attendance', label: 'Attendance Log', icon: CalendarCheck },
  { href: '/faculty/courses', label: 'My Courses', icon: BookOpen },
  { href: '/faculty/bills', label: 'Honorarium Bills', icon: FileText },
  { href: '/faculty/track', label: 'Track Bill', icon: Route },
  { href: '/faculty/payments', label: 'Payment History', icon: Landmark },
  { href: '/faculty/notifications', label: 'Notifications', icon: Bell },
];

export const ADMIN_NAV: NavItem[] = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/users', label: 'Faculty & Applications', icon: Users },
  { href: '/admin/structure', label: 'Departments & Courses', icon: Building2 },
  { href: '/admin/semesters', label: 'Semesters & Deadlines', icon: CalendarRange },
  { href: '/admin/assignments', label: 'Assignments & Timetable', icon: ClipboardList },
  { href: '/admin/bills', label: 'All Bills', icon: FileText },
  { href: '/admin/reports', label: 'Reports & Analytics', icon: BarChart3 },
  { href: '/admin/settings', label: 'Settings & Audit', icon: Settings },
];

export const COORDINATOR_NAV: NavItem[] = [
  { href: '/department', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/department/faculty', label: 'Department Faculty', icon: Users },
  { href: '/department/schedules', label: 'Timetable', icon: CalendarRange },
  { href: '/department/attendance', label: 'Attendance Review', icon: CalendarCheck },
  { href: '/department/bills', label: 'Bill Review', icon: FileText },
];

export const ACCOUNTS_NAV: NavItem[] = [
  { href: '/accounts', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/accounts/bills', label: 'Bills Inbox', icon: FileText },
  { href: '/accounts/payments', label: 'Payments', icon: Landmark },
  { href: '/accounts/reports', label: 'Reports', icon: BarChart3 },
];

export const APPROVER_NAV: NavItem[] = [
  { href: '/approvals', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/approvals/bills', label: 'Final Approvals', icon: BadgeCheck },
];

export function useNavFor(roles: string[]): NavItem[] {
  if (roles.includes('super_admin')) return ADMIN_NAV;
  if (roles.includes('accounts')) return ACCOUNTS_NAV;
  if (roles.includes('approver')) return APPROVER_NAV;
  if (roles.includes('coordinator')) return COORDINATOR_NAV;
  return FACULTY_NAV;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { session, roles, profile, loading, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  React.useEffect(() => {
    if (!loading && !session) router.replace('/');
  }, [loading, session, router]);

  if (loading || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-500/20 text-teal-400 border border-teal-500/30 animate-pulse">
            <GraduationCap className="h-6 w-6" />
          </div>
          <p className="text-sm font-medium text-slate-300">Loading your workspace…</p>
        </div>
      </div>
    );
  }

  const nav = useNavFor(roles);
  const home = homeRouteFor(roles);
  const userInitials = (profile?.full_name || session.user.email || 'U')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0].toUpperCase())
    .join('');

  return (
    <div className="flex min-h-screen bg-slate-50/70 overflow-x-hidden">
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-800 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-300 shadow-2xl transition-transform duration-300 ease-in-out lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Brand Header */}
        <div className="flex items-center gap-3 border-b border-slate-800/80 px-5 py-5 bg-slate-950/40">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 shadow-md shadow-teal-500/20">
            <GraduationCap className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold tracking-tight text-white truncate">University of Karachi</p>
            <p className="text-[11px] font-medium text-teal-400 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-teal-400 inline-block" />
              Teaching Honorarium
            </p>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3.5 py-4">
          <div className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Main Navigation
          </div>
          {nav.map((item) => {
            const active = pathname === item.href || (item.href !== home && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  'group relative flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-all duration-150',
                  active
                    ? 'bg-gradient-to-r from-teal-500/20 to-teal-500/5 text-teal-300 border border-teal-500/30 shadow-sm'
                    : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                )}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-r-full bg-teal-400 shadow-sm shadow-teal-400" />
                )}
                <item.icon className={cn('h-4 w-4 transition-transform group-hover:scale-110', active ? 'text-teal-400' : 'text-slate-400')} />
                <span className="flex-1 truncate">{item.label}</span>
                {active && <ChevronRight className="h-3 w-3 text-teal-400/70" />}
              </Link>
            );
          })}
        </nav>

        {/* User Card & Sign Out */}
        <div className="border-t border-slate-800/90 bg-slate-950/60 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-800 text-teal-300 font-bold text-xs border border-slate-700 shadow-inner">
              {userInitials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-white">{profile?.full_name || session.user.email}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
                <span className="truncate text-[10px] font-medium text-slate-400 uppercase tracking-wide">
                  {ROLE_LABELS[roles[0]] || roles[0] || 'User'}
                </span>
              </div>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="mt-3 w-full justify-center gap-2 border-slate-800 bg-slate-900/80 text-xs text-slate-300 hover:border-slate-700 hover:bg-slate-800 hover:text-white"
            onClick={async () => {
              await signOut();
              router.replace('/');
            }}
          >
            <LogOut className="h-3.5 w-3.5 text-slate-400" /> Sign out
          </Button>
        </div>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-30 bg-slate-950/60 backdrop-blur-sm lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Main Workspace Area */}
      <div className="flex min-w-0 flex-1 flex-col lg:ml-64">
        {/* Top Header Bar for Context */}
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-slate-200/80 bg-white/85 px-4 backdrop-blur-md sm:px-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="lg:hidden text-slate-700" onClick={() => setMobileOpen(!mobileOpen)}>
              <Menu className="h-5 w-5" />
            </Button>
            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500">
              <span className="font-semibold text-slate-800">University of Karachi</span>
              <span className="text-slate-300">•</span>
              <span className="text-teal-700 font-medium bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200/60 flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-teal-600" />
                Fall 2026 Academic Session
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/" className="text-xs text-slate-500 hover:text-slate-800 font-medium transition-colors">
              Public Portal
            </Link>
            <div className="h-3.5 w-px bg-slate-200" />
            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200 shadow-sm">
              Online Mode
            </span>
          </div>
        </header>

        <main className="flex-1 px-4 py-8 sm:px-8 lg:px-10 max-w-7xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
