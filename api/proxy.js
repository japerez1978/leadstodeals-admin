import { getConnector } from '../connectors/index.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Tenant-ID');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // vercel.json reescribe /proxy/(.*) → /api/proxy?proxyPath=$1
  // proxyPath ej: "hubspot/crm/v3/objects/deals"
  const proxyPath = req.query.proxyPath || '';
  const slashIdx = proxyPath.indexOf('/');
  const source = slashIdx === -1 ? proxyPath : proxyPath.slice(0, slashIdx);
  const subPath = slashIdx === -1 ? '' : proxyPath.slice(slashIdx + 1);

  if (!source) {
    return res.status(400).json({ error: 'Ruta de proxy inválida' });
  }

  const connector = getConnector(source);
  if (!connector) {
    return res.status(404).json({ error: `Fuente desconocida: ${source}` });
  }

  // Elimina proxyPath de req.query para no reenviarlo a la API destino
  const { proxyPath: _removed, ...forwardQuery } = req.query;
  req.query = forwardQuery;

  try {
    await connector(req, res, subPath);
  } catch (err) {
    console.error(`[proxy/${source}] Error:`, err.message);
    res.status(500).json({ error: err.message });
  }
}
