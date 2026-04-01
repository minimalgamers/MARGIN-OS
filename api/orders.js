// /api/orders.js — Endpoint che recupera gli ordini da Shopify
// Vercel Serverless Function

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Auth semplice con password
  const appPass = process.env.APP_PASSWORD;
  if (appPass) {
    const auth = req.headers.authorization;
    if (!auth || auth !== `Bearer ${appPass}`) {
      return res.status(401).json({ error: 'Non autorizzato' });
    }
  }

  const SHOP = process.env.SHOPIFY_SHOP_DOMAIN;
  const TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;

  if (!SHOP || !TOKEN) {
    return res.status(500).json({ error: 'Variabili Shopify non configurate' });
  }

  try {
    // Parametri opzionali
    const since = req.query.since || ''; // data ISO es. 2026-01-01
    const limit = Math.min(parseInt(req.query.limit) || 250, 250);
    const sinceId = req.query.since_id || '';

    let url = `https://${SHOP}/admin/api/2024-10/orders.json?status=any&limit=${limit}&fields=name,created_at,total_price,gateway,line_items`;
    if (since) url += `&created_at_min=${since}T00:00:00Z`;
    if (sinceId) url += `&since_id=${sinceId}`;

    const allOrders = [];
    let nextUrl = url;
    let pages = 0;
    const MAX_PAGES = 10; // massimo 2500 ordini per chiamata

    while (nextUrl && pages < MAX_PAGES) {
      const response = await fetch(nextUrl, {
        headers: {
          'X-Shopify-Access-Token': TOKEN,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errText = await response.text();
        return res.status(response.status).json({
          error: `Shopify API error: ${response.status}`,
          details: errText,
        });
      }

      const data = await response.json();
      if (!data.orders || data.orders.length === 0) break;

      // Trasforma nel formato che il frontend si aspetta
      for (const o of data.orders) {
        allOrders.push({
          on: o.name, // es. "#4205"
          dt: (o.created_at || '').substring(0, 10),
          pm: o.gateway || '',
          tot: parseFloat(o.total_price) || 0,
          li: (o.line_items || []).map(li => ({
            n: li.title + (li.variant_title ? ` - ${li.variant_title}` : ''),
            p: parseFloat(li.price) || 0,
          })),
        });
      }

      // Paginazione: check header Link per pagina successiva
      const linkHeader = response.headers.get('Link') || '';
      const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
      nextUrl = nextMatch ? nextMatch[1] : null;
      pages++;
    }

    return res.status(200).json({
      orders: allOrders,
      count: allOrders.length,
      pages: pages,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
