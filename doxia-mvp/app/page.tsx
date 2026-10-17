"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight, Boxes, Check, ChevronDown, Compass, Crown, Flame, Home, Leaf, LockKeyhole, Plus,
  Radio, Search, Send, Settings, Shield, Sparkles, Target, TrendingUp, Wallet, X, Zap
} from "lucide-react";
import DropCard from "@/components/DropCard";
import SignalBoard from "@/components/SignalBoard";
import ProjectsView from "@/components/ProjectsView";
import ReputationPanel from "@/components/ReputationPanel";
import WalletPicker from "@/components/WalletPicker";
import DogeWalletPanel from "@/components/DogeWalletPanel";
import { apiJson, goToLogin, MAIN_SIGNAL_SLUG, mapDrop, share, TOPICS, trendPath, type ApiDrop, type Drop, type SignalTopic, type Visibility, type Vote } from "@/components/types";

type Tab = "Home" | "Drops" | "Signal" | "Projects" | "Impact";
type Mission = { id: string; slug: string; title: string; description: string; points: number; completed: boolean };
type Trend = { topic: string; drops: number };
type ProjectOption = { slug: string; name: string };
type Sort = "latest" | "trending";

const PAGE_SIZE = 20;
const MISSION_STYLE: Record<string, { icon: string; tag: string }> = {
  "open-source-builder": { icon: "🌱", tag: "OPEN SOURCE" },
  "privacy-practice": { icon: "🛡️", tag: "PRIVACY" },
  "welcome-a-voice": { icon: "🤝", tag: "COMMUNITY" },
  "doge-native-vs-wrapped": { icon: "🐕", tag: "$DOGE · LEARN" },
  "doge-community-resource": { icon: "📚", tag: "$DOGE · COMMUNITY" },
};
const LOCAL_SAVED_KEY = "doxia-saved-drops";
const nav: { label: Tab; icon: typeof Home }[] = [
  { label: "Home", icon: Home }, { label: "Drops", icon: Compass }, { label: "Signal", icon: Radio }, { label: "Projects", icon: Boxes }, { label: "Impact", icon: Leaf },
];
const HEADINGS: Record<Tab, [string, string]> = {
  Home: ["Your signal, unfiltered.", "Ideas worth sharing. People worth finding."],
  Drops: ["The Drop zone.", "Short thoughts. Lasting ripples."],
  Signal: ["Read the room.", "Community sentiment, without the noise."],
  Projects: ["Projects.", "Community Drops and Signal for the networks people talk about."],
  Impact: ["Make it matter.", "Small actions. Real-world impact."],
};

