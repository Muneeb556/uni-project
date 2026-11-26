// In-memory mock database client for local development and demonstration mode
// This allows the full application to run without requiring a live Supabase connection.

import { DEMO_ACCOUNTS, DEMO_DEPARTMENTS } from './demo-constants';

export interface MockStore {
  departments: any[];
  courses: any[];
  semesters: any[];
  compensation_rules: any[];
  system_settings: any[];
  faculty_profiles: any[];
  faculty_assignments: any[];
  schedules: any[];
  schedule_revisions: any[];
  attendance_records: any[];
  attendance_correction_requests: any[];
  semester_attendance_closures: any[];
  semester_bills: any[];
  bill_items: any[];
  bill_approvals: any[];
  physical_bill_receipts: any[];
  payments: any[];
  payment_transactions: any[];
  notifications: any[];
  audit_logs: any[];
  faculty_documents: any[];
  document_reviews: any[];
  user_roles: any[];
}

function initMockStore(): MockStore {
  const deptCS = DEMO_DEPARTMENTS[0];
  const deptMath = DEMO_DEPARTMENTS[1];
  const deptEcon = DEMO_DEPARTMENTS[2];
  const deptEngl = DEMO_DEPARTMENTS[3];

  const semId = '00000000-0000-4000-8000-000000000010';
  const facultyId = 'b8045c22-d826-4589-930e-2440341acdbb';
  const asgId = '00000000-0000-4000-8000-000000000030';
  const courseId = '00000000-0000-4000-8000-000000000021';
  const billId = '00000000-0000-4000-8000-000000000070';

  const courses = [
    { id: '00000000-0000-4000-8000-000000000020', department_id: deptCS.id, title: 'Introduction to Programming', code: 'CS-101', credit_hours: 3, classification: 'Theory' },
    { id: courseId, department_id: deptCS.id, title: 'Database Systems', code: 'CS-205', credit_hours: 3, classification: 'Theory' },
    { id: '00000000-0000-4000-8000-000000000022', department_id: deptCS.id, title: 'Programming Lab', code: 'CS-102', credit_hours: 1, classification: 'Practical' },
    { id: '00000000-0000-4000-8000-000000000023', department_id: deptCS.id, title: 'Web Technologies', code: 'CS-315', credit_hours: 3, classification: 'Theory+Practical' },
    { id: '00000000-0000-4000-8000-000000000024', department_id: deptMath.id, title: 'Calculus I', code: 'MATH-101', credit_hours: 3, classification: 'Theory' },
    { id: '00000000-0000-4000-8000-000000000025', department_id: deptEcon.id, title: 'Principles of Microeconomics', code: 'ECON-101', credit_hours: 3, classification: 'Theory' },
    { id: '00000000-0000-4000-8000-000000000026', department_id: deptEngl.id, title: 'Academic English', code: 'ENGL-101', credit_hours: 3, classification: 'Theory' },
  ];

  const semesters = [
    {
      id: semId,
      name: 'Fall 2026',
      start_date: '2026-08-03',
      end_date: '2026-12-18',
      attendance_open: '2026-09-01',
      attendance_close: '2026-12-10',
      billing_open: '2026-11-20',
      billing_deadline: '2026-12-15',
      deadline_time: '23:59',
      timezone: 'Asia/Karachi',
      status: 'Active',
    },
  ];

  const faculty_profiles = [
    {
      id: facultyId,
      user_id: facultyId,
      full_name: 'Dr. Ahmed Raza',
      email: 'a.raza@uok-demo.edu',
      phone: '0300-1234567',
      cnic: '42101-1234567-1',
      designation: 'Visiting Assistant Professor',
      grade: 'BPS-19',
      qualification: 'PhD in Computer Science',
      department_id: deptCS.id,
      application_status: 'Approved',
      bank_name: 'Habib Bank Limited',
      bank_account_number: '12345678901234',
      university_branch: 'UoK Campus Branch',
      created_at: '2026-08-01T10:00:00Z',
      updated_at: '2026-08-01T10:00:00Z',
    },
  ];

  const faculty_assignments = [
    {
      id: asgId,
      faculty_id: facultyId,
      course_id: courseId,
      semester_id: semId,
      department_id: deptCS.id,
      theory_rate: 1500,
      practical_rate: 0,
      conveyance: 500,
      compensation_method: 'Per Period',
      classification: 'Theory',
      number_of_periods: 32,
      number_of_students: 45,
      start_time: '09:00',
      end_time: '10:30',
      status: 'Active',
      created_at: '2026-08-10T10:00:00Z',
    },
  ];

  const schedules = [
    {
      id: '00000000-0000-4000-8000-000000000040',
      assignment_id: asgId,
      day_of_week: 1,
      start_time: '09:00',
      end_time: '10:30',
      room: 'CS-02',
      start_date: '2026-08-03',
      end_date: '2026-12-18',
      number_of_periods: 1,
      status: 'Active',
    },
    {
      id: '00000000-0000-4000-8000-000000000041',
      assignment_id: asgId,
      day_of_week: 3,
      start_time: '09:00',
      end_time: '10:30',
      room: 'CS-02',
      start_date: '2026-08-03',
      end_date: '2026-12-18',
      number_of_periods: 1,
      status: 'Active',
    },
  ];

  // 22 approved attendance records
  const attendance_records: any[] = [];
  const bill_items: any[] = [];
  let d = new Date(2026, 8, 2); // Sept 2, 2026 (Wednesday)
  for (let i = 1; i <= 22; i++) {
    const attId = `00000000-0000-4000-8000-${String(100 + i).padStart(12, '0')}`;
    const dateStr = d.toISOString().slice(0, 10);
    attendance_records.push({
      id: attId,
      faculty_id: facultyId,
      assignment_id: asgId,
      semester_id: semId,
      scheduled_date: dateStr,
      actual_date: dateStr,
      start_time: '09:00',
      end_time: '10:30',
      number_of_periods: 1,
      number_of_students: 45,
      status: 'Approved',
      created_at: dateStr + 'T10:30:00Z',
    });

    bill_items.push({
      id: `00000000-0000-4000-8000-${String(200 + i).padStart(12, '0')}`,
      bill_id: billId,
      item_type: 'Theory',
      course_number: 'CS-205',
      course_title: 'Database Systems',
      number_of_students: 45,
      serial_number: i,
      entry_date: dateStr,
      timings: '09:00-10:30',
      number_of_periods: 1,
      rate: 1500,
      amount: 1500,
    });

    d.setDate(d.getDate() + (d.getDay() === 1 ? 2 : 5));
  }

  // Additional attendance records for review queue testing
  attendance_records.push({
    id: '00000000-0000-4000-8000-000000000198',
    faculty_id: facultyId,
    assignment_id: asgId,
    semester_id: semId,
    scheduled_date: '2026-11-23',
    actual_date: '2026-11-23',
    start_time: '09:00',
    end_time: '10:30',
    number_of_periods: 1,
    number_of_students: 44,
    status: 'Submitted',
    remarks: 'Conducted lecture on Indexing and B-Trees',
    created_at: '2026-11-23T11:00:00Z',
  });

  const correctionAttId = '00000000-0000-4000-8000-000000000199';
  attendance_records.push({
    id: correctionAttId,
    faculty_id: facultyId,
    assignment_id: asgId,
    semester_id: semId,
    scheduled_date: '2026-11-25',
    actual_date: '2026-11-25',
    start_time: '09:15',
    end_time: '10:45',
    number_of_periods: 1,
    number_of_students: 42,
    status: 'Pending',
    remarks: 'Time adjustment needed',
    created_at: '2026-11-25T11:00:00Z',
  });

  const attendance_correction_requests = [
    {
      id: '00000000-0000-4000-8000-000000000050',
      attendance_id: correctionAttId,
      faculty_id: facultyId,
      reason: 'Lecture started 15 minutes late due to projector setup issue; ended at 10:45.',
      requested_changes: { start_time: '09:15', end_time: '10:45' },
      status: 'Pending',
      created_at: '2026-11-25T11:30:00Z',
    },
  ];

  const semester_attendance_closures = [
    {
      id: '00000000-0000-4000-8000-000000000060',
      faculty_id: facultyId,
      semester_id: semId,
      department_id: deptCS.id,
      statement_status: 'Verified',
      total_periods: 22,
      created_at: '2026-11-18T10:00:00Z',
    },
  ];

  const semester_bills = [
    {
      id: billId,
      bill_number: 'TH-FALL2026-B8045C22',
      faculty_id: facultyId,
      semester_id: semId,
      status: 'Under Review',
      theory_periods: 22,
      theory_rate: 1500,
      theory_amount: 33000,
      practical_periods: 0,
      practical_rate: 0,
      practical_amount: 0,
      conveyance: 500,
      deductions: 0,
      total_amount: 33000,
      grand_total: 33500,
      is_revision: false,
      created_at: '2026-11-20T10:00:00Z',
      updated_at: '2026-11-20T10:00:00Z',
    },
  ];

  const notifications = [
    {
      id: '00000000-0000-4000-8000-000000000080',
      user_id: facultyId,
      title: 'Teaching Honorarium Bill Submitted',
      body: 'Your bill for Fall 2026 has been submitted and is currently under review by the department.',
      category: 'bill',
      read: false,
      is_read: false,
      created_at: '2026-11-20T10:00:00Z',
      link: '/faculty/bills',
    },
  ];

  // No pre-seeded payments: the bill starts at "Under Review",
  // so the full workflow (coordinator approve → accounts verify → approver → payment) can be tested end-to-end.

  const faculty_documents = [
    { id: '00000000-0000-4000-8000-000000000301', faculty_id: facultyId, doc_type: 'CNIC', status: 'Approved', file_name: 'cnic.pdf', storage_path: `${facultyId}/cnic.pdf`, remarks: 'Verified' },
    { id: '00000000-0000-4000-8000-000000000302', faculty_id: facultyId, doc_type: 'CV', status: 'Approved', file_name: 'cv.pdf', storage_path: `${facultyId}/cv.pdf`, remarks: 'Verified' },
    { id: '00000000-0000-4000-8000-000000000303', faculty_id: facultyId, doc_type: 'Educational Certificate', status: 'Approved', file_name: 'phd_degree.pdf', storage_path: `${facultyId}/degree.pdf`, remarks: 'Verified' },
  ];

  const user_roles = [
    { user_id: '00000000-0000-4000-8000-000000000101', role: 'super_admin', department_id: null },
    { user_id: '00000000-0000-4000-8000-000000000102', role: 'coordinator', department_id: deptCS.id },
    { user_id: '00000000-0000-4000-8000-000000000103', role: 'accounts', department_id: null },
    { user_id: '00000000-0000-4000-8000-000000000104', role: 'approver', department_id: null },
    { user_id: facultyId, role: 'faculty', department_id: deptCS.id },
  ];

  return {
    departments: DEMO_DEPARTMENTS.map((d) => ({ ...d, status: 'Active' })),
    courses,
    semesters,
    compensation_rules: [{ designation: 'Visiting Faculty', method: 'Per Period', theory_rate: 1500, practical_rate: 1750, conveyance: 500 }],
    system_settings: [{ key: 'university', value: { name: 'University of Karachi', program: 'Morning Program', formTitle: 'Teaching Honorarium' } }],
    faculty_profiles,
    faculty_assignments,
    schedules,
    schedule_revisions: [],
    attendance_records,
    attendance_correction_requests,
    semester_attendance_closures,
    semester_bills,
    bill_items,
    bill_approvals: [],
    physical_bill_receipts: [],
    payments: [],
    payment_transactions: [],
    notifications,
    audit_logs: [],
    faculty_documents,
    document_reviews: [],
    user_roles,
  };
}

