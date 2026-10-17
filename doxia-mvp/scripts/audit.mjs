import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
const root = process.cwd();
const required = [
  'app/page.tsx','app/login/page.tsx','app/auth/callback/route.ts','app/api/drops/route.ts',
  'app/api/drops/[id]/route.ts','app/api/drops/[id]/reactions/route.ts','app/api/signal/route.ts',
  'app/api/signal/[slug]/vote/route.ts','app/api/missions/route.ts','app/api/reports/route.ts',
  'app/api/wallet/nonce/route.ts','app/api/wallet/verify/route.ts','app/api/billing/checkout/route.ts',
  'app/api/billing/webhook/route.ts','app/api/billing/entitlement/route.ts','app/api/account/route.ts','supabase/schema.sql'
];
const problems = [];
for (const file of required) if (!fs.existsSync(path.join(root, file))) problems.push(`Missing required file: ${file}`);
const env = fs.readFileSync(path.join(root, '.env.example'), 'utf8');
for (const key of ['NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY','SUPABASE_SERVICE_ROLE_KEY','STRIPE_SECRET_KEY','STRIPE_WEBHOOK_SECRET','STRIPE_PRO_PRODUCT_ID','STRIPE_PRO_PRICE_ID','APP_URL']) if (!env.includes(`${key}=`)) problems.push(`Missing env documentation: ${key}`);
const schema = fs.readFileSync(path.join(root, 'supabase/schema.sql'), 'utf8');
for (const marker of ['enable row level security','consume_rate_limit','get_signal_summary','wallet_links','saved_drops','stripe_refunded_payments','pro_entitlements','handle_new_user']) if (!schema.toLowerCase().includes(marker.toLowerCase())) problems.push(`Schema missing security/product marker: ${marker}`);
const profileApi = fs.readFileSync(path.join(root, 'app/api/profile/route.ts'), 'utf8');
if (profileApi.includes('wallet_address')) problems.push('Profile API must not expose the removed/public wallet_address column.');
const webhook = fs.readFileSync(path.join(root, 'app/api/billing/webhook/route.ts'), 'utf8');
for (const marker of ['constructEvent','payment_status !== \'paid\'','amount_total !== 1199','currency !== \'gbp\'','listLineItems','STRIPE_PRO_PRODUCT_ID','pro_entitlements','charge.refunded']) if (!webhook.includes(marker)) problems.push(`Payment webhook missing guard: ${marker}`);
const wallet = fs.readFileSync(path.join(root, 'app/api/wallet/verify/route.ts'), 'utf8');
for (const marker of ['verifyWalletSignature','nonceHash','consumed_at','wallet_links']) if (!wallet.includes(marker)) problems.push(`Wallet verification missing guard: ${marker}`);
if (problems.length) { console.error(`Doxia static audit failed (${problems.length} findings):\n- ${problems.join('\n- ')}`); process.exit(1); }
console.log(`Doxia static audit passed: ${required.length} core files present; env, schema, payment and wallet guards detected.`);
console.log('This is a static completeness check, not a substitute for typecheck, runtime tests, provider sandbox tests, or a security review.');
