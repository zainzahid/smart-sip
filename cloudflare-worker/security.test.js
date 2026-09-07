import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateRequest } from './security.js';

const origin = 'https://zainzahid.github.io';
const request = (path = '/price/MEBL', headers = {}, method = 'GET') =>
  new Request(`https://proxy.example${path}`, { method, headers: { Origin: origin, ...headers } });
const environment = () => ({
  ALLOWED_ORIGINS: origin,
  PRICE_RATE_LIMITER: { async limit() { return { success: true }; } },
  GLOBAL_RATE_LIMITER: { async limit() { return { success: true }; } },
});

test('requires an exact allowed origin, including on direct visits', async () => {
  for (const bad of ['', 'null', 'https://other.example', `${origin}.evil.example`, `${origin}/smart-sip/`]) {
    const { response } = await validateRequest(request(undefined, { Origin: bad }), environment());
    assert.equal(response.status, 403);
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), null);
  }
  assert.equal((await validateRequest(new Request('https://proxy.example/price/MEBL'), environment())).response.status, 403);
  assert.equal((await validateRequest(request(), {})).response.status, 403);
});

test('allows configured origins and adds CORS and safe headers to JSON replies', async () => {
  const { symbol, reply } = await validateRequest(request('//company/mebl'), environment());
  assert.equal(symbol, 'MEBL');
  const response = reply({ price: 123 });
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), origin);
  assert.equal(response.headers.get('Vary'), 'Origin');
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
});

test('blocks unsupported methods, paths, query strings and encoded paths', async () => {
  for (const path of ['/stocks/MEBL', '/price/MEBL?url=https://evil.example', '/price/%2Fadmin', '/price/..x', '/price/' + 'A'.repeat(33)]) {
    assert.equal((await validateRequest(request(path), environment())).response.status, 400);
  }
  for (const method of ['POST', 'PUT', 'DELETE', 'HEAD']) {
    const { response } = await validateRequest(request(undefined, {}, method), environment());
    assert.equal(response.status, 405);
    assert.equal(response.headers.get('Allow'), 'GET, OPTIONS');
  }
});

test('validates CORS preflight without contacting a price source', async () => {
  const headers = { 'Access-Control-Request-Method': 'GET', 'Access-Control-Request-Headers': 'Accept, Content-Type' };
  const { response } = await validateRequest(request(undefined, headers, 'OPTIONS'), environment());
  assert.equal(response.status, 204);
  assert.equal(await response.text(), '');
  for (const bad of [{}, { 'Access-Control-Request-Method': 'POST' }, { ...headers, 'Access-Control-Request-Headers': 'Authorization' }]) {
    assert.equal((await validateRequest(request(undefined, bad, 'OPTIONS'), environment())).response.status, 403);
  }
});

test('uses Cloudflare IP for one bucket across aliases, ignoring X-Forwarded-For', async () => {
  const keys = [];
  const env = environment();
  env.PRICE_RATE_LIMITER.limit = async ({ key }) => { keys.push(key); return { success: keys.length === 1 }; };
  const headers = { 'CF-Connecting-IP': '192.0.2.1', 'X-Forwarded-For': '198.51.100.1' };
  assert.equal((await validateRequest(request('/price/MEBL', headers), env)).symbol, 'MEBL');
  const { response } = await validateRequest(request('/company/FFC', headers), env);
  assert.deepEqual(keys, ['price:192.0.2.1', 'price:192.0.2.1']);
  assert.equal(response.status, 429);
  assert.equal(response.headers.get('Retry-After'), '60');
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), origin);
});

test('applies aggregate limit and fails closed on missing or broken bindings', async t => {
  t.mock.method(console, 'error', () => {});
  const env = environment();
  env.GLOBAL_RATE_LIMITER.limit = async () => ({ success: false });
  assert.equal((await validateRequest(request(), env)).response.status, 429);
  delete env.GLOBAL_RATE_LIMITER;
  assert.equal((await validateRequest(request(), env)).response.status, 503);
  env.PRICE_RATE_LIMITER.limit = async () => { throw new Error('Unavailable'); };
  assert.equal((await validateRequest(request(), env)).response.status, 503);
});
