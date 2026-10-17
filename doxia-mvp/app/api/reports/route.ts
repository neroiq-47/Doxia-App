import { requireUser } from '@/lib/auth';
import { isRecord, jsonError, jsonOk, safeString } from '@/lib/http';
export async function POST(request: Request) {
  const { supabase, user } = await requireUser();
  if (!user) return jsonError('Sign in to report a Drop.', 401);
  const { data: allowed, error: rateError } = await supabase.rpc('consume_rate_limit', { p_action: 'report_drop' });
  if (rateError) return jsonError('Rate limiting is not configured. Apply the latest Supabase schema.', 503);
  if (!allowed) return jsonError('Report limit reached. Try again later.', 429);
  let body: unknown; try { body = await request.json(); } catch { return jsonError('Invalid JSON body.'); }
  if (!isRecord(body)) return jsonError('Invalid request body.');
  const drop_id = safeString(body.drop_id, 64);
  const reason = body.reason;
  const details = typeof body.details === 'string' ? body.details.slice(0, 1000) : '';
  if (!drop_id || !['spam','harassment','impersonation','illegal','other'].includes(String(reason))) return jsonError('Select a valid Drop and report reason.');
  const { error } = await supabase.from('drop_reports').insert({ reporter_id: user.id, drop_id, reason, details });
  if (error) return jsonError(error.code === '23505' ? 'You have already reported this Drop.' : 'Could not submit report.', error.code === '23505' ? 409 : 400);
  return jsonOk({ submitted: true }, 201);
}
