'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  GraduationCap, ShieldCheck, CheckCircle2, Clock, Landmark, Users,
  ArrowRight, FileSpreadsheet, Sparkles, Building, ChevronRight,
  Shield, Layers, Banknote, CalendarCheck, Award, BookOpen, AlertCircle,
  Upload, FileText, Trash2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/lib/auth-context';
import { homeRouteFor } from '@/lib/roles';
import { DEMO_ACCOUNTS, DEMO_DEPARTMENTS } from '@/lib/demo-constants';
import { readJsonResponse } from '@/lib/response';
import { DOC_TYPES } from '@/lib/shared';

interface PendingDoc {
  doc_type: string;
  file_name: string;
  mime_type: string;
  file_size: number;
  content_base64: string;
}

const MAX_DOC_SIZE = 5 * 1024 * 1024;

export default function LandingPage() {
  const router = useRouter();
  const { session, roles, loading, startSession } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [reg, setReg] = useState({
    full_name: '', reg_email: '', phone: '', cnic: '', reg_password: '',
    designation: '', department_id: '', qualification: '',
  });
  const [departments, setDepartments] = useState<Array<{ id: string; name: string; code: string }>>(DEMO_DEPARTMENTS);
  const [regBusy, setRegBusy] = useState(false);
  const [regError, setRegError] = useState('');
  const [regOk, setRegOk] = useState(false);
  const [regDocType, setRegDocType] = useState<string>('CNIC');
  const [regDocs, setRegDocs] = useState<PendingDoc[]>([]);
  const [regDocError, setRegDocError] = useState('');
  const regFileRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loading && session) router.replace(homeRouteFor(roles));
  }, [loading, session, roles, router]);

  useEffect(() => {
    fetch('/api/departments')
      .then(async (response) => {
        if (!response.ok) return DEMO_DEPARTMENTS;
        const data = await readJsonResponse<Array<{ id: string; name: string; code: string }>>(response);
        return Array.isArray(data) && data.length > 0 ? data : DEMO_DEPARTMENTS;
      })
      .then(setDepartments)
      .catch(() => setDepartments(DEMO_DEPARTMENTS));
  }, []);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const body = await readJsonResponse<{ access_token: string; refresh_token: string; expires_at?: number; user: { id: string; email?: string }; roles?: string[]; error?: { message?: string } }>(res);
      if (!res.ok) throw new Error(body?.error?.message || 'Sign in failed');
      await startSession({
        access_token: body.access_token,
        refresh_token: body.refresh_token,
        expires_at: body.expires_at,
        user: body.user,
      }, body.roles || []);
      router.replace(homeRouteFor(body.roles || []));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
    } finally {
      setBusy(false);
    }
  };

  const attachRegDoc = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setRegDocError('');
    if (file.size > MAX_DOC_SIZE) {
      setRegDocError('File exceeds the 5 MB limit');
      if (regFileRef.current) regFileRef.current.value = '';
      return;
    }
    if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.type)) {
      setRegDocError('Only PDF, JPG and PNG files are allowed');
      if (regFileRef.current) regFileRef.current.value = '';
      return;
    }
    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = '';
      for (let i = 0; i < bytes.length; i += 8192) {
        binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + 8192)) as number[]);
      }
      const nextDoc: PendingDoc = {
        doc_type: regDocType,
        file_name: file.name,
        mime_type: file.type,
        file_size: file.size,
        content_base64: btoa(binary),
      };
      setRegDocs((prev) => [...prev.filter((d) => d.doc_type !== regDocType), nextDoc]);
      if (regFileRef.current) regFileRef.current.value = '';
    } catch {
      setRegDocError('Could not read the selected file');
    }
  };

  const register = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegBusy(true);
    setRegError('');
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: reg.full_name,
          email: reg.reg_email,
          phone: reg.phone,
          cnic: reg.cnic,
          password: reg.reg_password,
          designation: reg.designation,
          department_id: reg.department_id,
          qualification: reg.qualification,
          documents: regDocs,
        }),
      });
      const body = await readJsonResponse<{ access_token: string; refresh_token: string; expires_at?: number; user: { id: string; email?: string }; roles?: string[]; error?: { message?: string } }>(res);
      if (!res.ok) throw new Error(body?.error?.message || 'Registration failed');
      setRegOk(true);
    } catch (err) {
      setRegError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setRegBusy(false);
    }
  };

  const demoSignIn = async (demoEmail: string, demoPassword: string) => {
    setEmail(demoEmail);
    setPassword(demoPassword);
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: demoEmail, password: demoPassword }),
      });
      const body = await readJsonResponse<{ access_token: string; refresh_token: string; expires_at?: number; user: { id: string; email?: string }; roles?: string[]; error?: { message?: string } }>(res);
      if (!res.ok) throw new Error(body?.error?.message || 'Sign in failed');
      await startSession({
        access_token: body.access_token,
        refresh_token: body.refresh_token,
        expires_at: body.expires_at,
        user: body.user,
      }, body.roles || []);
      router.replace(homeRouteFor(body.roles || []));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
    } finally {
      setBusy(false);
    }
  };

  const scrollToAuth = () => {
    document.getElementById('auth-section')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-slate-50/70 text-slate-900 selection:bg-teal-500 selection:text-white">
      {/* Institutional Top Banner */}
      <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 px-4 py-2 text-center text-xs text-slate-300 border-b border-slate-800">
        <span className="font-semibold text-teal-400">Official Portal:</span> Morning Program Visiting Faculty Honorarium Management & Timetable System • Fall 2026 Academic Session
      </div>

      {/* Main Navbar */}
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-teal-600 via-teal-700 to-slate-900 shadow-md shadow-teal-700/20 text-white">
              <GraduationCap className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold tracking-tight text-slate-950">University of Karachi</span>
                <span className="hidden sm:inline-block rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-teal-700 border border-teal-200/70">
                  Govt. Chartered
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">Visiting Faculty Honorarium & Academic Management</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <a href="#workflow" className="hidden md:inline-flex text-xs font-semibold text-slate-600 hover:text-teal-700 transition-colors">
              Workflow
            </a>
            <a href="#roles" className="hidden md:inline-flex text-xs font-semibold text-slate-600 hover:text-teal-700 transition-colors">
              Role Personas
            </a>
            <Button
              onClick={scrollToAuth}
              className="bg-gradient-to-r from-teal-600 to-slate-900 text-white hover:from-teal-700 hover:to-slate-950 shadow-sm shadow-teal-600/20 text-xs font-semibold px-4 h-9"
            >
              Sign In / Register
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden mesh-gradient-hero border-b border-slate-200/60 py-16 sm:py-24">
        {/* Subtle decorative grid lines */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f015_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f015_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid gap-12 lg:grid-cols-12 lg:items-center">
            {/* Left Content */}
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-teal-200/80 bg-white/80 px-3.5 py-1 text-xs font-semibold text-teal-800 shadow-sm backdrop-blur-sm">
                <Sparkles className="h-3.5 w-3.5 text-teal-600 animate-pulse" />
                <span>Next-Gen Academic Honorarium Engine</span>
                <span className="text-slate-300">•</span>
                <span className="text-slate-600">Morning Program</span>
              </div>

              <h1 className="text-3xl font-extrabold tracking-tight text-slate-950 sm:text-5xl lg:leading-[1.15]">
                Seamless Visiting Faculty Management &{' '}
                <span className="bg-gradient-to-r from-teal-600 via-emerald-600 to-blue-700 bg-clip-text text-transparent">
                  Automated Honorarium Bills
                </span>
              </h1>

              <p className="text-base leading-relaxed text-slate-600 sm:text-lg max-w-2xl">
                The official digital ecosystem for the University of Karachi. Synchronize course assignments, verify period attendance against scheduled timetables, and process multi-tier audit approvals with physical voucher dispatch and direct payment.
              </p>

              <div className="flex flex-wrap gap-3.5 pt-2">
                <Button
                  size="lg"
                  onClick={scrollToAuth}
                  className="bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-semibold shadow-md shadow-teal-600/25 gap-2 px-6"
                >
                  Access Portal <ArrowRight className="h-4 w-4" />
                </Button>
                <a
                  href="#roles"
                  className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 hover:text-slate-950 transition-colors"
                >
                  <ShieldCheck className="mr-2 h-4 w-4 text-teal-600" />
                  Try Instant Demo Accounts
                </a>
              </div>

              {/* Verified Trust Badges */}
              <div className="grid grid-cols-3 gap-4 pt-6 border-t border-slate-200/80 max-w-lg">
                <div>
                  <p className="text-2xl font-bold text-slate-900 tracking-tight">100%</p>
                  <p className="text-xs text-slate-500 font-medium">Digital Form Fidelity</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900 tracking-tight">5 Roles</p>
                  <p className="text-xs text-slate-500 font-medium">Audit-Grade Security</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-teal-600 tracking-tight">A4 Ready</p>
                  <p className="text-xs text-slate-500 font-medium">Official Print Standard</p>
                </div>
              </div>
            </div>

            {/* Right Card Mockup */}
            <div className="lg:col-span-5">
              <div className="glass-card rounded-2xl p-6 shadow-xl border border-slate-200/80 relative">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-emerald-500 animate-ping" />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700">Live Semester Tracker</span>
                  </div>
                  <span className="rounded-full bg-teal-50 px-2.5 py-0.5 text-[11px] font-semibold text-teal-700 border border-teal-200">
                    Fall 2026
                  </span>
                </div>

                <div className="space-y-4">
                  <div className="rounded-xl bg-slate-900 p-4 text-white">
                    <p className="text-xs text-slate-400 font-medium">Sample Honorarium Bill Claim</p>
                    <div className="mt-1 flex items-baseline justify-between">
                      <span className="text-2xl font-bold text-teal-300 tracking-tight">PKR 33,500</span>
                      <span className="text-xs text-emerald-400 font-semibold bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800">
                        Sanctioned
                      </span>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800">
                      <span>Faculty: Dr. Ahmed Raza</span>
                      <span>Dept: CS-205 (Theory)</span>
                    </div>
                  </div>

                  {/* Progressive Pipeline */}
                  <div className="space-y-2.5">
                    <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Multi-Tier Approval State</p>
                    
                    <div className="flex items-center gap-3 p-2.5 rounded-lg bg-teal-50/70 border border-teal-100">
                      <CheckCircle2 className="h-4 w-4 text-teal-600 flex-shrink-0" />
                      <div className="min-w-0 flex-1 text-xs">
                        <p className="font-semibold text-slate-900">Attendance Verification</p>
                        <p className="text-slate-500 text-[11px]">22/22 Lectures validated against timetable</p>
                      </div>
                      <span className="text-[10px] font-bold text-teal-700 bg-teal-100/70 px-2 py-0.5 rounded">Verified</span>
                    </div>

                    <div className="flex items-center gap-3 p-2.5 rounded-lg bg-blue-50/70 border border-blue-100">
                      <CheckCircle2 className="h-4 w-4 text-blue-600 flex-shrink-0" />
                      <div className="min-w-0 flex-1 text-xs">
                        <p className="font-semibold text-slate-900">Department Chairperson</p>
                        <p className="text-slate-500 text-[11px]">Department review completed</p>
                      </div>
                      <span className="text-[10px] font-bold text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded">Approved</span>
                    </div>

                    <div className="flex items-center gap-3 p-2.5 rounded-lg bg-emerald-50/70 border border-emerald-100">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                      <div className="min-w-0 flex-1 text-xs">
                        <p className="font-semibold text-slate-900">Accounts & Final Sanction</p>
                        <p className="text-slate-500 text-[11px]">Physical receipt UOK-2026 recorded & paid</p>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded">Disbursed</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 1-Click Interactive Demo Role Persona Hub */}
      <section id="roles" className="py-16 bg-white border-b border-slate-200/70">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <span className="text-xs font-bold uppercase tracking-wider text-teal-700 bg-teal-50 px-3 py-1 rounded-full border border-teal-200">
              Interactive Live Personas
            </span>
            <h2 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl mt-3">
              Experience the Full Ecosystem in One Click
            </h2>
            <p className="text-sm text-slate-600 mt-2">
              Select any role below to instantly log in as that persona and explore their specialized portal view with complete mock data.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {/* Faculty Persona */}
            <div className="glass-card rounded-xl p-5 border border-slate-200 hover:border-teal-400 transition-all shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-100 text-teal-700 font-bold">
                    <GraduationCap className="h-5 w-5" />
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-wider bg-teal-50 text-teal-800 px-2 py-0.5 rounded border border-teal-200">
                    Faculty
                  </span>
                </div>
                <h3 className="font-bold text-slate-900 text-base">Dr. Ahmed Raza</h3>
                <p className="text-xs text-slate-500">Visiting Assistant Professor • Dept. of Computer Science</p>
                <p className="text-xs text-slate-600 mt-2.5 leading-relaxed">
                  Log lectures against official timetable, request corrections, generate digital honorarium forms, and track payment receipts.
                </p>
              </div>
              <Button
                size="sm"
                className="mt-4 w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs justify-between"
                disabled={busy}
                onClick={() => demoSignIn('a.raza@uok-demo.edu', 'Fac#12345')}
              >
                <span>Launch Faculty View</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>

            {/* Department Coordinator */}
            <div className="glass-card rounded-xl p-5 border border-slate-200 hover:border-blue-400 transition-all shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-700 font-bold">
                    <Building className="h-5 w-5" />
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-wider bg-blue-50 text-blue-800 px-2 py-0.5 rounded border border-blue-200">
                    Coordinator
                  </span>
                </div>
                <h3 className="font-bold text-slate-900 text-base">Prof. Naveen Akhtar</h3>
                <p className="text-xs text-slate-500">Chairperson • Dept. of Computer Science</p>
                <p className="text-xs text-slate-600 mt-2.5 leading-relaxed">
                  Audit period claims, verify semester attendance closure statements, review flagged schedules, and endorse department bills.
                </p>
              </div>
              <Button
                size="sm"
                className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs justify-between"
                disabled={busy}
                onClick={() => demoSignIn('cs.chairman@uok-demo.edu', 'Coord#12345')}
              >
                <span>Launch Coordinator View</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>

            {/* Accounts Officer */}
            <div className="glass-card rounded-xl p-5 border border-slate-200 hover:border-emerald-400 transition-all shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 font-bold">
                    <Banknote className="h-5 w-5" />
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded border border-emerald-200">
                    Accounts
                  </span>
                </div>
                <h3 className="font-bold text-slate-900 text-base">Mr. Shahzad Iqbal</h3>
                <p className="text-xs text-slate-500">Accounts & Audit Officer • Finance Department</p>
                <p className="text-xs text-slate-600 mt-2.5 leading-relaxed">
                  Log incoming physical paper bills, verify deductions and rates, forward to final sanction, and record bank transaction receipts.
                </p>
              </div>
              <Button
                size="sm"
                className="mt-4 w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs justify-between"
                disabled={busy}
                onClick={() => demoSignIn('accounts@uok-demo.edu', 'Accnt#12345')}
              >
                <span>Launch Accounts View</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>

            {/* Approver / Dean */}
            <div className="glass-card rounded-xl p-5 border border-slate-200 hover:border-amber-400 transition-all shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-700 font-bold">
                    <Award className="h-5 w-5" />
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-wider bg-amber-50 text-amber-800 px-2 py-0.5 rounded border border-amber-200">
                    Approving Authority
                  </span>
                </div>
                <h3 className="font-bold text-slate-900 text-base">Dr. Rabia Mehmood</h3>
                <p className="text-xs text-slate-500">Dean of Finance & Administrative Authority</p>
                <p className="text-xs text-slate-600 mt-2.5 leading-relaxed">
                  Executive overview of all verified university bills, budget disbursement compliance, and final administrative sanction.
                </p>
              </div>
              <Button
                size="sm"
                className="mt-4 w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs justify-between"
                disabled={busy}
                onClick={() => demoSignIn('dean.finance@uok-demo.edu', 'Approv#12345')}
              >
                <span>Launch Approver View</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>

            {/* Super Admin / Registrar */}
            <div className="glass-card rounded-xl p-5 border border-slate-200 hover:border-purple-400 transition-all shadow-sm flex flex-col justify-between lg:col-span-2">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 text-purple-700 font-bold">
                    <Shield className="h-5 w-5" />
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-wider bg-purple-50 text-purple-800 px-2 py-0.5 rounded border border-purple-200">
                    Super Admin
                  </span>
                </div>
                <h3 className="font-bold text-slate-900 text-base">Dr. Kamran Siddiqui</h3>
                <p className="text-xs text-slate-500">Registrar • Central Academic & Administrative Office</p>
                <p className="text-xs text-slate-600 mt-2.5 leading-relaxed">
                  Configure academic semesters, establish deadline dates, create departments, approve faculty applications, and review system-wide audit logs.
                </p>
              </div>
              <Button
                size="sm"
                className="mt-4 w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs justify-between max-w-sm"
                disabled={busy}
                onClick={() => demoSignIn('registrar@uok-demo.edu', 'Admin#12345')}
              >
                <span>Launch Registrar View</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* 4-Stage Workflow Section */}
      <section id="workflow" className="py-16 bg-slate-50/80 border-b border-slate-200/70">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-bold uppercase tracking-wider text-teal-700 bg-teal-50 px-3 py-1 rounded-full border border-teal-200">
              End-to-End Governance
            </span>
            <h2 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl mt-3">
              How the Honorarium Lifecycle Operates
            </h2>
            <p className="text-sm text-slate-600 mt-2">
              Strict multi-point verification guarantees that every payment is mathematically verified against actual student lecture delivery.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm relative">
              <span className="absolute -top-3 left-4 bg-teal-600 text-white text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                Step 01
              </span>
              <div className="mt-2 text-teal-700 mb-3"><CalendarCheck className="h-6 w-6" /></div>
              <h3 className="font-bold text-sm text-slate-900">Lecture Logging</h3>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                Visiting faculty mark class completion against assigned timetable slots, noting duration, student count, and topics covered.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm relative">
              <span className="absolute -top-3 left-4 bg-blue-600 text-white text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                Step 02
              </span>
              <div className="mt-2 text-blue-700 mb-3"><Building className="h-6 w-6" /></div>
              <h3 className="font-bold text-sm text-slate-900">Chairperson Audit</h3>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                Department Chair reviews logged sessions against physical register logs and issues a verified attendance closure statement.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm relative">
              <span className="absolute -top-3 left-4 bg-amber-600 text-white text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                Step 03
              </span>
              <div className="mt-2 text-amber-700 mb-3"><FileSpreadsheet className="h-6 w-6" /></div>
              <h3 className="font-bold text-sm text-slate-900">Accounts & Taxes</h3>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                Physical bill printout received with voucher ID. Finance computes applicable conveyance, deductions, and tax withholdings.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm relative">
              <span className="absolute -top-3 left-4 bg-emerald-600 text-white text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                Step 04
              </span>
              <div className="mt-2 text-emerald-700 mb-3"><Landmark className="h-6 w-6" /></div>
              <h3 className="font-bold text-sm text-slate-900">Final Sanction & Pay</h3>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                Dean of Finance sanctions disbursement. Bank transfer reference number is logged and faculty notification is dispatched.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Auth & Registration Section */}
      <section id="auth-section" className="py-16 bg-white border-b border-slate-200/70">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-xl mx-auto mb-10">
            <span className="text-xs font-bold uppercase tracking-wider text-teal-700 bg-teal-50 px-3 py-1 rounded-full border border-teal-200">
              Portal Access
            </span>
            <h2 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl mt-3">
              Sign In or Register as Faculty
            </h2>
            <p className="text-sm text-slate-600 mt-1.5">
              Enter your credentials to enter the workspace or register for teaching approval.
            </p>
          </div>

          <Tabs defaultValue="signin" className="max-w-2xl mx-auto">
            <TabsList className="grid w-full grid-cols-2 rounded-xl bg-slate-100 p-1 mb-6 border border-slate-200">
              <TabsTrigger value="signin" className="rounded-lg font-semibold text-xs">
                Registered Faculty & Staff Sign In
              </TabsTrigger>
              <TabsTrigger value="register" className="rounded-lg font-semibold text-xs">
                New Faculty Application
              </TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <Card className="glass-card shadow-lg border-slate-200/80 rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-lg font-bold text-slate-900">Account Sign In</CardTitle>
                  <CardDescription className="text-xs">
                    Access your personalized departmental workspace with your university email.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={signIn} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="email" className="text-xs font-semibold text-slate-700">Official Email Address</Label>
                      <Input
                        id="email"
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="e.g. a.raza@uok-demo.edu"
                        className="rounded-xl border-slate-200 bg-white"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="password" className="text-xs font-semibold text-slate-700">Account Password</Label>
                      <Input
                        id="password"
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="rounded-xl border-slate-200 bg-white"
                      />
                    </div>
                    {error && (
                      <div className="flex items-center gap-2 rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700">
                        <AlertCircle className="h-4 w-4 flex-shrink-0" />
                        <span>{error}</span>
                      </div>
                    )}
                    <Button type="submit" className="w-full bg-gradient-to-r from-teal-600 to-slate-900 text-white font-semibold rounded-xl h-10 shadow-sm" disabled={busy}>
                      {busy ? 'Authenticating…' : 'Sign in to Dashboard'}
                    </Button>
                  </form>

                  {/* One-click quick demo accounts inside card */}
                  <div className="mt-6 rounded-xl border border-slate-200/80 bg-slate-50/70 p-4">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-2.5">
                      <ShieldCheck className="h-4 w-4 text-teal-600" />
                      <span>One-Click Demo Accounts:</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {DEMO_ACCOUNTS.map((d) => (
                        <button
                          key={d.email}
                          type="button"
                          disabled={busy}
                          onClick={() => demoSignIn(d.email, d.password)}
                          className="flex flex-col text-left p-2 rounded-lg bg-white border border-slate-200/80 hover:border-teal-400 hover:shadow-sm transition-all text-xs"
                        >
                          <span className="font-bold text-slate-800 capitalize">{d.role.replace('_', ' ')}</span>
                          <span className="text-[10px] text-slate-500 truncate">{d.full_name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="register">
              <Card className="glass-card shadow-lg border-slate-200/80 rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-lg font-bold text-slate-900">Faculty Registration Application</CardTitle>
                  <CardDescription className="text-xs">
                    Apply to become a verified visiting faculty member at the University of Karachi.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {regOk ? (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900">
                      <div className="flex items-center gap-2 font-bold text-emerald-800 mb-1">
                        <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                        Application Successfully Submitted
                      </div>
                      <p className="text-xs text-emerald-700 leading-relaxed">
                        Your application is now under review by the Registrar Office. You can sign in using your registered credentials once your credentials are confirmed.
                      </p>
                    </div>
                  ) : (
                    <form onSubmit={register} className="space-y-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold text-slate-700">Full Name</Label>
                          <Input required value={reg.full_name} onChange={(e) => setReg({ ...reg, full_name: e.target.value })} placeholder="Dr. / Mr. / Ms." className="rounded-xl" />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold text-slate-700">Email Address</Label>
                          <Input required type="email" value={reg.reg_email} onChange={(e) => setReg({ ...reg, reg_email: e.target.value })} placeholder="name@domain.edu" className="rounded-xl" />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold text-slate-700">Phone Number</Label>
                          <Input required value={reg.phone} onChange={(e) => setReg({ ...reg, phone: e.target.value })} placeholder="0300-1234567" className="rounded-xl" />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold text-slate-700">CNIC Number</Label>
                          <Input required value={reg.cnic} onChange={(e) => setReg({ ...reg, cnic: e.target.value })} placeholder="42101-1234567-1" className="rounded-xl" />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold text-slate-700">Applied Designation</Label>
                          <Input required value={reg.designation} onChange={(e) => setReg({ ...reg, designation: e.target.value })} placeholder="Visiting Lecturer / Assistant Prof." className="rounded-xl" />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold text-slate-700">Department</Label>
                          <Select required value={reg.department_id} onValueChange={(v) => setReg({ ...reg, department_id: v })}>
                            <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select department" /></SelectTrigger>
                            <SelectContent position="popper" className="max-h-64 rounded-xl">
                              {departments.map((d) => (
                                <SelectItem key={d.id} value={d.id}>{d.name} ({d.code})</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold text-slate-700">Educational Qualification</Label>
                          <Input required value={reg.qualification} onChange={(e) => setReg({ ...reg, qualification: e.target.value })} placeholder="PhD / MS / MPhil in Field" className="rounded-xl" />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold text-slate-700">Password (min 8 chars)</Label>
                          <Input required type="password" minLength={8} value={reg.reg_password} onChange={(e) => setReg({ ...reg, reg_password: e.target.value })} className="rounded-xl" />
                        </div>
                      </div>

                      {/* Supporting Documents Upload Section */}
                      <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
                        <div>
                          <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                            <Upload className="h-3.5 w-3.5 text-teal-600" />
                            Supporting Documents (Optional — PDF, JPG, PNG up to 5 MB)
                          </p>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Attach CNIC, CV, or Educational Certificates now so the Registrar can review and approve your application faster.
                          </p>
                        </div>

                        <div className="grid gap-2.5 sm:grid-cols-12 items-end">
                          <div className="sm:col-span-5 space-y-1">
                            <Label className="text-[11px] font-semibold text-slate-600">Document Type</Label>
                            <Select value={regDocType} onValueChange={setRegDocType}>
                              <SelectTrigger className="h-9 rounded-lg bg-white text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {DOC_TYPES.map((t) => (
                                  <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="sm:col-span-7 space-y-1">
                            <Label className="text-[11px] font-semibold text-slate-600">Choose File</Label>
                            <Input
                              ref={regFileRef}
                              type="file"
                              accept=".pdf,image/jpeg,image/png"
                              onChange={attachRegDoc}
                              className="h-9 rounded-lg bg-white text-xs file:mr-2 file:rounded file:border-0 file:bg-teal-50 file:px-2 file:py-1 file:text-xs file:font-semibold file:text-teal-700"
                            />
                          </div>
                        </div>

                        {regDocError && (
                          <p className="text-xs text-rose-600 font-medium">{regDocError}</p>
                        )}

                        {regDocs.length > 0 && (
                          <div className="space-y-1.5 pt-1">
                            {regDocs.map((doc) => (
                              <div
                                key={doc.doc_type}
                                className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <FileText className="h-3.5 w-3.5 text-teal-600 shrink-0" />
                                  <span className="font-semibold text-slate-800 shrink-0">{doc.doc_type}:</span>
                                  <span className="truncate text-slate-600">{doc.file_name}</span>
                                  <span className="text-[10px] text-slate-400 shrink-0">
                                    ({Math.max(1, Math.round(doc.file_size / 1024))} KB)
                                  </span>
                                </div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-slate-400 hover:text-rose-600"
                                  onClick={() => setRegDocs((prev) => prev.filter((d) => d.doc_type !== doc.doc_type))}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {regError && (
                        <div className="flex items-center gap-2 rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700">
                          <AlertCircle className="h-4 w-4 flex-shrink-0" />
                          <span>{regError}</span>
                        </div>
                      )}
                      <Button type="submit" className="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl h-10 shadow-sm" disabled={regBusy}>
                        {regBusy ? 'Submitting Application…' : 'Submit Registration Application'}
                      </Button>
                    </form>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </section>

      {/* Institutional Footer */}
      <footer className="bg-slate-950 text-slate-400 py-12 border-t border-slate-800">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 md:grid-cols-4 pb-8 border-b border-slate-800 text-xs">
            <div className="space-y-3 md:col-span-2">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-500/20 text-teal-400 border border-teal-500/30">
                  <GraduationCap className="h-4 w-4" />
                </div>
                <span className="font-bold text-white text-sm">University of Karachi</span>
              </div>
              <p className="text-slate-400 leading-relaxed max-w-md">
                Main University Road, Karachi - 75270, Sindh, Pakistan. Governing visiting faculty assignments, lecture attendance certification, and timely teaching honorarium disbursement.
              </p>
            </div>

            <div className="space-y-2">
              <p className="font-semibold text-white uppercase tracking-wider text-[11px]">Academic Roles</p>
              <ul className="space-y-1.5 text-slate-400">
                <li>Visiting Faculty Portal</li>
                <li>Departmental Chairperson Review</li>
                <li>Accounts & Audit Verification</li>
                <li>Dean of Finance Sanctions</li>
              </ul>
            </div>

            <div className="space-y-2">
              <p className="font-semibold text-white uppercase tracking-wider text-[11px]">System Support</p>
              <ul className="space-y-1.5 text-slate-400">
                <li>Morning Program Directorate</li>
                <li>Registrar Academic Affairs</li>
                <li>Honorarium Rate Schedule</li>
                <li>IT Helpdesk & Bug Tracker</li>
              </ul>
            </div>
          </div>

          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-3">
            <p>© {new Date().getFullYear()} University of Karachi. All rights reserved.</p>
            <p className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span>Teaching Honorarium & Visiting Faculty System • Production Release</span>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
