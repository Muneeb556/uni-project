export const BILL_STATUSES = [
  'Draft',
  'Submitted',
  'Under Review',
  'Changes Required',
  'Department Approved',
  'Rejected',
  'Late Rejected',
  'Sent to Accounts',
  'Physical Bill Received',
  'Accounts Review',
  'Accounts Returned',
  'Accounts Verified',
  'Awaiting Final Approval',
  'Approved for Payment',
  'Payment Processing',
  'Partially Paid',
  'Paid',
] as const;

export type BillStatus = (typeof BILL_STATUSES)[number];

export const DOC_TYPES = [
  'CNIC',
  'CV',
  'Educational Certificate',
  'Experience Certificate',
  'Photograph',
  'Other',
] as const;

export const STATUS_BADGE_CLASSES: Record<string, string> = {
  Draft: 'bg-slate-100 text-slate-700 border-slate-200',
  Submitted: 'bg-blue-50 text-blue-700 border-blue-200',
  'Under Review': 'bg-amber-50 text-amber-700 border-amber-200',
  'Changes Required': 'bg-amber-50 text-amber-700 border-amber-200',
  'Accounts Returned': 'bg-amber-50 text-amber-700 border-amber-200',
  Pending: 'bg-amber-50 text-amber-700 border-amber-200',
  Scheduled: 'bg-slate-100 text-slate-700 border-slate-200',
  Resubmitted: 'bg-blue-50 text-blue-700 border-blue-200',
  'Department Approved': 'bg-teal-50 text-teal-700 border-teal-200',
  'Sent to Accounts': 'bg-teal-50 text-teal-700 border-teal-200',
  'Physical Bill Received': 'bg-teal-50 text-teal-700 border-teal-200',
  'Accounts Review': 'bg-blue-50 text-blue-700 border-blue-200',
  'Accounts Verified': 'bg-teal-50 text-teal-700 border-teal-200',
  'Awaiting Final Approval': 'bg-blue-50 text-blue-700 border-blue-200',
  'Approved for Payment': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Payment Processing': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Paid: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  Rejected: 'bg-red-50 text-red-700 border-red-200',
  'Late Rejected': 'bg-red-50 text-red-700 border-red-200',
  Cancelled: 'bg-slate-100 text-slate-500 border-slate-200',
  'Not Uploaded': 'bg-slate-100 text-slate-500 border-slate-200',
  SubmittedDoc: 'bg-blue-50 text-blue-700 border-blue-200',
};

export function statusBadgeClass(status: string): string {
  return STATUS_BADGE_CLASSES[status] || 'bg-slate-100 text-slate-700 border-slate-200';
}

export function formatPKR(amount: number | string | null | undefined): string {
  const n = typeof amount === 'string' ? Number(amount) : amount;
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return `PKR ${n.toLocaleString('en-PK', { maximumFractionDigits: 0 })}`;
}

export function formatDate(date: string | null | undefined): string {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(date: string | null | undefined): string {
  if (!date) return '—';
  return new Date(date).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function authFetch(
  token: string | null | undefined,
  input: string,
  init?: RequestInit
): Promise<Response> {
  const headers = new Headers(init?.headers || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init?.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  return fetch(input, { ...init, headers });
}
