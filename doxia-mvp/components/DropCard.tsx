"use client";

import { useState } from "react";
import { Bookmark, Heart, MessageCircle, MoreHorizontal, Send } from "lucide-react";
import Replies from "./Replies";
import type { Drop } from "./types";

export default function DropCard({ drop, userId, isSignedIn, isPro, saved, onLike, onBookmark, onShare, onMore, onReplyCount, onProject }: {
  drop: Drop; userId: string | null; isSignedIn: boolean; isPro: boolean; saved: boolean;
  onLike: () => void; onBookmark: () => void; onShare: () => void; onMore: () => void; onReplyCount: (delta: number) => void; onProject?: (slug: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const own = Boolean(userId && drop.authorId === userId);
  return (
    <article className="drop-card">
      <div className="drop-avatar">{drop.author.slice(0, 1).toUpperCase()}</div>
      <div className="drop-body">
        <div className="drop-meta">
          <a className="author-link" href={`/u/${drop.handle.replace(/^@/, "")}`}><strong>{drop.author} {isPro && own && <span className="pro-badge">PRO</span>}</strong></a>
          <span className="handle">{drop.handle}</span><span className="meta-dot">·</span><span>{drop.time}</span>
          {drop.visibility === "unlisted" && <span className="unlisted-label">UNLISTED</span>}
          <button className="more-btn" aria-label="More actions" onClick={onMore}><MoreHorizontal size={19}/></button>
        </div>
        <p className="drop-text">{drop.text}</p>
        <div className="drop-tags"><span className="drop-tag">#{drop.tag}</span>{drop.project && <button className="drop-tag project-tag" onClick={() => onProject?.(drop.project!.slug)}>{drop.project.symbol ? `$${drop.project.symbol}` : drop.project.name}</button>}</div>
        <div className="drop-actions">
          <button className={drop.liked ? "liked" : ""} onClick={onLike} aria-label={drop.liked ? "Unlike" : "Like"}><Heart size={16} fill={drop.liked ? "currentColor" : "none"}/><span>{drop.likes}</span></button>
          <button className={open ? "liked" : ""} onClick={() => setOpen(o => !o)} aria-expanded={open} aria-label="Replies"><MessageCircle size={16}/><span>{drop.replies}</span></button>
          <button onClick={onShare}><Send size={15}/><span>Share</span></button>
          <button className="bookmark-action" onClick={onBookmark} aria-label={saved ? "Unsave Drop" : "Save Drop"}><Bookmark size={16} fill={saved ? "currentColor" : "none"}/></button>
        </div>
        {open && <Replies dropId={drop.id} dropAuthorId={drop.authorId} userId={userId} isSignedIn={isSignedIn} onCountChange={onReplyCount}/>}
      </div>
    </article>
  );
}
