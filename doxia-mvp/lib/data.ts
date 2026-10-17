import type { SupabaseClient } from '@supabase/supabase-js';
import { confidenceFor } from '@/lib/signal';
import { computeBadges } from '@/lib/badges';

// Shared read queries used by the app's own routes (signed-in client) and the public developer API (anonymous client).
export const DROP_SELECT = 'id,author_id,body,topic,visibility,created_at,project_id,profiles:profiles!drops_author_id_fkey(handle,display_name),projects(slug,name,symbol),drop_reactions(count),drop_replies(count)';
export const MAX_PAGE = 50;

type Row = Record<string, unknown>;
export type DropRow = Row & { liked: boolean };
export type DropFilters = { limit: number; before?: string | null; topic?: string | null; project?: string | null; sort?: 'latest' | 'trending'; q?: string | null; author?: string | null };

export function parseDropFilters(url: URL): DropFilters {
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? 20) || 20, 1), MAX_PAGE);
  const before = url.searchParams.get('before');
  return {
    limit,
    before: before && !Number.isNaN(Date.parse(before)) ? before : null,
    topic: url.searchParams.get('topic')?.slice(0, 40) || null,
    project: url.searchParams.get('project')?.slice(0, 40) || null,
    sort: url.searchParams.get('sort') === 'trending' ? 'trending' : 'latest',
    q: url.searchParams.get('q')?.slice(0, 100) || null,
  };
}

