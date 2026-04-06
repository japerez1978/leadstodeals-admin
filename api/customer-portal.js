import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SK);
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { tenant_id } = req.body;

    // Get tenant
    const { data: tenant } = await supabase
      .from('tenants')
      .select('stripe_customer_id')
      .eq('id', tenant_id)
      .single();

    if (!tenant?.stripe_customer_id) {
      return res.status(400).json({ error: 'Este tenant no tiene cuenta de Stripe' });
    }

    // Create portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: tenant.stripe_customer_id,
      return_url: `${req.headers.origin || 'http://localhost:5175'}/billing`,
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Portal error:', err);
    return res.status(500).json({ error: err.message });
  }
}
