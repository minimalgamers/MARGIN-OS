// /api/orders.js — Endpoint che recupera gli ordini PAGATI da Shopify
// Con auto-refresh del token se scade (401)

// Cache del token in memoria (persiste finché la funzione serverless è calda)
let cachedToken = null;

async function refreshToken(shop, clientId, clientSecret) {
  const resp = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Token refresh failed: ${resp.status} - ${err}`);
  }
  const data = await resp.json();
  return data.access_token;
}

async function fetchOrders(shop, token, query) {
  const { since, limit, sinceId } = query;
  let url = `https://${shop}/admin/api/2024-10/orders.json?status=any&financial_status=any&limit=${limit}&fields=name,created_at,total_price,gateway,line_items,financial_status,refunds`;
  if (since) url += `&created_at_min=${since}T00:00:00Z`;
  if (sinceId) url += `&since_id=${sinceId}`;

  const allOrders = [];
  let skipped = 0;
  let nextUrl = url;
  let pages = 0;
  const MAX_PAGES = 10;
  const VALID = new Set(['paid', 'partially_paid', 'partially_refunded']);

  while (nextUrl && pages < MAX_PAGES) {
    const response = await fetch(nextUrl, {
      headers: {
        'X-Shopify-Access-Token': token,
        'Content-Type': 'application/json',
      },
    });

    // Se 401, segnala che il token è scaduto
    if (response.status === 401) {
      return { error: 401 };
    }

    if (!response.ok) {
      const errText = await response.text();
      return { error: response.status, details: errText };
    }

    const data = await response.json();
    if (!data.orders || data.orders.length === 0) break;

    for (const o of data.orders) {
      const fs = (o.financial_status || '').toLowerCase();
      if (!VALID.has(fs)) { skipped++; continue; }

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

  return { orders: allOrders, skipped, pages };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const appPass = process.env.APP_PASSWORD;
  if (appPass) {
    const auth = req.headers.authorization;
    if (!auth || auth !== `Bearer ${appPass}`) {
      return res.status(401).json({ error: 'Non autorizzato' });
    }
  }

  const SHOP = process.env.SHOPIFY_SHOP_DOMAIN;
  const CLIENT_ID = process.env.SHOPIFY_CLIENT_ID;
  const CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET;
  let TOKEN = cachedToken || process.env.SHOPIFY_ACCESS_TOKEN;

  if (!SHOP || !TOKEN) {
    return res.status(500).json({ error: 'Variabili Shopify non configurate' });
  }

  try {
    const query = {
      since: req.query.since || '',
      limit: Math.min(parseInt(req.query.limit) || 250, 250),
      sinceId: req.query.since_id || '',
    };

    // Prima prova con il token attuale
    let result = await fetchOrders(SHOP, TOKEN, query);

    // Se 401 e abbiamo le credenziali per rigenerare il token
    if (result.error === 401 && CLIENT_ID && CLIENT_SECRET) {
      try {
        const newToken = await refreshToken(SHOP, CLIENT_ID, CLIENT_SECRET);
        cachedToken = newToken; // salva in memoria per le prossime chiamate
        // Riprova con il nuovo token
        result = await fetchOrders(SHOP, newToken, query);
      } catch (refreshErr) {
        return res.status(401).json({
          error: 'Token scaduto e refresh fallito',
          details: refreshErr.message,
        });
      }
    }

    // Se ancora errore (non 401 o refresh non ha risolto)
    if (result.error) {
      return res.status(result.error).json({
        error: `Shopify API error: ${result.error}`,
        details: result.details || '',
      });
    }

    return res.status(200).json({
      orders: result.orders,
      count: result.orders.length,
      skipped: result.skipped,
      pages: result.pages,
      tokenRefreshed: cachedToken ? true : false,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
