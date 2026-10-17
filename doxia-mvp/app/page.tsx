 "use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity, ArrowUpRight, Bell, Bookmark, Check, ChevronDown, Compass, Crown,
  Flame, Heart, Home, Leaf, LockKeyhole, MessageCircle, MoreHorizontal, Plus,
  Radio, Search, Send, Settings, Shield, Sparkles, Target, Wallet, X, Zap
} from "lucide-react";

type Tab = "Home" | "Drops" | "Signal" | "Impact";
type Drop = { id: string; author: string; handle: string; time: string; text: string; tag: string; likes: number; liked: boolean; comments: number; };
type ApiDrop = { id: string; body: string; created_at: string; topic?: string | null; liked?: boolean; profiles?: { display_name?: string | null; handle?: string | null } | null; drop_reactions?: { count: number }[] };
type ApiMission = { slug: string; completed: boolean };
type ApiTopic = { slug: string; bullish?: number; bearish?: number; neutral?: number; my_vote?: string | null };
const seedDrops: Drop[] = [
  { id: "d1", author: "Mira", handle: "@mira.zk", time: "12m", text: "Privacy shouldn't be a premium feature. It should be the default. Building toward a web where identity is yours to reveal — and yours to keep.", tag: "Privacy", likes: 128, liked: false, comments: 18 },
  { id: "d2", author: "0xNorth", handle: "@0xnorth", time: "38m", text: "The best onchain communities won't be the loudest. They'll be the ones that turn conviction into useful action.", tag: "Web3", likes: 84, liked: true, comments: 12 },
  { id: "d3", author: "Sable", handle: "@sable.eth", time: "1h", text: "Signal check: builders are quietly shipping again. Less noise, more open-source commits. That's the energy I want to see.", tag: "Signal", likes: 56, liked: false, comments: 9 },
];
const nav: { label: Tab; icon: typeof Home }[] = [
  { label: "Home", icon: Home }, { label: "Drops", icon: Compass }, { label: "Signal", icon: Radio }, { label: "Impact", icon: Leaf },
];

