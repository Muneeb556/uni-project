import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createMockSupabaseClient } from './mock-supabase';

// Loosely typed: query results are `any` at compile time. All authorization and
// validation happens in API route code, so strict result typing is not the safety
// boundary here; the hand-written Database type predates postgrest-js's strict
// query parser and cannot fully satisfy it.
export type ServerClient = SupabaseClient<any, 'public', any>;

let cached: ServerClient | null = null;
let mockCached: ServerClient | null = null;

export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return false;
  if (url.includes('your-project.supabase.co') || key.includes('your-service-role-key')) return false;
  return true;
}

export function getServiceClient(): ServerClient {
  if (!isSupabaseConfigured()) {
    if (!mockCached) {
      mockCached = createMockSupabaseClient() as unknown as ServerClient;
    }
    return mockCached;
  }

  if (!cached) {
    const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL)!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    cached = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    }) as unknown as ServerClient;
  }
  return cached;
}

export function getAuthedClient(accessToken: string): ServerClient {
  if (!isSupabaseConfigured()) {
    return getServiceClient();
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return getServiceClient();
  }
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  }) as unknown as ServerClient;
}
