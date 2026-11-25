import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Loosely typed: query results are `any` at compile time. All authorization and
// validation happens in API route code, so strict result typing is not the safety
// boundary here; the hand-written Database type predates postgrest-js's strict
// query parser and cannot fully satisfy it.
export type ServerClient = SupabaseClient<any, 'public', any>;

let cached: ServerClient | null = null;

export function getServiceClient(): ServerClient {
  if (!cached) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error('Supabase service credentials are not configured');
    }
    cached = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    }) as unknown as ServerClient;
  }
  return cached;
}

export function getAuthedClient(accessToken: string): ServerClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error('Supabase environment variables are not configured');
  }
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  }) as unknown as ServerClient;
}
