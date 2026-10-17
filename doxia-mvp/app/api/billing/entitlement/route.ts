import { requireUser } from '@/lib/auth';
import { jsonError, jsonOk } from '@/lib/http';
export async function GET() {
  const { supabase, user } = await requireUser();
  if (!user) return jsonError('Sign in required.', 401);
  const { data, error } = await supabase.from('pro_entitlements').select('status,granted_at').eq('user_id', user.id).maybeSingle();
  if (error) return jsonError('Could not load Pro status.', 500);
  return jsonOk({ isPro: data?.status === 'active', entitlement: data ?? null });
}
