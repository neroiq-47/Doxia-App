"use client";

import { useEffect, useState } from "react";
import { Award, Flame, Trophy } from "lucide-react";
import { apiJson, goToLogin, type Badge } from "./types";

type Reputation = { total: number; last_30_days: number; streak: number; breakdown: Record<string, number>; badges: Badge[] };
type Leader = { rank: number; handle: string; display_name: string; score: number; streak: number };
const BREAKDOWN_LABELS: Record<string, string> = { drops: "Drops published", likes_received: "Likes from others", replies: "Replies written", replies_received: "Replies received", signal: "Signal topics voted", missions: "Missions" };

export default function ReputationPanel({ isSignedIn, refreshKey, showInRankings }: { isSignedIn: boolean; refreshKey: number; showInRankings: boolean }) {
  const [rep, setRep] = useState<Reputation | null>(null);
  const [leaders, setLeaders] = useState<Leader[] | null>(null);
  useEffect(() => {
    if (isSignedIn) apiJson<Reputation>("/api/reputation").then(setRep).catch(() => setRep(null)); else setRep(null);
    apiJson<{ leaders: Leader[] }>("/api/leaderboard?days=30").then(p => setLeaders(p.leaders)).catch(() => setLeaders([]));
  }, [isSignedIn, refreshKey]);

  return (
    <>
      {isSignedIn && rep ? <div className="signal-hero reputation-card">
        <div className="topic-head"><div><span className="eyebrow"><Award size={13}/> YOUR REPUTATION</span><h3>{rep.total} points</h3><p className="muted small-copy">{rep.last_30_days} in the last 30 days{showInRankings ? "" : " · hidden from rankings"}</p></div><span className="streak"><Flame size={15}/> {rep.streak}-day streak</span></div>
        <div className="breakdown">{Object.entries(rep.breakdown).map(([k, v]) => <div key={k}><span>{BREAKDOWN_LABELS[k] ?? k}</span><strong>{v}</strong></div>)}</div>
        <div className="badge-row">{rep.badges.map(b => <span key={b.id} className={`badge ${b.earned ? "earned" : ""}`} title={b.description}>{b.label}</span>)}</div>
        <p className="fine-print">Reputation rewards contribution, not follower count: 5 per Drop (3 a day max), 2 per like from others, 2 per reply written (10 a day max), 1 per reply received, 3 per Signal topic, plus mission points. Self-likes never count. Points are in-app progress only, not cryptocurrency or cash.</p>
      </div> : <div className="welcome-strip"><div className="welcome-icon"><Award size={19}/></div><div><strong>Build a reputation for contributing.</strong><p>Sign in to earn points, badges and streaks from Drops, replies, Signal and missions.</p></div><button onClick={goToLogin}>Sign in</button></div>}
      <div className="signal-prompt">
        <span className="eyebrow"><Trophy size={13}/> TOP CONTRIBUTORS · 30 DAYS</span>
        {leaders === null && <p className="feed-status">Loading rankings…</p>}
        {leaders?.length === 0 && <p className="trend-empty">No contributions in the last 30 days yet.</p>}
        <ol className="leaderboard">{(leaders ?? []).map(l => <li key={l.handle}><span className="trend-rank">{String(l.rank).padStart(2, "0")}</span><a href={`/u/${l.handle}`}><strong>{l.display_name}</strong><em>@{l.handle}</em></a><span className="leader-score">{l.score} pts{l.streak > 1 ? ` · 🔥${l.streak}` : ""}</span></li>)}</ol>
        <p className="fine-print">Members can opt out of rankings in their profile settings. Opted-out members are never listed.</p>
      </div>
    </>
  );
}
