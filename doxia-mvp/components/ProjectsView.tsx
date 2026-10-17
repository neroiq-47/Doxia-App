"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ArrowUpRight, Boxes, Plus } from "lucide-react";
import { TopicCard } from "./SignalBoard";
import { apiJson, mapDrop, share, type ApiDrop, type Drop, type SignalTopic, type Vote } from "./types";

type Project = { slug: string; name: string; symbol: string | null; description: string; website: string | null; signal: SignalTopic | null };

export default function ProjectsView({ selected, onSelect, isSignedIn, onVote, renderDrop, onPost, refreshKey }: {
  selected: string | null; onSelect: (slug: string | null) => void; isSignedIn: boolean; onVote: (slug: string, choice: Vote) => void;
  renderDrop: (d: Drop, update: (id: string, change: (d: Drop) => Drop) => void) => React.ReactNode; onPost: (projectSlug: string) => void; refreshKey: number;
}) {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [detail, setDetail] = useState<{ project: Project; signal: SignalTopic | null; drops: Drop[] } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => { apiJson<{ projects: Project[] }>("/api/projects").then(p => setProjects(p.projects)).catch(e => setError(e.message)); }, [refreshKey]);
  useEffect(() => {
    if (!selected) { setDetail(null); return; }
    let cancelled = false;
    apiJson<{ project: Project; signal: SignalTopic | null; drops: ApiDrop[] }>(`/api/projects/${selected}`)
      .then(p => { if (!cancelled) setDetail({ project: p.project, signal: p.signal, drops: p.drops.map(mapDrop) }); })
      .catch(e => setError(e.message));
    return () => { cancelled = true; };
  }, [selected, refreshKey]);

  const updateDrop = (id: string, change: (d: Drop) => Drop) => setDetail(d => d && { ...d, drops: d.drops.map(x => x.id === id ? change(x) : x) });

  if (selected && detail) return (
    <div className="signal-view">
      <button className="text-btn" onClick={() => onSelect(null)}><ArrowLeft size={14}/> All projects</button>
      <div className="impact-banner"><div><span className="eyebrow">PROJECT{detail.project.symbol ? ` · $${detail.project.symbol}` : ""}</span><h2>{detail.project.name}</h2><p>{detail.project.description}</p>{detail.project.website && <a className="text-btn" href={detail.project.website} target="_blank" rel="noopener noreferrer">Official site <ArrowUpRight size={13}/></a>}</div><div className="impact-art"><Boxes size={46}/></div></div>
      {detail.signal && <TopicCard topic={detail.signal} isSignedIn={isSignedIn} onVote={onVote}/>}
      <div className="section-row"><div className="section-title"><strong>Drops about {detail.project.name}</strong></div><button className="text-btn" onClick={() => onPost(detail.project.slug)}><Plus size={14}/> Post about {detail.project.name}</button></div>
      <div className="feed-list">{detail.drops.length === 0 ? <div className="empty-state"><strong>No Drops about {detail.project.name} yet</strong><span>Start the conversation.</span></div> : detail.drops.map(d => renderDrop(d, updateDrop))}</div>
    </div>
  );

  return (
    <div className="signal-view">
      {error && <p className="feed-status">{error}</p>}
      {projects === null && !error && <p className="feed-status">Loading projects…</p>}
      <div className="project-grid">{(projects ?? []).map(p => (
        <button className="right-card project-card" key={p.slug} onClick={() => onSelect(p.slug)}>
          <span className="eyebrow">{p.symbol ? `$${p.symbol}` : "NETWORK"}</span><h3>{p.name}</h3><p>{p.description}</p>
          <span className="project-signal">{p.signal && p.signal.total ? `${share(p.signal.bullish, p.signal.total)}% positive · ${p.signal.total} ${p.signal.total === 1 ? "vote" : "votes"}` : "No Signal votes yet"} <ArrowUpRight size={13}/></span>
        </button>
      ))}</div>
      <p className="fine-print">Project pages collect community Drops and Signal. Descriptions are informational; Doxia is not affiliated with these projects.</p>
    </div>
  );
}
