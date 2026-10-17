"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity, ArrowUpRight, Bookmark, Check, ChevronDown, Compass, Crown,
  Flame, Heart, Home, Leaf, LockKeyhole, MoreHorizontal, Plus,
  Radio, Search, Send, Settings, Shield, Sparkles, Target, Wallet, X, Zap
} from "lucide-react";

type Tab = "Home" | "Drops" | "Signal" | "Impact";
type Visibility = "public" | "unlisted";
type Drop = { id: string; authorId: string; author: string; handle: string; time: string; text: string; tag: string; likes: number; liked: boolean; visibility: Visibility; };
type ApiDrop = { id: string; author_id: string; body: string; created_at: string; topic?: string | null; visibility?: string | null; liked?: boolean; profiles?: { display_name?: string | null; handle?: string | null } | null; drop_reactions?: { count: number }[] };
type Mission = { id: string; slug: string; title: string; description: string; points: number; completed: boolean };
type Counts = { bullish: number; bearish: number; neutral: number };
type HistoryPoint = Counts & { day: string };
type ApiTopic = Partial<Counts> & { slug: string; my_vote?: string | null; history?: HistoryPoint[] };
type Trend = { topic: string; drops: number };
type Vote = "bullish" | "bearish" | "neutral";

const SIGNAL_SLUG = "privacy-web-direction";
const PAGE_SIZE = 20;
const TOPICS = ["Community", "Privacy", "Web3", "Open source", "Signal", "Culture"];
const MISSION_STYLE: Record<string, { icon: string; tag: string }> = {
  "open-source-builder": { icon: "🌱", tag: "OPEN SOURCE" },
  "privacy-practice": { icon: "🛡️", tag: "PRIVACY" },
  "welcome-a-voice": { icon: "🤝", tag: "COMMUNITY" },
};
const LOCAL_SAVED_KEY = "doxia-saved-drops";
const nav: { label: Tab; icon: typeof Home }[] = [
  { label: "Home", icon: Home }, { label: "Drops", icon: Compass }, { label: "Signal", icon: Radio }, { label: "Impact", icon: Leaf },
];