export default function Page() {
  const [tab, setTab] = useState<Tab>("Home");
  const [drops, setDrops] = useState<Drop[]>([]);
  const [sharedDrop, setSharedDrop] = useState<Drop | null>(null);
  const [feedCursor, setFeedCursor] = useState<string | null>(null);
  const [feedLoading, setFeedLoading] = useState(true);
  const [feedError, setFeedError] = useState("");
  const [feedTopic, setFeedTopic] = useState<string | null>(null);
  const [feedSort, setFeedSort] = useState<Sort>("latest");
  const [search, setSearch] = useState("");
  const [feedQuery, setFeedQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [draftTopic, setDraftTopic] = useState("Community");
  const [draftVisibility, setDraftVisibility] = useState<Visibility>("public");
  const [draftProject, setDraftProject] = useState("");
  const [composerOpen, setComposerOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [proOpen, setProOpen] = useState(false);
  const [walletOpen, setWalletOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [handle, setHandle] = useState("");
  const [bio, setBio] = useState("");
  const [showInRankings, setShowInRankings] = useState(true);
  const [savedDrops, setSavedDrops] = useState<string[]>([]);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [backendConfigured, setBackendConfigured] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [signalTopics, setSignalTopics] = useState<SignalTopic[]>([]);
  const [signalGeneratedAt, setSignalGeneratedAt] = useState<string | null>(null);
  const [dogeWalletEnabled, setDogeWalletEnabled] = useState(false);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [trending, setTrending] = useState<Trend[]>([]);
  const [projectOptions, setProjectOptions] = useState<ProjectOption[]>([]);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isPro, setIsPro] = useState(false);
  const [selectedDrop, setSelectedDrop] = useState<Drop | null>(null);
  const [reportReason, setReportReason] = useState('spam');
  const [reportDetails, setReportDetails] = useState('');
  const [editingDropId, setEditingDropId] = useState<string | null>(null);

  const bumpCommunity = () => setRefreshKey(k => k + 1);

  useEffect(() => {
    let subscription: { unsubscribe: () => void } | undefined;
    async function initAuth() {
      try {
        const health = await fetch('/api/health', { cache: 'no-store' }).then(r => r.json());
        setBackendConfigured(Boolean(health.backendConfigured));
        setDogeWalletEnabled(Boolean(health.features?.dogeWallet));
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

  // Debounce search; the server searches all public Drops, not just the loaded page.
  useEffect(() => {
    const timer = window.setTimeout(() => setFeedQuery(search.trim().length >= 2 ? search.trim() : ""), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (authLoading) return;
    void loadFeed(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isSignedIn, feedTopic, feedSort, feedQuery]);

  useEffect(() => {
    if (authLoading) return;
    void loadCommunity();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isSignedIn, refreshKey]);

  useEffect(() => {
    apiJson<{ projects: ProjectOption[] }>('/api/projects').then(p => setProjectOptions(p.projects.map(({ slug, name }) => ({ slug, name })))).catch(() => setProjectOptions([]));
  }, []);

  useEffect(() => {
    if (authLoading) return;
    const params = new URLSearchParams(window.location.search);
    const project = params.get('project');
    if (project && /^[a-z0-9-]{2,40}$/.test(project)) { setSelectedProject(project); setTab('Projects'); }
    const target = params.get('drop');
    if (!target) return;
    let cancelled = false;
    apiJson<{ drop: ApiDrop }>(`/api/drops/${encodeURIComponent(target)}`).then(payload => {
      if (cancelled) return;
      setSharedDrop(mapDrop(payload.drop)); setTab('Drops');
    }).catch(() => { /* the feed still loads if a shared link is unavailable */ });
    return () => { cancelled = true; };
  }, [authLoading, isSignedIn]);

  useEffect(() => {
    if (authLoading) return;
    if (!isSignedIn) {
      setDisplayName(""); setHandle(""); setBio(""); setWalletAddress(null); setIsPro(false); setShowInRankings(true);
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
          if (payload.profile) { setDisplayName(payload.profile.display_name); setHandle('@' + payload.profile.handle); setBio(payload.profile.bio); setShowInRankings(payload.profile.show_in_rankings !== false); }
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
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), sort: feedSort });
      if (!reset && feedCursor) params.set('before', feedCursor);
      if (feedTopic) params.set('topic', feedTopic);
      if (feedQuery) params.set('q', feedQuery);
      const payload = await apiJson<{ drops: ApiDrop[]; nextCursor: string | null }>(`/api/drops?${params}`);
      const page = payload.drops.map(mapDrop);
      setDrops(ds => reset ? page : [...ds, ...page.filter(d => !ds.some(existing => existing.id === d.id))]);
      setFeedCursor(payload.nextCursor ?? null); setFeedError('');
    } catch (error) { setFeedError(error instanceof Error ? error.message : 'Could not load Drops.'); }
    finally { setFeedLoading(false); }
  }

  async function loadCommunity() {
    try {
      const [signal, missionPayload, trendingPayload] = await Promise.all([
        apiJson<{ topics: SignalTopic[]; generated_at: string }>('/api/signal'), apiJson<{ missions: Mission[] }>('/api/missions'), apiJson<{ topics: Trend[] }>('/api/trending'),
      ]);
      setSignalTopics(signal.topics); setSignalGeneratedAt(signal.generated_at ?? null); setMissions(missionPayload.missions); setTrending(trendingPayload.topics);
    } catch { /* community panels show their empty states */ }
  }

  function updateDrop(id: string, change: (d: Drop) => Drop) {
    setDrops(ds => ds.map(d => d.id === id ? change(d) : d));
    setSharedDrop(d => d && d.id === id ? change(d) : d);
    setSelectedDrop(d => d && d.id === id ? change(d) : d);
  }

  const visibleDrops = useMemo(() => sharedDrop && !feedQuery && !feedTopic ? [sharedDrop, ...drops.filter(d => d.id !== sharedDrop.id)] : drops, [drops, sharedDrop, feedQuery, feedTopic]);
  const mainTopic = signalTopics.find(t => t.slug === MAIN_SIGNAL_SLUG) ?? null;
  const mainTrend = mainTopic ? trendPath(mainTopic.history.slice(-7)) : null;
  const completedMissions = missions.filter(m => m.completed);
  const isOwnDrop = (d?: Drop | null) => Boolean(d && userId && d.authorId === userId);

  function openComposer(projectSlug = "") {
    if (!isSignedIn) { goToLogin(); return; }
    setEditingDropId(null); setDraft(""); setDraftTopic("Community"); setDraftVisibility("public"); setDraftProject(projectSlug); setComposerOpen(true);
  }
  function openProfile() {
    if (!isSignedIn) { goToLogin(); return; }
    setProfileOpen(true);
  }

  async function publishDrop() {
    const text = draft.trim();
    if (!text || !isSignedIn) return;
    if (editingDropId) {
      try { await apiJson(`/api/drops/${editingDropId}`, { method: 'PATCH', body: JSON.stringify({ body: text }) }); }
      catch (error) { alert(error instanceof Error ? error.message : 'Could not update Drop.'); return; }
      updateDrop(editingDropId, d => ({ ...d, text }));
    } else {
      try {
        const payload = await apiJson<{ drop: ApiDrop }>('/api/drops', { method: 'POST', body: JSON.stringify({ body: text, topic: draftTopic, visibility: draftVisibility, project: draftProject || undefined }) });
        const created = mapDrop(payload.drop);
        if (created.visibility === 'unlisted') {
          setSharedDrop(created);
          const url = `${window.location.origin}/?drop=${created.id}`;
          try { await navigator.clipboard.writeText(url); alert('Unlisted Drop published. Its link has been copied — only people with the link can see it.'); }
          catch { alert(`Unlisted Drop published. Share this link: ${url}`); }
        } else if (!feedQuery && (!feedTopic || feedTopic === created.tag) && feedSort === 'latest') {
          setDrops(ds => [created, ...ds]);
        }
      } catch (error) { alert(error instanceof Error ? error.message : 'Could not publish Drop.'); return; }
    }
    setDraft(""); setEditingDropId(null); setComposerOpen(false);
    if (tab !== "Projects") setTab("Drops");
    bumpCommunity();
  }

  function editSelectedDrop() {
    if (!selectedDrop) return;
    setDraft(selectedDrop.text); setEditingDropId(selectedDrop.id); setSelectedDrop(null); setComposerOpen(true);
  }

  async function deleteSelectedDrop() {
    if (!selectedDrop) return;
    if (!window.confirm('Delete this Drop permanently? This cannot be undone.')) return;
    try { await apiJson(`/api/drops/${selectedDrop.id}`, { method: 'DELETE' }); }
    catch (error) { alert(error instanceof Error ? error.message : 'Could not delete Drop.'); return; }
    const id = selectedDrop.id;
    setDrops(ds => ds.filter(d => d.id !== id));
    setSharedDrop(d => d?.id === id ? null : d);
    setSelectedDrop(null); bumpCommunity();
  }

  async function unlinkWallet() {
    try { await apiJson('/api/wallet', { method: 'DELETE' }); setWalletAddress(null); bumpCommunity(); }
    catch (e) { alert(e instanceof Error ? e.message : 'Could not unlink wallet.'); }
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
    if (!window.confirm('Permanently delete your Doxia account, profile, Drops, replies, votes, wallet link and Pro access? This cannot be undone, and account deletion does not automatically refund a purchase.')) return;
    if (!window.confirm('Final confirmation: delete this account now?')) return;
    try {
      await apiJson('/api/account', { method: 'DELETE', body: JSON.stringify({ confirm: 'DELETE' }) });
      const { createClient } = await import('@/lib/supabase/browser');
      await createClient().auth.signOut();
      setProfileOpen(false); setIsSignedIn(false);
      window.location.href = '/';
    } catch (error) { alert(error instanceof Error ? error.message : 'Could not delete account.'); }
  }

  async function saveProfile() {
    try {
      const payload = await apiJson<{ profile: { display_name: string; handle: string; bio: string; show_in_rankings: boolean } }>('/api/profile', { method: 'PATCH', body: JSON.stringify({ display_name: displayName, handle, bio, show_in_rankings: showInRankings }) });
      const nextHandle = '@' + payload.profile.handle;
      setDisplayName(payload.profile.display_name); setHandle(nextHandle); setBio(payload.profile.bio); setShowInRankings(payload.profile.show_in_rankings);
      const mine = (d: Drop) => d.authorId === userId ? { ...d, author: payload.profile.display_name, handle: nextHandle } : d;
      setDrops(ds => ds.map(mine)); setSharedDrop(d => d && mine(d));
    } catch (error) { alert(error instanceof Error ? error.message : 'Could not save profile.'); return; }
    setProfileOpen(false); bumpCommunity();
  }

  async function castVote(slug: string, choice: Vote) {
    if (!isSignedIn) { goToLogin(); return; }
    try {
      await apiJson(`/api/signal/${slug}/vote`, { method: 'PUT', body: JSON.stringify({ choice }) });
      bumpCommunity();
    } catch (error) { alert(error instanceof Error ? error.message : 'Could not save vote.'); }
  }

  async function completeMission(slug: string) {
    if (!isSignedIn) { goToLogin(); return; }
    if (missions.some(m => m.slug === slug && m.completed)) return;
    try {
      await apiJson(`/api/missions/${slug}/complete`, { method: 'POST' });
      setMissions(ms => ms.map(m => m.slug === slug ? { ...m, completed: true } : m)); bumpCommunity();
    } catch (error) { alert(error instanceof Error ? error.message : 'Could not update mission.'); }
  }

  async function startCheckout() {
    if (!isSignedIn) { goToLogin(); return; }
    try {
      const payload = await apiJson<{ url: string }>('/api/billing/checkout', { method: 'POST' });
      window.location.href = payload.url;
    } catch (error) { alert(error instanceof Error ? error.message : 'Checkout is not available.'); }
  }

  async function toggleLike(drop: Drop, update: (id: string, change: (d: Drop) => Drop) => void) {
    if (!isSignedIn) { goToLogin(); return; }
    try { await apiJson(`/api/drops/${drop.id}/reactions`, { method: drop.liked ? 'DELETE' : 'POST' }); }
    catch (error) { alert(error instanceof Error ? error.message : 'Could not update reaction.'); return; }
    const change = (d: Drop) => ({ ...d, liked: !drop.liked, likes: Math.max(0, d.likes + (drop.liked ? -1 : 1)) });
    update(drop.id, change); if (update !== updateDrop) updateDrop(drop.id, change);
  }

  async function toggleBookmark(id: string) {
    const currentlySaved = savedDrops.includes(id);
    const next = currentlySaved ? savedDrops.filter(dropId => dropId !== id) : [...savedDrops, id];
    if (isSignedIn) {
      try { await apiJson(`/api/drops/${id}/bookmark`, { method: currentlySaved ? 'DELETE' : 'POST' }); }
      catch (error) { alert(error instanceof Error ? error.message : 'Could not update saved Drop.'); return; }
    } else {
      // Signed-out bookmarks stay in this browser only.
      try { localStorage.setItem(LOCAL_SAVED_KEY, JSON.stringify(next)); } catch { /* storage is optional */ }
    }
    setSavedDrops(next);
  }

  async function submitReport() {
    if (!isSignedIn) { goToLogin(); return; }
    if (!selectedDrop) return;
    try {
      await apiJson('/api/reports', { method: 'POST', body: JSON.stringify({ drop_id: selectedDrop.id, reason: reportReason, details: reportDetails }) });
      setSelectedDrop(null); setReportDetails(''); alert('Report submitted. Thank you for helping keep Doxia safer.');
    } catch (error) { alert(error instanceof Error ? error.message : 'Could not submit report.'); }
  }

  async function shareDrop(d: Drop) {
    const url = `${window.location.origin}/?drop=${d.id}`;
    try {
      if (navigator.share) await navigator.share({ title: "Doxia Drop", text: d.text, url });
      else { await navigator.clipboard.writeText(url); alert("Drop link copied."); }
    } catch { /* user cancelled native share */ }
  }

  function renderDrop(d: Drop, update: (id: string, change: (d: Drop) => Drop) => void = updateDrop) {
    return <DropCard key={d.id} drop={d} userId={userId} isSignedIn={isSignedIn} isPro={isPro} saved={savedDrops.includes(d.id)}
      onLike={() => void toggleLike(d, update)} onBookmark={() => void toggleBookmark(d.id)} onShare={() => void shareDrop(d)}
      onMore={() => { setSelectedDrop(d); setReportReason("spam"); }}
      onReplyCount={delta => { const change = (x: Drop) => ({ ...x, replies: Math.max(0, x.replies + delta) }); update(d.id, change); if (update !== updateDrop) updateDrop(d.id, change); }}
      onProject={slug => { setSelectedProject(slug); setTab("Projects"); }}/>;
  }

  const initial = (displayName || "?").slice(0, 1).toUpperCase();
  const trendingList = trending.length
    ? trending.map((t, i) => <button className="trend-item" key={t.topic} onClick={() => { setFeedTopic(TOPICS.includes(t.topic) ? t.topic : null); if (!TOPICS.includes(t.topic)) setSearch(t.topic); setTab("Drops"); }}><span className="trend-rank">0{i + 1}</span><span><small>TOPIC</small><strong>{t.topic}</strong><em>{t.drops} {t.drops === 1 ? "Drop" : "Drops"} this week</em></span><ArrowUpRight size={15}/></button>)
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
          {nav.map(({ label, icon: Icon }) => <button key={label} className={`nav-item ${tab === label ? "active" : ""}`} onClick={() => { setTab(label); if (label === "Projects") setSelectedProject(null); }}><Icon size={19}/><span>{label}</span>{label === "Signal" && <span className="nav-pill">LIVE</span>}</button>)}
        </nav>
        <button className="primary-btn compose-side" onClick={() => openComposer()}><Plus size={18}/> {isSignedIn ? "Create a Drop" : "Sign in to post"}</button>
        <div className="sidebar-bottom">
          <div className="privacy-note"><LockKeyhole size={16}/><span>Your identity. Your terms.</span></div>
          <button className="pro-card" onClick={() => setProOpen(true)}><span className="pro-icon"><Crown size={18}/></span><span><strong>{isPro ? "Doxia Pro active" : "Unlock Doxia Pro"}</strong><small>{isPro ? "Lifetime access enabled." : "Own your signal."}</small></span><ArrowUpRight size={17}/></button>
          <div className="sidebar-foot"><span className="status-dot"/> Early access <span>·</span> v0.3</div>
        </div>
      </aside>

      <section className="main-column">
        <header className="topbar">
          <div className="mobile-brand"><span className="brand-mark">d</span><strong>doxia<span className="brand-dot">.</span></strong></div>
          <div className="search-box"><Search size={17}/><input value={search} onChange={e => { setSearch(e.target.value); if (tab !== "Drops" && tab !== "Home") setTab("Drops"); }} placeholder="Search Drops, people, projects…" aria-label="Search"/></div>
          <div className="top-actions">{isSignedIn
            ? <><button className="wallet-btn" onClick={() => walletAddress ? void unlinkWallet() : setWalletOpen(true)}><Wallet size={17}/>{walletAddress ? 'Unlink wallet' : 'Link wallet'}</button><button className="signout-btn" onClick={() => void signOut()}>Sign out</button></>
            : <button className="wallet-btn" onClick={goToLogin} disabled={authLoading}><Wallet size={17}/>{authLoading ? 'Checking…' : 'Sign in'}</button>}</div>
        </header>

        <div className="mobile-nav">{nav.map(({label, icon: Icon}) => <button key={label} className={tab === label ? "selected" : ""} onClick={() => { setTab(label); if (label === "Projects") setSelectedProject(null); }}><Icon size={17}/>{label}</button>)}</div>
        <div className="content">
          <div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-dot"/> {isSignedIn ? 'SIGNED IN' : backendConfigured ? 'SIGN IN TO POST, VOTE AND SAVE' : 'COMMUNITY SERVICE UNAVAILABLE'}</div><h1>{HEADINGS[tab][0]}</h1><p>{HEADINGS[tab][1]}</p></div><button className="round-action" aria-label="Create Drop" onClick={() => openComposer()}><Plus size={21}/></button></div>

          {tab === "Home" && (isSignedIn
            ? <div className="welcome-strip"><div className="welcome-icon"><Sparkles size={19}/></div><div><strong>Welcome back, {displayName || "friend"}.</strong><p>Your identity is yours. Your signal is yours to share.</p></div><button onClick={openProfile}>Edit profile <ArrowUpRight size={14}/></button></div>
            : <div className="welcome-strip"><div className="welcome-icon"><Sparkles size={19}/></div><div><strong>Join the conversation.</strong><p>Sign in with your email to post Drops, reply, vote in Signal and build your reputation.</p></div><button onClick={goToLogin}>Sign in <ArrowUpRight size={14}/></button></div>)}

          {(tab === "Home" || tab === "Drops") && <>
            <div className="section-row"><div className="section-title"><Flame size={17}/><strong>{feedQuery ? `Results for “${feedQuery}”` : tab === "Home" ? "The current" : "Latest Drops"}</strong><span className="live-label">LIVE FEED</span></div>
              <div className="filter-row"><button className={`chip ${feedSort === "latest" ? "active" : ""}`} onClick={() => setFeedSort("latest")}>Latest</button><button className={`chip ${feedSort === "trending" ? "active" : ""}`} onClick={() => setFeedSort("trending")}><TrendingUp size={11}/> Trending</button></div></div>
            {tab === "Drops" && <div className="filter-row" role="group" aria-label="Filter by topic"><button className={`chip ${!feedTopic ? "active" : ""}`} onClick={() => setFeedTopic(null)}>All topics</button>{TOPICS.map(t => <button key={t} className={`chip ${feedTopic === t ? "active" : ""}`} onClick={() => setFeedTopic(feedTopic === t ? null : t)}>#{t}</button>)}</div>}
            {feedQuery && feedSort === "trending" && <p className="feed-status">Search results are shown newest first.</p>}
            {tab === "Home" && <button className="composer-launch" onClick={() => openComposer()}><div className="avatar avatar-lime">{initial}</div><span>{isSignedIn ? "What’s on your mind?" : "Sign in to share a Drop"}</span><span className="composer-plus"><Plus size={17}/></span></button>}
            <div className="feed-list">{visibleDrops.map(d => renderDrop(d))}
              {!feedLoading && !feedError && visibleDrops.length === 0 && <div className="empty-state"><Search size={24}/><strong>{feedQuery || feedTopic ? "No Drops found" : "No Drops yet"}</strong><span>{feedQuery || feedTopic ? "Try another search or topic." : isSignedIn ? "Be the first to share something." : "Sign in to share the first one."}</span></div>}
              {feedError && <p className="feed-status">{feedError} <button className="text-btn" onClick={() => void loadFeed(true)}>Retry</button></p>}
              {feedLoading && <p className="feed-status">Loading Drops…</p>}
            </div>
            {feedCursor && !feedLoading && <div className="load-more"><button className="text-btn" onClick={() => void loadFeed(false)}>Load more Drops <ChevronDown size={14}/></button></div>}
          </>}

          {tab === "Signal" && <SignalBoard topics={signalTopics} isSignedIn={isSignedIn} generatedAt={signalGeneratedAt} onVote={(slug, choice) => void castVote(slug, choice)}/>}

          {tab === "Projects" && <ProjectsView selected={selectedProject} onSelect={setSelectedProject} isSignedIn={isSignedIn} onVote={(slug, choice) => void castVote(slug, choice)} renderDrop={renderDrop} onPost={slug => openComposer(slug)} refreshKey={refreshKey}/>}

          {tab === "Impact" && <div className="impact-view">
            <ReputationPanel isSignedIn={isSignedIn} refreshKey={refreshKey} showInRankings={showInRankings}/>
            <div className="impact-banner"><div><span className="eyebrow">THE IMPACT BOARD</span><h2>Turn conviction into action.</h2><p>Choose a mission. Make a little progress. Bring others along.</p></div><div className="impact-art"><Target size={54}/></div></div>
            <div className="impact-stats"><div><strong>{completedMissions.length}</strong><span>Missions completed</span></div><div><strong>{completedMissions.reduce((sum, m) => sum + m.points, 0)}</strong><span>Mission points</span></div><div><strong>{missions.length - completedMissions.length}</strong><span>Open missions</span></div></div>
            <div className="section-row"><div className="section-title"><Leaf size={17}/><strong>Community missions</strong></div><span className="muted small">{isSignedIn ? "SAVED TO YOUR ACCOUNT" : "SIGN IN TO TRACK"}</span></div>
            <div className="mission-list">{missions.map(m => { const style = MISSION_STYLE[m.slug] ?? { icon: "✨", tag: "MISSION" }; return <article className="mission-card" key={m.id}><div className="mission-emoji">{style.icon}</div><div className="mission-copy"><span className="mission-tag">{style.tag}</span><h3>{m.title}</h3><p>{m.description}</p><span className="mission-points"><Zap size={13}/>{m.points} impact points</span></div><button className={m.completed ? "mission-done" : "mission-cta"} disabled={m.completed} onClick={() => void completeMission(m.slug)}>{m.completed ? <><Check size={16}/> Done</> : "Mark done"}</button></article>; })}{missions.length === 0 && <div className="empty-state"><Leaf size={24}/><strong>No missions right now</strong><span>Check back soon.</span></div>}</div>
            <p className="fine-print">Points and reputation are app progress only; no token, donation or financial reward is issued.</p>
          </div>}

          <footer className="main-footer"><span>© 2026 Doxia</span><span><Shield size={13}/> Privacy by design, still in progress</span><span className="footer-links"><a href="/guidelines">Guidelines</a><a href="/developers">Developer API</a><button onClick={() => alert("Privacy policy and terms should be added before public beta.")}>Privacy & terms</button></span></footer>
        </div>
      </section>

      <aside className="right-column">
        <div className="right-top"><button className="icon-btn" aria-label="Explore Drops" onClick={() => setTab("Drops")}><Compass size={18}/></button><button className="profile-trigger" onClick={openProfile} aria-label={isSignedIn ? "Edit profile" : "Sign in"}><div className="avatar avatar-lime">{initial}</div><ChevronDown size={14}/></button></div>
        <div className="right-card signal-card"><div className="right-card-heading"><div><span className="eyebrow">SIGNAL SNAPSHOT</span><h3>Privacy web</h3></div><span className="mini-pulse"><i/></span></div><div className="big-score">{mainTopic?.total ? <>{share(mainTopic.bullish, mainTopic.total)}<span>%</span></> : "—"}</div><div className="score-caption">Positive signal {mainTrend && <span>{mainTrend.delta >= 0 ? "↑" : "↓"} {Math.abs(mainTrend.delta)} pts this week</span>}</div><div className="mini-chart">{mainTrend ? <svg viewBox="0 0 260 60" preserveAspectRatio="none" aria-label="Share of positive votes over the last 7 days"><path d={mainTrend.path} fill="none" stroke="#b7f779" strokeWidth="2.5" strokeLinecap="round"/></svg> : <div className="chart-empty">Trend appears after votes on 2+ days</div>}</div><div className="chart-bottom"><span>7-DAY TREND</span><span>{mainTopic?.total ?? 0} {mainTopic?.total === 1 ? "VOTE" : "VOTES"}</span></div></div>
        <div className="right-card"><div className="right-card-heading"><h3>Trending topics</h3><span className="live-label">7 DAYS</span></div>{trendingList}<button className="see-all" onClick={() => setTab("Signal")}>Explore Signal <ArrowUpRight size={14}/></button></div>
        <div className="right-card mission-teaser"><div className="mission-teaser-icon"><Leaf size={18}/></div><span className="eyebrow">IMPACT</span><h3>Contribution over clout.</h3><p>Earn reputation, badges and streaks for Drops, replies, Signal and missions.</p><button className="text-btn" onClick={() => setTab("Impact")}>See rankings <ArrowUpRight size={14}/></button></div>
        <div className="right-foot"><a href="/developers">Developers</a><a href="/guidelines">Guidelines</a><span>Help</span><p>Identity. Signal. Impact.</p></div>
      </aside>

      {selectedDrop && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setSelectedDrop(null); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="report-title"><div className="modal-head"><div><span className="eyebrow">COMMUNITY SAFETY</span><h2 id="report-title">{isOwnDrop(selectedDrop) ? "Manage your Drop." : "Report this Drop."}</h2></div><button className="icon-btn" onClick={() => setSelectedDrop(null)} aria-label="Close"><X size={20}/></button></div>{isOwnDrop(selectedDrop) ? <><p className="muted">Manage the Drop you published.</p><button className="primary-btn full-btn" onClick={editSelectedDrop}>Edit Drop</button><button className="danger-btn full-btn" onClick={() => void deleteSelectedDrop()}>Delete Drop permanently</button></> : <><label className="field-label">Reason<select value={reportReason} onChange={e => setReportReason(e.target.value)}><option value="spam">Spam</option><option value="harassment">Harassment</option><option value="impersonation">Impersonation</option><option value="illegal">Illegal content</option><option value="other">Other</option></select></label><label className="field-label">Additional details (optional)<textarea value={reportDetails} maxLength={1000} onChange={e => setReportDetails(e.target.value)} placeholder="Help the moderation team understand the issue." /></label><p className="demo-warning">Reports are reviewed by the Doxia team. Do not use this for emergencies.</p><button className="primary-btn full-btn" onClick={() => void submitReport()}>{isSignedIn ? "Submit report" : "Sign in to report"}</button></>}</section></div>}

      {composerOpen && <div className="modal-backdrop" onMouseDown={e => {if(e.target === e.currentTarget) { setComposerOpen(false); setEditingDropId(null); setDraft(""); }}}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="compose-title"><div className="modal-head"><div><span className="eyebrow">CREATE SOMETHING</span><h2 id="compose-title">{editingDropId ? "Edit your Drop." : "Drop a thought."}</h2></div><button className="icon-btn" onClick={() => { setComposerOpen(false); setEditingDropId(null); setDraft(""); }} aria-label="Close"><X size={20}/></button></div><div className="compose-author"><div className="avatar avatar-lime">{initial}</div><div><strong>{displayName}</strong><span>{handle} · {editingDropId ? "Editing" : draftVisibility === "public" ? "Public Drop" : "Unlisted Drop"}</span></div></div><textarea autoFocus maxLength={isPro ? 1000 : 500} value={draft} onChange={e => setDraft(e.target.value)} placeholder="What do you want the world to hear?" />{!editingDropId && <div className="compose-options"><label className="field-label">Topic<select value={draftTopic} onChange={e => setDraftTopic(e.target.value)}>{TOPICS.map(t => <option key={t} value={t}>{t}</option>)}</select></label><label className="field-label">Project (optional)<select value={draftProject} onChange={e => setDraftProject(e.target.value)}><option value="">None</option>{projectOptions.map(p => <option key={p.slug} value={p.slug}>{p.name}</option>)}</select></label><label className="field-label">Who can see it<select value={draftVisibility} onChange={e => setDraftVisibility(e.target.value === "unlisted" ? "unlisted" : "public")}><option value="public">Public — in the feed</option><option value="unlisted">Unlisted — link only</option></select></label></div>}<div className="compose-foot"><span>{draft.length}/{isPro ? 1000 : 500} · Be thoughtful. Be you.</span><button className="primary-btn" disabled={!draft.trim()} onClick={() => void publishDrop()}><Send size={16}/> {editingDropId ? "Save changes" : "Publish Drop"}</button></div><p className="demo-warning">{editingDropId ? "Changes update this Drop for everyone who can see it." : draftVisibility === "public" ? "Public Drops appear in the community feed." : "Unlisted Drops stay out of the feed; anyone with the link can view them."}</p></section></div>}

      {profileOpen && <div className="modal-backdrop" onMouseDown={e => {if(e.target === e.currentTarget) setProfileOpen(false)}}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="profile-title"><div className="modal-head"><div><span className="eyebrow">YOUR IDENTITY</span><h2 id="profile-title">Make it yours.</h2></div><button className="icon-btn" onClick={() => setProfileOpen(false)} aria-label="Close"><X size={20}/></button></div><label className="field-label">Display name<input value={displayName} maxLength={32} onChange={e => setDisplayName(e.target.value)} /></label><label className="field-label">Handle<input value={handle} maxLength={25} onChange={e => setHandle(e.target.value.startsWith("@") ? e.target.value : "@"+e.target.value)} /></label><label className="field-label">Bio<textarea value={bio} maxLength={160} onChange={e => setBio(e.target.value)} /></label><label className="toggle-row"><span>Show me in contributor rankings and show my reputation and badges on my public profile</span><input type="checkbox" checked={showInRankings} onChange={e => setShowInRankings(e.target.checked)} /></label><div className="privacy-callout"><LockKeyhole size={17}/><span>Your display name, handle, bio and public Drops are public. Your email, wallet address and individual votes stay private.</span></div><div className="account-links"><a className="text-btn" href={`/u/${handle.replace(/^@/, "")}`}>View public profile <ArrowUpRight size={12}/></a><a className="text-btn" href="/api/account/export" download>Download my data <ArrowUpRight size={12}/></a>{walletAddress && <span className="text-btn">Wallet linked: {walletAddress.slice(0, 6)}…{walletAddress.slice(-4)} (private)</span>}</div>{dogeWalletEnabled && <DogeWalletPanel/>}<button className="primary-btn full-btn" onClick={() => void saveProfile()}><Check size={16}/> Save profile</button><button className="danger-btn full-btn" onClick={() => void deleteAccount()}>Delete account permanently</button></section></div>}

      {walletOpen && <WalletPicker onClose={() => setWalletOpen(false)} onLinked={address => { setWalletAddress(address); setWalletOpen(false); bumpCommunity(); }}/>}

      {proOpen && <div className="modal-backdrop" onMouseDown={e => {if(e.target === e.currentTarget) setProOpen(false)}}><section className="modal pro-modal" role="dialog" aria-modal="true" aria-labelledby="pro-title"><button className="modal-close icon-btn" onClick={() => setProOpen(false)} aria-label="Close"><X size={20}/></button><div className="pro-crown"><Crown size={28}/></div><span className="eyebrow">A LITTLE MORE DOXIA</span><h2 id="pro-title">{isPro ? "You’re Pro." : <>Your signal.<br/>Your rules.</>}</h2><p className="pro-lead">{isPro ? "Lifetime Doxia Pro access is active on this account." : "One payment. Lifetime Pro access, after verified checkout."}</p><div className="price"><strong>£11.99</strong><span>one-time · lifetime</span></div><ul className="pro-benefits"><li><Check size={16}/> Long-form Drops up to 1,000 characters</li><li><Check size={16}/> Pro badge and Supporter badge</li><li><Check size={16}/> Lifetime Pro status on this account</li><li><Check size={16}/> Support the independent build</li></ul>{!isPro && <button className="primary-btn full-btn" onClick={() => void startCheckout()}>{isSignedIn ? "Continue to checkout" : "Sign in to upgrade"} <ArrowUpRight size={16}/></button>}<p className="demo-warning">Secure checkout by Stripe. Pro is activated on your account once payment is confirmed. Core Drops, Signal and Impact stay free.</p></section></div>}
    </main>
  );
}
