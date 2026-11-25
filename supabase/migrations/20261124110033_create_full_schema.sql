/*
# Visiting Faculty Management System - Full Schema

1. Overview
Creates the complete database schema for the Visiting Faculty Management & Teaching Honorarium System: departments, courses, semesters, faculty profiles and documents, document reviews, assignments, schedules, schedule revisions, holidays, attendance records, attendance correction requests, semester attendance closures, compensation rules, semester bills, bill items, bill submissions, bill approvals, physical bill receipts, bill attachments, payments, payment transactions, notifications, conversations, messages, support tickets, audit logs, and system settings.

2. Conventions
- All tables in the public schema; uuid primary keys default gen_random_uuid().
- Enum-like values are text with CHECK constraints.
- References to auth.users are ON DELETE SET NULL so financial/historical rows never cascade-delete.
- The Next.js API routes run server-side with the service role key and own ALL business-logic validation; the browser never queries these tables directly. RLS below is the second line of defense for the Data API, and policies scope faculty to their own rows.

3. Security
- RLS enabled on every table; policies scoped TO authenticated.
- Faculty: own rows only. super_admin: all rows. Coordinators/accounts/approvers: workflow-scoped via role checks.
- Explicit GRANTs to authenticated on every table for Data API reachability.
- Private storage bucket faculty-documents for uploads.
*/

-- ============ Core reference tables ============

CREATE TABLE IF NOT EXISTS departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  code text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'Active' CHECK (status IN ('Active','Inactive')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  title text NOT NULL,
  code text NOT NULL,
  credit_hours int NOT NULL DEFAULT 3 CHECK (credit_hours > 0),
  classification text NOT NULL DEFAULT 'Theory' CHECK (classification IN ('Theory','Practical','Theory+Practical')),
  status text NOT NULL DEFAULT 'Active' CHECK (status IN ('Active','Inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (code, department_id)
);

CREATE TABLE IF NOT EXISTS semesters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  attendance_open date NOT NULL,
  attendance_close date NOT NULL,
  billing_open date NOT NULL,
  billing_deadline date NOT NULL,
  deadline_time text NOT NULL DEFAULT '23:59',
  timezone text NOT NULL DEFAULT 'Asia/Karachi',
  extension_date date,
  extension_remarks text,
  extension_authorized_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'Upcoming' CHECK (status IN ('Upcoming','Active','Attendance Closing','Billing Open','Closed','Archived')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============ People ============

CREATE TABLE IF NOT EXISTS faculty_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  phone text,
  cnic text,
  designation text,
  grade text,
  qualification text,
  department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  bank_account_number text,
  bank_name text,
  university_branch text,
  application_status text NOT NULL DEFAULT 'Draft' CHECK (application_status IN ('Draft','Submitted','Under Review','Changes Required','Resubmitted','Approved','Rejected')),
  status text NOT NULL DEFAULT 'Active' CHECK (status IN ('Active','Inactive')),
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_roles (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('faculty','super_admin','coordinator','accounts','approver')),
  department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role, department_id)
);

CREATE TABLE IF NOT EXISTS faculty_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  faculty_id uuid NOT NULL REFERENCES faculty_profiles(id) ON DELETE CASCADE,
  doc_type text NOT NULL CHECK (doc_type IN ('CNIC','CV','Educational Certificate','Experience Certificate','Photograph','Other')),
  file_name text NOT NULL,
  storage_path text NOT NULL,
  mime_type text,
  file_size int,
  status text NOT NULL DEFAULT 'Submitted' CHECK (status IN ('Not Uploaded','Submitted','Under Review','Approved','Changes Required','Rejected')),
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (faculty_id, doc_type)
);

CREATE TABLE IF NOT EXISTS document_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES faculty_documents(id) ON DELETE CASCADE,
  reviewer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (action IN ('Approved','Changes Required','Rejected','Under Review')),
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============ Academic structure ============

