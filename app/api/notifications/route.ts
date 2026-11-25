import { NextRequest } from 'next/server';
import { requireAuth, json, errorResponse, handleApiError } from '@/lib/api-helpers';
import { getServiceClient } from '@/lib/supabase-server';
import { z } from 'zod';

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireAuth(req);
    if (ctx instanceof Response) return ctx;
    const service = getServiceClient();
    const { data, error } = await service
      .from('notifications')
      .select('*')
      .eq('user_id', ctx.userId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) return errorResponse(error.message, 500, 'query_failed');
    return json(data || []);
  } catch (err) {
    return handleApiError(err);
  }
}

const markSchema = z.object({ ids: z.array(z.string().uuid()).optional(), all: z.boolean().optional() });

export async function PATCH(req: NextRequest) {
  try {
    const ctx = await requireAuth(req);
    if (ctx instanceof Response) return ctx;
    const parsed = markSchema.safeParse(await req.json().catch(() => ({})));
    const service = getServiceClient();
    if (parsed.success && parsed.data.all) {
      await service.from('notifications').update({ read: true }).eq('user_id', ctx.userId).eq('read', false);
    } else if (parsed.success && parsed.data.ids) {
      await service.from('notifications').update({ read: true }).in('id', parsed.data.ids).eq('user_id', ctx.userId);
    }
    return json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
