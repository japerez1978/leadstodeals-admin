import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * HubSpot connector — lee el token del tenant desde Supabase y reenvía la petición.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {string} subPath  — ej: "crm/v3/objects/deals"
 */
export async function hubspotConnector(req, res, subPath) {
  const tenantId = req.headers['x-tenant-id'];
  if (!tenantId) {
    return res.status(400).json({ error: 'Header X-Tenant-ID requerido' });
  }

  const { data: tenant, error } = await supabase
    .from('tenants')
    .select('hubspot_access_token')
    .eq('id', tenantId)
    .maybeSingle();

  if (error) {
    console.error('[hubspot] Supabase error:', error.message);
    return res.status(500).json({ error: 'Error leyendo credenciales del tenant' });
  }
  if (!tenant?.hubspot_access_token) {
    return res.status(401).json({ error: 'Este tenant no tiene token de HubSpot configurado' });
  }

  // Construye query string desde req.query (ya parseado por Express)
  const qs = new URLSearchParams(req.query).toString();
  const targetUrl = `https://api.hubspot.com/${subPath}${qs ? `?${qs}` : ''}`;

  const upstreamRes = await fetch(targetUrl, {
    method: req.method,
    headers: {
      Authorization: `Bearer ${tenant.hubspot_access_token}`,
      'Content-Type': 'application/json',
    },
    body: ['GET', 'HEAD'].includes(req.method)
      ? undefined
      : JSON.stringify(req.body),
  });

  const data = await upstreamRes.json();
  return res.status(upstreamRes.status).json(data);
}
