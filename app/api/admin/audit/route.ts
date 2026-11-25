import { NextRequest } from 'next/server';
import { requireRole, json, handleApiError } from '@/lib/api-helpers';
import { getServiceClient } from '@/lib/supabase-server';

interface AuditApiRow {
  id: string;
  action_type: string;
  entity: string;
  entity_id: string | null;
  previous_value: unknown;
  new_value: unknown;
  remarks: string | null;
  created_at: string;
  actor_id: string | null;
}

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireRole(req, ['super_admin']);
    if (ctx instanceof Response) return ctx;
    const service = getServiceClient();
    const { data, error } = await service
      .from('audit_logs')
      .select('id, action_type, entity, entity_id, previous_value, new_value, remarks, created_at, actor_id')
      .order('created_at', { ascending: false })
      .limit(300);
    if (error) return json({ error: { message: error.message } }, 500);
    const rows = (data || []) as unknown as AuditApiRow[];
    const actorIds = Array.from(new Set(rows.map((r) => r.actor_id).filter((v): v is string => Boolean(v))));
    const nameMap = new Map<string, string>();
    if (actorIds.length > 0) {
      const { data: actors, error: actorsError } = await service
        .from('faculty_profiles')
        .select('user_id, full_name')
        .in('user_id', actorIds);
      if (!actorsError) {
        for (const a of (actors || []) as unknown as { user_id: string; full_name: string }[]) {
          nameMap.set(a.user_id, a.full_name);
        }
      }
    }
    return json(rows.map((r) => ({ ...r, actor_name: r.actor_id ? nameMap.get(r.actor_id) || 'Staff' : 'System' })));
  } catch (err) {
    return handleApiError(err);
  }
}
