import Stripe from 'stripe';
import { requireUser } from '@/lib/auth';
import { jsonError, jsonOk } from '@/lib/http';

export async function POST(request: Request) {
  const { supabase, user } = await requireUser();
  if (!user) return jsonError('Sign in before purchasing Doxia Pro.', 401);
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_PRO_PRICE_ID || !process.env.STRIPE_PRO_PRODUCT_ID || !process.env.APP_URL) return jsonError('Checkout is not configured yet.', 503);
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  try {
    const price = await stripe.prices.retrieve(process.env.STRIPE_PRO_PRICE_ID);
    const priceProductId = typeof price.product === 'string' ? price.product : price.product.id;
    if (!price.active || price.type !== 'one_time' || price.unit_amount !== 1199 || price.currency !== 'gbp' || priceProductId !== process.env.STRIPE_PRO_PRODUCT_ID) return jsonError('Configured Pro price must be an active one-time GBP £11.99 price for the configured Doxia Pro product.', 503);
  } catch { return jsonError('Could not validate the configured Pro price.', 503); }
  const { data: entitlement, error: entitlementError } = await supabase.from('pro_entitlements').select('status').eq('user_id', user.id).maybeSingle();
  if (entitlementError) return jsonError('Could not check Pro status.', 500);
  if (entitlement?.status === 'active') return jsonError('Doxia Pro is already active on this account.', 409);
  if (entitlement?.status === 'refunded' || entitlement?.status === 'revoked') return jsonError('This account has a previously refunded or revoked Pro purchase. Contact support before attempting another purchase.', 409);
  const base = new URL(process.env.APP_URL).origin;
  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price: process.env.STRIPE_PRO_PRICE_ID, quantity: 1 }],
      client_reference_id: user.id,
      customer_email: user.email ?? undefined,
      metadata: { doxia_user_id: user.id, product: 'doxia_pro_lifetime' },
      payment_intent_data: { metadata: { doxia_user_id: user.id, product: 'doxia_pro_lifetime' } },
      success_url: `${base}/?pro=success`,
      cancel_url: `${base}/?pro=cancelled`,
    }, { idempotencyKey: `doxia-pro-lifetime-${user.id}` });
    if (!session.url) return jsonError('Payment provider did not return a checkout URL.', 502);
    return jsonOk({ url: session.url });
  } catch (error) {
    console.error('Stripe checkout session creation failed', error instanceof Error ? error.message : 'unknown error');
    return jsonError('Could not start checkout. Try again later.', 502);
  }
}