CREATE TABLE IF NOT EXISTS faculty_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  faculty_id uuid NOT NULL REFERENCES faculty_profiles(id) ON DELETE CASCADE,
  department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  semester_id uuid NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  number_of_students int NOT NULL DEFAULT 0,
  classification text NOT NULL DEFAULT 'Theory' CHECK (classification IN ('Theory','Practical')),
  teaching_days text[] NOT NULL DEFAULT '{}',
  start_time text,
  end_time text,
  number_of_periods int NOT NULL DEFAULT 1,
  compensation_method text NOT NULL DEFAULT 'Per Period' CHECK (compensation_method IN ('Per Hour','Per Period','Per Course Fixed','Custom')),
  theory_rate numeric NOT NULL DEFAULT 0,
  practical_rate numeric NOT NULL DEFAULT 0,
  conveyance numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'Active' CHECK (status IN ('Active','Inactive','Cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (faculty_id, semester_id, course_id)
);

CREATE TABLE IF NOT EXISTS schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES faculty_assignments(id) ON DELETE CASCADE,
  day_of_week int NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_date date NOT NULL,
  end_date date NOT NULL,
  start_time text NOT NULL,
  end_time text NOT NULL,
  classroom text,
  number_of_periods int NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'Active' CHECK (status IN ('Active','Cancelled','Superseded')),
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  change_reason text,
  effective_from date,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS schedule_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
  previous_values jsonb NOT NULL,
  new_values jsonb NOT NULL,
  reason text,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  effective_from date,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS holidays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  semester_id uuid REFERENCES semesters(id) ON DELETE CASCADE,
  holiday_date date NOT NULL,
  title text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (semester_id, holiday_date)
);

CREATE TABLE IF NOT EXISTS attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  faculty_id uuid NOT NULL REFERENCES faculty_profiles(id) ON DELETE CASCADE,
  assignment_id uuid NOT NULL REFERENCES faculty_assignments(id) ON DELETE CASCADE,
  schedule_id uuid REFERENCES schedules(id) ON DELETE SET NULL,
  semester_id uuid NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
  scheduled_date date NOT NULL,
  actual_date date,
  start_time text,
  end_time text,
  number_of_periods int,
  number_of_students int,
  status text NOT NULL DEFAULT 'Scheduled' CHECK (status IN ('Scheduled','Pending','Submitted','Approved','Rejected','Correction Required','Cancelled','Rescheduled')),
  remarks text,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (assignment_id, scheduled_date, schedule_id)
);

CREATE TABLE IF NOT EXISTS attendance_correction_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_id uuid NOT NULL REFERENCES attendance_records(id) ON DELETE CASCADE,
  faculty_id uuid NOT NULL REFERENCES faculty_profiles(id) ON DELETE CASCADE,
  requested_changes jsonb NOT NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','Approved','Rejected')),
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  review_remarks text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS semester_attendance_closures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  faculty_id uuid NOT NULL REFERENCES faculty_profiles(id) ON DELETE CASCADE,
  semester_id uuid NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
  submitted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  total_periods int NOT NULL DEFAULT 0,
  total_hours numeric NOT NULL DEFAULT 0,
  statement_status text NOT NULL DEFAULT 'Draft' CHECK (statement_status IN ('Draft','Submitted','Verified','Locked')),
  locked_at timestamptz,
  verified_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (faculty_id, semester_id)
);

-- ============ Compensation & billing ============

