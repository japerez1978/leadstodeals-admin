import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SK);
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Stripe Price IDs
const PRICE_MAP = {
  ofertas_hubspot: process.env.STRIPE_PRICE_OFERTAS,
  sat_gestion: process.env.STRIPE_PRICE_SAT,
};

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { tenant_id, app_slug } = req.body;

    if (!tenant_id || !app_slug) {
      return res.status(400).json({ error: 'tenant_id y app_slug son requeridos' });
    }

    const priceId = PRICE_MAP[app_slug];
    if (!priceId) {
      return res.status(400).json({ error: `Plan no válido: ${app_slug}` });
    }

    // Get tenant info
    const { data: tenant, error: tenantErr } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', tenant_id)
      .single();

    if (tenantErr || !tenant) {
      return res.status(404).json({ error: 'Tenant no encontrado' });
    }

    // Create or reuse Stripe Customer
    let customerId = tenant.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        name: tenant.nombre,
        metadata: { tenant_id: String(tenant_id), subdominio: tenant.subdominio },
      });
      customerId = customer.id;

      // Save Stripe customer ID
      await supabase
        .from('tenants')
        .update({ stripe_customer_id: customerId })
        .eq('id', tenant_id);
    }

    // Create Checkout Session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: { tenant_id: String(tenant_id), app_slug },
      success_url: `${req.headers.origin || 'http://localhost:5175'}/billing?success=true&tenant=${tenant_id}&app=${app_slug}`,
      cancel_url: `${req.headers.origin || 'http://localhost:5175'}/billing?canceled=true`,
    });

    return res.status(200).json({ url: session.url, sessionId: session.id });
  } catch (err) {
    console.error('Checkout error:', err);
    return res.status(500).json({ error: err.message });
  }
}
