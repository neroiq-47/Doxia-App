import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Doxia developer API", description: "Read-only public API for Doxia Drops, Signal, projects, profiles and community stats." };

const endpoints: [string, string][] = [
  ["GET /api/v1/drops", "Public Drops. Query: limit (1–50), before (ISO cursor), topic, project (slug), sort=latest|trending, q (search, 2+ chars)."],
  ["GET /api/v1/drops/{id}", "One public or unlisted Drop."],
  ["GET /api/v1/drops/{id}/replies", "Replies on a Drop (threads are one level deep; see parent_id)."],
  ["GET /api/v1/signal", "Every active Signal topic: totals, 95% Wilson confidence interval for the positive share, daily history. Query: days (1–90)."],
  ["GET /api/v1/projects", "Projects with their 7-day Signal summary."],
  ["GET /api/v1/projects/{slug}", "One project with 30-day Signal history and recent Drops."],
  ["GET /api/v1/profiles/{handle}", "Public profile, Drop stats and recent Drops. Reputation and badges only for members who appear in rankings."],
  ["GET /api/v1/leaderboard", "Contribution rankings. Query: days (1–365), limit (1–50). Opted-out members are never listed."],
  ["GET /api/v1/trending-topics", "Most-used Drop topics in the last 7 days."],
  ["GET /api/v1/challenges", "This week’s five community challenges (picked at random every Sunday 00:00 UTC) and when the week ends."],
  ["GET /api/v1/stats", "Community-wide aggregate counts."],
];

export default function DevelopersPage() {
  return (
    <main className="page-wrap docs">
      <Link className="page-brand" href="/">doxia<span>.</span></Link>
      <h1>Developer API</h1>
      <p>Read-only JSON over HTTPS. No key needed. Responses contain only data a signed-out visitor can already see: never emails, wallet addresses or individual votes.</p>
      <ul className="docs-list">
        <li><strong>Base URL:</strong> the Doxia site origin, e.g. <code>/api/v1/drops</code></li>
        <li><strong>Rate limit:</strong> 60 requests per minute per IP. Check the <code>X-RateLimit-*</code> headers; <code>429</code> includes <code>Retry-After</code>.</li>
        <li><strong>CORS:</strong> enabled for all origins (GET only). Responses may be cached for 30 seconds.</li>
        <li><strong>Envelope:</strong> <code>{"{ data, ... }"}</code> on success, <code>{"{ error }"}</code> on failure.</li>
      </ul>
      <h2 className="page-section">Endpoints</h2>
      <div className="docs-endpoints">{endpoints.map(([path, text]) => <div className="right-card" key={path}><code>{path}</code><p>{text}</p></div>)}</div>
      <h2 className="page-section">Embed a Signal widget</h2>
      <pre className="docs-code">{`<iframe src="https://<doxia-host>/embed/signal/zcash-sentiment" width="360" height="230" style="border:0"></iframe>`}</pre>
      <p className="fine-print">Signal reflects community opinion, not financial advice or market data.</p>
    </main>
  );
}