let globalStore: MockStore | null = null;
function getStore(): MockStore {
  if (!globalStore) {
    globalStore = initMockStore();
  }
  return globalStore;
}

const mockAuthUsers: Array<{ id: string; email: string; password: string }> = [];
const mockStorageFiles = new Map<string, { dataUrl: string; contentType: string }>();

function resolveJoins(table: string, item: any, store: MockStore): any {
  if (!item) return item;
  const row = { ...item };
  if (table === 'faculty_profiles' || row.faculty_profiles) {
    if (row.department_id && !row.departments) {
      row.departments = store.departments.find((d) => d.id === row.department_id) || null;
    }
    if (!row.faculty_documents) {
      row.faculty_documents = store.faculty_documents.filter((doc) => doc.faculty_id === row.id);
    }
  }
  if (table === 'faculty_assignments') {
    if (row.course_id && !row.courses) {
      row.courses = store.courses.find((c) => c.id === row.course_id) || null;
    }
    if (row.semester_id && !row.semesters) {
      row.semesters = store.semesters.find((s) => s.id === row.semester_id) || null;
    }
    if (row.department_id && !row.departments) {
      row.departments = store.departments.find((d) => d.id === row.department_id) || null;
    }
    if (row.faculty_id && !row.faculty_profiles) {
      const fp = store.faculty_profiles.find((f) => f.id === row.faculty_id);
      row.faculty_profiles = fp ? resolveJoins('faculty_profiles', fp, store) : null;
    }
  }
  if (table === 'schedules') {
    if (row.assignment_id && !row.faculty_assignments) {
      const asg = store.faculty_assignments.find((a) => a.id === row.assignment_id);
      row.faculty_assignments = asg ? resolveJoins('faculty_assignments', asg, store) : null;
    }
  }
  if (table === 'semester_bills') {
    if (row.faculty_id && !row.faculty_profiles) {
      const fp = store.faculty_profiles.find((f) => f.id === row.faculty_id);
      row.faculty_profiles = fp ? resolveJoins('faculty_profiles', fp, store) : null;
    }
    if (row.semester_id && !row.semesters) {
      row.semesters = store.semesters.find((s) => s.id === row.semester_id) || null;
    }
    if (!row.bill_items) {
      row.bill_items = store.bill_items.filter((bi) => bi.bill_id === row.id);
    }
    if (!row.bill_approvals) {
      row.bill_approvals = store.bill_approvals.filter((ba) => ba.bill_id === row.id);
    }
    if (!row.bill_submissions) {
      row.bill_submissions = ((store as any).bill_submissions || []).filter((bs: any) => bs.bill_id === row.id);
    }
    if (!row.physical_bill_receipts) {
      row.physical_bill_receipts = store.physical_bill_receipts.filter((pbr) => pbr.bill_id === row.id);
    }
    if (!row.payments) {
      row.payments = store.payments.filter((p) => p.bill_id === row.id);
    }
  }
  if (table === 'attendance_records') {
    if (row.assignment_id && !row.courses) {
      const asg = store.faculty_assignments.find((a) => a.id === row.assignment_id);
      if (asg) {
        row.courses = store.courses.find((c) => c.id === asg.course_id) || null;
        row.faculty_assignments = resolveJoins('faculty_assignments', asg, store);
      }
    }
    if (row.faculty_id && !row.faculty_profiles) {
      row.faculty_profiles = store.faculty_profiles.find((f) => f.id === row.faculty_id) || null;
    }
  }
  if (table === 'semester_attendance_closures') {
    if (row.faculty_id && !row.faculty_profiles) {
      row.faculty_profiles = store.faculty_profiles.find((f) => f.id === row.faculty_id) || null;
    }
    if (row.semester_id && !row.semesters) {
      row.semesters = store.semesters.find((s) => s.id === row.semester_id) || null;
    }
  }
  if (table === 'attendance_correction_requests') {
    if (row.attendance_id && !row.attendance_records) {
      row.attendance_records = store.attendance_records.find((ar) => ar.id === row.attendance_id) || null;
    }
    if (row.faculty_id && !row.faculty_profiles) {
      row.faculty_profiles = store.faculty_profiles.find((f) => f.id === row.faculty_id) || null;
    }
  }
  if (table === 'payments') {
    if (row.bill_id && !row.semester_bills) {
      const bill = store.semester_bills.find((b) => b.id === row.bill_id);
      row.semester_bills = bill ? resolveJoins('semester_bills', bill, store) : null;
    }
    if (row.faculty_id && !row.faculty_profiles) {
      row.faculty_profiles = store.faculty_profiles.find((f) => f.id === row.faculty_id) || null;
    }
  }
  return row;
}