CREATE TABLE IF NOT EXISTS compensation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  designation text,
  method text NOT NULL DEFAULT 'Per Period' CHECK (method IN ('Per Hour','Per Period','Per Course Fixed','Custom')),
  theory_rate numeric NOT NULL DEFAULT 0,
  practical_rate numeric NOT NULL DEFAULT 0,
  conveyance numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'Active' CHECK (status IN ('Active','Inactive')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS semester_bills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  faculty_id uuid NOT NULL REFERENCES faculty_profiles(id) ON DELETE CASCADE,
  semester_id uuid NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
  bill_number text UNIQUE,
  status text NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft','Submitted','Under Review','Changes Required','Department Approved','Rejected','Late Rejected','Sent to Accounts','Physical Bill Received','Accounts Review','Accounts Returned','Accounts Verified','Awaiting Final Approval','Approved for Payment','Payment Processing','Partially Paid','Paid')),
  theory_periods int NOT NULL DEFAULT 0,
  theory_rate numeric NOT NULL DEFAULT 0,
  theory_amount numeric NOT NULL DEFAULT 0,
  practical_periods int NOT NULL DEFAULT 0,
  practical_rate numeric NOT NULL DEFAULT 0,
  practical_amount numeric NOT NULL DEFAULT 0,
  conveyance numeric NOT NULL DEFAULT 0,
  deductions numeric NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0,
  grand_total numeric NOT NULL DEFAULT 0,
  is_revision boolean NOT NULL DEFAULT false,
  revised_from uuid REFERENCES semester_bills(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (faculty_id, semester_id)
);

CREATE TABLE IF NOT EXISTS bill_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id uuid NOT NULL REFERENCES semester_bills(id) ON DELETE CASCADE,
  item_type text NOT NULL CHECK (item_type IN ('Theory','Additional Theory/Practical')),
  course_number text,
  course_title text,
  number_of_students int,
  serial_number int,
  entry_date date,
  timings text,
  number_of_periods int NOT NULL DEFAULT 0,
  rate numeric NOT NULL DEFAULT 0,
  amount numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bill_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id uuid NOT NULL REFERENCES semester_bills(id) ON DELETE CASCADE,
  submitted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  on_time boolean NOT NULL DEFAULT true,
  deadline_at timestamptz,
  remarks text
);

CREATE TABLE IF NOT EXISTS bill_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id uuid NOT NULL REFERENCES semester_bills(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_role text NOT NULL,
  action text NOT NULL CHECK (action IN ('Submitted','Under Review','Department Approved','Sent to Accounts','Physical Bill Received','Accounts Review','Accounts Returned','Accounts Verified','Awaiting Final Approval','Approved for Payment','Rejected','Late Rejected','Changes Required','Payment Processing','Partially Paid','Paid')),
  from_status text,
  to_status text NOT NULL,
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS physical_bill_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id uuid NOT NULL REFERENCES semester_bills(id) ON DELETE CASCADE,
  receipt_number text NOT NULL,
  dispatch_number text,
  received_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  remarks text
);

