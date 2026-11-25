// Shared between client and server: no node-only imports here.

export interface DemoAccountSpec {
  email: string;
  password: string;
  full_name: string;
  role: string;
  departmentCode: string | null;
}

export const DEMO_ACCOUNTS: DemoAccountSpec[] = [
  { email: 'registrar@uok-demo.edu', password: 'Admin#12345', full_name: 'Dr. Kamran Siddiqui', role: 'super_admin', departmentCode: null },
  { email: 'cs.chairman@uok-demo.edu', password: 'Coord#12345', full_name: 'Prof. Naveen Akhtar', role: 'coordinator', departmentCode: 'CS' },
  { email: 'accounts@uok-demo.edu', password: 'Accnt#12345', full_name: 'Mr. Shahzad Iqbal', role: 'accounts', departmentCode: null },
  { email: 'dean.finance@uok-demo.edu', password: 'Approv#12345', full_name: 'Dr. Rabia Mehmood', role: 'approver', departmentCode: null },
  { email: 'a.raza@uok-demo.edu', password: 'Fac#12345', full_name: 'Dr. Ahmed Raza', role: 'faculty', departmentCode: 'CS' },
];

// Used when the departments table cannot be reached, so the registration
// dropdown always shows the seeded university departments.
export const DEMO_DEPARTMENTS = [
  { id: '00000000-0000-4000-8000-000000000001', name: 'Department of Computer Science', code: 'CS' },
  { id: '00000000-0000-4000-8000-000000000002', name: 'Department of Mathematics', code: 'MATH' },
  { id: '00000000-0000-4000-8000-000000000003', name: 'Department of Economics', code: 'ECON' },
  { id: '00000000-0000-4000-8000-000000000004', name: 'Department of English', code: 'ENGL' },
];
