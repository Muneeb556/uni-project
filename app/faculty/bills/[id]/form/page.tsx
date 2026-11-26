'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { authFetch, formatDate, formatPKR } from '@/lib/shared';
import { Button } from '@/components/ui/button';
import { LoadingBlock, ErrorState, StatusBadge } from '@/components/dashboard-widgets';
import { Printer, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface BillDetail {
  id: string;
  bill_number: string | null;
  status: string;
  theory_periods: number;
  theory_rate: number;
  theory_amount: number;
  practical_periods: number;
  practical_rate: number;
  practical_amount: number;
  conveyance: number;
  deductions: number;
  total_amount: number;
  grand_total: number;
  faculty_profiles: {
    full_name: string; designation: string | null; grade: string | null; cnic: string | null;
    bank_account_number: string | null; bank_name: string | null; university_branch: string | null;
    departments: { name: string } | null;
  } | null;
  semesters: { name: string; start_date: string; end_date: string } | null;
  bill_items: Array<{
    id: string; item_type: string; course_number: string | null; number_of_students: number | null;
    serial_number: number | null; entry_date: string | null; timings: string | null; number_of_periods: number; rate?: number | null;
  }>;
}

// Numbered rows matching the two side-by-side Theory tables on the paper form (28 + 24).
const LEFT_ROWS = 28;
const RIGHT_ROWS = 24;

export default function HonorariumFormPage() {
  const params = useParams<{ id: string }>();
  const billId = params.id;
  const { session } = useAuth();
  const token = session?.access_token;
  const [bill, setBill] = useState<BillDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token || !billId) return;
    authFetch(token, `/api/bills?id=${billId}`)
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body?.error?.message || 'Failed to load bill');
        setBill(body);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [token, billId]);

  if (loading) return <LoadingBlock rows={5} />;
  if (error) return <ErrorState message={error} />;
  if (!bill) return <ErrorState message="Bill not found" />;

  const fp = bill.faculty_profiles;
  const theoryItems = bill.bill_items.filter((i) => i.item_type === 'Theory');
  const additionalItems = bill.bill_items.filter((i) => i.item_type !== 'Theory');

  const emptyRow = (n: number) => (
    <tr key={`blank-${n}`} className="border-b">
      <td className="border-r px-1 py-[3px] text-center text-[10px]">{n}</td>
      <td className="border-r px-1 py-[3px]">&nbsp;</td>
      <td className="border-r px-1 py-[3px]">&nbsp;</td>
      <td className="border-r px-1 py-[3px]">&nbsp;</td>
      <td className="border-r px-1 py-[3px]">&nbsp;</td>
      <td className="px-1 py-[3px]">&nbsp;</td>
    </tr>
  );

  const filledRow = (item: (typeof theoryItems)[number], idx: number) => (
    <tr key={item.id} className="border-b">
      <td className="border-r px-1 py-[3px] text-center text-[10px]">{idx + 1}</td>
      <td className="border-r px-1 py-[3px] text-[10px]">{item.course_number || ''}</td>
      <td className="border-r px-1 py-[3px] text-center text-[10px]">{item.number_of_students ?? ''}</td>
      <td className="border-r px-1 py-[3px] text-[10px]">{item.entry_date ? formatDate(item.entry_date) : ''}</td>
      <td className="border-r px-1 py-[3px] text-[10px]">{item.timings || ''}</td>
      <td className="px-1 py-[3px] text-center text-[10px]">{item.number_of_periods || ''}</td>
    </tr>
  );

  const leftItems = theoryItems.slice(0, LEFT_ROWS);
  const rightItems = theoryItems.slice(LEFT_ROWS, LEFT_ROWS + RIGHT_ROWS);

  const theoryCell = (items: typeof theoryItems, count: number, offset: number) => (
    <tbody>
      {Array.from({ length: count }).map((_, i) => {
        const item = items[i];
        if (!item) return emptyRow(offset + i + 1);
        return filledRow(item, offset + i);
      })}
    </tbody>
  );

  return (
    <div>
      <div className="no-print mb-4 flex items-center justify-between">
        <Link href="/faculty/bills" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
          <ArrowLeft className="h-4 w-4" /> Back to bills
        </Link>
        <div className="flex items-center gap-3">
          <StatusBadge status={bill.status} />
          <Button onClick={() => window.print()} className="gap-2">
            <Printer className="h-4 w-4" /> Print / save as PDF
          </Button>
        </div>
      </div>

      {/* A4 print sheet */}
      <div className="print-form mx-auto w-full max-w-[820px] border border-gray-400 bg-white p-6 text-black shadow-sm print:border-0 print:shadow-none">
        <div className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full border border-gray-500 text-[8px] text-gray-500">
            LOGO
          </div>
          <h1 className="text-lg font-bold uppercase tracking-wide">University of Karachi</h1>
          <p className="text-xs font-medium">Morning Program</p>
          <p className="mt-1 border-y border-gray-500 py-1 text-sm font-bold uppercase">Teaching Honorarium</p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1 text-[11px]">
          <p><span className="font-semibold">Name of Faculty:</span> {fp?.full_name || ''}</p>
          <p><span className="font-semibold">Designation:</span> {fp?.designation || ''}</p>
          <p><span className="font-semibold">Grade:</span> {fp?.grade || ''}</p>
          <p><span className="font-semibold">Department:</span> {fp?.departments?.name || ''}</p>
          <p><span className="font-semibold">CNIC:</span> {fp?.cnic || ''}</p>
          <p><span className="font-semibold">Email:</span> {session?.user?.email || ''}</p>
          <p><span className="font-semibold">Bank Account No.:</span> {fp?.bank_account_number || ''}</p>
          <p><span className="font-semibold">Bank Name:</span> {fp?.bank_name || ''}</p>
          <p><span className="font-semibold">University Branch:</span> {fp?.university_branch || ''}</p>
          <p>
            <span className="font-semibold">Bill Period:</span>{' '}
            {bill.semesters ? `${bill.semesters.name} (${formatDate(bill.semesters.start_date)} – ${formatDate(bill.semesters.end_date)})` : ''}
          </p>
          <p className="col-span-2"><span className="font-semibold">Tracking ID / Bill No.:</span> <span className="font-mono font-semibold">{bill.bill_number || bill.id.slice(0, 8).toUpperCase()}</span></p>
        </div>

        <p className="mt-4 border border-gray-600 bg-gray-100 px-2 py-1 text-center text-xs font-bold uppercase">Theory</p>
        <div className="mt-2 grid grid-cols-2 gap-3">
          {[0, 1].map((half) => {
            const count = half === 0 ? LEFT_ROWS : RIGHT_ROWS;
            const items = half === 0 ? leftItems : rightItems;
            return (
              <table key={half} className="w-full border border-gray-500 text-[10px]">
                <thead>
                  <tr className="border-b border-gray-500 bg-gray-100 text-center font-semibold">
                    <th className="border-r border-gray-500 px-1 py-1 w-8">S.No</th>
                    <th className="border-r border-gray-500 px-1 py-1">Course No.</th>
                    <th className="border-r border-gray-500 px-1 py-1 w-14">No. of Students</th>
                    <th className="border-r border-gray-500 px-1 py-1">Date</th>
                    <th className="border-r border-gray-500 px-1 py-1">Timings</th>
                    <th className="px-1 py-1 w-14">Periods</th>
                  </tr>
                </thead>
                {theoryCell(items, count, half === 0 ? 0 : LEFT_ROWS)}
              </table>
            );
          })}
        </div>

        <p className="mt-4 border border-gray-600 bg-gray-100 px-2 py-1 text-center text-xs font-bold uppercase">Additional Theory / Practical</p>
        <table className="mt-2 w-full border border-gray-500 text-[10px]">
          <thead>
            <tr className="border-b border-gray-500 bg-gray-100 text-center font-semibold">
              <th className="border-r border-gray-500 px-1 py-1">Course No. / Title</th>
              <th className="border-r border-gray-500 px-1 py-1">Type</th>
              <th className="border-r border-gray-500 px-1 py-1">Date</th>
              <th className="border-r border-gray-500 px-1 py-1">Timings</th>
              <th className="border-r border-gray-500 px-1 py-1">Periods</th>
              <th className="px-1 py-1">Rate</th>
            </tr>
          </thead>
          <tbody>
            {additionalItems.length === 0 && (
              <tr><td colSpan={6} className="px-2 py-3 text-center text-gray-400">—</td></tr>
            )}
            {additionalItems.map((i) => (
              <tr key={i.id} className="border-b">
                <td className="border-r px-1 py-[3px]">{i.course_number || ''}</td>
                <td className="border-r px-1 py-[3px] text-center">{i.item_type}</td>
                <td className="border-r px-1 py-[3px]">{i.entry_date ? formatDate(i.entry_date) : ''}</td>
                <td className="border-r px-1 py-[3px]">{i.timings || ''}</td>
                <td className="border-r px-1 py-[3px] text-center">{i.number_of_periods || ''}</td>
                <td className="px-1 py-[3px] text-center">{formatPKR(i.rate ?? bill.practical_rate)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <table className="mt-4 w-full border border-gray-500 text-[11px]">
          <tbody>
            <tr className="border-b border-gray-500">
              <td className="border-r px-2 py-1.5 font-semibold">Total Theory Periods / Hours</td>
              <td className="border-r px-2 py-1.5 text-right">{bill.theory_periods}</td>
              <td className="border-r px-2 py-1.5 font-semibold">Theory Rate</td>
              <td className="px-2 py-1.5 text-right">{formatPKR(bill.theory_rate)}</td>
            </tr>
            <tr className="border-b border-gray-500">
              <td className="border-r px-2 py-1.5 font-semibold">Theory Amount</td>
              <td className="border-r px-2 py-1.5 text-right">{formatPKR(bill.theory_amount)}</td>
              <td className="border-r px-2 py-1.5 font-semibold">Total Practical Periods</td>
              <td className="px-2 py-1.5 text-right">{bill.practical_periods}</td>
            </tr>
            <tr className="border-b border-gray-500">
              <td className="border-r px-2 py-1.5 font-semibold">Practical Rate</td>
              <td className="border-r px-2 py-1.5 text-right">{formatPKR(bill.practical_rate)}</td>
              <td className="border-r px-2 py-1.5 font-semibold">Practical Amount</td>
              <td className="px-2 py-1.5 text-right">{formatPKR(bill.practical_amount)}</td>
            </tr>
            <tr className="border-b border-gray-500">
              <td className="border-r px-2 py-1.5 font-semibold">Total Amount</td>
              <td className="border-r px-2 py-1.5 text-right font-semibold">{formatPKR(bill.total_amount)}</td>
              <td className="border-r px-2 py-1.5 font-semibold">Conveyance Amount</td>
              <td className="px-2 py-1.5 text-right">{formatPKR(bill.conveyance)}</td>
            </tr>
            <tr className="bg-gray-100">
              <td className="border-r px-2 py-1.5 font-bold">GRAND TOTAL</td>
              <td className="border-r px-2 py-1.5 text-right font-bold">{formatPKR(bill.grand_total)}</td>
              <td className="border-r px-2 py-1.5 font-semibold">Checked by</td>
              <td className="px-2 py-1.5"></td>
            </tr>
          </tbody>
        </table>

        <div className="mt-8 grid grid-cols-3 gap-x-6 gap-y-8 text-[10px]">
          {['Signature of Claimant', 'Signature of Chairman / HOD', 'Dean / Faculty', 'Accountant Bill', 'Auditor', 'Director Finance'].map((s) => (
            <div key={s} className="border-t border-gray-700 pt-1 text-center">{s}</div>
          ))}
        </div>
        <div className="mt-6 text-center text-[10px]">
          <span className="inline-block border border-gray-700 px-6 py-1 font-semibold uppercase">Passed for payment</span>
        </div>
        <p className="mt-4 text-center text-[9px] text-gray-500">
          This digitally generated bill mirrors the official paper form; signatures are obtained physically. Amounts are calculated and validated by the system.
        </p>
      </div>
    </div>
  );
}