export default function Page() {
  const [tab, setTab] = useState<Tab>("Home");
  const [drops, setDrops] = useState<Drop[]>(seedDrops);
  const [draft, setDraft] = useState("");
  const [composerOpen, setComposerOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [proOpen, setProOpen] = useState(false);
  const [voted, setVoted] = useState<Record<string, string>>({});
  const [completed, setCompleted] = useState<string[]>([]);
  const [displayName, setDisplayName] = useState("Nova");
  const [handle, setHandle] = useState("@nova.signal");
  const [bio, setBio] = useState("Building in public. Keeping my privacy.");
  const [savedDrops, setSavedDrops] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [backendConfigured, setBackendConfigured] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [signalCounts, setSignalCounts] = useState<{ bullish: number; bearish: number; neutral: number } | null>(null);
  const [isPro, setIsPro] = useState(false);
  const [reportDropId, setReportDropId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState('spam');
  const [reportDetails, setReportDetails] = useState('');
  const [editingDropId, setEditingDropId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("doxia-mvp-state");
      if (raw) {
        const s = JSON.parse(raw);
        if (s.drops) setDrops(s.drops);
        if (s.voted) setVoted(s.voted);
        if (s.completed) setCompleted(s.completed);
        if (s.displayName) setDisplayName(s.displayName);
        if (s.handle) setHandle(s.handle);
        if (s.bio) setBio(s.bio);
        if (s.savedDrops) setSavedDrops(s.savedDrops);
      }
    } catch { /* start with sample content if browser storage is unavailable */ }
  }, []);

  useEffect(() => {
    let subscription: { unsubscribe: () => void } | undefined;
    async function initAuth() {
      try {
        const health = await fetch('/api/health', { cache: 'no-store' }).then(r => r.json());
        setBackendConfigured(Boolean(health.backendConfigured));
        if (!health.backendConfigured) { setAuthLoading(false); return; }
        const { createClient } = await import('@/lib/supabase/browser');
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        setIsSignedIn(Boolean(user));
        const listener = supabase.auth.onAuthStateChange((event, session) => {
          if (event === 'SIGNED_OUT') {
            setDrops(seedDrops); setDisplayName('Nova'); setHandle('@nova.signal'); setBio('Building in public. Keeping my privacy.');
            setVoted({}); setCompleted([]); setSignalCounts(null); setWalletAddress(null); setIsPro(false); setSavedDrops([]);
            try { localStorage.removeItem('doxia-mvp-state'); } catch { /* storage is optional */ }
          }
          setIsSignedIn(Boolean(session?.user));
        });
        subscription = listener.data.subscription;
      } catch { setBackendConfigured(false); }
      finally { setAuthLoading(false); }
    }
    void initAuth();
    return () => subscription?.unsubscribe();
  }, []);

  useEffect(() => {
    const target = new URLSearchParams(window.location.search).get('drop');
    if (!target) return;
    let cancelled = false;
    fetch(`/api/drops/${encodeURIComponent(target)}`, { cache: 'no-store' }).then(async response => {
      const payload = await response.json();
      if (!response.ok || !payload.drop || cancelled) return;
      const d = payload.drop;
      setDrops(ds => ds.some(existing => existing.id === d.id) ? ds : [{ id: d.id, author: d.profiles?.display_name ?? 'Doxia member', handle: '@' + (d.profiles?.handle ?? 'member'), time: new Date(d.created_at).toLocaleString(), text: d.body, tag: d.topic ?? 'Community', likes: d.drop_reactions?.[0]?.count ?? 0, liked: false, comments: 0 }, ...ds]);
      setTab('Drops');
    }).catch(() => { /* shared links may be unavailable until backend is configured */ });
    return () => { cancelled = true; };
  }, []);

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

  useEffect(() => {
    if (!isSignedIn) return;
    let cancelled = false;
    async function loadAccountData() {
      try {
        const [dropResponse, profileResponse, walletResponse, missionResponse, signalResponse, entitlementResponse, bookmarkResponse] = await Promise.all([
          fetch('/api/drops', { cache: 'no-store' }), fetch('/api/profile', { cache: 'no-store' }),
          fetch('/api/wallet', { cache: 'no-store' }), fetch('/api/missions', { cache: 'no-store' }),
          fetch('/api/signal', { cache: 'no-store' }), fetch('/api/billing/entitlement', { cache: 'no-store' }), fetch('/api/bookmarks', { cache: 'no-store' })
        ]);
        if (cancelled) return;
        if (dropResponse.ok) {
          const payload = await dropResponse.json();
          const mapped = (payload.drops ?? []).map((d: ApiDrop) => ({ id: d.id, author: d.profiles?.display_name ?? 'Doxia member', handle: '@' + (d.profiles?.handle ?? 'member'), time: new Date(d.created_at).toLocaleString(), text: d.body, tag: d.topic ?? 'Community', likes: d.drop_reactions?.[0]?.count ?? 0, liked: Boolean(d.liked), comments: 0 }));
          setDrops(mapped);
        }
        if (profileResponse.ok) {
          const payload = await profileResponse.json();
          if (payload.profile) { setDisplayName(payload.profile.display_name); setHandle('@' + payload.profile.handle); setBio(payload.profile.bio); }
        }
        if (walletResponse.ok) { const payload = await walletResponse.json(); setWalletAddress(payload.wallet?.address ?? null); }
        if (missionResponse.ok) { const payload = await missionResponse.json(); setCompleted((payload.missions ?? []).filter((m: ApiMission) => m.completed).map((m: ApiMission) => m.slug)); }
        if (signalResponse.ok) { const payload = await signalResponse.json(); const topic = (payload.topics ?? []).find((t: ApiTopic) => t.slug === 'privacy-web-direction'); if (topic) { setSignalCounts({ bullish: Number(topic.bullish ?? 0), bearish: Number(topic.bearish ?? 0), neutral: Number(topic.neutral ?? 0) }); if (topic.my_vote) setVoted(v => ({ ...v, privacy: topic.my_vote === 'bullish' ? 'Bullish' : topic.my_vote === 'bearish' ? 'Bearish' : 'Neutral' })); } }
        if (entitlementResponse.ok) { const payload = await entitlementResponse.json(); setIsPro(Boolean(payload.isPro)); }
        if (bookmarkResponse.ok) { const payload = await bookmarkResponse.json(); setSavedDrops(payload.dropIds ?? []); }
      } catch { /* the app remains usable in preview mode if the backend is unavailable */ }
    }
    void loadAccountData();
    return () => { cancelled = true; };
  }, [isSignedIn]);

  useEffect(() => {
    try {
      if (isSignedIn) { localStorage.removeItem('doxia-mvp-state'); return; }
      localStorage.setItem("doxia-mvp-state", JSON.stringify({ drops, voted, completed, displayName, handle, bio, savedDrops }));
    } catch { /* storage is optional in this demo */ }
  }, [drops, voted, completed, displayName, handle, bio, savedDrops, isSignedIn]);

  const filteredDrops = useMemo(() => drops.filter(d => `${d.text} ${d.author} ${d.tag}`.toLowerCase().includes(search.toLowerCase())), [drops, search]);
  const voteCounts = useMemo(() => {
    const all = Object.values(voted);
    const bullish = isSignedIn && signalCounts ? signalCounts.bullish : all.filter(v => v === "Bullish").length;
    const bearish = isSignedIn && signalCounts ? signalCounts.bearish : all.filter(v => v === "Bearish").length;
    return { bullish, bearish, total: isSignedIn && signalCounts ? signalCounts.bullish + signalCounts.bearish + signalCounts.neutral : all.length };
  }, [voted, isSignedIn, signalCounts]);

  async function publishDrop() {
    const text = draft.trim();
    if (!text) return;
    if (editingDropId) {
      if (isSignedIn) {
        try {
          const response = await fetch(`/api/drops/${editingDropId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body: text }) });
          const payload = await response.json();
          if (!response.ok) throw new Error(payload.error ?? 'Could not update Drop.');
        } catch (error) { alert(error instanceof Error ? error.message : 'Could not update Drop.'); return; }
      }
      setDrops(ds => ds.map(d => d.id === editingDropId ? { ...d, text, time: 'edited just now' } : d));
    } else if (isSignedIn) {
      try {
        const response = await fetch('/api/drops', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body: text, topic: 'Community', visibility: 'public' }) });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? 'Could not publish Drop.');
        const d = payload.drop;
        setDrops(ds => [{ id: d.id, author: displayName, handle, time: 'now', text: d.body, tag: d.topic, likes: 0, liked: false, comments: 0 }, ...ds]);
      } catch (error) { alert(error instanceof Error ? error.message : 'Could not publish Drop.'); return; }
    } else {
      setDrops(ds => [{ id: crypto.randomUUID(), author: displayName, handle, time: "now", text, tag: "Community", likes: 0, liked: false, comments: 0 }, ...ds]);
    }
    setDraft(""); setEditingDropId(null); setComposerOpen(false); setTab("Drops");
  }

  function editSelectedDrop() {
    const target = drops.find(d => d.id === reportDropId);
    if (!target) return;
    setDraft(target.text); setEditingDropId(target.id); setReportDropId(null); setComposerOpen(true);
  }

  async function deleteSelectedDrop() {
    if (!reportDropId) return;
    if (!window.confirm('Delete this Drop permanently? This cannot be undone.')) return;
    if (isSignedIn) {
      try {
        const response = await fetch(`/api/drops/${reportDropId}`, { method: 'DELETE' });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? 'Could not delete Drop.');
      } catch (error) { alert(error instanceof Error ? error.message : 'Could not delete Drop.'); return; }
    }
    setDrops(ds => ds.filter(d => d.id !== reportDropId)); setReportDropId(null);
  }

  async function toggleWallet() {
    if (!isSignedIn) { window.location.href = '/login'; return; }
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
    if (isSignedIn) {
      try {
        const response = await fetch('/api/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ display_name: displayName, handle, bio }) });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? 'Could not save profile.');
        setDisplayName(payload.profile.display_name); setHandle('@' + payload.profile.handle); setBio(payload.profile.bio);
      } catch (error) { alert(error instanceof Error ? error.message : 'Could not save profile.'); return; }
    }
    setProfileOpen(false);
  }

  async function castVote(choice: 'bullish' | 'bearish') {
    if (isSignedIn) {
      try {
        const response = await fetch('/api/signal/privacy-web-direction/vote', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ choice }) });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? 'Could not save vote.');
        const summaryResponse = await fetch('/api/signal', { cache: 'no-store' });
        if (summaryResponse.ok) { const payload = await summaryResponse.json(); const topic = (payload.topics ?? []).find((t: ApiTopic) => t.slug === 'privacy-web-direction'); if (topic) setSignalCounts({ bullish: Number(topic.bullish ?? 0), bearish: Number(topic.bearish ?? 0), neutral: Number(topic.neutral ?? 0) }); }
      } catch (error) { alert(error instanceof Error ? error.message : 'Could not save vote.'); return; }
    }
    setVoted(v => ({ ...v, privacy: choice === 'bullish' ? 'Bullish' : 'Bearish' }));
  }

  async function toggleMission(slug: string) {
    if (isSignedIn) {
      if (completed.includes(slug)) return;
      try {
        const response = await fetch(`/api/missions/${slug}/complete`, { method: 'POST' });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? 'Could not update mission.');
      } catch (error) { alert(error instanceof Error ? error.message : 'Could not update mission.'); return; }
    }
    setCompleted(c => c.includes(slug) ? c.filter(x => x !== slug) : [...c, slug]);
  }

  async function startCheckout() {
    if (!isSignedIn) { window.location.href = '/login'; return; }
    try {
      const response = await fetch('/api/billing/checkout', { method: 'POST' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'Checkout is not available.');
      window.location.href = payload.url;
    } catch (error) { alert(error instanceof Error ? error.message : 'Checkout is not available.'); }
  }
  async function toggleLike(id: string) {
    const current = drops.find(d => d.id === id);
    if (!current) return;
    if (isSignedIn) {
      try {
        const response = await fetch(`/api/drops/${id}/reactions`, { method: current.liked ? 'DELETE' : 'POST' });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? 'Could not update reaction.');
      } catch (error) { alert(error instanceof Error ? error.message : 'Could not update reaction.'); return; }
    }
    setDrops(ds => ds.map(d => d.id === id ? { ...d, liked: !d.liked, likes: Math.max(0, d.likes + (d.liked ? -1 : 1)) } : d));
  }
  async function toggleBookmark(id: string) {
    const currentlySaved = savedDrops.includes(id);
    if (isSignedIn) {
      try {
        const response = await fetch(`/api/drops/${id}/bookmark`, { method: currentlySaved ? 'DELETE' : 'POST' });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? 'Could not update saved Drop.');
      } catch (error) { alert(error instanceof Error ? error.message : 'Could not update saved Drop.'); return; }
    }
    setSavedDrops(current => currentlySaved ? current.filter(dropId => dropId !== id) : [...current, id]);
  }

  async function submitReport() {
    if (!isSignedIn) { window.location.href = '/login'; return; }
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

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#" onClick={e => { e.preventDefault(); setTab("Home"); }}><span className="brand-mark">d</span><span>doxia<span className="brand-dot">.</span></span></a>
        <div className="profile-mini">
          <div className="avatar avatar-lime">{displayName.slice(0,1).toUpperCase()}</div>
          <div className="profile-mini-copy"><strong>{displayName} {isPro && <span className="pro-badge">PRO</span>}</strong><span>{handle}</span></div>
          <button className="icon-btn subtle" aria-label="Edit profile" onClick={() => setProfileOpen(true)}><Settings size={17}/></button>
        </div>
        <nav className="nav-list" aria-label="Main navigation">
          {nav.map(({ label, icon: Icon }) => <button key={label} className={`nav-item ${tab === label ? "active" : ""}`} onClick={() => setTab(label)}><Icon size={19}/><span>{label}</span>{label === "Signal" && <span className="nav-pill">LIVE</span>}</button>)}
        </nav>
        <button className="primary-btn compose-side" onClick={() => { setEditingDropId(null); setDraft(""); setComposerOpen(true); }}><Plus size={18}/> Create a Drop</button>
        <div className="sidebar-bottom">
          <div className="privacy-note"><LockKeyhole size={16}/><span>Your identity. Your terms.</span></div>
          <button className="pro-card" onClick={() => setProOpen(true)}><span className="pro-icon"><Crown size={18}/></span><span><strong>{isPro ? "Doxia Pro active" : "Unlock Doxia Pro"}</strong><small>{isPro ? "Lifetime access enabled." : "Own your signal."}</small></span><ArrowUpRight size={17}/></button>
          <div className="sidebar-foot"><span className="status-dot"/> MVP preview <span>·</span> v0.1</div>
        </div>
      </aside>

      <section className="main-column">
        <header className="topbar">
          <div className="mobile-brand"><span className="brand-mark">d</span><strong>doxia<span className="brand-dot">.</span></strong></div>
          <div className="search-box"><Search size={17}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search Drops, people, signals…" aria-label="Search"/></div>
          <div className="top-actions"><button className="icon-btn" aria-label="Notifications"><Bell size={19}/><i/></button><button className="wallet-btn" onClick={toggleWallet}><Wallet size={17}/>{walletAddress ? 'Unlink wallet' : isSignedIn ? 'Link wallet' : authLoading ? 'Checking…' : 'Sign in to sync'}</button>{isSignedIn && <button className="signout-btn" onClick={async () => { try { const { createClient } = await import('@/lib/supabase/browser'); await createClient().auth.signOut(); setIsSignedIn(false); setWalletAddress(null); setIsPro(false); setDrops(seedDrops); setVoted({}); setCompleted([]); setSignalCounts(null); setSavedDrops([]); try { localStorage.removeItem('doxia-mvp-state'); } catch { /* storage is optional */ } } catch { alert('Could not sign out.'); } }}>Sign out</button>}</div>
        </header>

        <div className="mobile-nav">{nav.map(({label, icon: Icon}) => <button key={label} className={tab === label ? "selected" : ""} onClick={() => setTab(label)}><Icon size={17}/>{label}</button>)}</div>
        <div className="content">
          <div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-dot"/> {isSignedIn ? 'SYNCED DOXIA ACCOUNT' : backendConfigured ? 'SIGN IN TO SYNC YOUR IDENTITY' : 'YOUR CORNER OF THE OPEN WEB'}</div><h1>{tab === "Home" ? "Your signal, unfiltered." : tab === "Drops" ? "The Drop zone." : tab === "Signal" ? "Read the room." : "Make it matter."}</h1><p>{tab === "Home" ? "Ideas worth sharing. People worth finding." : tab === "Drops" ? "Short thoughts. Lasting ripples." : tab === "Signal" ? "Community sentiment, without the noise." : "Small actions. Real-world impact."}</p></div><button className="round-action" aria-label="Create Drop" onClick={() => { setEditingDropId(null); setDraft(""); setComposerOpen(true); }}><Plus size={21}/></button></div>

          {tab === "Home" && <div className="welcome-strip"><div className="welcome-icon"><Sparkles size={19}/></div><div><strong>Welcome back, {displayName}.</strong><p>Your identity is yours. Your signal is yours to share.</p></div><button onClick={() => setProfileOpen(true)}>Edit profile <ArrowUpRight size={14}/></button></div>}

          {(tab === "Home" || tab === "Drops") && <>
            <div className="section-row"><div className="section-title"><Flame size={17}/><strong>{tab === "Home" ? "The current" : "Latest Drops"}</strong><span className="live-label">{isSignedIn ? "LIVE FEED" : "SAMPLE FEED"}</span></div><button className="text-btn" onClick={() => setTab(tab === "Home" ? "Drops" : "Home")}>{tab === "Home" ? "Explore all" : "Home feed"} <ArrowUpRight size={14}/></button></div>
            {tab === "Home" && <button className="composer-launch" onClick={() => { setEditingDropId(null); setDraft(""); setComposerOpen(true); }}><div className="avatar avatar-lime">{displayName.slice(0,1).toUpperCase()}</div><span>What’s on your mind?</span><span className="composer-plus"><Plus size={17}/></span></button>}
            <div className="feed-list">{filteredDrops.map(d => <article className="drop-card" key={d.id}><div className="drop-avatar">{d.author.slice(0,1).toUpperCase()}</div><div className="drop-body"><div className="drop-meta"><strong>{d.author} {isPro && d.handle === handle && <span className="pro-badge">PRO</span>}</strong><span className="handle">{d.handle}</span><span className="meta-dot">·</span><span>{d.time}</span><button className="more-btn" aria-label="More actions" onClick={() => { setReportDropId(d.id); setReportReason("spam"); }}><MoreHorizontal size={19}/></button></div><p className="drop-text">{d.text}</p><div className="drop-tag">#{d.tag}</div><div className="drop-actions"><button className={d.liked ? "liked" : ""} onClick={() => toggleLike(d.id)}><Heart size={16} fill={d.liked ? "currentColor" : "none"}/><span>{d.likes}</span></button><button onClick={() => alert("Replies are not included in this MVP yet.")}><MessageCircle size={16}/><span>{d.comments}</span></button><button onClick={() => shareDrop(d)}><Send size={15}/><span>Share</span></button><button className="bookmark-action" onClick={() => void toggleBookmark(d.id)} aria-label="Save Drop"><Bookmark size={16} fill={savedDrops.includes(d.id) ? "currentColor" : "none"}/></button></div></div></article>)}
              {filteredDrops.length === 0 && <div className="empty-state"><Search size={24}/><strong>No Drops found</strong><span>Try another search or create the first one.</span></div>}
            </div>
          </>}

          {tab === "Signal" && <div className="signal-view"><div className="signal-hero"><div className="signal-head"><div className="signal-icon"><Activity size={22}/></div><div><span className="eyebrow">COMMUNITY PULSE</span><h2>What’s the mood?</h2></div><span className="signal-live"><i/> LIVE</span></div><p className="muted">{isSignedIn ? "Cast a signal and see the community aggregate update." : "Cast a sample signal. Sign in to save your vote and see community totals."}</p><div className="sentiment-bars"><div className="sentiment-label"><span>Positive signal</span><strong>{voteCounts.total ? Math.round((voteCounts.bullish / voteCounts.total) * 100) : (isSignedIn ? 0 : 68)}%</strong></div><div className="bar"><span style={{width: `${voteCounts.total ? (voteCounts.bullish / voteCounts.total) * 100 : (isSignedIn ? 0 : 68)}%`}}/></div><div className="sentiment-label"><span>Cautious signal</span><strong>{voteCounts.total ? Math.round((voteCounts.bearish / voteCounts.total) * 100) : (isSignedIn ? 0 : 32)}%</strong></div><div className="bar bar-muted"><span style={{width: `${voteCounts.total ? (voteCounts.bearish / voteCounts.total) * 100 : (isSignedIn ? 0 : 32)}%`}}/></div></div><div className="signal-total"><span><span className="status-dot"/> {isSignedIn ? `${voteCounts.total} community votes` : `${voteCounts.total} votes from this browser`}</span><span>{isSignedIn ? "Live authenticated totals" : "Illustrative baseline until live data"}</span></div></div><div className="signal-prompt"><span className="eyebrow">YOUR TAKE</span><h3>Where is the privacy web heading?</h3><p>Choose the signal that best reflects your view.</p><div className="vote-buttons"><button className={voted.privacy === "Bullish" ? "vote-selected bullish" : ""} onClick={() => void castVote("bullish")}><Zap size={18}/> Bullish <span>↗</span></button><button className={voted.privacy === "Bearish" ? "vote-selected bearish" : ""} onClick={() => void castVote("bearish")}><Activity size={18}/> Cautious <span>↘</span></button></div><small>{voted.privacy ? `Your current vote: ${voted.privacy}. You can change it any time.` : isSignedIn ? "One vote per topic on your account." : "Preview vote is stored in this browser."}</small></div><div className="signal-topic"><div><span className="topic-chip">TRENDING TOPIC</span><h3>Privacy as a default</h3><p>Are users ready to make privacy a core product expectation?</p></div><div className="topic-score"><strong>82</strong><span>signal score*</span></div></div><p className="fine-print">* Sample score for design preview; not a live market or financial indicator.</p></div>}

          {tab === "Impact" && <div className="impact-view"><div className="impact-banner"><div><span className="eyebrow">THE IMPACT BOARD</span><h2>Turn conviction into action.</h2><p>Choose a mission. Make a little progress. Bring others along.</p></div><div className="impact-art"><Target size={54}/></div></div><div className="impact-stats"><div><strong>{completed.length}</strong><span>Missions completed</span></div><div><strong>{completed.length * 25}</strong><span>Impact points earned</span></div><div><strong>{Math.max(0, 3 - completed.length)}</strong><span>Open missions</span></div></div><div className="section-row"><div className="section-title"><Leaf size={17}/><strong>Community missions</strong></div><span className="muted small">{isSignedIn ? "COMMUNITY MISSIONS" : "DEMO MISSIONS"}</span></div><div className="mission-list">{[{id:"open-source-builder",icon:"🌱",tag:"OPEN SOURCE",title:"Support a public-good builder",desc:"Discover an open-source project and share what makes it useful.",points:25},{id:"privacy-practice",icon:"🛡️",tag:"PRIVACY",title:"Help someone take control",desc:"Share one practical privacy setting or safety resource with your circle.",points:25},{id:"welcome-a-voice",icon:"🤝",tag:"COMMUNITY",title:"Welcome a new voice",desc:"Make space for a new community member and amplify their first Drop.",points:25}].map(m => <article className="mission-card" key={m.id}><div className="mission-emoji">{m.icon}</div><div className="mission-copy"><span className="mission-tag">{m.tag}</span><h3>{m.title}</h3><p>{m.desc}</p><span className="mission-points"><Zap size={13}/>{m.points} impact points</span></div><button className={completed.includes(m.id) ? "mission-done" : "mission-cta"} onClick={() => void toggleMission(m.id)}>{completed.includes(m.id) ? <><Check size={16}/> Done</> : "Mark done"}</button></article>)}</div><p className="fine-print">{isSignedIn ? "Mission completions are saved to your account. Points are app progress only; no token or financial reward is issued." : "Missions and points are local demo state; no donation, token, or external action occurs."}</p></div>}

          <footer className="main-footer"><span>© 2026 Doxia</span><span><Shield size={13}/> Privacy by design, still in progress</span><button onClick={() => alert("Privacy policy and terms should be added before public beta.")}>Privacy & terms</button></footer>
        </div>
      </section>

      <aside className="right-column">
        <div className="right-top"><button className="icon-btn" aria-label="Explore"><Compass size={18}/></button><button className="icon-btn" aria-label="Notifications"><Bell size={18}/></button><button className="profile-trigger" onClick={() => setProfileOpen(true)}><div className="avatar avatar-lime">{displayName.slice(0,1).toUpperCase()}</div><ChevronDown size={14}/></button></div>
        <div className="right-card signal-card"><div className="right-card-heading"><div><span className="eyebrow">SIGNAL SNAPSHOT</span><h3>Privacy web</h3></div><span className="mini-pulse"><i/></span></div><div className="big-score">+68<span>%</span></div><div className="score-caption">Community optimism <span>↑ 8.4%</span></div><div className="mini-chart"><svg viewBox="0 0 260 60" preserveAspectRatio="none" aria-label="Illustrative upward trend"><path d="M0 48 C18 45 20 29 38 34 S59 42 76 28 S100 38 120 24 S142 28 158 18 S181 30 197 13 S224 23 240 7 S252 10 260 3" fill="none" stroke="#b7f779" strokeWidth="2.5" strokeLinecap="round"/></svg></div><div className="chart-bottom"><span>24H TREND</span><span>ILLUSTRATIVE DATA</span></div></div>
        <div className="right-card"><div className="right-card-heading"><h3>Trending topics</h3><span className="muted small">DEMO</span><button className="more-btn" aria-label="More topics"><MoreHorizontal size={18}/></button></div>{[{tag:"PRIVACY",title:"Zero-knowledge social",posts:"2.4k Drops"},{tag:"ECOSYSTEM",title:"Robinhood Chain",posts:"1.8k Drops"},{tag:"CULTURE",title:"Build in public",posts:"968 Drops"}].map((t,i)=><button className="trend-item" key={t.title} onClick={() => {setSearch(t.title.split(" ")[0]);setTab("Drops")}}><span className="trend-rank">0{i+1}</span><span><small>{t.tag}</small><strong>{t.title}</strong><em>{t.posts}</em></span><ArrowUpRight size={15}/></button>)}<button className="see-all" onClick={() => setTab("Signal")}>Explore Signal <ArrowUpRight size={14}/></button></div>
        <div className="right-card mission-teaser"><div className="mission-teaser-icon"><Leaf size={18}/></div><span className="eyebrow">IMPACT MISSION</span><h3>Privacy is a practice.</h3><p>Help one person make a safer choice online today.</p><button className="text-btn" onClick={() => setTab("Impact")}>View missions <ArrowUpRight size={14}/></button></div>
        <div className="right-foot"><span>About</span><span>Guidelines</span><span>Help</span><p>Identity. Signal. Impact.</p></div>
      </aside>

      {reportDropId && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setReportDropId(null); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="report-title"><div className="modal-head"><div><span className="eyebrow">COMMUNITY SAFETY</span><h2 id="report-title">{drops.find(d => d.id === reportDropId)?.handle === handle ? "Manage your Drop." : "Report this Drop."}</h2></div><button className="icon-btn" onClick={() => setReportDropId(null)} aria-label="Close"><X size={20}/></button></div>{drops.find(d => d.id === reportDropId)?.handle === handle ? <><p className="muted">Manage the Drop you published.</p><button className="primary-btn full-btn" onClick={editSelectedDrop}>Edit Drop</button><button className="danger-btn full-btn" onClick={() => void deleteSelectedDrop()}>Delete Drop permanently</button></> : <><label className="field-label">Reason<select value={reportReason} onChange={e => setReportReason(e.target.value)}><option value="spam">Spam</option><option value="harassment">Harassment</option><option value="impersonation">Impersonation</option><option value="illegal">Illegal content</option><option value="other">Other</option></select></label><label className="field-label">Additional details (optional)<textarea value={reportDetails} maxLength={1000} onChange={e => setReportDetails(e.target.value)} placeholder="Help the moderation team understand the issue." /></label><p className="demo-warning">Reports are reviewed by the Doxia team. Do not use this for emergencies.</p><button className="primary-btn full-btn" onClick={() => void submitReport()}>Submit report</button></>}</section></div>}

      {composerOpen && <div className="modal-backdrop" onMouseDown={e => {if(e.target === e.currentTarget) { setComposerOpen(false); setEditingDropId(null); setDraft(""); }}}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="compose-title"><div className="modal-head"><div><span className="eyebrow">CREATE SOMETHING</span><h2 id="compose-title">{editingDropId ? "Edit your Drop." : "Drop a thought."}</h2></div><button className="icon-btn" onClick={() => { setComposerOpen(false); setEditingDropId(null); setDraft(""); }} aria-label="Close"><X size={20}/></button></div><div className="compose-author"><div className="avatar avatar-lime">{displayName.slice(0,1).toUpperCase()}</div><div><strong>{displayName}</strong><span>{handle} · Public Drop</span></div></div><textarea autoFocus maxLength={isPro ? 1000 : 500} value={draft} onChange={e => setDraft(e.target.value)} placeholder="What do you want the world to hear?" /><div className="compose-foot"><span>{draft.length}/{isPro ? 1000 : 500} · Be thoughtful. Be you.</span><button className="primary-btn" disabled={!draft.trim()} onClick={publishDrop}><Send size={16}/> {editingDropId ? "Save changes" : "Publish Drop"}</button></div><p className="demo-warning">{editingDropId ? "Changes update this Drop." : isSignedIn ? "This Drop will be saved to your Doxia account." : "Preview mode: this Drop is saved only in this browser. Sign in to sync across devices."}</p></section></div>}

      {profileOpen && <div className="modal-backdrop" onMouseDown={e => {if(e.target === e.currentTarget) setProfileOpen(false)}}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="profile-title"><div className="modal-head"><div><span className="eyebrow">YOUR IDENTITY</span><h2 id="profile-title">Make it yours.</h2></div><button className="icon-btn" onClick={() => setProfileOpen(false)} aria-label="Close"><X size={20}/></button></div><label className="field-label">Display name<input value={displayName} maxLength={32} onChange={e => setDisplayName(e.target.value)} /></label><label className="field-label">Handle<input value={handle} maxLength={24} onChange={e => setHandle(e.target.value.startsWith("@") ? e.target.value : "@"+e.target.value)} /></label><label className="field-label">Bio<textarea value={bio} maxLength={160} onChange={e => setBio(e.target.value)} /></label><div className="privacy-callout"><LockKeyhole size={17}/><span>{isSignedIn ? "Your profile is saved to your Doxia account." : "Your profile is a local preview. Sign in to save it to your account."}</span></div><button className="primary-btn full-btn" onClick={() => void saveProfile()}><Check size={16}/> Save profile</button>{isSignedIn && <button className="danger-btn full-btn" onClick={() => void deleteAccount()}>Delete account permanently</button>}</section></div>}

      {proOpen && <div className="modal-backdrop" onMouseDown={e => {if(e.target === e.currentTarget) setProOpen(false)}}><section className="modal pro-modal" role="dialog" aria-modal="true" aria-labelledby="pro-title"><button className="modal-close icon-btn" onClick={() => setProOpen(false)} aria-label="Close"><X size={20}/></button><div className="pro-crown"><Crown size={28}/></div><span className="eyebrow">A LITTLE MORE DOXIA</span><h2 id="pro-title">{isPro ? "You’re Pro." : <>Your signal.<br/>Your rules.</>}</h2><p className="pro-lead">{isPro ? "Lifetime Doxia Pro access is active on this account." : "One payment. Lifetime Pro access, after verified checkout."}</p><div className="price"><strong>£11.99</strong><span>one-time · lifetime</span></div><ul className="pro-benefits"><li><Check size={16}/> Long-form Drops up to 1,000 characters</li><li><Check size={16}/> Pro badge on your profile</li><li><Check size={16}/> Lifetime Pro status on this account</li><li><Check size={16}/> Support the independent build</li></ul>{!isPro && <button className="primary-btn full-btn" onClick={() => void startCheckout()}>Continue to checkout <ArrowUpRight size={16}/></button>}<p className="demo-warning">Checkout requires configured Stripe credentials and a verified price. Lifetime access is granted only after a verified server webhook; review tax and refund terms before launch.</p></section></div>}
    </main>
  );
}
