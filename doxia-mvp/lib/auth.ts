import { createClient } from '@/lib/supabase/server';
export async function requireUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { supabase, user: null } as const;
  return { supabase, user } as const;
}