function timeAgo(iso: string) {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d`;
  return new Date(iso).toLocaleDateString();
}
function mapDrop(d: ApiDrop): Drop {
  return { id: d.id, authorId: d.author_id, author: d.profiles?.display_name ?? "Doxia member", handle: "@" + (d.profiles?.handle ?? "member"), time: timeAgo(d.created_at), text: d.body, tag: d.topic ?? "Community", likes: d.drop_reactions?.[0]?.count ?? 0, liked: Boolean(d.liked), visibility: d.visibility === "unlisted" ? "unlisted" : "public" };
}
function totalOf(c: Counts) { return c.bullish + c.bearish + c.neutral; }
function share(part: number, total: number) { return total ? Math.round((part / total) * 100) : 0; }
function goToLogin() { window.location.href = "/login"; }

export default function Page() {
  const [tab, setTab] = useState<Tab>("Home");
  const [drops, setDrops] = useState<Drop[]>([]);
  const [sharedDrop, setSharedDrop] = useState<Drop | null>(null);
  const [feedCursor, setFeedCursor] = useState<string | null>(null);
  const [feedLoading, setFeedLoading] = useState(true);
  const [feedError, setFeedError] = useState("");
  const [draft, setDraft] = useState("");
  const [draftTopic, setDraftTopic] = useState("Community");
  const [draftVisibility, setDraftVisibility] = useState<Visibility>("public");
  const [composerOpen, setComposerOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [proOpen, setProOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [handle, setHandle] = useState("");
  const [bio, setBio] = useState("");
  const [savedDrops, setSavedDrops] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [backendConfigured, setBackendConfigured] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [signal, setSignal] = useState<Counts & { history: HistoryPoint[] } | null>(null);
  const [myVote, setMyVote] = useState<Vote | null>(null);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [trending, setTrending] = useState<Trend[]>([]);
  const [isPro, setIsPro] = useState(false);
  const [reportDropId, setReportDropId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState('spam');
  const [reportDetails, setReportDetails] = useState('');
  const [editingDropId, setEditingDropId] = useState<string | null>(null);

  useEffect(() => {
    let subscription: { unsubscribe: () => void } | undefined;
    async function initAuth() {
      try {
        const health = await fetch('/api/health', { cache: 'no-store' }).then(r => r.json());
        setBackendConfigured(Boolean(health.backendConfigured));
        if (!health.backendConfigured) return;
        const { createClient } = await import('@/lib/supabase/browser');
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        setIsSignedIn(Boolean(user)); setUserId(user?.id ?? null);
        const listener = supabase.auth.onAuthStateChange((_event, session) => {
          setIsSignedIn(Boolean(session?.user)); setUserId(session?.user?.id ?? null);
        });
        subscription = listener.data.subscription;
      } catch { setBackendConfigured(false); }
      finally { setAuthLoading(false); }
    }
    void initAuth();
    return () => subscription?.unsubscribe();
  }, []);

  // Public data: loaded for everyone, and reloaded when auth changes so liked flags, own vote and mission progress are correct.
  useEffect(() => {
    if (authLoading) return;
    void loadFeed(true);
    void loadCommunity();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isSignedIn]);

  useEffect(() => {
    if (authLoading) return;
    const target = new URLSearchParams(window.location.search).get('drop');
    if (!target) return;
    let cancelled = false;
    fetch(`/api/drops/${encodeURIComponent(target)}`, { cache: 'no-store' }).then(async response => {
      const payload = await response.json();
      if (!response.ok || !payload.drop || cancelled) return;
      setSharedDrop(mapDrop(payload.drop)); setTab('Drops');
    }).catch(() => { /* the feed still loads if a shared link is unavailable */ });
    return () => { cancelled = true; };
  }, [authLoading, isSignedIn]);

  useEffect(() => {
    if (authLoading) return;
    if (!isSignedIn) {
      setDisplayName(""); setHandle(""); setBio(""); setWalletAddress(null); setIsPro(false);
      try { setSavedDrops(JSON.parse(localStorage.getItem(LOCAL_SAVED_KEY) ?? "[]")); } catch { setSavedDrops([]); }
      return;
    }
    let cancelled = false;
    async function loadAccountData() {
      try {
        const [profileResponse, walletResponse, entitlementResponse, bookmarkResponse] = await Promise.all([
          fetch('/api/profile', { cache: 'no-store' }), fetch('/api/wallet', { cache: 'no-store' }),
          fetch('/api/billing/entitlement', { cache: 'no-store' }), fetch('/api/bookmarks', { cache: 'no-store' }),
        ]);
        if (cancelled) return;
        if (profileResponse.ok) {
          const payload = await profileResponse.json();
          if (payload.profile) { setDisplayName(payload.profile.display_name); setHandle('@' + payload.profile.handle); setBio(payload.profile.bio); }
        }
        if (walletResponse.ok) { const payload = await walletResponse.json(); setWalletAddress(payload.wallet?.address ?? null); }
        if (entitlementResponse.ok) { const payload = await entitlementResponse.json(); setIsPro(Boolean(payload.isPro)); }
        if (bookmarkResponse.ok) { const payload = await bookmarkResponse.json(); setSavedDrops(payload.dropIds ?? []); }
      } catch { /* account panels stay empty if the backend is unavailable */ }
    }
    void loadAccountData();
    return () => { cancelled = true; };
  }, [authLoading, isSignedIn]);

  useEffect(() => {
    if (!isSignedIn) return;
    const params = new URLSearchParams(window.location.search);
    const checkoutState = params.get('pro');
    if (checkoutState !== 'success' && checkoutState !== 'cancelled') return;
    if (checkoutState === 'cancelled') {
      params.delete('pro'); window.history.replaceState({}, '', `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`);
      return;
    }
    let attempts = 0;
    let cancelled = false;
    const timer = window.setInterval(async () => {
      attempts += 1;
      try {
        const response = await fetch('/api/billing/entitlement', { cache: 'no-store' });
        if (response.ok) { const payload = await response.json(); if (payload.isPro) { setIsPro(true); cancelled = true; window.clearInterval(timer); params.delete('pro'); params.delete('session_id'); window.history.replaceState({}, '', `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`); } }
      } catch { /* webhook can still be processing */ }
      if (attempts >= 15 && !cancelled) window.clearInterval(timer);
    }, 2000);
    return () => window.clearInterval(timer);
  }, [isSignedIn]);

  async function loadFeed(reset: boolean) {
    setFeedLoading(true);
    try {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
      if (!reset && feedCursor) params.set('before', feedCursor);
      const response = await fetch(`/api/drops?${params}`, { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'Could not load Drops.');
      const page: Drop[] = (payload.drops ?? []).map(mapDrop);
      setDrops(ds => reset ? page : [...ds, ...page.filter(d => !ds.some(existing => existing.id === d.id))]);
      setFeedCursor(payload.nextCursor ?? null); setFeedError('');
    } catch (error) { setFeedError(error instanceof Error ? error.message : 'Could not load Drops.'); }
    finally { setFeedLoading(false); }
  }

  async function loadSignal() {
    const response = await fetch('/api/signal', { cache: 'no-store' });
    if (!response.ok) return;
    const payload = await response.json();
    const topic: ApiTopic | undefined = (payload.topics ?? []).find((t: ApiTopic) => t.slug === SIGNAL_SLUG);
    if (!topic) return;
    setSignal({ bullish: Number(topic.bullish ?? 0), bearish: Number(topic.bearish ?? 0), neutral: Number(topic.neutral ?? 0), history: (topic.history ?? []).map(h => ({ day: h.day, bullish: Number(h.bullish), bearish: Number(h.bearish), neutral: Number(h.neutral) })) });
    setMyVote(topic.my_vote === 'bullish' || topic.my_vote === 'bearish' || topic.my_vote === 'neutral' ? topic.my_vote : null);
  }

  async function loadCommunity() {
    try {
      const [, missionResponse, trendingResponse] = await Promise.all([
        loadSignal(), fetch('/api/missions', { cache: 'no-store' }), fetch('/api/trending', { cache: 'no-store' }),
      ]);
      if (missionResponse.ok) { const payload = await missionResponse.json(); setMissions(payload.missions ?? []); }
      if (trendingResponse.ok) { const payload = await trendingResponse.json(); setTrending((payload.topics ?? []).map((t: Trend) => ({ topic: t.topic, drops: Number(t.drops) }))); }
    } catch { /* community panels show their empty states */ }
  }

  function updateDrop(id: string, change: (d: Drop) => Drop) {
    setDrops(ds => ds.map(d => d.id === id ? change(d) : d));
    setSharedDrop(d => d && d.id === id ? change(d) : d);
  }

  const allDrops = useMemo(() => sharedDrop ? [sharedDrop, ...drops.filter(d => d.id !== sharedDrop.id)] : drops, [drops, sharedDrop]);
  const filteredDrops = useMemo(() => allDrops.filter(d => `${d.text} ${d.author} ${d.handle} ${d.tag}`.toLowerCase().includes(search.toLowerCase())), [allDrops, search]);
  const signalTotal = signal ? totalOf(signal) : 0;
  const trend = useMemo(() => {
    const points = (signal?.history ?? []).map(h => totalOf(h) ? (h.bullish / totalOf(h)) * 100 : null);
    const known = points.filter((p): p is number => p !== null);
    if (known.length < 2) return null;
    const width = 260, height = 56;
    const path = points.map((p, i) => p === null ? null : `${(i / (points.length - 1)) * width} ${height - 4 - (p / 100) * (height - 8)}`)
      .filter(Boolean).map((xy, i) => `${i ? 'L' : 'M'}${xy}`).join(' ');
    return { path, delta: Math.round(known[known.length - 1] - known[0]) };
  }, [signal]);
  const completedMissions = missions.filter(m => m.completed);
  const isOwnDrop = (d?: Drop) => Boolean(d && userId && d.authorId === userId);
  const selectedDrop = allDrops.find(d => d.id === reportDropId);

  function openComposer() {
    if (!isSignedIn) { goToLogin(); return; }
    setEditingDropId(null); setDraft(""); setDraftTopic("Community"); setDraftVisibility("public"); setComposerOpen(true);
  }
  function openProfile() {
    if (!isSignedIn) { goToLogin(); return; }
    setProfileOpen(true);
  }

  async function publishDrop() {
    const text = draft.trim();
    if (!text || !isSignedIn) return;
    if (editingDropId) {
      try {
        const response = await fetch(`/api/drops/${editingDropId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body: text }) });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? 'Could not update Drop.');
      } catch (error) { alert(error instanceof Error ? error.message : 'Could not update Drop.'); return; }
      updateDrop(editingDropId, d => ({ ...d, text }));
    } else {
      try {
        const response = await fetch('/api/drops', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body: text, topic: draftTopic, visibility: draftVisibility }) });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? 'Could not publish Drop.');
        const created = mapDrop({ ...payload.drop, profiles: { display_name: displayName, handle: handle.replace(/^@/, '') } });
        if (created.visibility === 'unlisted') {
          setSharedDrop(created);
          const url = `${window.location.origin}/?drop=${created.id}`;
          try { await navigator.clipboard.writeText(url); alert('Unlisted Drop published. Its link has been copied — only people with the link can see it.'); }
          catch { alert(`Unlisted Drop published. Share this link: ${url}`); }
        } else {
          setDrops(ds => [created, ...ds]);
        }
        void loadCommunity();
      } catch (error) { alert(error instanceof Error ? error.message : 'Could not publish Drop.'); return; }
    }
    setDraft(""); setEditingDropId(null); setComposerOpen(false); setTab("Drops");
  }

  function editSelectedDrop() {
    if (!selectedDrop) return;
    setDraft(selectedDrop.text); setEditingDropId(selectedDrop.id); setReportDropId(null); setComposerOpen(true);
  }

  async function deleteSelectedDrop() {
    if (!reportDropId) return;
    if (!window.confirm('Delete this Drop permanently? This cannot be undone.')) return;
    try {
      const response = await fetch(`/api/drops/${reportDropId}`, { method: 'DELETE' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'Could not delete Drop.');
    } catch (error) { alert(error instanceof Error ? error.message : 'Could not delete Drop.'); return; }
    setDrops(ds => ds.filter(d => d.id !== reportDropId));
    setSharedDrop(d => d?.id === reportDropId ? null : d);
    setReportDropId(null); void loadCommunity();
  }

  async function toggleWallet() {
    if (!isSignedIn) { goToLogin(); return; }
    if (walletAddress) {
      try { const r = await fetch('/api/wallet', { method: 'DELETE' }); const p = await r.json(); if (!r.ok) throw new Error(p.error); setWalletAddress(null); }
      catch (e) { alert(e instanceof Error ? e.message : 'Could not unlink wallet.'); }
      return;
    }
    if (!window.ethereum) { alert('Install an EVM wallet such as MetaMask to link a wallet.'); return; }
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' }) as string[];
      const address = accounts?.[0];
      if (!address) throw new Error('No wallet account was selected.');
      const chainId = String(await window.ethereum.request({ method: 'eth_chainId' })).toLowerCase();
      if (chainId !== '0xb626') throw new Error('Switch your wallet to Robinhood Chain testnet (chain ID 46630) first. No transaction is required.');
      const challengeResponse = await fetch('/api/wallet/nonce', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ address }) });
      const challenge = await challengeResponse.json();
      if (!challengeResponse.ok) throw new Error(challenge.error ?? 'Could not create wallet challenge.');
      const signature = await window.ethereum.request({ method: 'personal_sign', params: [challenge.message, address] }) as string;
      const verifyResponse = await fetch('/api/wallet/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ address, nonce: challenge.nonce, message: challenge.message, signature }) });
      const result = await verifyResponse.json();
      if (!verifyResponse.ok) throw new Error(result.error ?? 'Wallet verification failed.');
      setWalletAddress(result.address);
    } catch (error) { alert(error instanceof Error ? error.message : 'Wallet linking failed.'); }
  }

  async function signOut() {
    try {
      const { createClient } = await import('@/lib/supabase/browser');
      await createClient().auth.signOut();
      setIsSignedIn(false); setUserId(null);
    } catch { alert('Could not sign out.'); }
  }

  async function deleteAccount() {
    if (!isSignedIn) return;
    if (!window.confirm('Permanently delete your Doxia account, profile, Drops, votes, wallet link and Pro access? This cannot be undone, and account deletion does not automatically refund a purchase.')) return;
    if (!window.confirm('Final confirmation: delete this account now?')) return;
    try {
      const response = await fetch('/api/account', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirm: 'DELETE' }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'Could not delete account.');
      const { createClient } = await import('@/lib/supabase/browser');
      await createClient().auth.signOut();
      setProfileOpen(false); setIsSignedIn(false);
      window.location.href = '/';
    } catch (error) { alert(error instanceof Error ? error.message : 'Could not delete account.'); }
  }

  async function saveProfile() {
    try {
      const response = await fetch('/api/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ display_name: displayName, handle, bio }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'Could not save profile.');
      const nextHandle = '@' + payload.profile.handle;
      setDisplayName(payload.profile.display_name); setHandle(nextHandle); setBio(payload.profile.bio);
      const mine = (d: Drop) => d.authorId === userId ? { ...d, author: payload.profile.display_name, handle: nextHandle } : d;
      setDrops(ds => ds.map(mine)); setSharedDrop(d => d && mine(d));
    } catch (error) { alert(error instanceof Error ? error.message : 'Could not save profile.'); return; }
    setProfileOpen(false);
  }

  async function castVote(choice: Vote) {
    if (!isSignedIn) { goToLogin(); return; }
    try {
      const response = await fetch(`/api/signal/${SIGNAL_SLUG}/vote`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ choice }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'Could not save vote.');
      setMyVote(choice);
      await loadSignal();
    } catch (error) { alert(error instanceof Error ? error.message : 'Could not save vote.'); }
  }

  async function completeMission(slug: string) {
    if (!isSignedIn) { goToLogin(); return; }
    if (missions.some(m => m.slug === slug && m.completed)) return;
    try {
      const response = await fetch(`/api/missions/${slug}/complete`, { method: 'POST' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'Could not update mission.');
      setMissions(ms => ms.map(m => m.slug === slug ? { ...m, completed: true } : m));
    } catch (error) { alert(error instanceof Error ? error.message : 'Could not update mission.'); }
  }

  async function startCheckout() {
    if (!isSignedIn) { goToLogin(); return; }
    try {
      const response = await fetch('/api/billing/checkout', { method: 'POST' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'Checkout is not available.');
      window.location.href = payload.url;
    } catch (error) { alert(error instanceof Error ? error.message : 'Checkout is not available.'); }
  }

  async function toggleLike(id: string) {
    if (!isSignedIn) { goToLogin(); return; }
    const current = allDrops.find(d => d.id === id);
    if (!current) return;
    try {
      const response = await fetch(`/api/drops/${id}/reactions`, { method: current.liked ? 'DELETE' : 'POST' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'Could not update reaction.');
    } catch (error) { alert(error instanceof Error ? error.message : 'Could not update reaction.'); return; }
    updateDrop(id, d => ({ ...d, liked: !current.liked, likes: Math.max(0, d.likes + (current.liked ? -1 : 1)) }));
  }

  async function toggleBookmark(id: string) {
    const currentlySaved = savedDrops.includes(id);
    const next = currentlySaved ? savedDrops.filter(dropId => dropId !== id) : [...savedDrops, id];
    if (isSignedIn) {
      try {
        const response = await fetch(`/api/drops/${id}/bookmark`, { method: currentlySaved ? 'DELETE' : 'POST' });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? 'Could not update saved Drop.');
      } catch (error) { alert(error instanceof Error ? error.message : 'Could not update saved Drop.'); return; }
    } else {
      // Signed-out bookmarks stay in this browser only.
      try { localStorage.setItem(LOCAL_SAVED_KEY, JSON.stringify(next)); } catch { /* storage is optional */ }
    }
    setSavedDrops(next);
  }

  async function submitReport() {
    if (!isSignedIn) { goToLogin(); return; }
    if (!reportDropId) return;
    try {
      const response = await fetch('/api/reports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ drop_id: reportDropId, reason: reportReason, details: reportDetails }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'Could not submit report.');
      setReportDropId(null); setReportDetails(''); alert('Report submitted. Thank you for helping keep Doxia safer.');
    } catch (error) { alert(error instanceof Error ? error.message : 'Could not submit report.'); }
  }

  async function shareDrop(d: Drop) {
    const url = `${window.location.origin}/?drop=${d.id}`;
    try {
      if (navigator.share) await navigator.share({ title: "Doxia Drop", text: d.text, url });
      else { await navigator.clipboard.writeText(url); alert("Drop link copied."); }
    } catch { /* user cancelled native share */ }
  }

  const initial = (displayName || "?").slice(0, 1).toUpperCase();
  const trendingList = trending.length
    ? trending.map((t, i) => <button className="trend-item" key={t.topic} onClick={() => { setSearch(t.topic); setTab("Drops"); }}><span className="trend-rank">0{i + 1}</span><span><small>TOPIC</small><strong>{t.topic}</strong><em>{t.drops} {t.drops === 1 ? "Drop" : "Drops"} this week</em></span><ArrowUpRight size={15}/></button>)
    : <p className="trend-empty">No public Drops this week yet. Topics appear here as people post.</p>;

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#" onClick={e => { e.preventDefault(); setTab("Home"); }}><span className="brand-mark">d</span><span>doxia<span className="brand-dot">.</span></span></a>
        <div className="profile-mini">
          <div className="avatar avatar-lime">{initial}</div>
          <div className="profile-mini-copy"><strong>{isSignedIn ? displayName || "…" : "Guest"} {isPro && <span className="pro-badge">PRO</span>}</strong><span>{isSignedIn ? handle : "Not signed in"}</span></div>
          <button className="icon-btn subtle" aria-label={isSignedIn ? "Edit profile" : "Sign in"} onClick={openProfile}><Settings size={17}/></button>
        </div>
        <nav className="nav-list" aria-label="Main navigation">
          {nav.map(({ label, icon: Icon }) => <button key={label} className={`nav-item ${tab === label ? "active" : ""}`} onClick={() => setTab(label)}><Icon size={19}/><span>{label}</span>{label === "Signal" && <span className="nav-pill">LIVE</span>}</button>)}
        </nav>
        <button className="primary-btn compose-side" onClick={openComposer}><Plus size={18}/> {isSignedIn ? "Create a Drop" : "Sign in to post"}</button>
        <div className="sidebar-bottom">
          <div className="privacy-note"><LockKeyhole size={16}/><span>Your identity. Your terms.</span></div>
          <button className="pro-card" onClick={() => setProOpen(true)}><span className="pro-icon"><Crown size={18}/></span><span><strong>{isPro ? "Doxia Pro active" : "Unlock Doxia Pro"}</strong><small>{isPro ? "Lifetime access enabled." : "Own your signal."}</small></span><ArrowUpRight size={17}/></button>
          <div className="sidebar-foot"><span className="status-dot"/> Early access <span>·</span> v0.2</div>
        </div>
      </aside>

      <section className="main-column">
        <header className="topbar">
          <div className="mobile-brand"><span className="brand-mark">d</span><strong>doxia<span className="brand-dot">.</span></strong></div>
          <div className="search-box"><Search size={17}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search Drops, people, topics…" aria-label="Search"/></div>
          <div className="top-actions">{isSignedIn
            ? <><button className="wallet-btn" onClick={toggleWallet}><Wallet size={17}/>{walletAddress ? 'Unlink wallet' : 'Link wallet'}</button><button className="signout-btn" onClick={() => void signOut()}>Sign out</button></>
            : <button className="wallet-btn" onClick={goToLogin} disabled={authLoading}><Wallet size={17}/>{authLoading ? 'Checking…' : 'Sign in'}</button>}</div>
        </header>

        <div className="mobile-nav">{nav.map(({label, icon: Icon}) => <button key={label} className={tab === label ? "selected" : ""} onClick={() => setTab(label)}><Icon size={17}/>{label}</button>)}</div>
        <div className="content">
          <div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-dot"/> {isSignedIn ? 'SIGNED IN' : backendConfigured ? 'SIGN IN TO POST, VOTE AND SAVE' : 'COMMUNITY SERVICE UNAVAILABLE'}</div><h1>{tab === "Home" ? "Your signal, unfiltered." : tab === "Drops" ? "The Drop zone." : tab === "Signal" ? "Read the room." : "Make it matter."}</h1><p>{tab === "Home" ? "Ideas worth sharing. People worth finding." : tab === "Drops" ? "Short thoughts. Lasting ripples." : tab === "Signal" ? "Community sentiment, without the noise." : "Small actions. Real-world impact."}</p></div><button className="round-action" aria-label="Create Drop" onClick={openComposer}><Plus size={21}/></button></div>

          {tab === "Home" && (isSignedIn
            ? <div className="welcome-strip"><div className="welcome-icon"><Sparkles size={19}/></div><div><strong>Welcome back, {displayName || "friend"}.</strong><p>Your identity is yours. Your signal is yours to share.</p></div><button onClick={openProfile}>Edit profile <ArrowUpRight size={14}/></button></div>
            : <div className="welcome-strip"><div className="welcome-icon"><Sparkles size={19}/></div><div><strong>Join the conversation.</strong><p>Sign in with your email to post Drops, vote in Signal and track your Impact.</p></div><button onClick={goToLogin}>Sign in <ArrowUpRight size={14}/></button></div>)}

          {(tab === "Home" || tab === "Drops") && <>
            <div className="section-row"><div className="section-title"><Flame size={17}/><strong>{tab === "Home" ? "The current" : "Latest Drops"}</strong><span className="live-label">LIVE FEED</span></div><button className="text-btn" onClick={() => setTab(tab === "Home" ? "Drops" : "Home")}>{tab === "Home" ? "Explore all" : "Home feed"} <ArrowUpRight size={14}/></button></div>
            {tab === "Home" && <button className="composer-launch" onClick={openComposer}><div className="avatar avatar-lime">{initial}</div><span>{isSignedIn ? "What’s on your mind?" : "Sign in to share a Drop"}</span><span className="composer-plus"><Plus size={17}/></span></button>}
            <div className="feed-list">{filteredDrops.map(d => <article className="drop-card" key={d.id}><div className="drop-avatar">{d.author.slice(0,1).toUpperCase()}</div><div className="drop-body"><div className="drop-meta"><strong>{d.author} {isPro && isOwnDrop(d) && <span className="pro-badge">PRO</span>}</strong><span className="handle">{d.handle}</span><span className="meta-dot">·</span><span>{d.time}</span>{d.visibility === "unlisted" && <span className="unlisted-label">UNLISTED</span>}<button className="more-btn" aria-label="More actions" onClick={() => { setReportDropId(d.id); setReportReason("spam"); }}><MoreHorizontal size={19}/></button></div><p className="drop-text">{d.text}</p><div className="drop-tag">#{d.tag}</div><div className="drop-actions"><button className={d.liked ? "liked" : ""} onClick={() => void toggleLike(d.id)} aria-label={d.liked ? "Unlike" : "Like"}><Heart size={16} fill={d.liked ? "currentColor" : "none"}/><span>{d.likes}</span></button><button onClick={() => void shareDrop(d)}><Send size={15}/><span>Share</span></button><button className="bookmark-action" onClick={() => void toggleBookmark(d.id)} aria-label={savedDrops.includes(d.id) ? "Unsave Drop" : "Save Drop"}><Bookmark size={16} fill={savedDrops.includes(d.id) ? "currentColor" : "none"}/></button></div></div></article>)}
              {!feedLoading && !feedError && filteredDrops.length === 0 && <div className="empty-state"><Search size={24}/><strong>{search ? "No Drops found" : "No Drops yet"}</strong><span>{search ? "Try another search." : isSignedIn ? "Be the first to share something." : "Sign in to share the first one."}</span></div>}
              {feedError && <p className="feed-status">{feedError} <button className="text-btn" onClick={() => void loadFeed(true)}>Retry</button></p>}
              {feedLoading && <p className="feed-status">Loading Drops…</p>}
            </div>
            {feedCursor && !feedLoading && !search && <div className="load-more"><button className="text-btn" onClick={() => void loadFeed(false)}>Load more Drops <ChevronDown size={14}/></button></div>}
          </>}

          {tab === "Signal" && <div className="signal-view"><div className="signal-hero"><div className="signal-head"><div className="signal-icon"><Activity size={22}/></div><div><span className="eyebrow">COMMUNITY PULSE</span><h2>What’s the mood?</h2></div><span className="signal-live"><i/> LIVE</span></div><p className="muted">{signalTotal ? "Live totals from every vote cast on Doxia." : "No votes yet. Cast the first signal."}</p><div className="sentiment-bars"><div className="sentiment-label"><span>Positive signal</span><strong>{share(signal?.bullish ?? 0, signalTotal)}%</strong></div><div className="bar"><span style={{width: `${share(signal?.bullish ?? 0, signalTotal)}%`}}/></div><div className="sentiment-label"><span>Cautious signal</span><strong>{share(signal?.bearish ?? 0, signalTotal)}%</strong></div><div className="bar bar-muted"><span style={{width: `${share(signal?.bearish ?? 0, signalTotal)}%`}}/></div></div><div className="signal-total"><span><span className="status-dot"/> {signalTotal} community {signalTotal === 1 ? "vote" : "votes"}</span><span>Community opinion · not financial advice</span></div></div><div className="signal-prompt"><span className="eyebrow">YOUR TAKE</span><h3>Where is the privacy web heading?</h3><p>Choose the signal that best reflects your view.</p><div className="vote-buttons"><button className={myVote === "bullish" ? "vote-selected bullish" : ""} onClick={() => void castVote("bullish")}><Zap size={18}/> Bullish <span>↗</span></button><button className={myVote === "bearish" ? "vote-selected bearish" : ""} onClick={() => void castVote("bearish")}><Activity size={18}/> Cautious <span>↘</span></button></div><small>{myVote ? `Your current vote: ${myVote === "bullish" ? "Bullish" : myVote === "bearish" ? "Cautious" : "Neutral"}. You can change it any time.` : isSignedIn ? "One vote per topic on your account." : "Sign in to vote. One vote per account."}</small></div><div className="signal-prompt"><span className="eyebrow">TRENDING THIS WEEK</span><h3>What people are posting about</h3>{trendingList}</div></div>}

          {tab === "Impact" && <div className="impact-view"><div className="impact-banner"><div><span className="eyebrow">THE IMPACT BOARD</span><h2>Turn conviction into action.</h2><p>Choose a mission. Make a little progress. Bring others along.</p></div><div className="impact-art"><Target size={54}/></div></div><div className="impact-stats"><div><strong>{completedMissions.length}</strong><span>Missions completed</span></div><div><strong>{completedMissions.reduce((sum, m) => sum + m.points, 0)}</strong><span>Impact points earned</span></div><div><strong>{missions.length - completedMissions.length}</strong><span>Open missions</span></div></div><div className="section-row"><div className="section-title"><Leaf size={17}/><strong>Community missions</strong></div><span className="muted small">{isSignedIn ? "SAVED TO YOUR ACCOUNT" : "SIGN IN TO TRACK"}</span></div><div className="mission-list">{missions.map(m => { const style = MISSION_STYLE[m.slug] ?? { icon: "✨", tag: "MISSION" }; return <article className="mission-card" key={m.id}><div className="mission-emoji">{style.icon}</div><div className="mission-copy"><span className="mission-tag">{style.tag}</span><h3>{m.title}</h3><p>{m.description}</p><span className="mission-points"><Zap size={13}/>{m.points} impact points</span></div><button className={m.completed ? "mission-done" : "mission-cta"} disabled={m.completed} onClick={() => void completeMission(m.slug)}>{m.completed ? <><Check size={16}/> Done</> : "Mark done"}</button></article>; })}{missions.length === 0 && <div className="empty-state"><Leaf size={24}/><strong>No missions right now</strong><span>Check back soon.</span></div>}</div><p className="fine-print">Points are app progress only; no token, donation or financial reward is issued.</p></div>}

          <footer className="main-footer"><span>© 2026 Doxia</span><span><Shield size={13}/> Privacy by design, still in progress</span><button onClick={() => alert("Privacy policy and terms should be added before public beta.")}>Privacy & terms</button></footer>
        </div>
      </section>

      <aside className="right-column">
        <div className="right-top"><button className="icon-btn" aria-label="Explore Drops" onClick={() => setTab("Drops")}><Compass size={18}/></button><button className="profile-trigger" onClick={openProfile} aria-label={isSignedIn ? "Edit profile" : "Sign in"}><div className="avatar avatar-lime">{initial}</div><ChevronDown size={14}/></button></div>
        <div className="right-card signal-card"><div className="right-card-heading"><div><span className="eyebrow">SIGNAL SNAPSHOT</span><h3>Privacy web</h3></div><span className="mini-pulse"><i/></span></div><div className="big-score">{signalTotal ? <>{share(signal?.bullish ?? 0, signalTotal)}<span>%</span></> : "—"}</div><div className="score-caption">Positive signal {trend && <span>{trend.delta >= 0 ? "↑" : "↓"} {Math.abs(trend.delta)} pts this week</span>}</div><div className="mini-chart">{trend ? <svg viewBox="0 0 260 60" preserveAspectRatio="none" aria-label="Share of positive votes over the last 7 days"><path d={trend.path} fill="none" stroke="#b7f779" strokeWidth="2.5" strokeLinecap="round"/></svg> : <div className="chart-empty">Trend appears after votes on 2+ days</div>}</div><div className="chart-bottom"><span>7-DAY TREND</span><span>{signalTotal} {signalTotal === 1 ? "VOTE" : "VOTES"}</span></div></div>
        <div className="right-card"><div className="right-card-heading"><h3>Trending topics</h3><span className="live-label">7 DAYS</span></div>{trendingList}<button className="see-all" onClick={() => setTab("Signal")}>Explore Signal <ArrowUpRight size={14}/></button></div>
        <div className="right-card mission-teaser"><div className="mission-teaser-icon"><Leaf size={18}/></div><span className="eyebrow">IMPACT MISSION</span><h3>Privacy is a practice.</h3><p>Help one person make a safer choice online today.</p><button className="text-btn" onClick={() => setTab("Impact")}>View missions <ArrowUpRight size={14}/></button></div>
        <div className="right-foot"><span>About</span><span>Guidelines</span><span>Help</span><p>Identity. Signal. Impact.</p></div>
      </aside>

      {reportDropId && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setReportDropId(null); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="report-title"><div className="modal-head"><div><span className="eyebrow">COMMUNITY SAFETY</span><h2 id="report-title">{isOwnDrop(selectedDrop) ? "Manage your Drop." : "Report this Drop."}</h2></div><button className="icon-btn" onClick={() => setReportDropId(null)} aria-label="Close"><X size={20}/></button></div>{isOwnDrop(selectedDrop) ? <><p className="muted">Manage the Drop you published.</p><button className="primary-btn full-btn" onClick={editSelectedDrop}>Edit Drop</button><button className="danger-btn full-btn" onClick={() => void deleteSelectedDrop()}>Delete Drop permanently</button></> : <><label className="field-label">Reason<select value={reportReason} onChange={e => setReportReason(e.target.value)}><option value="spam">Spam</option><option value="harassment">Harassment</option><option value="impersonation">Impersonation</option><option value="illegal">Illegal content</option><option value="other">Other</option></select></label><label className="field-label">Additional details (optional)<textarea value={reportDetails} maxLength={1000} onChange={e => setReportDetails(e.target.value)} placeholder="Help the moderation team understand the issue." /></label><p className="demo-warning">Reports are reviewed by the Doxia team. Do not use this for emergencies.</p><button className="primary-btn full-btn" onClick={() => void submitReport()}>{isSignedIn ? "Submit report" : "Sign in to report"}</button></>}</section></div>}

      {composerOpen && <div className="modal-backdrop" onMouseDown={e => {if(e.target === e.currentTarget) { setComposerOpen(false); setEditingDropId(null); setDraft(""); }}}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="compose-title"><div className="modal-head"><div><span className="eyebrow">CREATE SOMETHING</span><h2 id="compose-title">{editingDropId ? "Edit your Drop." : "Drop a thought."}</h2></div><button className="icon-btn" onClick={() => { setComposerOpen(false); setEditingDropId(null); setDraft(""); }} aria-label="Close"><X size={20}/></button></div><div className="compose-author"><div className="avatar avatar-lime">{initial}</div><div><strong>{displayName}</strong><span>{handle} · {editingDropId ? "Editing" : draftVisibility === "public" ? "Public Drop" : "Unlisted Drop"}</span></div></div><textarea autoFocus maxLength={isPro ? 1000 : 500} value={draft} onChange={e => setDraft(e.target.value)} placeholder="What do you want the world to hear?" />{!editingDropId && <div className="compose-options"><label className="field-label">Topic<select value={draftTopic} onChange={e => setDraftTopic(e.target.value)}>{TOPICS.map(t => <option key={t} value={t}>{t}</option>)}</select></label><label className="field-label">Who can see it<select value={draftVisibility} onChange={e => setDraftVisibility(e.target.value === "unlisted" ? "unlisted" : "public")}><option value="public">Public — in the feed</option><option value="unlisted">Unlisted — link only</option></select></label></div>}<div className="compose-foot"><span>{draft.length}/{isPro ? 1000 : 500} · Be thoughtful. Be you.</span><button className="primary-btn" disabled={!draft.trim()} onClick={() => void publishDrop()}><Send size={16}/> {editingDropId ? "Save changes" : "Publish Drop"}</button></div><p className="demo-warning">{editingDropId ? "Changes update this Drop for everyone who can see it." : draftVisibility === "public" ? "Public Drops appear in the community feed." : "Unlisted Drops stay out of the feed; anyone with the link can view them."}</p></section></div>}

      {profileOpen && <div className="modal-backdrop" onMouseDown={e => {if(e.target === e.currentTarget) setProfileOpen(false)}}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="profile-title"><div className="modal-head"><div><span className="eyebrow">YOUR IDENTITY</span><h2 id="profile-title">Make it yours.</h2></div><button className="icon-btn" onClick={() => setProfileOpen(false)} aria-label="Close"><X size={20}/></button></div><label className="field-label">Display name<input value={displayName} maxLength={32} onChange={e => setDisplayName(e.target.value)} /></label><label className="field-label">Handle<input value={handle} maxLength={25} onChange={e => setHandle(e.target.value.startsWith("@") ? e.target.value : "@"+e.target.value)} /></label><label className="field-label">Bio<textarea value={bio} maxLength={160} onChange={e => setBio(e.target.value)} /></label><div className="privacy-callout"><LockKeyhole size={17}/><span>Your display name, handle and bio are public. Your email and wallet stay private.</span></div><button className="primary-btn full-btn" onClick={() => void saveProfile()}><Check size={16}/> Save profile</button><button className="danger-btn full-btn" onClick={() => void deleteAccount()}>Delete account permanently</button></section></div>}

      {proOpen && <div className="modal-backdrop" onMouseDown={e => {if(e.target === e.currentTarget) setProOpen(false)}}><section className="modal pro-modal" role="dialog" aria-modal="true" aria-labelledby="pro-title"><button className="modal-close icon-btn" onClick={() => setProOpen(false)} aria-label="Close"><X size={20}/></button><div className="pro-crown"><Crown size={28}/></div><span className="eyebrow">A LITTLE MORE DOXIA</span><h2 id="pro-title">{isPro ? "You’re Pro." : <>Your signal.<br/>Your rules.</>}</h2><p className="pro-lead">{isPro ? "Lifetime Doxia Pro access is active on this account." : "One payment. Lifetime Pro access, after verified checkout."}</p><div className="price"><strong>£11.99</strong><span>one-time · lifetime</span></div><ul className="pro-benefits"><li><Check size={16}/> Long-form Drops up to 1,000 characters</li><li><Check size={16}/> Pro badge on your profile</li><li><Check size={16}/> Lifetime Pro status on this account</li><li><Check size={16}/> Support the independent build</li></ul>{!isPro && <button className="primary-btn full-btn" onClick={() => void startCheckout()}>{isSignedIn ? "Continue to checkout" : "Sign in to upgrade"} <ArrowUpRight size={16}/></button>}<p className="demo-warning">Secure checkout by Stripe. Pro is activated on your account once payment is confirmed.</p></section></div>}
    </main>
  );
}
