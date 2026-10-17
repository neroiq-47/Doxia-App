import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const secret = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret || !webhookSecret || !supabaseUrl || !serviceKey || !process.env.STRIPE_PRO_PRICE_ID || !process.env.STRIPE_PRO_PRODUCT_ID) return NextResponse.json({ error: 'Webhook is not configured.' }, { status: 503 });
  const signature = request.headers.get('stripe-signature');
  if (!signature) return NextResponse.json({ error: 'Missing Stripe signature.' }, { status: 400 });
  const rawBody = await request.text();
  const stripe = new Stripe(secret);
  let event: Stripe.Event;
  try { event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret); }
  catch { return NextResponse.json({ error: 'Invalid webhook signature.' }, { status: 400 }); }
  const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  try {
    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode !== 'payment' || session.payment_status !== 'paid') return NextResponse.json({ received: true, ignored: 'not-paid' });
      if (session.metadata?.product !== 'doxia_pro_lifetime' || session.amount_total !== 1199 || session.currency !== 'gbp') return NextResponse.json({ error: 'Checkout does not match the Doxia Pro price.' }, { status: 400 });
      const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 2, expand: ['data.price.product'] });
      if (lineItems.data.length !== 1) return NextResponse.json({ error: 'Checkout must contain exactly one Doxia Pro line item.' }, { status: 400 });
      const lineItem = lineItems.data[0];
      const linePrice = lineItem.price;
      const lineProductId = linePrice ? (typeof linePrice.product === 'string' ? linePrice.product : linePrice.product.id) : null;
      if (!linePrice || linePrice.id !== process.env.STRIPE_PRO_PRICE_ID || lineProductId !== process.env.STRIPE_PRO_PRODUCT_ID || linePrice.unit_amount !== 1199 || linePrice.currency !== 'gbp' || lineItem.quantity !== 1) return NextResponse.json({ error: 'Checkout line item does not match the configured Doxia Pro product and price.' }, { status: 400 });
      const userId = session.metadata?.doxia_user_id ?? session.client_reference_id;
      if (!userId || !session.id) return NextResponse.json({ error: 'Checkout session missing user metadata.' }, { status: 400 });
      const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : null;
      if (paymentIntentId) {
        const { data: refunded } = await admin.from('stripe_refunded_payments').select('payment_intent_id').eq('payment_intent_id', paymentIntentId).maybeSingle();
        if (refunded) {
          const { error: revokeError } = await admin.from('pro_entitlements').upsert({ user_id: userId, provider: 'stripe', provider_customer_id: typeof session.customer === 'string' ? session.customer : null, provider_transaction_id: session.id, status: 'refunded' }, { onConflict: 'user_id' });
          if (revokeError) return NextResponse.json({ error: 'Could not record refunded entitlement.' }, { status: 500 });
          return NextResponse.json({ received: true, ignored: 'payment-already-refunded' });
        }
      }
      const { data: existing } = await admin.from('pro_entitlements').select('status,provider_transaction_id').eq('user_id', userId).maybeSingle();
      if ((existing?.status === 'refunded' || existing?.status === 'revoked') && existing.provider_transaction_id === session.id) return NextResponse.json({ received: true, ignored: 'already-refunded' });
      const { error } = await admin.from('pro_entitlements').upsert({ user_id: userId, provider: 'stripe', provider_customer_id: typeof session.customer === 'string' ? session.customer : null, provider_transaction_id: session.id, status: 'active' }, { onConflict: 'user_id' });
      if (error) { console.error('Entitlement grant failed', error.code); return NextResponse.json({ error: 'Could not grant entitlement.' }, { status: 500 }); }
    }
    if (event.type === 'charge.refunded') {
      const charge = event.data.object as Stripe.Charge;
      if (charge.payment_intent && charge.amount_refunded >= charge.amount) {
        const { error: refundRecordError } = await admin.from('stripe_refunded_payments').upsert({ payment_intent_id: String(charge.payment_intent), refunded_at: new Date().toISOString() }, { onConflict: 'payment_intent_id' });
        if (refundRecordError) return NextResponse.json({ error: 'Could not record refund event.' }, { status: 500 });
        const sessions = await stripe.checkout.sessions.list({ payment_intent: String(charge.payment_intent), limit: 1 });
        const sessionId = sessions.data[0]?.id;
        if (sessionId) {
          const { error } = await admin.from('pro_entitlements').update({ status: 'refunded' }).eq('provider_transaction_id', sessionId).eq('provider', 'stripe');
          if (error) { console.error('Entitlement refund update failed', error.code); return NextResponse.json({ error: 'Could not revoke refunded entitlement.' }, { status: 500 }); }
        }
      }
    }
    return NextResponse.json({ received: true });
  } catch {
    return NextResponse.json({ error: 'Webhook processing failed.' }, { status: 500 });
  }
}
