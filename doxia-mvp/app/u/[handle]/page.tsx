import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createPublicClient } from "@/lib/supabase/public";
import { getPublicProfile } from "@/lib/data";

export const revalidate = 60;
type Params = { params: Promise<{ handle: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { handle } = await params;
  // Privacy by default: profiles are shareable by link but not offered to search engines.
  return { title: `@${handle} on Doxia`, description: `Drops and contributions from @${handle} on Doxia.`, robots: { index: false, follow: false } };
}

export default async function ProfilePage({ params }: Params) {
  const { handle } = await params;
  const result = await getPublicProfile(createPublicClient(), null, decodeURIComponent(handle));
  if (!result) notFound();
  const { profile, stats, reputation, badges, drops } = result;
  return (
    <main className="page-wrap">
      <Link className="page-brand" href="/">doxia<span>.</span></Link>
      <section className="right-card profile-header">
        <div className="drop-avatar profile-avatar">{String(profile.display_name ?? "?").slice(0, 1).toUpperCase()}</div>
        <div>
          <h1>{String(profile.display_name)}</h1>
          <p className="handle">@{String(profile.handle)} · joined {new Date(String(profile.joined_at)).toLocaleDateString(undefined, { month: "long", year: "numeric" })}</p>
          {profile.bio ? <p className="profile-bio">{String(profile.bio)}</p> : null}
        </div>
      </section>
      <div className="impact-stats">
        <div><strong>{stats.public_drops}</strong><span>Public Drops</span></div>
        <div><strong>{stats.likes_received}</strong><span>Likes from others</span></div>
        <div><strong>{reputation ? reputation.score : "—"}</strong><span>{reputation ? `Reputation · ${reputation.streak}-day streak` : "Reputation hidden"}</span></div>
      </div>
      {badges.length > 0 && <div className="badge-row">{badges.map(b => <span className="badge earned" key={b.id} title={b.description}>{b.label}</span>)}</div>}
      <h2 className="page-section">Recent Drops</h2>
      <div className="feed-list">
        {drops.length === 0 && <div className="empty-state"><strong>No public Drops yet</strong></div>}
        {drops.map(d => <article className="drop-card" key={String(d.id)}><div className="drop-body"><div className="drop-meta"><span>{new Date(String(d.created_at)).toLocaleString()}</span></div><p className="drop-text">{String(d.body)}</p><div className="drop-tag">#{String(d.topic)}</div> <Link className="text-btn inline-link" href={`/?drop=${String(d.id)}`}>Open in Doxia →</Link></div></article>)}
      </div>
    </main>
  );
}
