import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export async function GET() {
  const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  return NextResponse.json({ status: 'ok', app: 'doxia', version: '0.4.0', backendConfigured: configured, features: { dogeWallet: process.env.DOGE_WALLET_ENABLED === 'true' } }, { headers: { 'Cache-Control': 'no-store' } });
}
