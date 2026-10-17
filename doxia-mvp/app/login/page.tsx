'use client';
import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/browser';
import './login.css';

const RESEND_SECONDS = 60;
const LINK_ERRORS: Record<string, string> = {
  auth_confirm: 'That sign-in link is invalid or has already been used. Request a new one below.',
  auth_callback: 'That sign-in link could not be completed. Request a new one below.',
};

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState('');
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('error');
    if (code && LINK_ERRORS[code]) setMessage(LINK_ERRORS[code]);
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    // Each request issues a new link and invalidates the previous one, so never send while one is in flight or cooling down.
    if (busy || cooldown > 0) return;
    setMessage(''); setBusy(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: `${window.location.origin}/auth/callback` } });
      if (error) {
        if (error.status === 429) throw new Error('Too many sign-in emails were requested. Please wait a few minutes, then try again.');
        throw error;
      }
      setSentTo(email.trim()); setCooldown(RESEND_SECONDS);
    } catch (err) { setMessage(err instanceof Error ? err.message : 'Could not send sign-in link.'); }
    finally { setBusy(false); }
  }

  return <main className="login-wrap"><Link className="login-brand" href="/">doxia<span>.</span></Link><section className="login-card"><span className="login-eyebrow">YOUR IDENTITY, YOUR TERMS</span><h1>Sign in to Doxia.</h1>{sentTo
    ? <><p>We sent a sign-in link to <strong>{sentTo}</strong>. Open it on any device to finish signing in. Only the newest link works.</p><form onSubmit={submit}><button disabled={busy || cooldown > 0}>{cooldown > 0 ? `Resend available in ${cooldown}s` : busy ? 'Sending link…' : 'Resend link'}</button><button type="button" className="login-secondary" onClick={() => { setSentTo(''); setMessage(''); }}>Use a different email</button></form></>
    : <><p>We’ll email you a one-time link. No password required.</p><form onSubmit={submit}><label htmlFor="email">Email address</label><input id="email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com"/><button disabled={busy || cooldown > 0}>{busy ? 'Sending link…' : 'Email me a sign-in link'}</button></form></>}
    {message && <p role="status" className="login-message">{message}</p>}<small>By continuing, you agree to use Doxia respectfully. Terms and privacy policy must be published before public launch.</small></section><Link className="login-back" href="/">← Back to Doxia</Link></main>;
}
