import { NextRequest } from 'next/server';
import { getServiceClient } from '@/lib/supabase-server';
import { json, errorResponse, handleApiError } from '@/lib/api-helpers';
import { DEMO_ACCOUNTS } from '@/lib/demo-constants';
import { signDemoToken } from '@/lib/demo-tokens';
import { z } from 'zod';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const DEMO_USER_IDS: Record<string, string> = {
  super_admin: '00000000-0000-4000-8000-000000000101',
  coordinator: '00000000-0000-4000-8000-000000000102',
  accounts: '00000000-0000-4000-8000-000000000103',
  approver: '00000000-0000-4000-8000-000000000104',
  faculty: 'b8045c22-d826-4589-930e-2440341acdbb',
};

export async function POST(req: NextRequest) {
  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return errorResponse('Email and password are required');
    const { email, password } = parsed.data;
    const demo = DEMO_ACCOUNTS.find((account) => account.email.toLowerCase() === email.toLowerCase());

    if (demo) {
      if (demo.password !== password) return errorResponse('Invalid email or password', 401, 'invalid_credentials');
      const account = await resolveDemoAccount(demo);
      const token = signDemoToken({
        sub: account.userId,
        email: demo.email,
        roles: [demo.role],
        department_ids: account.departmentId ? [account.departmentId] : [],
      });
      return json({
        access_token: token,
        refresh_token: token,
        expires_at: Math.floor(Date.now() / 1000) + 60 * 60 * 12,
        user: { id: account.userId, email: demo.email },
        roles: [demo.role],
        demo: true,
      });
    }

    try {
      const service = getServiceClient();
      const { data, error } = await service.auth.signInWithPassword({ email, password });
      if (error || !data.session) return errorResponse('Invalid email or password', 401, 'invalid_credentials');
      return json({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at,
        user: { id: data.user.id, email: data.user.email },
      });
    } catch {
      return errorResponse('Only the demonstration accounts can sign in in this environment', 401, 'invalid_credentials');
    }
  } catch (err) {
    return handleApiError(err);
  }
}

async function resolveDemoAccount(demo: (typeof DEMO_ACCOUNTS)[number]): Promise<{ userId: string; departmentId: string | null }> {
  const fallback = { userId: DEMO_USER_IDS[demo.role], departmentId: null as string | null };
  try {
    const service = getServiceClient();
    const departmentId = demo.departmentCode
      ? (await service.from('departments').select('id').eq('code', demo.departmentCode).maybeSingle()).data?.id || null
      : null;
    if (demo.role === 'faculty') {
      const profile = (await service.from('faculty_profiles').select('user_id, department_id').eq('user_id', fallback.userId).maybeSingle()).data;
      return { userId: profile?.user_id || fallback.userId, departmentId: profile?.department_id || departmentId };
    }
    return { ...fallback, departmentId };
  } catch {
    return fallback;
  }
}