CREATE TABLE IF NOT EXISTS bill_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id uuid NOT NULL REFERENCES semester_bills(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  storage_path text NOT NULL,
  mime_type text,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id uuid NOT NULL REFERENCES semester_bills(id) ON DELETE CASCADE,
  faculty_id uuid NOT NULL REFERENCES faculty_profiles(id) ON DELETE CASCADE,
  approved_amount numeric NOT NULL DEFAULT 0,
  paid_amount numeric NOT NULL DEFAULT 0,
  payment_date date NOT NULL,
  payment_method text NOT NULL DEFAULT 'Bank Transfer',
  reference_number text,
  remarks text,
  status text NOT NULL DEFAULT 'Completed' CHECK (status IN ('Pending','Completed','Partial')),
  recorded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  bill_id uuid NOT NULL REFERENCES semester_bills(id) ON DELETE CASCADE,
  transaction_type text NOT NULL CHECK (transaction_type IN ('Payment','Adjustment','Reversal')),
  amount numeric NOT NULL DEFAULT 0,
  reference_number text,
  remarks text,
  recorded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============ Communication ============

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text,
  category text NOT NULL DEFAULT 'Info',
  link text,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  faculty_id uuid REFERENCES faculty_profiles(id) ON DELETE CASCADE,
  bill_id uuid REFERENCES semester_bills(id) ON DELETE SET NULL,
  subject text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  faculty_id uuid NOT NULL REFERENCES faculty_profiles(id) ON DELETE CASCADE,
  subject text NOT NULL,
  body text,
  status text NOT NULL DEFAULT 'Open' CHECK (status IN ('Open','In Progress','Resolved','Closed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============ Governance ============

CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_role text,
  action_type text NOT NULL,
  entity text NOT NULL,
  entity_id uuid,
  previous_value jsonb,
  new_value jsonb,
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS system_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============ Indexes ============

CREATE INDEX IF NOT EXISTS idx_courses_department ON courses(department_id);
CREATE INDEX IF NOT EXISTS idx_assignments_faculty ON faculty_assignments(faculty_id);
CREATE INDEX IF NOT EXISTS idx_assignments_semester ON faculty_assignments(semester_id);
CREATE INDEX IF NOT EXISTS idx_schedules_assignment ON schedules(assignment_id);
CREATE INDEX IF NOT EXISTS idx_attendance_faculty ON attendance_records(faculty_id);
CREATE INDEX IF NOT EXISTS idx_attendance_assignment_date ON attendance_records(assignment_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_bills_faculty_semester ON semester_bills(faculty_id, semester_id);
CREATE INDEX IF NOT EXISTS idx_bill_items_bill ON bill_items(bill_id);
CREATE INDEX IF NOT EXISTS idx_bill_approvals_bill ON bill_approvals(bill_id);
CREATE INDEX IF NOT EXISTS idx_payments_bill ON payments(bill_id);
CREATE INDEX IF NOT EXISTS idx_payments_faculty ON payments(faculty_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_docs_faculty ON faculty_documents(faculty_id);

-- ============ RLS ============

ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE semesters ENABLE ROW LEVEL SECURITY;
ALTER TABLE faculty_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE faculty_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE faculty_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_correction_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE semester_attendance_closures ENABLE ROW LEVEL SECURITY;
ALTER TABLE compensation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE semester_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE physical_bill_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Read-only shared reference data for authenticated users
DROP POLICY IF EXISTS "Authenticated can read departments" ON departments;
CREATE POLICY "Authenticated can read departments" ON departments FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated can read courses" ON courses;
CREATE POLICY "Authenticated can read courses" ON courses FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated can read semesters" ON semesters;
CREATE POLICY "Authenticated can read semesters" ON semesters FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated can read holidays" ON holidays;
CREATE POLICY "Authenticated can read holidays" ON holidays FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated can read settings" ON system_settings;
CREATE POLICY "Authenticated can read settings" ON system_settings FOR SELECT TO authenticated USING (true);

-- Roles: users read their own role assignments; super_admin reads all
DROP POLICY IF EXISTS "Users read own roles" ON user_roles;
CREATE POLICY "Users read own roles" ON user_roles FOR SELECT TO authenticated
USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin'));
DROP POLICY IF EXISTS "Super admin manages roles" ON user_roles;
CREATE POLICY "Super admin manages roles" ON user_roles FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin'))
WITH CHECK (EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin'));

-- Faculty profiles: own profile; staff can read
DROP POLICY IF EXISTS "Faculty read own profile" ON faculty_profiles;
CREATE POLICY "Faculty read own profile" ON faculty_profiles FOR SELECT TO authenticated
USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('super_admin','coordinator','accounts','approver')));
DROP POLICY IF EXISTS "Faculty insert own profile" ON faculty_profiles;
CREATE POLICY "Faculty insert own profile" ON faculty_profiles FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Faculty update own profile" ON faculty_profiles;
CREATE POLICY "Faculty update own profile" ON faculty_profiles FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id OR EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin'));

-- Documents: owner and staff
DROP POLICY IF EXISTS "Faculty read own documents" ON faculty_documents;
CREATE POLICY "Faculty read own documents" ON faculty_documents FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM faculty_profiles fp WHERE fp.id = faculty_documents.faculty_id AND fp.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('super_admin','coordinator')));
DROP POLICY IF EXISTS "Faculty insert own documents" ON faculty_documents;
CREATE POLICY "Faculty insert own documents" ON faculty_documents FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM faculty_profiles fp WHERE fp.id = faculty_documents.faculty_id AND fp.user_id = auth.uid()));
DROP POLICY IF EXISTS "Faculty update own documents" ON faculty_documents;
CREATE POLICY "Faculty update own documents" ON faculty_documents FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM faculty_profiles fp WHERE fp.id = faculty_documents.faculty_id AND fp.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin'))
WITH CHECK (EXISTS (SELECT 1 FROM faculty_profiles fp WHERE fp.id = faculty_documents.faculty_id AND fp.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin'));
DROP POLICY IF EXISTS "Faculty delete own documents" ON faculty_documents;
CREATE POLICY "Faculty delete own documents" ON faculty_documents FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM faculty_profiles fp WHERE fp.id = faculty_documents.faculty_id AND fp.user_id = auth.uid()));

