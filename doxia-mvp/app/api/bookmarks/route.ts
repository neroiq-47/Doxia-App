import { requireUser } from '@/lib/auth';
import { jsonError, jsonOk } from '@/lib/http';
export async function GET() {
  const { supabase, user } = await requireUser();
  if (!user) return jsonError('Sign in to sync saved Drops.', 401);
  const { data, error } = await supabase.from('saved_drops').select('drop_id').eq('user_id', user.id);
  if (error) return jsonError('Could not load saved Drops.', 500);
  return jsonOk({ dropIds: (data ?? []).map(row => row.drop_id) });
}
