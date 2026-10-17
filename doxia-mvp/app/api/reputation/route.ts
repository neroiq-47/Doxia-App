import { requireUser } from '@/lib/auth';
import { jsonError, jsonOk } from '@/lib/http';
import { computeBadges } from '@/lib/badges';
// The signed-in member's own reputation breakdown, streak and badges.
export async function GET() {
  const { supabase, user } = await requireUser();
  if (!user) return jsonError('Sign in to see your reputation.', 401);
  const { data, error } = await supabase.rpc('get_my_reputation');
  if (error || !data?.[0]) return jsonError('Could not load reputation.', 500);
  const r = data[0];
  const n = (v: unknown) => Number(v ?? 0);
  return jsonOk({
    total: n(r.total), last_30_days: n(r.last_30_days), streak: n(r.streak),
    breakdown: { drops: n(r.drops_points), likes_received: n(r.likes_points), replies: n(r.replies_points), replies_received: n(r.replies_received_points), signal: n(r.signal_points), missions: n(r.mission_points) },
    badges: computeBadges({ drops: n(r.drops_count), replies: n(r.replies_count), topicsVoted: n(r.topics_voted), missionsCompleted: n(r.missions_completed), missionsAvailable: n(r.missions_available), streak: n(r.streak), walletVerified: Boolean(r.wallet_verified), isPro: Boolean(r.is_pro) }),
  });
}
