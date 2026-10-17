"use client";

import { useEffect, useState } from "react";
import { Activity, Minus, ShieldCheck, Users, Zap } from "lucide-react";
import { apiJson, share, trendPath, type SignalTopic, type Vote } from "./types";

const CONFIDENCE_LABEL = { none: "No votes yet", low: "Low confidence", medium: "Medium confidence", high: "High confidence" } as const;

export function TopicCard({ topic, isSignedIn, onVote, compact = false }: { topic: SignalTopic; isSignedIn: boolean; onVote: (slug: string, choice: Vote) => void; compact?: boolean }) {
  const trend = trendPath(topic.history);
  const rows: [Vote, string, string][] = [["bullish", "Positive", ""], ["neutral", "Neutral", "bar-muted"], ["bearish", "Cautious", "bar-muted"]];
  return (
    <div className="signal-hero topic-card">
      <div className="topic-head">
        <div>{topic.project && <span className="topic-chip">{topic.project.symbol ? `$${topic.project.symbol}` : topic.project.name.toUpperCase()}</span>}<h3>{topic.question}</h3></div>
        <span className={`confidence confidence-${topic.confidence.level}`} title="95% Wilson interval for the positive share">{CONFIDENCE_LABEL[topic.confidence.level]}{topic.total > 0 && ` · ±${topic.confidence.margin_pts} pts`}</span>
      </div>
      {rows.map(([key, label, cls]) => <div key={key}><div className="sentiment-label"><span>{label}</span><strong>{share(topic[key], topic.total)}%</strong></div><div className={`bar ${cls}`}><span style={{ width: `${share(topic[key], topic.total)}%` }}/></div></div>)}
      {!compact && <div className="mini-chart topic-chart">{trend ? <svg viewBox="0 0 260 60" preserveAspectRatio="none" aria-label="Positive share, last 30 days"><path d={trend.path} fill="none" stroke="#b7f779" strokeWidth="2.5" strokeLinecap="round"/></svg> : <div className="chart-empty">30-day timeline appears once votes span 2+ days</div>}</div>}
      <div className="signal-total"><span><span className="status-dot"/> {topic.total} {topic.total === 1 ? "vote" : "votes"}{trend ? ` · ${trend.delta >= 0 ? "↑" : "↓"} ${Math.abs(trend.delta)} pts in 30 days` : ""}</span><span>Community opinion · not financial advice</span></div>
      <div className="vote-buttons vote-three">
        <button className={topic.my_vote === "bullish" ? "vote-selected" : ""} onClick={() => onVote(topic.slug, "bullish")}><Zap size={16}/> Positive</button>
        <button className={topic.my_vote === "neutral" ? "vote-selected" : ""} onClick={() => onVote(topic.slug, "neutral")}><Minus size={16}/> Neutral</button>
        <button className={topic.my_vote === "bearish" ? "vote-selected" : ""} onClick={() => onVote(topic.slug, "bearish")}><Activity size={16}/> Cautious</button>
      </div>
      <small className="vote-note">{topic.my_vote ? "Your vote is saved. You can change it any time." : isSignedIn ? "One vote per account per topic." : "Sign in to vote. One vote per account."}</small>
    </div>
  );
}

export default function SignalBoard({ topics, isSignedIn, onVote, generatedAt }: { topics: SignalTopic[]; isSignedIn: boolean; onVote: (slug: string, choice: Vote) => void; generatedAt: string | null }) {
  const [stats, setStats] = useState<Record<string, number> | null>(null);
  useEffect(() => { apiJson<{ stats: Record<string, number> }>("/api/insights").then(p => setStats(p.stats)).catch(() => setStats(null)); }, [topics]);
  return (
    <div className="signal-view">
      {stats && <div className="impact-stats insight-stats">
        <div><strong>{stats.active_contributors_7d}</strong><span>Active contributors (7d)</span></div>
        <div><strong>{stats.votes_7d}</strong><span>Signal votes (7d)</span></div>
        <div><strong>{stats.drops_7d}</strong><span>Public Drops (7d)</span></div>
      </div>}
      {generatedAt && <p className="signal-updated">Totals computed from stored votes at {new Date(generatedAt).toLocaleTimeString()}</p>}
      {topics.length === 0 && <div className="empty-state"><Users size={24}/><strong>Signal is loading</strong></div>}
      {topics.map(t => <TopicCard key={t.slug} topic={t} isSignedIn={isSignedIn} onVote={onVote}/>)}
      <div className="signal-prompt methodology">
        <span className="eyebrow"><ShieldCheck size={13}/> HOW SIGNAL STAYS HONEST</span>
        <ul>
          <li>One vote per account per topic; changing your vote replaces it, never adds to it.</li>
          <li>Votes are rate limited on the server (20 per minute) to blunt automated voting.</li>
          <li>Only totals are published. Nobody, including other members, can see how you voted.</li>
          <li>Confidence uses a 95% Wilson interval: few votes means a wide margin and a “low confidence” label, so small samples can’t pose as consensus.</li>
          <li>The timeline shows the positive share of votes cast up to each day.</li>
          <li>Accounts that repeatedly hit vote limits are logged privately for review; the log records the limit, not how anyone voted.</li>
          <li>Signal never includes market prices. Where a project page shows a price, it is labelled with its external source and time.</li>
        </ul>
        <p className="fine-print">Signal reflects community opinion. It is not market data, a prediction, or financial advice.</p>
      </div>
    </div>
  );
}
