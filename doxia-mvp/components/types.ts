export type Visibility = "public" | "unlisted";
export type Vote = "bullish" | "bearish" | "neutral";
export type Drop = {
  id: string; authorId: string; author: string; handle: string; time: string; text: string; tag: string;
  likes: number; liked: boolean; replies: number; visibility: Visibility; project: { slug: string; name: string; symbol: string | null } | null;
};
export type ApiDrop = {
  id: string; author_id: string; body: string; created_at: string; topic?: string | null; visibility?: string | null; liked?: boolean;
  profiles?: { display_name?: string | null; handle?: string | null } | null;
  projects?: { slug: string; name: string; symbol: string | null } | null;
  drop_reactions?: { count: number }[]; drop_replies?: { count: number }[];
};
export type HistoryPoint = { day: string; bullish: number; bearish: number; neutral: number };
export type SignalTopic = {
  slug: string; question: string; project: { slug: string; name: string; symbol: string | null } | null;
  bullish: number; bearish: number; neutral: number; total: number; my_vote: Vote | null;
  confidence: { level: "none" | "low" | "medium" | "high"; positive_lower: number; positive_upper: number; margin_pts: number };
  history: HistoryPoint[];
};
export type Badge = { id: string; label: string; description: string; earned: boolean };

export const MAIN_SIGNAL_SLUG = "privacy-web-direction";
export const TOPICS = ["Community", "Privacy", "Web3", "Open source", "Signal", "Culture"];

export function timeAgo(iso: string) {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d`;
  return new Date(iso).toLocaleDateString();
}

export function mapDrop(d: ApiDrop): Drop {
  return {
    id: d.id, authorId: d.author_id, author: d.profiles?.display_name ?? "Doxia member", handle: "@" + (d.profiles?.handle ?? "member"),
    time: timeAgo(d.created_at), text: d.body, tag: d.topic ?? "Community", likes: d.drop_reactions?.[0]?.count ?? 0, liked: Boolean(d.liked),
    replies: d.drop_replies?.[0]?.count ?? 0, visibility: d.visibility === "unlisted" ? "unlisted" : "public", project: d.projects ?? null,
  };
}

export function share(part: number, total: number) { return total ? Math.round((part / total) * 100) : 0; }

// Sparkline path for the positive share over time; null when fewer than two days have votes.
export function trendPath(history: HistoryPoint[], width = 260, height = 56) {
  const points = history.map(h => { const t = h.bullish + h.bearish + h.neutral; return t ? (h.bullish / t) * 100 : null; });
  const known = points.filter((p): p is number => p !== null);
  if (known.length < 2) return null;
  const path = points.map((p, i) => p === null ? null : `${(i / (points.length - 1)) * width} ${height - 4 - (p / 100) * (height - 8)}`)
    .filter(Boolean).map((xy, i) => `${i ? "L" : "M"}${xy}`).join(" ");
  return { path, delta: Math.round(known[known.length - 1] - known[0]) };
}

export function goToLogin() { window.location.href = "/login"; }

export async function apiJson<T = Record<string, unknown>>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, { cache: "no-store", ...init, headers: init?.body ? { "Content-Type": "application/json", ...init?.headers } : init?.headers });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error((payload as { error?: string }).error ?? "Something went wrong.");
  return payload as T;
}
