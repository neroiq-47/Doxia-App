"use client";

import { useEffect, useState } from "react";
import { CornerDownRight, Send, Trash2 } from "lucide-react";
import { apiJson, goToLogin, timeAgo } from "./types";

type Reply = { id: string; author_id: string; parent_id: string | null; body: string; created_at: string; profiles?: { handle?: string; display_name?: string } | null };

export default function Replies({ dropId, dropAuthorId, userId, isSignedIn, onCountChange }: {
  dropId: string; dropAuthorId: string; userId: string | null; isSignedIn: boolean; onCountChange: (delta: number) => void;
}) {
  const [replies, setReplies] = useState<Reply[] | null>(null);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<Reply | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    apiJson<{ replies: Reply[] }>(`/api/drops/${dropId}/replies`).then(p => setReplies(p.replies)).catch(e => setError(e.message));
  }, [dropId]);

  async function send() {
    if (!isSignedIn) { goToLogin(); return; }
    const text = draft.trim();
    if (!text || busy) return;
    setBusy(true);
    try {
      const { reply } = await apiJson<{ reply: Reply }>(`/api/drops/${dropId}/replies`, { method: "POST", body: JSON.stringify({ body: text, parent_id: replyTo?.id ?? null }) });
      setReplies(rs => [...(rs ?? []), reply]); setDraft(""); setReplyTo(null); onCountChange(1);
    } catch (e) { alert(e instanceof Error ? e.message : "Could not post reply."); }
    finally { setBusy(false); }
  }

  async function remove(reply: Reply) {
    if (!window.confirm("Remove this reply?")) return;
    try {
      await apiJson(`/api/replies/${reply.id}`, { method: "DELETE" });
      const removed = (replies ?? []).filter(r => r.id === reply.id || r.parent_id === reply.id).length;
      setReplies(rs => (rs ?? []).filter(r => r.id !== reply.id && r.parent_id !== reply.id)); onCountChange(-removed);
    } catch (e) { alert(e instanceof Error ? e.message : "Could not remove reply."); }
  }

  const canRemove = (r: Reply) => Boolean(userId && (r.author_id === userId || dropAuthorId === userId));
  const top = (replies ?? []).filter(r => !r.parent_id);
  const renderReply = (r: Reply, nested: boolean) => (
    <div className={`reply ${nested ? "reply-nested" : ""}`} key={r.id}>
      <div className="reply-meta"><strong>{r.profiles?.display_name ?? "Doxia member"}</strong><span>@{r.profiles?.handle ?? "member"} · {timeAgo(r.created_at)}</span>
        {!nested && <button className="text-btn" onClick={() => { if (!isSignedIn) { goToLogin(); return; } setReplyTo(r); }}><CornerDownRight size={12}/> Reply</button>}
        {canRemove(r) && <button className="text-btn" aria-label="Remove reply" onClick={() => void remove(r)}><Trash2 size={12}/></button>}
      </div>
      <p>{r.body}</p>
    </div>
  );

  return (
    <div className="replies">
      {error && <p className="feed-status">{error}</p>}
      {replies === null && !error && <p className="feed-status">Loading replies…</p>}
      {replies?.length === 0 && <p className="feed-status">No replies yet.</p>}
      {top.map(r => <div key={r.id}>{renderReply(r, false)}{(replies ?? []).filter(c => c.parent_id === r.id).map(c => renderReply(c, true))}</div>)}
      <div className="reply-compose">
        {replyTo && <span className="reply-to">Replying to @{replyTo.profiles?.handle ?? "member"} <button className="text-btn" onClick={() => setReplyTo(null)}>Cancel</button></span>}
        {isSignedIn ? <div className="reply-row">
          <input value={draft} maxLength={500} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === "Enter") void send(); }} placeholder="Write a reply…" aria-label="Write a reply" />
          <button className="icon-btn" aria-label="Send reply" disabled={!draft.trim() || busy} onClick={() => void send()}><Send size={15}/></button>
        </div> : <button className="text-btn" onClick={goToLogin}>Sign in to reply</button>}
      </div>
    </div>
  );
}