export class MockQueryBuilder {
  private tableName: string;
  private operation: 'select' | 'insert' | 'update' | 'upsert' | 'delete' = 'select';
  private mutationData: any = null;
  private upsertOptions?: { onConflict?: string };
  private filters: Array<(item: any) => boolean> = [];
  private orderFn: ((a: any, b: any) => number) | null = null;
  private limitCount: number | null = null;
  private isCountQuery = false;
  private isHeadOnly = false;
  private isSingle = false;
  private isMaybeSingle = false;

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  select(_fields?: string, options?: { count?: string; head?: boolean }) {
    if (options?.count === 'exact') this.isCountQuery = true;
    if (options?.head) this.isHeadOnly = true;
    return this;
  }

  insert(data: any | any[]) {
    this.operation = 'insert';
    this.mutationData = data;
    return this;
  }

  upsert(data: any | any[], options?: { onConflict?: string }) {
    this.operation = 'upsert';
    this.mutationData = data;
    this.upsertOptions = options;
    return this;
  }

  update(values: any) {
    this.operation = 'update';
    this.mutationData = values;
    return this;
  }

  delete() {
    this.operation = 'delete';
    return this;
  }

  single() {
    this.isSingle = true;
    return this;
  }

  maybeSingle() {
    this.isMaybeSingle = true;
    return this;
  }

