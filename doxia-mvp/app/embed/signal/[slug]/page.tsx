import { notFound } from "next/navigation";
import { createPublicClient } from "@/lib/supabase/public";
import { listSignalTopics } from "@/lib/data";
import { publicOrigin } from "@/lib/http";

export const revalidate = 60;

// Read-only widget for other sites: <iframe src="https://<app>/embed/signal/<slug>" width="360" height="220"></iframe>
export default async function SignalEmbed({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const topic = (await listSignalTopics(createPublicClient(), 7, slug))?.[0];
  if (!topic) notFound();
  const pct = (n: number) => (topic.total ? Math.round((n / topic.total) * 100) : 0);
  const origin = publicOrigin(process.env.APP_URL ?? "");
  return (
    <main className="embed-card">
      <span className="eyebrow">DOXIA SIGNAL{topic.project ? ` · ${String(topic.project.name).toUpperCase()}` : ""}</span>
      <h1>{topic.question}</h1>
      {(["bullish", "neutral", "bearish"] as const).map(k => (
        <div key={k}><div className="sentiment-label"><span>{k === "bullish" ? "Positive" : k === "bearish" ? "Cautious" : "Neutral"}</span><strong>{pct(topic[k])}%</strong></div><div className={`bar ${k === "bullish" ? "" : "bar-muted"}`}><span style={{ width: `${pct(topic[k])}%` }} /></div></div>
      ))}
      <p className="embed-foot">{topic.total} {topic.total === 1 ? "vote" : "votes"} · confidence {topic.confidence.level} · not financial advice · <a href={origin || "/"} target="_blank" rel="noopener noreferrer">Vote on Doxia</a></p>
    </main>
  );
}
