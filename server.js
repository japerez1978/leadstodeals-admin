import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const app = express();
const stripe = new Stripe(process.env.STRIPE_SK);
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const PRICE_MAP = {
  ofertas_hubspot: process.env.STRIPE_PRICE_OFERTAS,
  sat_gestion: process.env.STRIPE_PRICE_SAT,
};

const PRICE_TO_AMOUNT = {
  [process.env.STRIPE_PRICE_OFERTAS]: 99,
  [process.env.STRIPE_PRICE_SAT]: 49,
};

app.use(cors());

// Webhook needs raw body
app.post('/api/stripe-webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('⚠️ Webhook sig failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log(`📩 Stripe event: ${event.type}`);

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const tenantId = parseInt(session.metadata?.tenant_id);
    const appSlug = session.metadata?.app_slug;
    const subscriptionId = session.subscription;

    if (tenantId && appSlug && subscriptionId) {
      const sub = await stripe.subscriptions.retrieve(subscriptionId);
      const priceId = sub.items.data[0]?.price?.id;

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

      if (session.customer) {
        await supabase.from('tenants').update({ stripe_customer_id: session.customer }).eq('id', tenantId);
      }

      await supabase.from('tenant_apps').upsert(
        { tenant_id: tenantId, app_slug: appSlug, activa: true },
        { onConflict: 'tenant_id,app_slug' }
      );

      console.log(`✅ Suscripción creada: tenant=${tenantId}, app=${appSlug}`);
    }
  } else if (event.type === 'customer.subscription.deleted') {
    await supabase.from('subscriptions').update({ estado: 'cancelado' }).eq('stripe_subscription_id', event.data.object.id);
    console.log(`❌ Suscripción cancelada: ${event.data.object.id}`);
  } else if (event.type === 'invoice.payment_failed') {
    if (event.data.object.subscription) {
      await supabase.from('subscriptions').update({ estado: 'impago' }).eq('stripe_subscription_id', event.data.object.subscription);
    }
  }

  res.json({ received: true });
});

// All other routes use JSON
app.use(express.json());

// Create Checkout Session
app.post('/api/create-checkout', async (req, res) => {
  try {
    const { tenant_id, app_slug } = req.body;
    const priceId = PRICE_MAP[app_slug];
    if (!priceId) return res.status(400).json({ error: `Plan no válido: ${app_slug}` });

    const { data: tenant } = await supabase.from('tenants').select('*').eq('id', tenant_id).single();
    if (!tenant) return res.status(404).json({ error: 'Tenant no encontrado' });

    let customerId = tenant.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        name: tenant.nombre,
        metadata: { tenant_id: String(tenant_id) },
      });
      customerId = customer.id;
      await supabase.from('tenants').update({ stripe_customer_id: customerId }).eq('id', tenant_id);
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: { tenant_id: String(tenant_id), app_slug },
      success_url: `http://localhost:5175/billing?success=true&tenant=${tenant_id}&app=${app_slug}`,
      cancel_url: `http://localhost:5175/billing?canceled=true`,
    });

    res.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    console.error('Checkout error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Cancel Subscription
app.post('/api/cancel-subscription', async (req, res) => {
  try {
    const { stripe_subscription_id } = req.body;
    await stripe.subscriptions.cancel(stripe_subscription_id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Customer Portal
app.post('/api/customer-portal', async (req, res) => {
  try {
    const { tenant_id } = req.body;
    const { data: tenant } = await supabase.from('tenants').select('stripe_customer_id').eq('id', tenant_id).single();
    if (!tenant?.stripe_customer_id) return res.status(400).json({ error: 'Sin cuenta Stripe' });

    const session = await stripe.billingPortal.sessions.create({
      customer: tenant.stripe_customer_id,
      return_url: 'http://localhost:5175/billing',
    });
    res.json({ url: session.url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`\n🚀 Stripe API server running on http://localhost:${PORT}`);
  console.log(`   Endpoints:`);
  console.log(`   POST /api/create-checkout`);
  console.log(`   POST /api/cancel-subscription`);
  console.log(`   POST /api/customer-portal`);
  console.log(`   POST /api/stripe-webhook\n`);
});