  private resolveValue(item: any, column: string): any {
    if (!item) return undefined;
    if (column.includes('.')) {
      const parts = column.split('.');
      let cur = item;
      for (const p of parts) {
        if (cur === null || cur === undefined) return undefined;
        cur = cur[p];
      }
      return cur;
    }
    return item[column];
  }

  eq(column: string, value: any) {
    this.filters.push((item) => this.resolveValue(item, column) === value);
    return this;
  }

  neq(column: string, value: any) {
    this.filters.push((item) => this.resolveValue(item, column) !== value);
    return this;
  }

  in(column: string, values: any[]) {
    this.filters.push((item) => {
      const val = this.resolveValue(item, column);
      return Array.isArray(values) && values.includes(val);
    });
    return this;
  }

  gte(column: string, value: any) {
    this.filters.push((item) => {
      const v = this.resolveValue(item, column);
      if (v === null || v === undefined) return false;
      return v >= value;
    });
    return this;
  }

  lte(column: string, value: any) {
    this.filters.push((item) => {
      const v = this.resolveValue(item, column);
      if (v === null || v === undefined) return false;
      return v <= value;
    });
    return this;
  }

  gt(column: string, value: any) {
    this.filters.push((item) => {
      const v = this.resolveValue(item, column);
      if (v === null || v === undefined) return false;
      return v > value;
    });
    return this;
  }