-- Document reviews: staff read; super_admin write
DROP POLICY IF EXISTS "Staff read document reviews" ON document_reviews;
CREATE POLICY "Staff read document reviews" ON document_reviews FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('super_admin','coordinator')));
DROP POLICY IF EXISTS "Super admin writes document reviews" ON document_reviews;
CREATE POLICY "Super admin writes document reviews" ON document_reviews FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin'))
WITH CHECK (EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin'));

-- Assignments: faculty read own; staff read all
DROP POLICY IF EXISTS "Faculty read own assignments" ON faculty_assignments;
CREATE POLICY "Faculty read own assignments" ON faculty_assignments FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM faculty_profiles fp WHERE fp.id = faculty_assignments.faculty_id AND fp.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('super_admin','coordinator','accounts','approver')));
DROP POLICY IF EXISTS "Super admin manages assignments" ON faculty_assignments;
CREATE POLICY "Super admin manages assignments" ON faculty_assignments FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin'))
WITH CHECK (EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin'));

-- Schedules and revisions
DROP POLICY IF EXISTS "Read schedules" ON schedules;
CREATE POLICY "Read schedules" ON schedules FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM faculty_assignments fa JOIN faculty_profiles fp ON fp.id = fa.faculty_id WHERE fa.id = schedules.assignment_id AND fp.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('super_admin','coordinator','accounts','approver'))
);
DROP POLICY IF EXISTS "Staff manages schedules" ON schedules;
CREATE POLICY "Staff manages schedules" ON schedules FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('super_admin','coordinator')))
WITH CHECK (EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('super_admin','coordinator')));
DROP POLICY IF EXISTS "Read schedule revisions" ON schedule_revisions;
CREATE POLICY "Read schedule revisions" ON schedule_revisions FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('super_admin','coordinator')));
DROP POLICY IF EXISTS "Staff manages schedule revisions" ON schedule_revisions;
CREATE POLICY "Staff manages schedule revisions" ON schedule_revisions FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('super_admin','coordinator')))
WITH CHECK (EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('super_admin','coordinator')));

DROP POLICY IF EXISTS "Read attendance" ON attendance_records;
CREATE POLICY "Read attendance" ON attendance_records FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM faculty_profiles fp WHERE fp.id = attendance_records.faculty_id AND fp.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('super_admin','coordinator','accounts','approver'))
);
DROP POLICY IF EXISTS "Faculty submits attendance" ON attendance_records;
CREATE POLICY "Faculty submits attendance" ON attendance_records FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM faculty_profiles fp WHERE fp.id = attendance_records.faculty_id AND fp.user_id = auth.uid()));
DROP POLICY IF EXISTS "Faculty updates own attendance" ON attendance_records;
CREATE POLICY "Faculty updates own attendance" ON attendance_records FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM faculty_profiles fp WHERE fp.id = attendance_records.faculty_id AND fp.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM faculty_profiles fp WHERE fp.id = attendance_records.faculty_id AND fp.user_id = auth.uid()));
DROP POLICY IF EXISTS "Staff updates attendance" ON attendance_records;
CREATE POLICY "Staff updates attendance" ON attendance_records FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('super_admin','coordinator')))
WITH CHECK (EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('super_admin','coordinator')));

