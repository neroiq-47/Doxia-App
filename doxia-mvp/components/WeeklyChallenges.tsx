"use client";

import { useEffect, useState } from "react";
import { Check, Shuffle, Zap } from "lucide-react";

export type Weekly = { week_start: string; ends_at: string; challenges: { id: string; slug: string; title: string; description: string; points: number; completed: boolean }[] };

function untilReset(endsAt: string) {
  const ms = Math.max(0, new Date(endsAt).getTime() - Date.now());
  const days = Math.floor(ms / 86_400_000), hours = Math.floor((ms % 86_400_000) / 3_600_000), minutes = Math.floor((ms % 3_600_000) / 60_000);
  return days > 0 ? `${days}d ${hours}h` : hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

export default function WeeklyChallenges({ weekly, isSignedIn, onComplete }: { weekly: Weekly | null; isSignedIn: boolean; onComplete: (slug: string) => void }) {
  const [, tick] = useState(0);
  useEffect(() => { const t = window.setInterval(() => tick(n => n + 1), 60_000); return () => window.clearInterval(t); }, []);
  if (!weekly) return null;
  const done = weekly.challenges.filter(c => c.completed).length;
  return (
    <div className="signal-prompt weekly-card">
      <div className="topic-head">
        <div><span className="eyebrow"><Shuffle size={13}/> THIS WEEK&apos;S CHALLENGES</span><h3>{done}/{weekly.challenges.length} complete</h3></div>
        <span className="confidence confidence-high">New set in {untilReset(weekly.ends_at)}</span>
      </div>
      <div className="mission-list">{weekly.challenges.map(c => (
        <article className="mission-card" key={c.id}>
          <div className="mission-emoji">🎲</div>
          <div className="mission-copy"><span className="mission-tag">WEEKLY CHALLENGE</span><h3>{c.title}</h3><p>{c.description}</p><span className="mission-points"><Zap size={13}/>{c.points} impact points</span></div>
          <button className={c.completed ? "mission-done" : "mission-cta"} disabled={c.completed} onClick={() => onComplete(c.slug)}>{c.completed ? <><Check size={16}/> Done</> : isSignedIn ? "Mark done" : "Sign in"}</button>
        </article>
      ))}</div>
      <p className="fine-print">Five challenges are drawn at random from the community pool every Sunday at 00:00 UTC, never repeating last week&apos;s. Each week&apos;s challenges can only be completed that week.</p>
    </div>
  );
}
