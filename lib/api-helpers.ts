import { NextRequest, NextResponse } from 'next/server';
import { getAuthedClient, getServiceClient, type ServerClient } from './supabase-server';
import { verifyDemoToken } from './demo-tokens';

export type Role = 'faculty' | 'super_admin' | 'coordinator' | 'accounts' | 'approver';

export interface AuthContext {
  userId: string;
  email: string;
  roles: Role[];
  departmentIds: string[];
  client: ServerClient;
}

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function errorResponse(message: string, status = 400, code?: string) {
  return NextResponse.json({ error: { message, code: code || 'bad_request' } }, { status });
}

export async function getAuth(req: NextRequest): Promise<AuthContext | null> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const accessToken = authHeader.slice('Bearer '.length).trim();
  if (!accessToken) return null;

  const demoPayload = verifyDemoToken(accessToken);
  if (demoPayload) {
    return {
      userId: demoPayload.sub,
      email: demoPayload.email,
      roles: demoPayload.roles as Role[],
      departmentIds: demoPayload.department_ids,
      client: getServiceClient(),
    };
  }

  const service = getServiceClient();
  const { data: userData, error: userError } = await service.auth.getUser(accessToken);
  if (userError || !userData?.user) return null;

  const { data: roleRows } = await service
    .from('user_roles')
    .select('role, department_id')
    .eq('user_id', userData.user.id);

  const roles = (roleRows || []).map((r) => r.role as Role);
  const departmentIds = Array.from(
    new Set((roleRows || []).map((r) => r.department_id).filter((d): d is string => Boolean(d)))
  );

  return {
    userId: userData.user.id,
    email: userData.user.email || '',
    roles,
    departmentIds,
    client: getAuthedClient(accessToken),
  };
}

export async function requireAuth(req: NextRequest): Promise<AuthContext | NextResponse> {
  const ctx = await getAuth(req);
  if (!ctx) return errorResponse('Authentication required', 401, 'unauthorized');
  return ctx;
}

export function isStaff(ctx: AuthContext) {
  return ctx.roles.some((r) => r !== 'faculty');
}

export async function requireRole(
  req: NextRequest,
  allowed: Role[]
): Promise<AuthContext | NextResponse> {
  const ctx = await requireAuth(req);
  if (ctx instanceof NextResponse) return ctx;
  if (!ctx.roles.some((r) => allowed.includes(r))) {
    return errorResponse('You do not have permission to perform this action', 403, 'forbidden');
  }
  return ctx;
}

export async function getFacultyProfile(ctx: AuthContext) {
  const { data, error } = await ctx.client
    .from('faculty_profiles')
    .select('*')
    .eq('user_id', ctx.userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export function handleApiError(err: unknown) {
  const message = err instanceof Error ? err.message : 'An unexpected error occurred';
  return errorResponse(message, 500, 'internal');
}

export async function audit(
  ctx: AuthContext | null,
  actionType: string,
  entity: string,
  entityId: string | null,
  previousValue: unknown,
  newValue: unknown,
  remarks?: string
) {
  const service = getServiceClient();
  await service.from('audit_logs').insert({
    actor_id: ctx?.userId || null,
    actor_role: ctx?.roles[0] || null,
    action_type: actionType,
    entity,
    entity_id: entityId,
    previous_value: (previousValue ?? null) as never,
    new_value: (newValue ?? null) as never,
    remarks: remarks || null,
  });
}

export async function notify(
  userId: string,
  title: string,
  body: string,
  category: string,
  link?: string
) {
  const service = getServiceClient();
  await service.from('notifications').insert({
    user_id: userId,
    title,
    body,
    category,
    link: link || null,
  });
}