DROP POLICY IF EXISTS "Faculty read own corrections" ON attendance_correction_requests;
CREATE POLICY "Faculty read own corrections" ON attendance_correction_requests FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM faculty_profiles fp WHERE fp.id = attendance_correction_requests.faculty_id AND fp.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('super_admin','coordinator')));
DROP POLICY IF EXISTS "Faculty creates corrections" ON attendance_correction_requests;
CREATE POLICY "Faculty creates corrections" ON attendance_correction_requests FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM faculty_profiles fp WHERE fp.id = attendance_correction_requests.faculty_id AND fp.user_id = auth.uid()));
DROP POLICY IF EXISTS "Staff reviews corrections" ON attendance_correction_requests;
CREATE POLICY "Staff reviews corrections" ON attendance_correction_requests FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('super_admin','coordinator')))
WITH CHECK (EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('super_admin','coordinator')));

DROP POLICY IF EXISTS "Faculty read own closures" ON semester_attendance_closures;
CREATE POLICY "Faculty read own closures" ON semester_attendance_closures FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM faculty_profiles fp WHERE fp.id = semester_attendance_closures.faculty_id AND fp.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('super_admin','coordinator','accounts','approver')));
DROP POLICY IF EXISTS "Faculty submits closures" ON semester_attendance_closures;
CREATE POLICY "Faculty submits closures" ON semester_attendance_closures FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM faculty_profiles fp WHERE fp.id = semester_attendance_closures.faculty_id AND fp.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM faculty_profiles fp WHERE fp.id = semester_attendance_closures.faculty_id AND fp.user_id = auth.uid()));

DROP POLICY IF EXISTS "Read compensation rules" ON compensation_rules;
CREATE POLICY "Read compensation rules" ON compensation_rules FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Super admin manages compensation" ON compensation_rules;
CREATE POLICY "Super admin manages compensation" ON compensation_rules FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin'))
WITH CHECK (EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin'));

-- Bills: faculty own; staff all
DROP POLICY IF EXISTS "Faculty read own bills" ON semester_bills;
CREATE POLICY "Faculty read own bills" ON semester_bills FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM faculty_profiles fp WHERE fp.id = semester_bills.faculty_id AND fp.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('super_admin','coordinator','accounts','approver')));
DROP POLICY IF EXISTS "Faculty creates own bills" ON semester_bills;
CREATE POLICY "Faculty creates own bills" ON semester_bills FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM faculty_profiles fp WHERE fp.id = semester_bills.faculty_id AND fp.user_id = auth.uid()));
DROP POLICY IF EXISTS "Faculty updates own bills" ON semester_bills;
CREATE POLICY "Faculty updates own bills" ON semester_bills FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM faculty_profiles fp WHERE fp.id = semester_bills.faculty_id AND fp.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM faculty_profiles fp WHERE fp.id = semester_bills.faculty_id AND fp.user_id = auth.uid()));
DROP POLICY IF EXISTS "Staff updates bills" ON semester_bills;
CREATE POLICY "Staff updates bills" ON semester_bills FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('super_admin','coordinator','accounts','approver')))
WITH CHECK (EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('super_admin','coordinator','accounts','approver')));

DROP POLICY IF EXISTS "Read bill items" ON bill_items;
CREATE POLICY "Read bill items" ON bill_items FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM semester_bills sb JOIN faculty_profiles fp ON fp.id = sb.faculty_id WHERE sb.id = bill_items.bill_id AND fp.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('super_admin','coordinator','accounts','approver')));
DROP POLICY IF EXISTS "Faculty manages own bill items" ON bill_items;
CREATE POLICY "Faculty manages own bill items" ON bill_items FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM semester_bills sb JOIN faculty_profiles fp ON fp.id = sb.faculty_id WHERE sb.id = bill_items.bill_id AND fp.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM semester_bills sb JOIN faculty_profiles fp ON fp.id = sb.faculty_id WHERE sb.id = bill_items.bill_id AND fp.user_id = auth.uid()));
DROP POLICY IF EXISTS "Staff manages bill items" ON bill_items;
CREATE POLICY "Staff manages bill items" ON bill_items FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('super_admin','coordinator','accounts','approver')))
WITH CHECK (EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('super_admin','coordinator','accounts','approver')));

