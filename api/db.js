// /api/db.js — API per operazioni database Supabase
// Gestisce CRUD per tutte le tabelle

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

async function supabase(path, method = 'GET', body = null) {
  const opts = {
    method,
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': method === 'POST' ? 'return=representation' : (method === 'PATCH' ? 'return=representation' : ''),
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, opts);
  if (!r.ok) {
    const err = await r.text();
    throw new Error(`Supabase ${method} ${path}: ${r.status} - ${err}`);
  }
  const text = await r.text();
  return text ? JSON.parse(text) : null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(500).json({ error: 'Supabase non configurato' });
  }

  try {
    const { action } = req.query;
    const body = req.body;

    switch (action) {

      // ═══ LOAD ALL — carica tutto il database in una volta ═══
      case 'load_all': {
        const [builds, components, buildComponents, variants, accessories, customBuilds,
               orders, adsLog, expenses, manualOrders, subscriptions, settings,
               purchaseLots, lotPrices] = await Promise.all([
          supabase('builds?order=id'),
          supabase('components?order=id'),
          supabase('build_components?order=id'),
          supabase('variants?order=id'),
          supabase('accessories?order=id'),
          supabase('custom_builds?order=id'),
          supabase('orders?order=order_date.desc'),
          supabase('ads_log?order=date.desc'),
          supabase('expenses?order=date.desc'),
          supabase('manual_orders?order=date.desc'),
          supabase('subscriptions?order=id'),
          supabase('settings?order=key'),
          supabase('purchase_lots?order=id.desc'),
          supabase('lot_prices?order=id'),
        ]);
        return res.status(200).json({
          builds, components, buildComponents, variants, accessories, customBuilds,
          orders, adsLog, expenses, manualOrders, subscriptions, settings,
          purchaseLots, lotPrices,
        });
      }

      // ═══ ADS ═══
      case 'ads_upsert': {
        // Upsert: se esiste per quella data, aggiorna. Altrimenti inserisce.
        const existing = await supabase(`ads_log?date=eq.${body.date}&select=id`);
        if (existing && existing.length > 0) {
          await supabase(`ads_log?id=eq.${existing[0].id}`, 'PATCH', { tiktok: body.tiktok, meta: body.meta });
        } else {
          await supabase('ads_log', 'POST', body);
        }
        return res.status(200).json({ ok: true });
      }
      case 'ads_delete': {
        await supabase(`ads_log?date=eq.${body.date}`, 'DELETE');
        return res.status(200).json({ ok: true });
      }

      // ═══ SPESE EXTRA ═══
      case 'expense_add': {
        const r = await supabase('expenses', 'POST', body);
        return res.status(200).json({ ok: true, data: r });
      }
      case 'expense_delete': {
        await supabase(`expenses?id=eq.${body.id}`, 'DELETE');
        return res.status(200).json({ ok: true });
      }

      // ═══ ORDINI MANUALI ═══
      case 'manual_add': {
        const r = await supabase('manual_orders', 'POST', body);
        return res.status(200).json({ ok: true, data: r });
      }
      case 'manual_delete': {
        await supabase(`manual_orders?id=eq.${body.id}`, 'DELETE');
        return res.status(200).json({ ok: true });
      }

      // ═══ ORDINI SHOPIFY (cache analisi) ═══
      case 'orders_save': {
        // Salva ordini analizzati in batch
        for (const order of body.orders) {
          const existing = await supabase(`orders?order_name=eq.${encodeURIComponent(order.order_name)}&select=id`);
          if (existing && existing.length > 0) {
            await supabase(`orders?id=eq.${existing[0].id}`, 'PATCH', order);
          } else {
            await supabase('orders', 'POST', order);
          }
        }
        return res.status(200).json({ ok: true, count: body.orders.length });
      }
      case 'orders_clear': {
        await supabase('orders?id=gt.0', 'DELETE');
        return res.status(200).json({ ok: true });
      }

      // ═══ ABBONAMENTI ═══
      case 'subscription_add': {
        const r = await supabase('subscriptions', 'POST', body);
        return res.status(200).json({ ok: true, data: r });
      }
      case 'subscription_update': {
        await supabase(`subscriptions?id=eq.${body.id}`, 'PATCH', body.data);
        return res.status(200).json({ ok: true });
      }
      case 'subscription_delete': {
        await supabase(`subscriptions?id=eq.${body.id}`, 'DELETE');
        return res.status(200).json({ ok: true });
      }

      // ═══ VARIANTI ═══
      case 'variant_add': {
        const r = await supabase('variants', 'POST', body);
        return res.status(200).json({ ok: true, data: r });
      }
      case 'variant_update': {
        await supabase(`variants?id=eq.${body.id}`, 'PATCH', body.data);
        return res.status(200).json({ ok: true });
      }
      case 'variant_delete': {
        await supabase(`variants?id=eq.${body.id}`, 'DELETE');
        return res.status(200).json({ ok: true });
      }

      // ═══ BUILD ═══
      case 'build_update': {
        await supabase(`builds?id=eq.${body.id}`, 'PATCH', body.data);
        return res.status(200).json({ ok: true });
      }

      // ═══ COMPONENTI ═══
      case 'component_update': {
        await supabase(`components?id=eq.${body.id}`, 'PATCH', body.data);
        return res.status(200).json({ ok: true });
      }

      // ═══ SETTINGS ═══
      case 'setting_update': {
        await supabase(`settings?key=eq.${body.key}`, 'PATCH', { value: body.value, updated_at: new Date().toISOString() });
        return res.status(200).json({ ok: true });
      }

      // ═══ LOTTI DI ACQUISTO ═══
      case 'lot_create': {
        const r = await supabase('purchase_lots', 'POST', body);
        return res.status(200).json({ ok: true, data: r });
      }
      case 'lot_confirm': {
        // Conferma lotto e salva prezzi
        await supabase(`purchase_lots?id=eq.${body.lot_id}`, 'PATCH', {
          status: 'confirmed',
          confirmed_at: new Date().toISOString(),
        });
        // Salva prezzi confermati
        if (body.prices && body.prices.length > 0) {
          for (const p of body.prices) {
            await supabase('lot_prices', 'POST', { ...p, lot_id: body.lot_id });
          }
        }
        // Aggiorna ordini nel range con lot_id
        // (il frontend ricalcolerà i profitti con i prezzi confermati)
        return res.status(200).json({ ok: true });
      }
      case 'lot_delete': {
        await supabase(`lot_prices?lot_id=eq.${body.id}`, 'DELETE');
        await supabase(`purchase_lots?id=eq.${body.id}`, 'DELETE');
        return res.status(200).json({ ok: true });
      }

      default:
        return res.status(400).json({ error: `Azione sconosciuta: ${action}` });
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
