import { NextRequest } from 'next/server';
import { requireAuth, json, handleApiError, isStaff, getFacultyProfile, type AuthContext } from '@/lib/api-helpers';
import type { NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireAuth(req);
    if (isResponse(ctx)) return ctx;
    const profile = isStaff(ctx) ? null : await getFacultyProfile(ctx);
    return json({
      user: { id: ctx.userId, email: ctx.email },
      roles: ctx.roles,
      department_ids: ctx.departmentIds,
      profile,
    });
  } catch (err) {
    return handleApiError(err);
  }
}

function isResponse(v: AuthContext | NextResponse): v is NextResponse {
  return (v as NextResponse).status !== undefined;
}
