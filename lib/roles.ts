export const ROLE_LABELS: Record<string, string> = {
  faculty: 'Visiting Faculty',
  super_admin: 'Super Admin',
  coordinator: 'Department Coordinator / Chairman',
  accounts: 'Accounts Officer',
  approver: 'Approving Authority',
};

export function homeRouteFor(roles: string[]): string {
  if (roles.includes('super_admin')) return '/admin';
  if (roles.includes('accounts')) return '/accounts';
  if (roles.includes('approver')) return '/approvals';
  if (roles.includes('coordinator')) return '/department';
  return '/faculty';
}
