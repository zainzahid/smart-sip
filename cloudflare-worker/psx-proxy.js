import { fetchSourcePrice } from './priceSources.js';
import { validateRequest } from './security.js';

export default {
  async fetch(request, env = {}) {
    const access = await validateRequest(request, env);
    if (access.response) return access.response;
    const { symbol, reply } = access;
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
        console.warn('price_source_failed', {
          symbol, source, ray: request.headers.get('cf-ray'),
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
    return reply({ error: `Could not fetch a valid price for ${symbol}` }, 502);
  },
};
