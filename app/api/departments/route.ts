import { json, handleApiError } from '@/lib/api-helpers';
import { getServiceClient } from '@/lib/supabase-server';
import { DEMO_DEPARTMENTS } from '@/lib/demo-constants';

export async function GET() {
  try {
    const service = getServiceClient();
    const { data } = await service
      .from('departments')
      .select('id, name, code')
      .eq('status', 'Active')
      .order('name');
    return json(data && data.length > 0 ? data : DEMO_DEPARTMENTS);
  } catch {
    return json(DEMO_DEPARTMENTS);
  }
}
