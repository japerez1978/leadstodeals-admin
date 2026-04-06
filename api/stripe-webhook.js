import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SK);
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

// Price ID → app_slug mapping
const PRICE_TO_APP = {
  [process.env.STRIPE_PRICE_OFERTAS]: 'ofertas_hubspot',
  [process.env.STRIPE_PRICE_SAT]: 'sat_gestion',
};

const PRICE_TO_AMOUNT = {
  [process.env.STRIPE_PRICE_OFERTAS]: 99,
  [process.env.STRIPE_PRICE_SAT]: 49,
};

export const config = {
  api: { bodyParser: false },
};

async function getRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const rawBody = await getRawBody(req);
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, endpointSecret);
  } catch (err) {
    console.error('Webhook signature failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log(`Stripe event: ${event.type}`);

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const tenantId = parseInt(session.metadata?.tenant_id);
      const appSlug = session.metadata?.app_slug;
      const subscriptionId = session.subscription;

      if (!tenantId || !appSlug) break;

      // Get subscription details from Stripe
      const sub = await stripe.subscriptions.retrieve(subscriptionId);
      const priceId = sub.items.data[0]?.price?.id;

      // Create subscription in DB
      await supabase.from('subscriptions').insert({
        tenant_id: tenantId,
        app_slug: appSlug,
        estado: 'activo',
        precio_mes: PRICE_TO_AMOUNT[priceId] || 0,
        inicio: new Date(sub.current_period_start * 1000).toISOString().slice(0, 10),
        stripe_subscription_id: subscriptionId,
        stripe_price_id: priceId,
        current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
      });

      // Save customer ID on tenant
      if (session.customer) {
        await supabase
          .from('tenants')
          .update({ stripe_customer_id: session.customer })
          .eq('id', tenantId);
      }

      // Auto-enable app access for tenant
      await supabase.from('tenant_apps').upsert({
        tenant_id: tenantId,
        app_slug: appSlug,
        activa: true,
      }, { onConflict: 'tenant_id,app_slug' });

      console.log(`✅ Suscripción creada: tenant=${tenantId}, app=${appSlug}`);
      break;
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object;
      const stripeSubId = sub.id;

      const estado = sub.cancel_at_period_end ? 'cancelado_fin_periodo'
        : sub.status === 'active' ? 'activo'
        : sub.status === 'past_due' ? 'impago'
        : sub.status;

      await supabase
        .from('subscriptions')
        .update({
          estado,
          current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
        })
        .eq('stripe_subscription_id', stripeSubId);

      console.log(`🔄 Suscripción actualizada: ${stripeSubId} → ${estado}`);
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object;
      await supabase
        .from('subscriptions')
        .update({ estado: 'cancelado' })
        .eq('stripe_subscription_id', sub.id);

      console.log(`❌ Suscripción cancelada: ${sub.id}`);
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object;
      if (invoice.subscription) {
        await supabase
          .from('subscriptions')
          .update({ estado: 'impago' })
          .eq('stripe_subscription_id', invoice.subscription);

        console.log(`⚠️ Pago fallido: ${invoice.subscription}`);
      }
      break;
    }
  }

  res.status(200).json({ received: true });
}
