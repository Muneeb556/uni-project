import { NextRequest } from 'next/server';
import { requireAuth, json, errorResponse, handleApiError, getFacultyProfile, audit, type AuthContext } from '@/lib/api-helpers';
import type { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase-server';
import { z } from 'zod';

const schema = z.object({
  full_name: z.string().min(3).optional(),
  phone: z.string().max(20).optional(),
  cnic: z.string().max(15).optional(),
  designation: z.string().optional(),
  grade: z.string().optional(),
  qualification: z.string().optional(),
  bank_account_number: z.string().max(30).optional(),
  bank_name: z.string().optional(),
  university_branch: z.string().optional(),
});

function isResponse(v: AuthContext | NextResponse): v is NextResponse {
  return (v as NextResponse).status !== undefined;
}

export async function PUT(req: NextRequest) {
  try {
    const ctx = await requireAuth(req);
    if (isResponse(ctx)) return ctx;
    const profile = await getFacultyProfile(ctx);
    if (!profile) return errorResponse('Profile not found', 404, 'not_found');

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return errorResponse(parsed.error.issues[0]?.message || 'Invalid profile details');

    const service = getServiceClient();
    const { data, error } = await service
      .from('faculty_profiles')
      .update({ ...parsed.data, updated_at: new Date().toISOString() })
      .eq('id', profile.id)
      .select('*')
      .single();
    if (error) return errorResponse(error.message, 500, 'update_failed');

    await audit(ctx, 'profile.update', 'faculty_profiles', profile.id, profile, data);
    return json(data);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireAuth(req);
    if (isResponse(ctx)) return ctx;
    const profile = await getFacultyProfile(ctx);
    if (!profile) return errorResponse('Profile not found', 404, 'not_found');
    return json(profile);
  } catch (err) {
    return handleApiError(err);
  }
}
