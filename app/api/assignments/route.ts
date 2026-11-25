import { NextRequest } from 'next/server';
import { requireAuth, json, handleApiError, errorResponse, isStaff } from '@/lib/api-helpers';
import { getServiceClient } from '@/lib/supabase-server';

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireAuth(req);
    if (ctx instanceof Response) return ctx;
    const service = getServiceClient();
    const { searchParams } = new URL(req.url);
    const semesterId = searchParams.get('semester_id');
    let query = service
      .from('faculty_assignments')
      .select('*, courses (title, code, credit_hours), semesters (name), departments (name)')
      .order('created_at', { ascending: false });
    if (semesterId) query = query.eq('semester_id', semesterId);
    if (!isStaff(ctx)) {
      const { data: prof } = await service.from('faculty_profiles').select('id').eq('user_id', ctx.userId).maybeSingle();
      if (!prof) return json([]);
      query = query.eq('faculty_id', prof.id);
    } else if (ctx.roles.includes('coordinator') && !ctx.roles.includes('super_admin') && ctx.departmentIds.length > 0) {
      query = query.in('department_id', ctx.departmentIds);
    }
    const { data, error } = await query;
    if (error) return errorResponse(error.message, 500, 'query_failed');
    return json(data || []);
  } catch (err) {
    return handleApiError(err);
  }
}
