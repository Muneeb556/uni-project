import { NextRequest } from 'next/server';
import { requireRole, json, handleApiError, errorResponse } from '@/lib/api-helpers';
import { getServiceClient } from '@/lib/supabase-server';

// Department-wide attendance review queue (coordinator/admin)
export async function GET(req: NextRequest) {
  try {
    const ctx = await requireRole(req, ['super_admin', 'coordinator']);
    if (ctx instanceof Response) return ctx;
    const service = getServiceClient();
    const { searchParams } = new URL(req.url);
    const semesterId = searchParams.get('semester_id');
    let query = service
      .from('attendance_records')
      .select('*, faculty_profiles (full_name), faculty_assignments (courses (code, title))')
      .in('status', ['Submitted', 'Pending', 'Correction Required'])
      .order('scheduled_date', { ascending: false });
    if (semesterId) query = query.eq('semester_id', semesterId);
    if (ctx.roles.includes('coordinator') && !ctx.roles.includes('super_admin') && ctx.departmentIds.length > 0) {
      query = query.in('faculty_profiles.department_id', ctx.departmentIds);
    }
    const { data, error } = await query;
    if (error) return errorResponse(error.message, 500, 'query_failed');
    return json(data || []);
  } catch (err) {
    return handleApiError(err);
  }
}
