// /api/health.js — Verifica che l'API funzioni
export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    shopify: !!process.env.SHOPIFY_ACCESS_TOKEN,
    password: !!process.env.APP_PASSWORD,
  });
}