  lt(column: string, value: any) {
    this.filters.push((item) => {
      const v = this.resolveValue(item, column);
      if (v === null || v === undefined) return false;
      return v < value;
    });
    return this;
  }

  like(column: string, pattern: string) {
    const raw = pattern.replace(/%/g, '');
    this.filters.push((item) => {
      const v = String(this.resolveValue(item, column) || '');
      return v.includes(raw);
    });
    return this;
  }

  ilike(column: string, pattern: string) {
    const raw = pattern.replace(/%/g, '').toLowerCase();
    this.filters.push((item) => {
      const v = String(this.resolveValue(item, column) || '').toLowerCase();
      return v.includes(raw);
    });
    return this;
  }

  is(column: string, value: any) {
    this.filters.push((item) => this.resolveValue(item, column) === value);
    return this;
  }

  not(column: string, operator: string, value: any) {
    if (operator === 'eq') return this.neq(column, value);
    if (operator === 'in') {
      this.filters.push((item) => {
        const v = this.resolveValue(item, column);
        return !Array.isArray(value) || !value.includes(v);
      });
      return this;
    }
    return this;
  }

  or(_filterStr: string) {
    return this;
  }

  range(_from: number, to: number) {
    this.limitCount = to + 1;
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    const asc = options?.ascending !== false;
    this.orderFn = (a, b) => {
      const va = this.resolveValue(a, column);
      const vb = this.resolveValue(b, column);
      if (va === vb) return 0;
      if (va === null || va === undefined) return 1;
      if (vb === null || vb === undefined) return -1;
      return asc ? (va > vb ? 1 : -1) : va < vb ? 1 : -1;
    };
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  private async execute(): Promise<{ data: any; count: number | null; error: any }> {
    const store = getStore();
    const table = ((store as any)[this.tableName] = (store as any)[this.tableName] || []);

    if (this.operation === 'insert') {
      const items = Array.isArray(this.mutationData) ? this.mutationData : [this.mutationData];
      const inserted = items.map((item) => {
        const row = {
          id: item.id || `mock-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...item,
        };
        table.push(row);
        return row;
      });
      const resData = this.isSingle
        ? inserted[0]
        : this.isMaybeSingle
        ? inserted[0] || null
        : Array.isArray(this.mutationData)
        ? inserted
        : inserted[0];
      return { data: resData, count: null, error: null };
    }

    if (this.operation === 'upsert') {
      const items = Array.isArray(this.mutationData) ? this.mutationData : [this.mutationData];
      const conflictFields = this.upsertOptions?.onConflict
        ? this.upsertOptions.onConflict.split(',').map((s) => s.trim())
        : ['id'];

      const results: any[] = [];
      for (const item of items) {
        const existingIdx = table.findIndex((row: any) =>
          conflictFields.every((field) => row[field] !== undefined && row[field] === item[field])
        );
        if (existingIdx >= 0) {
          table[existingIdx] = { ...table[existingIdx], ...item, updated_at: new Date().toISOString() };
          results.push(table[existingIdx]);
        } else {
          const newRow = {
            id: item.id || `mock-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            ...item,
          };
          table.push(newRow);
          results.push(newRow);
        }
      }
      const resData = this.isSingle
        ? results[0]
        : this.isMaybeSingle
        ? results[0] || null
        : Array.isArray(this.mutationData)
        ? results
        : results[0];
      return { data: resData, count: null, error: null };
    }

    if (this.operation === 'update') {
      const updated: any[] = [];
      table.forEach((item: any, idx: number) => {
        const joined = resolveJoins(this.tableName, item, store);
        if (this.filters.every((f) => f(joined))) {
          table[idx] = { ...item, ...this.mutationData, updated_at: new Date().toISOString() };
          updated.push(table[idx]);
        }
      });
      const resData = this.isSingle
        ? updated[0] || null
        : this.isMaybeSingle
        ? updated[0] || null
        : updated;
      return { data: resData, count: null, error: null };
    }

    if (this.operation === 'delete') {
      const remaining = table.filter((item: any) => {
        const joined = resolveJoins(this.tableName, item, store);
        return !this.filters.every((f) => f(joined));
      });
      (store as any)[this.tableName] = remaining;
      return { data: null, count: null, error: null };
    }

    // Default: 'select'
    let items = table.map((item: any) => resolveJoins(this.tableName, item, store));

    for (const filter of this.filters) {
      items = items.filter(filter);
    }

    const count = items.length;

    if (this.isHeadOnly) {
      return { data: null, count, error: null };
    }

    if (this.orderFn) {
      items.sort(this.orderFn);
    }

    if (this.limitCount !== null) {
      items = items.slice(0, this.limitCount);
    }

    let finalData: any = items;
    if (this.isSingle) {
      finalData = items[0] || null;
      if (!finalData) {
        return { data: null, count: null, error: { message: 'Row not found' } };
      }
    } else if (this.isMaybeSingle) {
      finalData = items[0] || null;
    }

    return { data: finalData, count: this.isCountQuery ? count : null, error: null };
  }

  then(resolve: (val: any) => any, reject?: (err: any) => any) {
    return this.execute().then(resolve, reject);
  }

  catch(reject: (err: any) => any) {
    return this.execute().catch(reject);
  }
}

export function createMockSupabaseClient() {
  return {
    from: (table: string) => new MockQueryBuilder(table),
    storage: {
      from: (_bucket: string) => ({
        upload: async (path: string, file: any, opts?: { contentType?: string }) => {
          const contentType = opts?.contentType || 'application/octet-stream';
          try {
            const buf = Buffer.isBuffer(file) ? file : Buffer.from(file);
            mockStorageFiles.set(path, {
              dataUrl: `data:${contentType};base64,${buf.toString('base64')}`,
              contentType,
            });
          } catch {
            // ignore if non-buffer in test
          }
          return { data: { path }, error: null };
        },
        createSignedUrl: async (path: string, _expiresIn: number) => {
          const stored = mockStorageFiles.get(path);
          return {
            data: {
              signedUrl: stored?.dataUrl || 'https://placehold.co/600x400/png?text=Document+Preview',
            },
            error: null,
          };
        },
        remove: async (paths: string[]) => {
          for (const p of paths) mockStorageFiles.delete(p);
          return { data: [], error: null };
        },
      }),
    },
    auth: {
      admin: {
        createUser: async ({ email, password }: { email: string; password: string; email_confirm?: boolean }) => {
          const lower = (email || '').toLowerCase();
          if (
            DEMO_ACCOUNTS.some((a) => a.email.toLowerCase() === lower) ||
            mockAuthUsers.some((u) => u.email.toLowerCase() === lower)
          ) {
            return { data: { user: null }, error: { message: 'User already registered' } };
          }
          const id =
            typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
              ? crypto.randomUUID()
              : `mock-user-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
          const user = { id, email, password };
          mockAuthUsers.push(user);
          return { data: { user: { id, email } }, error: null };
        },
        deleteUser: async (userId: string) => {
          const idx = mockAuthUsers.findIndex((u) => u.id === userId);
          if (idx >= 0) mockAuthUsers.splice(idx, 1);
          return { data: {}, error: null };
        },
      },
      getUser: async (token: string) => {
        const demoAccount = DEMO_ACCOUNTS.find((a) => a.email.includes(token) || token.startsWith('demo.'));
        if (demoAccount) {
          return { data: { user: { id: demoAccount.email, email: demoAccount.email } }, error: null };
        }
        return { data: { user: { id: 'demo-user', email: 'demo@uok-demo.edu' } }, error: null };
      },
      signInWithPassword: async ({ email, password }: any) => {
        const lower = (email || '').toLowerCase();
        const account = DEMO_ACCOUNTS.find((a) => a.email.toLowerCase() === lower);
        if (account && account.password === password) {
          return {
            data: {
              session: {
                access_token: `mock-token-${account.role}`,
                refresh_token: `mock-refresh-${account.role}`,
                expires_at: Math.floor(Date.now() / 1000) + 3600 * 12,
              },
              user: { id: account.email, email: account.email },
            },
            error: null,
          };
        }
        const registered = mockAuthUsers.find((u) => u.email.toLowerCase() === lower && u.password === password);
        if (registered) {
          return {
            data: {
              session: {
                access_token: `mock-token-${registered.id}`,
                refresh_token: `mock-refresh-${registered.id}`,
                expires_at: Math.floor(Date.now() / 1000) + 3600 * 12,
              },
              user: { id: registered.id, email: registered.email },
            },
            error: null,
          };
        }
        return { data: { session: null, user: null }, error: { message: 'Invalid credentials' } };
      },
    },
  };
}