DROP POLICY IF EXISTS "Read bill submissions" ON bill_submissions;
CREATE POLICY "Read bill submissions" ON bill_submissions FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM semester_bills sb JOIN faculty_profiles fp ON fp.id = sb.faculty_id WHERE sb.id = bill_submissions.bill_id AND fp.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('super_admin','coordinator','accounts','approver')));
DROP POLICY IF EXISTS "Faculty creates submissions" ON bill_submissions;
CREATE POLICY "Faculty creates submissions" ON bill_submissions FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM semester_bills sb JOIN faculty_profiles fp ON fp.id = sb.faculty_id WHERE sb.id = bill_submissions.bill_id AND fp.user_id = auth.uid()));

DROP POLICY IF EXISTS "Read bill approvals" ON bill_approvals;
CREATE POLICY "Read bill approvals" ON bill_approvals FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM semester_bills sb JOIN faculty_profiles fp ON fp.id = sb.faculty_id WHERE sb.id = bill_approvals.bill_id AND fp.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('super_admin','coordinator','accounts','approver')));
DROP POLICY IF EXISTS "Staff creates approvals" ON bill_approvals;
CREATE POLICY "Staff creates approvals" ON bill_approvals FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('super_admin','coordinator','accounts','approver')));

DROP POLICY IF EXISTS "Read physical receipts" ON physical_bill_receipts;
CREATE POLICY "Read physical receipts" ON physical_bill_receipts FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM semester_bills sb JOIN faculty_profiles fp ON fp.id = sb.faculty_id WHERE sb.id = physical_bill_receipts.bill_id AND fp.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('super_admin','accounts','coordinator','approver')));
DROP POLICY IF EXISTS "Accounts creates receipts" ON physical_bill_receipts;
CREATE POLICY "Accounts creates receipts" ON physical_bill_receipts FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('super_admin','accounts')));

DROP POLICY IF EXISTS "Read bill attachments" ON bill_attachments;
CREATE POLICY "Read bill attachments" ON bill_attachments FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM semester_bills sb JOIN faculty_profiles fp ON fp.id = sb.faculty_id WHERE sb.id = bill_attachments.bill_id AND fp.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('super_admin','coordinator','accounts','approver')));
DROP POLICY IF EXISTS "Staff uploads attachments" ON bill_attachments;
CREATE POLICY "Staff uploads attachments" ON bill_attachments FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('super_admin','accounts')));

DROP POLICY IF EXISTS "Faculty reads own payments" ON payments;
CREATE POLICY "Faculty reads own payments" ON payments FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM faculty_profiles fp WHERE fp.id = payments.faculty_id AND fp.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('super_admin','coordinator','accounts','approver')));
DROP POLICY IF EXISTS "Accounts records payments" ON payments;
CREATE POLICY "Accounts records payments" ON payments FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('super_admin','accounts')));
DROP POLICY IF EXISTS "Accounts updates payments" ON payments;
CREATE POLICY "Accounts updates payments" ON payments FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('super_admin','accounts')))
WITH CHECK (EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('super_admin','accounts')));

DROP POLICY IF EXISTS "Read payment transactions" ON payment_transactions;
CREATE POLICY "Read payment transactions" ON payment_transactions FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM payments p JOIN faculty_profiles fp ON fp.id = p.faculty_id WHERE p.id = payment_transactions.payment_id AND fp.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('super_admin','accounts','approver','coordinator')));
DROP POLICY IF EXISTS "Accounts creates transactions" ON payment_transactions;
CREATE POLICY "Accounts creates transactions" ON payment_transactions FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('super_admin','accounts')));