async function projectIdFor(supabase: SupabaseClient, slug: string) {
  const { data } = await supabase.from('projects').select('id').eq('slug', slug).maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

async function likedSet(supabase: SupabaseClient, userId: string | null, dropIds: string[]) {
  if (!userId || dropIds.length === 0) return new Set<string>();
  const { data } = await supabase.from('drop_reactions').select('drop_id').eq('user_id', userId).in('drop_id', dropIds);
  return new Set((data ?? []).map(r => r.drop_id as string));
}

export async function listDrops(supabase: SupabaseClient, userId: string | null, f: DropFilters) {
  let rows: Row[] | null = null;
  let nextCursor: string | null = null;
  if (f.q && f.q.trim().length >= 2) {
    const { data, error } = await supabase.rpc('search_drops', { p_query: f.q, p_limit: f.limit }).select(DROP_SELECT);
    if (error) return { error: 'Could not search Drops.' } as const;
    rows = data as Row[];
  } else if (f.sort === 'trending') {
    const { data, error } = await supabase.rpc('get_trending_drops', { p_hours: 72, p_limit: f.limit }).select(DROP_SELECT);
    if (error) return { error: 'Could not load trending Drops.' } as const;
    rows = data as Row[];
  } else {
    let query = supabase.from('drops').select(DROP_SELECT).eq('visibility', 'public').order('created_at', { ascending: false }).limit(f.limit);
    if (f.before) query = query.lt('created_at', f.before);
    if (f.topic) query = query.eq('topic', f.topic);
    if (f.author) query = query.eq('author_id', f.author);
    if (f.project) {
      const projectId = await projectIdFor(supabase, f.project);
      if (!projectId) return { drops: [], nextCursor: null } as const;
      query = query.eq('project_id', projectId);
    }
    const { data, error } = await query;
    if (error) return { error: 'Could not load Drops.' } as const;
    rows = data as Row[];
    nextCursor = rows.length === f.limit ? (rows[rows.length - 1].created_at as string) : null;
  }
  const liked = await likedSet(supabase, userId, rows.map(r => r.id as string));
  const drops: DropRow[] = rows.map(r => ({ ...r, liked: liked.has(r.id as string) }));
  return { drops, nextCursor } as const;
}

export async function getDrop(supabase: SupabaseClient, userId: string | null, id: string) {
  const { data, error } = await supabase.from('drops').select(DROP_SELECT).eq('id', id).maybeSingle();
  if (error || !data) return null;
  const liked = await likedSet(supabase, userId, [id]);
  return { ...(data as Row), liked: liked.has(id) };
}

export async function listReplies(supabase: SupabaseClient, dropId: string) {
  const { data, error } = await supabase.from('drop_replies').select('id,drop_id,author_id,parent_id,body,created_at,profiles:profiles!drop_replies_author_id_fkey(handle,display_name)').eq('drop_id', dropId).order('created_at', { ascending: true }).limit(200);
  if (error) return null;
  return data as Row[];
}

function signalShape(summary: Row, history: Row[], topic: Row) {
  const bullish = Number(summary.bullish ?? 0), bearish = Number(summary.bearish ?? 0), neutral = Number(summary.neutral ?? 0);
  const total = bullish + bearish + neutral;
  const confidence = confidenceFor(total, bullish);
  return {
    slug: topic.slug as string, question: topic.question as string, project: (topic.projects as Row | null) ?? null,
    bullish, bearish, neutral, total, my_vote: (summary.my_vote as string | null) ?? null,
    confidence: { level: confidence.level, positive_lower: Number(confidence.lower.toFixed(3)), positive_upper: Number(confidence.upper.toFixed(3)), margin_pts: confidence.marginPts },
    history: history.map(h => ({ day: h.day as string, bullish: Number(h.bullish), bearish: Number(h.bearish), neutral: Number(h.neutral) })),
  };
}
export type SignalTopic = ReturnType<typeof signalShape>;

export async function listSignalTopics(supabase: SupabaseClient, days = 30, onlySlug?: string) {
  let query = supabase.from('signal_topics').select('slug,question,created_at,project_id,projects(slug,name,symbol)').eq('is_active', true).order('created_at', { ascending: true });
  if (onlySlug) query = query.eq('slug', onlySlug);
  const { data: topics, error } = await query;
  if (error) return null;
  const shaped = await Promise.all((topics ?? []).map(async topic => {
    const [summary, history] = await Promise.all([
      supabase.rpc('get_signal_summary', { p_slug: topic.slug }),
      supabase.rpc('get_signal_history', { p_slug: topic.slug, p_days: days }),
    ]);
    if (summary.error || history.error || !summary.data?.[0]) return null;
    return signalShape(summary.data[0], history.data ?? [], topic as Row);
  }));
  if (shaped.some(s => s === null)) return null;
  return shaped as SignalTopic[];
}

export async function listProjects(supabase: SupabaseClient) {
  const [{ data: projects, error }, topics] = await Promise.all([
    supabase.from('projects').select('id,slug,name,symbol,description,website').eq('is_active', true).order('name'),
    listSignalTopics(supabase, 7),
  ]);
  if (error || !topics) return null;
  return (projects ?? []).map(p => ({ ...p, signal: topics.find(t => (t.project as Row | null)?.slug === p.slug) ?? null }));
}

export async function getProject(supabase: SupabaseClient, userId: string | null, slug: string) {
  const { data: project } = await supabase.from('projects').select('id,slug,name,symbol,description,website').eq('slug', slug).eq('is_active', true).maybeSingle();
  if (!project) return null;
  const topics = await listSignalTopics(supabase, 30, `${slug}-sentiment`);
  const feed = await listDrops(supabase, userId, { limit: 20, project: slug, sort: 'latest' });
  return { project, signal: topics?.[0] ?? null, drops: 'error' in feed ? [] : feed.drops };
}

export async function getPublicProfile(supabase: SupabaseClient, userId: string | null, handle: string) {
  const { data, error } = await supabase.rpc('get_profile_stats', { p_handle: handle.replace(/^@/, '') });
  if (error || !data?.[0]) return null;
  const s = data[0] as Row;
  const { data: owner } = await supabase.from('profiles').select('id').eq('handle', s.handle as string).maybeSingle();
  const feed = owner ? await listDrops(supabase, userId, { limit: 20, author: owner.id as string, sort: 'latest' }) : { drops: [] as DropRow[] };
  const ranked = Boolean(s.show_in_rankings);
  return {
    profile: { handle: s.handle, display_name: s.display_name, bio: s.bio, joined_at: s.joined_at },
    stats: { public_drops: Number(s.public_drops), likes_received: Number(s.likes_received), replies_written: Number(s.replies_written) },
    reputation: ranked ? { score: Number(s.reputation ?? 0), streak: Number(s.streak ?? 0) } : null,
    badges: ranked ? computeBadges({ drops: Number(s.public_drops), replies: Number(s.replies_written), topicsVoted: Number(s.topics_voted ?? 0), missionsCompleted: Number(s.missions_completed ?? 0), missionsAvailable: Number(s.missions_available ?? 0), streak: Number(s.streak ?? 0), walletVerified: Boolean(s.wallet_verified), isPro: Boolean(s.is_pro) }).filter(b => b.earned) : [],
    drops: 'error' in feed ? [] : feed.drops,
  };
}

export async function getLeaderboard(supabase: SupabaseClient, days = 30, limit = 10) {
  const { data, error } = await supabase.rpc('get_leaderboard', { p_days: days, p_limit: limit });
  if (error) return null;
  return (data ?? []).map((r: Row) => ({ rank: Number(r.rank), handle: r.handle as string, display_name: r.display_name as string, score: Number(r.score), streak: Number(r.streak) }));
}

export async function getCommunityStats(supabase: SupabaseClient) {
  const { data, error } = await supabase.rpc('get_community_stats');
  if (error || !data?.[0]) return null;
  return Object.fromEntries(Object.entries(data[0] as Row).map(([k, v]) => [k, Number(v)])) as Record<string, number>;
}

export async function getTrendingTopics(supabase: SupabaseClient) {
  const { data, error } = await supabase.rpc('get_trending_topics', { p_days: 7, p_limit: 5 });
  if (error) return null;
  return (data ?? []).map((t: Row) => ({ topic: t.topic as string, drops: Number(t.drops) }));
}

// Public, stable JSON shape for Drops in the developer API.
export function publicDrop(d: Row, origin: string) {
  const author = (d.profiles as Row | null) ?? {};
  return {
    id: d.id, body: d.body, topic: d.topic, visibility: d.visibility, created_at: d.created_at,
    author: { handle: author.handle ?? null, display_name: author.display_name ?? null },
    project: (d.projects as Row | null) ?? null,
    likes: Number(((d.drop_reactions as Row[] | undefined)?.[0]?.count) ?? 0),
    replies: Number(((d.drop_replies as Row[] | undefined)?.[0]?.count) ?? 0),
    url: `${origin}/?drop=${d.id}`,
  };
}
