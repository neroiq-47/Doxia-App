'use client';
import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/browser';
import './login.css';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault(); setMessage(''); setBusy(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: `${window.location.origin}/auth/callback` } });
      if (error) throw error;
      setMessage('Check your email for your secure sign-in link.');
    } catch (err) { setMessage(err instanceof Error ? err.message : 'Could not send sign-in link.'); }
    finally { setBusy(false); }
  }
  return <main className="login-wrap"><Link className="login-brand" href="/">doxia<span>.</span></Link><section className="login-card"><span className="login-eyebrow">YOUR IDENTITY, YOUR TERMS</span><h1>Sign in to Doxia.</h1><p>We’ll email you a one-time link. No password required.</p><form onSubmit={submit}><label htmlFor="email">Email address</label><input id="email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com"/><button disabled={busy}>{busy ? 'Sending link…' : 'Email me a sign-in link'}</button></form>{message && <p role="status" className="login-message">{message}</p>}<small>By continuing, you agree to use Doxia respectfully. Terms and privacy policy must be published before public launch.</small></section><Link className="login-back" href="/">← Back to Doxia preview</Link></main>;
}
