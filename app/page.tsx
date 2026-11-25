'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { GraduationCap, ShieldCheck } from 'lucide-react';
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

  React.useEffect(() => {
    if (!loading && session) router.replace(homeRouteFor(roles));
  }, [loading, session, roles, router]);

  React.useEffect(() => {
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

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-4 sm:px-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary">
            <GraduationCap className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <p className="text-base font-semibold leading-tight">University of Karachi</p>
            <p className="text-xs text-muted-foreground">Visiting Faculty Management & Teaching Honorarium System</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="mb-8 max-w-2xl">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Morning Program — Teaching Honorarium Portal</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Register, manage teaching attendance, and submit your semester Teaching Honorarium bill entirely
            online. The digital bill mirrors the official paper form and is processed through the
            department, Accounts, and the approving authority — ending with physical submission and payment.
          </p>
        </div>

        <Tabs defaultValue="signin" className="max-w-xl">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="signin">Sign in</TabsTrigger>
            <TabsTrigger value="register">Register as Faculty</TabsTrigger>
          </TabsList>

          <TabsContent value="signin">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Sign in</CardTitle>
                <CardDescription>Use your university email account.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={signIn} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@uok-demo.edu" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="password">Password</Label>
                    <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
                  </div>
                  {error && <p className="text-sm text-destructive">{error}</p>}
                  <Button type="submit" className="w-full" disabled={busy}>
                    {busy ? 'Signing in…' : 'Sign in'}
                  </Button>
                </form>

                <div className="mt-6 rounded-md border bg-muted/40 p-3">
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <ShieldCheck className="h-3.5 w-3.5" /> Demonstration accounts (one click)
                  </p>
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    {DEMO_ACCOUNTS.map((d) => (
                      <Button key={d.email} variant="outline" size="sm" className="justify-start text-xs" disabled={busy} onClick={() => demoSignIn(d.email, d.password)}>
                        {d.role}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="register">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Faculty registration</CardTitle>
                <CardDescription>Submit your application; the registrar verifies your documents next.</CardDescription>
              </CardHeader>
              <CardContent>
                {regOk ? (
                  <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                    Registration received. Sign in after completing your profile and uploading documents.
                  </div>
                ) : (
                  <form onSubmit={register} className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label>Full name</Label>
                        <Input required value={reg.full_name} onChange={(e) => setReg({ ...reg, full_name: e.target.value })} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Email</Label>
                        <Input required type="email" value={reg.reg_email} onChange={(e) => setReg({ ...reg, reg_email: e.target.value })} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Phone number</Label>
                        <Input required value={reg.phone} onChange={(e) => setReg({ ...reg, phone: e.target.value })} placeholder="03xx-xxxxxxx" />
                      </div>
                      <div className="space-y-1.5">
                        <Label>CNIC</Label>
                        <Input required value={reg.cnic} onChange={(e) => setReg({ ...reg, cnic: e.target.value })} placeholder="42101-xxxxxxx-x" />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Designation</Label>
                        <Input required value={reg.designation} onChange={(e) => setReg({ ...reg, designation: e.target.value })} placeholder="Visiting Faculty" />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Department</Label>
                        <Select required value={reg.department_id} onValueChange={(v) => setReg({ ...reg, department_id: v })}>
                          <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                          <SelectContent position="popper" className="max-h-64">
                            {departments.map((d) => (
                              <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Educational qualification</Label>
                        <Input required value={reg.qualification} onChange={(e) => setReg({ ...reg, qualification: e.target.value })} placeholder="MS / MPhil / PhD" />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Password (min 8 characters)</Label>
                        <Input required type="password" minLength={8} value={reg.reg_password} onChange={(e) => setReg({ ...reg, reg_password: e.target.value })} />
                      </div>
                    </div>
                    {regError && <p className="text-sm text-destructive">{regError}</p>}
                    <Button type="submit" className="w-full" disabled={regBusy}>
                      {regBusy ? 'Submitting…' : 'Submit registration'}
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
