import { requireUser } from '@/lib/auth';
import { jsonError } from '@/lib/http';
// Download everything Doxia stores about the signed-in member. Row Level Security limits every query to their own rows.
export async function GET() {
  const { supabase, user } = await requireUser();
  if (!user) return jsonError('Sign in to export your data.', 401);
  const { data: allowed, error: rateError } = await supabase.rpc('consume_rate_limit', { p_action: 'data_export' });
  if (rateError) return jsonError('Rate limiting is not configured. Apply the latest Supabase schema.', 503);
  if (!allowed) return jsonError('You can export your data 3 times per hour.', 429);
  const own = (table: string, column: string, select = '*') => supabase.from(table).select(select).eq(column, user.id);
  const [profile, drops, replies, reactions, saved, votes, missions, reports, wallet, entitlement, dogeWallet, weeklyChallenges] = await Promise.all([
    own('profiles', 'id', 'handle,display_name,bio,show_in_rankings,created_at,updated_at'), own('drops', 'author_id'), own('drop_replies', 'author_id'),
    own('drop_reactions', 'user_id'), own('saved_drops', 'user_id'), own('signal_votes', 'user_id'), own('mission_completions', 'user_id'),
    own('drop_reports', 'reporter_id'), own('wallet_links', 'user_id', 'address,claimed_chain_id,verified_at'), own('pro_entitlements', 'user_id', 'provider,status,granted_at'),
    own('doge_wallet_links', 'user_id', 'address,verified_at'),
    own('weekly_challenge_completions', 'user_id', 'week_start,mission_id,completed_at'),
  ]);
  const failed = [profile, drops, replies, reactions, saved, votes, missions, reports, wallet, entitlement, dogeWallet, weeklyChallenges].find(r => r.error);
  if (failed) return jsonError('Could not export your data.', 500);
  const exportData = {
    exported_at: new Date().toISOString(), account: { id: user.id, email: user.email, created_at: user.created_at },
    profile: profile.data?.[0] ?? null, drops: drops.data, replies: replies.data, likes: reactions.data, saved_drops: saved.data,
    signal_votes: votes.data, mission_completions: missions.data, weekly_challenge_completions: weeklyChallenges.data, reports_submitted: reports.data, wallet_link: wallet.data?.[0] ?? null, dogecoin_wallet_link: dogeWallet.data?.[0] ?? null, pro_entitlement: entitlement.data?.[0] ?? null,
  };
  return new Response(JSON.stringify(exportData, null, 2), { headers: {
    'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
    'Content-Disposition': `attachment; filename="doxia-export-${new Date().toISOString().slice(0, 10)}.json"`,
  } });
}
