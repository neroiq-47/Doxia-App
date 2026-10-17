import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// Anonymous, session-less client for public read-only surfaces (developer API, embeds, public profile pages).
export function createPublicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error('Supabase is not configured.');
  return createSupabaseClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}
