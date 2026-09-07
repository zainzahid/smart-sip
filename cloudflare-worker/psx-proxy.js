import { fetchSourcePrice } from './priceSources.js';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};
const reply = (body, status = 200) => Response.json(body, { status, headers });

export default {
  async fetch(request, env = {}) {
    const url = new URL(request.url);
    // Keep /company as an alias for previously deployed clients.
    const match = url.pathname.replace(/\/{2,}/g, '/').match(/^\/(?:price|company)\/([A-Za-z0-9.-]{1,32})$/);
    if (request.method !== 'GET' || !match || url.search) {
      return reply({ error: 'Expected GET /price/SYMBOL' }, 400);
    }

    const symbol = match[1].toUpperCase();
    const mode = env.PRICE_SOURCE || 'auto';
    if (!['auto', 'dps', 'sarmaaya'].includes(mode)) {
      return reply({ error: 'PRICE_SOURCE must be auto, dps, or sarmaaya' }, 500);
    }
    const sources = mode === 'auto' ? ['dps', 'sarmaaya'] : [mode];
    for (const source of sources) {
      try {
        const price = await fetchSourcePrice(source, symbol);
        return reply({ symbol, price, source });
      } catch (error) {
        console.warn('Price source failed', { symbol, source, message: error.message });
      }
    }
    return reply({ error: `Could not fetch a valid price for ${symbol}` }, 502);
  },
};
