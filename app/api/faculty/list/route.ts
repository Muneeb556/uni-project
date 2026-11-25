import { NextRequest } from 'next/server';
import { requireRole, json, handleApiError, errorResponse } from '@/lib/api-helpers';
import { getServiceClient } from '@/lib/supabase-server';

// Staff-facing list of faculty applications with document summaries
export async function GET(req: NextRequest) {
  try {
    const ctx = await requireRole(req, ['super_admin', 'coordinator']);
    if (ctx instanceof Response) return ctx;
    const service = getServiceClient();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');

    let query = service
      .from('faculty_profiles')
      .select('*, departments (name, code), user_id, faculty_documents (id, doc_type, status, remarks)')
      .order('created_at', { ascending: false });
    if (status) query = query.eq('application_status', status);
    if (ctx.roles.includes('coordinator') && !ctx.roles.includes('super_admin') && ctx.departmentIds.length > 0) {
      query = query.in('department_id', ctx.departmentIds);
    }
    const { data, error } = await query;
    if (error) return errorResponse(error.message, 500, 'query_failed');
    return json(data || []);
  } catch (err) {
    return handleApiError(err);
  }
}
