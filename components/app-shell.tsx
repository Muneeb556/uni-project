'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { homeRouteFor, ROLE_LABELS } from '@/lib/roles';
import {
  LayoutDashboard, GraduationCap, FileText, CalendarCheck, ClipboardList,
  Users, Building2, BookOpen, CalendarRange, Settings, Bell, LogOut,
  Landmark, BadgeCheck, BarChart3, Menu, ChevronLeft,
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
  { href: '/faculty/attendance', label: 'Attendance', icon: CalendarCheck },
  { href: '/faculty/courses', label: 'My Courses', icon: BookOpen },
  { href: '/faculty/bills', label: 'Honorarium Bills', icon: FileText },
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
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-pulse text-sm text-muted-foreground">Loading your workspace…</div>
      </div>
    );
  }

  const nav = useNavFor(roles);
  const home = homeRouteFor(roles);

  return (
    <div className="flex min-h-screen bg-background">
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r bg-[hsl(var(--sidebar))] text-[hsl(var(--sidebar-foreground))] transition-transform lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex items-center gap-2.5 border-b border-[hsl(var(--sidebar-border))] px-5 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-white/10">
            <GraduationCap className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight text-white">Teaching Honorarium</p>
            <p className="text-xs text-[hsl(var(--sidebar-foreground))]">University of Karachi</p>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
          {nav.map((item) => {
            const active = pathname === item.href || (item.href !== home && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'bg-[hsl(var(--sidebar-accent))] text-white'
                    : 'text-[hsl(var(--sidebar-foreground))] hover:bg-white/5 hover:text-white'
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-[hsl(var(--sidebar-border))] px-4 py-4">
          <p className="truncate text-sm font-medium text-white">{profile?.full_name || session.user.email}</p>
          <p className="truncate text-xs text-[hsl(var(--sidebar-foreground))]">
            {ROLE_LABELS[roles[0]] || roles[0] || 'User'}
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 w-full justify-start gap-2 text-[hsl(var(--sidebar-foreground))] hover:bg-white/5 hover:text-white"
            onClick={async () => {
              await signOut();
              router.replace('/');
            }}
          >
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        </div>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-white/95 px-4 backdrop-blur lg:hidden">
          <Button variant="ghost" size="icon" onClick={() => setMobileOpen(!mobileOpen)}>
            <Menu className="h-5 w-5" />
          </Button>
          <span className="text-sm font-semibold">Teaching Honorarium System</span>
        </header>
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
