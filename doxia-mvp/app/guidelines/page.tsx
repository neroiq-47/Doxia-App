import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Doxia community guidelines", description: "How to take part in Doxia: respectful, honest, and safe." };

const rules: [string, string][] = [
  ["Be respectful", "No harassment, hate, threats or targeted abuse. Disagree with ideas, not people."],
  ["Keep it honest", "Don't impersonate people or projects. Disclose if you're paid by, work for, or hold a significant position in something you promote."],
  ["No financial promises", "Signal and Drops are opinions. Don't present price predictions as certainties, and never promise returns."],
  ["No spam or manipulation", "No repeated posts, pump-and-dump coordination, vote brigading or automated activity. Rate limits and duplicate-post checks enforce this."],
  ["Protect privacy", "Don't share other people's personal information. Don't post your own private keys, seed phrases or wallet recovery details, ever."],
  ["Stay safe from scams", "Nobody legitimate will DM you for a seed phrase. Treat giveaway, “double your DOGE” and wallet-validation offers as scams and report them."],
  ["Keep it legal", "No illegal content or instructions for wrongdoing."],
];

export default function GuidelinesPage() {
  return (
    <main className="page-wrap docs">
      <Link className="page-brand" href="/">doxia<span>.</span></Link>
      <h1>Community guidelines</h1>
      <p>Doxia is a place for privacy-minded people to share ideas, read the room and make a contribution. These guidelines apply to Drops, replies, profiles and Signal, including $DOGE and other project communities.</p>
      <div className="docs-endpoints">{rules.map(([title, text]) => <div className="right-card" key={title}><strong>{title}</strong><p>{text}</p></div>)}</div>
      <h2 className="page-section">Reporting and enforcement</h2>
      <p>Use “Report” on any Drop (the ••• menu). Reports go to the Doxia team. Drop authors can remove replies on their own Drops. Breaking these guidelines can lead to content removal or account suspension. Doxia never requires you to buy or hold any cryptoasset to take part.</p>
      <p className="fine-print">Crypto prices and sentiment change quickly, and you can lose money when buying or holding cryptoassets. Nothing on Doxia is financial advice.</p>
    </main>
  );
}
