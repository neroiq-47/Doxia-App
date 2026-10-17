import { requireUser } from '@/lib/auth';
import { isRecord, jsonError, jsonOk, safeString } from '@/lib/http';
export async function GET() {
  const { supabase, user } = await requireUser();
  if (!user) return jsonError('Sign in required.', 401);
  const { data, error } = await supabase.from('profiles').select('id,handle,display_name,bio,created_at,show_in_rankings').eq('id', user.id).maybeSingle();
  if (error) return jsonError('Could not load profile.', 500);
  return jsonOk({ profile: data });
}
export async function PATCH(request: Request) {
  const { supabase, user } = await requireUser();
  if (!user) return jsonError('Sign in required.', 401);
  const { data: allowed, error: rateError } = await supabase.rpc('consume_rate_limit', { p_action: 'profile_update' });
  if (rateError) return jsonError('Rate limiting is not configured. Apply the latest Supabase schema.', 503);
  if (!allowed) return jsonError('Profile updated too frequently. Wait a minute and try again.', 429);
  let body: unknown; try { body = await request.json(); } catch { return jsonError('Invalid JSON body.'); }
  if (!isRecord(body)) return jsonError('Invalid request body.');
  const display_name = safeString(body.display_name, 32);
  const bio = typeof body.bio === 'string' && body.bio.length <= 160 ? body.bio : null;
  const handleRaw = safeString(body.handle, 24)?.replace(/^@/, '').toLowerCase();
  if (!display_name || bio === null || !handleRaw || !/^[a-z0-9_][a-z0-9_.]{1,23}$/.test(handleRaw)) return jsonError('Check display name, handle (2–24 letters/numbers/._), and bio (max 160 characters).');
  const update: Record<string, unknown> = { display_name, bio, handle: handleRaw, updated_at: new Date().toISOString() };
  if (typeof body.show_in_rankings === 'boolean') update.show_in_rankings = body.show_in_rankings;
  const { data, error } = await supabase.from('profiles').update(update).eq('id', user.id).select('id,handle,display_name,bio,show_in_rankings').single();
  if (error) return jsonError(error.code === '23505' ? 'That handle is already taken.' : 'Could not save profile.', error.code === '23505' ? 409 : 400);
  return jsonOk({ profile: data });
}
