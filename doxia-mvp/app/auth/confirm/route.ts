import { NextResponse } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { publicOrigin } from '@/lib/http';

// Email links point here with a token hash, so sign-in is verified on the server and does not depend on
// a PKCE verifier stored in the browser that requested the link (which breaks across browsers and resends).
const EMAIL_OTP_TYPES: EmailOtpType[] = ['email', 'magiclink', 'signup', 'invite', 'recovery', 'email_change'];

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = publicOrigin(url.origin);
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type') as EmailOtpType | null;
  if (tokenHash && type && EMAIL_OTP_TYPES.includes(type)) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL('/', origin));
    console.error('Auth confirm failed:', error.name, error.message);
  }
  return NextResponse.redirect(new URL('/login?error=auth_confirm', origin));
}
