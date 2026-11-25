import { NextRequest } from 'next/server';
import { requireAuth, json, handleApiError, errorResponse } from '@/lib/api-helpers';
import { getServiceClient } from '@/lib/supabase-server';

// Public-to-authenticated reference data endpoints
export async function GET(req: NextRequest) {
  try {
    const ctx = await requireAuth(req);
    if (ctx instanceof Response) return ctx;
    const service = getServiceClient();
    const type = new URL(req.url).searchParams.get('type');
    switch (type) {
      case 'departments': {
        const { data } = await service.from('departments').select('*').order('name');
        return json(data || []);
      }
      case 'courses': {
        const { data } = await service.from('courses').select('*').order('code');
        return json(data || []);
      }
      case 'settings': {
        const { data } = await service.from('system_settings').select('*');
        return json(data || []);
      }
      case 'compensation': {
        const { data } = await service.from('compensation_rules').select('*');
        return json(data || []);
      }
      default:
        return errorResponse('Unknown reference type');
    }
  } catch (err) {
    return handleApiError(err);
  }
}
