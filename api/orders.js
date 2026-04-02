// /api/orders.js — Endpoint che recupera gli ordini PAGATI da Shopify
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
    const since = req.query.since || '';
    const limit = Math.min(parseInt(req.query.limit) || 250, 250);
    const sinceId = req.query.since_id || '';

    // financial_status=paid per prendere solo ordini pagati + partially_refunded
    let url = `https://${SHOP}/admin/api/2024-10/orders.json?status=any&financial_status=any&limit=${limit}&fields=name,created_at,total_price,gateway,line_items,financial_status,refunds`;
    if (since) url += `&created_at_min=${since}T00:00:00Z`;
    if (sinceId) url += `&since_id=${sinceId}`;

    const allOrders = [];
    let skipped = 0;
    let nextUrl = url;
    let pages = 0;
    const MAX_PAGES = 10;

    // Solo ordini effettivamente pagati
    const VALID = new Set(['paid', 'partially_paid', 'partially_refunded']);

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

      for (const o of data.orders) {
        const fs = (o.financial_status || '').toLowerCase();

        // FILTRA: salta expired, pending, voided, refunded (totale), authorized
        if (!VALID.has(fs)) {
          skipped++;
          continue;
        }

        // Calcola importo rimborsato
        let refundAmount = 0;
        if (o.refunds && o.refunds.length > 0) {
          for (const refund of o.refunds) {
            if (refund.transactions) {
              for (const tx of refund.transactions) {
                refundAmount += parseFloat(tx.amount) || 0;
              }
            }
          }
        }

        allOrders.push({
          on: o.name,
          dt: (o.created_at || '').substring(0, 10),
          pm: o.gateway || '',
          tot: parseFloat(o.total_price) || 0,
          fs: fs,
          refund: refundAmount,
          li: (o.line_items || []).map(li => ({
            n: li.title + (li.variant_title ? ` - ${li.variant_title}` : ''),
            p: parseFloat(li.price) || 0,
          })),
        });
      }

      const linkHeader = response.headers.get('Link') || '';
      const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
      nextUrl = nextMatch ? nextMatch[1] : null;
      pages++;
    }

    return res.status(200).json({
      orders: allOrders,
      count: allOrders.length,
      skipped: skipped,
      pages: pages,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
