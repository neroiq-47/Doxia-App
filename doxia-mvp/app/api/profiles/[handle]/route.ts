import { requireUser } from '@/lib/auth';
import { jsonError, jsonOk } from '@/lib/http';
import { getPublicProfile } from '@/lib/data';
export async function GET(_request: Request, context: { params: Promise<{ handle: string }> }) {
  const { handle } = await context.params;
  const { supabase, user } = await requireUser();
  const profile = await getPublicProfile(supabase, user?.id ?? null, handle);
  if (!profile) return jsonError('Profile not found.', 404);
  return jsonOk(profile);
}
