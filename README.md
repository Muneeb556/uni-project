# University of Karachi — Visiting Faculty Management & Teaching Honorarium System

A complete, database-backed system for managing visiting faculty at the University of Karachi (Morning Program): registration, document verification, course assignments and timetables, validated attendance, semester closing, the official Teaching Honorarium bill, deadline-enforced submissions, department review, Accounts processing, final approval, and payment recording.

## Roles

| Role | Home | What they do |
| --- | --- | --- |
| Visiting Faculty | `/faculty` | Profile, documents, timetable, attendance, bills, payments |
| Super Admin | `/admin` | Users, applications, departments/courses, semesters & deadlines, assignments, reports, settings & audit |
| Department Coordinator | `/department` | Faculty, timetable, attendance review, bill review |
| Accounts Officer | `/accounts` | Bills inbox (physical receipt, verify/return/forward), payments |
| Approving Authority | `/approvals` | Final authorization of financial claims |

Demo accounts (created on first sign-in via the one-click demo buttons on the login page):

- Super Admin — `registrar@uok-demo.edu` / `Admin#12345`
- Coordinator — `cs.chairman@uok-demo.edu` / `Coord#12345`
- Accounts — `accounts@uok-demo.edu` / `Accnt#12345`
- Approver — `dean.finance@uok-demo.edu` / `Approv#12345`

- Faculty (demo) — `a.raza@uok-demo.edu` / `Fac#12345` — comes with an approved application, a Database Systems assignment, a published Mon/Wed timetable, 22 approved attendance records, and a locked attendance statement, so the full faculty flow (attendance → bill generation → printing → submission) can be exercised immediately

Faculty members can also register themselves on the login page, upload documents, and proceed after approval.

## Tech stack

- **Next.js 13 (App Router)** with TypeScript, Tailwind CSS and shadcn/ui
- **API routes** under `app/api/**` implement the REST backend; all authorization and financial calculations happen there — the browser is never trusted with roles, faculty IDs, or amounts
- **Supabase** (PostgreSQL + Auth + Storage) for persistence. Migrations live in `supabase/migrations/`
- Private storage bucket `faculty-documents`; documents are served through short-lived signed URLs after an ownership check

## Key business rules enforced server-side

1. Attendance must match the approved timetable (day, date range, time window) or is flagged for review; duplicates are rejected by a database constraint
2. Bills are generated only from `Approved` attendance plus a Verified/Locked semester closure statement; amounts are recomputed from assignment rates on the server
3. Submission deadline = `extension_date || billing_deadline` + `deadline_time` (Asia/Karachi) compared server-side; late submissions become **Late Rejected** with the attempt recorded
4. Every bill status transition is validated against a permission-checked workflow map; faculty can never approve their own bills
5. Payments guard against overpayment; a bill becomes Paid only when payments cover the grand total
6. Schedule changes preserve history (Superseded rows + revision records + faculty notification); audit logs are append-only

## The official honorarium form

`app/faculty/bills/[id]/form` reproduces the University of Karachi Teaching Honorarium paper form: university/program headings, faculty information grid, the two side-by-side Theory tables (28 + 24 numbered rows), the Additional Theory/Practical section, the calculation block (theory/practical periods × rate, total, conveyance, grand total, checked by), six signature blocks and "Passed for payment". Use the browser's Print dialog (A4, black-and-white) to produce the physical form for Accounts.

## Setup

```bash
npm install
cp .env.example .env.local   # fill in your Supabase URL and anon key
npm run dev
```

The database schema and reference seed data (departments, courses, Fall 2026 semester with billing deadlines, compensation rates, university settings) are applied through Supabase migrations.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key used by the browser client |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only key used by API routes for auth verification and privileged operations (never exposed to the browser) |

## Deployment

Build and deploy as a standard Next.js application (Vercel/Netlify or a Node host). Set the three environment variables above in the host's dashboard. Run the migrations against the target Supabase project once; the storage bucket is created by the migration.
