const RESPONSE_HEADERS = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Vary': 'Origin',
};

export async function validateRequest(request, env) {
  const headers = { ...RESPONSE_HEADERS };
  const reply = (body, status = 200, extraHeaders = {}) =>
    Response.json(body, { status, headers: { ...headers, ...extraHeaders } });
  const reject = (error, status, extraHeaders) => ({ response: reply({ error }, status, extraHeaders) });
  const origin = request.headers.get('Origin');
  const allowedOrigins = (env.ALLOWED_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean);
  if (!origin || !allowedOrigins.includes(origin)) return reject('Origin not allowed', 403);
  headers['Access-Control-Allow-Origin'] = origin;
  headers['Access-Control-Expose-Headers'] = 'Retry-After';

  if (!['GET', 'OPTIONS'].includes(request.method)) {
    return reject('Method not allowed', 405, { Allow: 'GET, OPTIONS' });
  }
  const url = new URL(request.url);
  // Both aliases use the same rate-limit key; symbols must start with a letter/digit.
  const match = url.pathname.replace(/\/{2,}/g, '/').match(/^\/(?:price|company)\/([A-Za-z0-9][A-Za-z0-9.-]{0,31})$/);
  if (!match || url.search) return reject('Expected /price/SYMBOL without query parameters', 400);

  if (request.method === 'OPTIONS') {
    const requestedHeaders = (request.headers.get('Access-Control-Request-Headers') || '')
      .split(',').map(value => value.trim().toLowerCase()).filter(Boolean);
    if (request.headers.get('Access-Control-Request-Method') !== 'GET'
      || requestedHeaders.some(value => !['accept', 'content-type'].includes(value))) {
      return reject('Preflight request not allowed', 403);
    }
  }

  try {
    // Cloudflare sets this header. Do not use client-supplied X-Forwarded-For.
    const key = `price:${request.headers.get('CF-Connecting-IP') || 'unknown'}`;
    const perIp = await env.PRICE_RATE_LIMITER.limit({ key });
    const allowed = perIp.success && (await env.GLOBAL_RATE_LIMITER.limit({ key: 'all-prices' })).success;
    if (!allowed) return reject('Too many requests. Try again in a minute.', 429, { 'Retry-After': '60' });
  } catch {
    // A missing/broken binding must not silently disable protection.
    console.error('rate_limiter_unavailable', { ray: request.headers.get('cf-ray') });
    return reject('Price service temporarily unavailable', 503);
  }

  if (request.method === 'OPTIONS') {
    return { response: new Response(null, { status: 204, headers: {
      ...headers,
      'Access-Control-Allow-Methods': 'GET',
      'Access-Control-Allow-Headers': 'Accept, Content-Type',
      'Access-Control-Max-Age': '600',
    } }) };
  }
  return { symbol: match[1].toUpperCase(), reply };
}