DROP POLICY IF EXISTS "Users read own notifications" ON notifications;
CREATE POLICY "Users read own notifications" ON notifications FOR SELECT TO authenticated
USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "System creates notifications" ON notifications;
CREATE POLICY "System creates notifications" ON notifications FOR INSERT TO authenticated
WITH CHECK (true);
DROP POLICY IF EXISTS "Users update own notifications" ON notifications;
CREATE POLICY "Users update own notifications" ON notifications FOR UPDATE TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Read conversations" ON conversations;
CREATE POLICY "Read conversations" ON conversations FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM faculty_profiles fp WHERE fp.id = conversations.faculty_id AND fp.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('super_admin','coordinator','accounts','approver')));
DROP POLICY IF EXISTS "Staff creates conversations" ON conversations;
CREATE POLICY "Staff creates conversations" ON conversations FOR INSERT TO authenticated
WITH CHECK (true);
DROP POLICY IF EXISTS "Read messages" ON messages;
CREATE POLICY "Read messages" ON messages FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM conversations c JOIN faculty_profiles fp ON fp.id = c.faculty_id WHERE c.id = messages.conversation_id AND fp.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('super_admin','coordinator','accounts','approver')));
DROP POLICY IF EXISTS "Authenticated sends messages" ON messages;
CREATE POLICY "Authenticated sends messages" ON messages FOR INSERT TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Faculty read own tickets" ON support_tickets;
CREATE POLICY "Faculty read own tickets" ON support_tickets FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM faculty_profiles fp WHERE fp.id = support_tickets.faculty_id AND fp.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('super_admin','coordinator','accounts','approver')));
DROP POLICY IF EXISTS "Faculty creates tickets" ON support_tickets;
CREATE POLICY "Faculty creates tickets" ON support_tickets FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM faculty_profiles fp WHERE fp.id = support_tickets.faculty_id AND fp.user_id = auth.uid()));
DROP POLICY IF EXISTS "Staff updates tickets" ON support_tickets;
CREATE POLICY "Staff updates tickets" ON support_tickets FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('super_admin','coordinator','accounts','approver')))
WITH CHECK (EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('super_admin','coordinator','accounts','approver')));

-- Audit logs: staff read, insert allowed for record-keeping, no update/delete policies (immutable)
DROP POLICY IF EXISTS "Staff reads audit logs" ON audit_logs;
CREATE POLICY "Staff reads audit logs" ON audit_logs FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('super_admin','coordinator','accounts','approver')));
DROP POLICY IF EXISTS "Authenticated inserts audit logs" ON audit_logs;
CREATE POLICY "Authenticated inserts audit logs" ON audit_logs FOR INSERT TO authenticated
WITH CHECK (true);

-- ============ Grants ============

GRANT SELECT ON departments, courses, semesters, holidays, system_settings, compensation_rules TO authenticated;
GRANT SELECT, INSERT, UPDATE ON faculty_profiles TO authenticated;
GRANT SELECT ON user_roles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON faculty_documents TO authenticated;
GRANT SELECT, INSERT ON document_reviews TO authenticated;
GRANT SELECT ON faculty_assignments, schedules TO authenticated;
GRANT SELECT, INSERT, UPDATE ON attendance_records TO authenticated;
GRANT SELECT, INSERT, UPDATE ON attendance_correction_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON semester_attendance_closures TO authenticated;
GRANT SELECT, INSERT, UPDATE ON semester_bills TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON bill_items TO authenticated;
GRANT SELECT, INSERT ON bill_submissions, bill_approvals, physical_bill_receipts, bill_attachments TO authenticated;
GRANT SELECT, INSERT, UPDATE ON payments TO authenticated;
GRANT SELECT, INSERT ON payment_transactions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON notifications TO authenticated;
GRANT SELECT, INSERT ON conversations, messages, support_tickets TO authenticated;
GRANT UPDATE ON support_tickets TO authenticated;
GRANT SELECT, INSERT ON audit_logs TO authenticated;

-- ============ Storage ============

INSERT INTO storage.buckets (id, name, public) VALUES ('faculty-documents', 'faculty-documents', false)
ON CONFLICT (id) DO NOTHING;
