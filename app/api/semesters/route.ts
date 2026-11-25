import { NextRequest } from 'next/server';
import { json, handleApiError, errorResponse, requireAuth, isStaff } from '@/lib/api-helpers';
import { getServiceClient } from '@/lib/supabase-server';

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireAuth(req);
    if (ctx instanceof Response) return ctx;
    const service = getServiceClient();
    const { searchParams } = new URL(req.url);
    const active = searchParams.get('active');
    let query = service.from('semesters').select('*').order('start_date', { ascending: false });
    if (active === '1') query = query.in('status', ['Active', 'Billing Open', 'Attendance Closing']);
    const { data, error } = await query;
    if (error) return errorResponse(error.message, 500, 'query_failed');
    return json(data || []);
  } catch (err) {
    return handleApiError(err);
  }
}
