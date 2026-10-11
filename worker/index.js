// Cloudflare Worker: static files come from public/ (assets binding); this script handles
// only what is not a file there: the translate API, health check and old two-screen URLs.
//
// The free translate endpoints often answer 429 to Cloudflare's shared egress IPs, so the
// Worker tries Google once and otherwise forwards the request to the Render server
// (env.FALLBACK_API), whose own IP is not blocked. Opening the app wakes Render in the
// background so the fallback is ready by the time the user speaks.
import { viaGoogle, MAX_TEXT } from '../translate.js';

const OLD_PATHS = /^\/(speaker|listen)(\.html)?$|^\/l\/[^/]+$/;
const json = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });

const cache = new Map();

async function viaFallback(env, text) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 40000); // Render free tier can take ~30s to wake
  try {
    const r = await fetch(env.FALLBACK_API + '/api/translate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text }),
      signal: ctrl.signal,
    });
    const body = await r.json().catch(() => ({}));
    if (!r.ok || !body.he) throw new Error('HTTP ' + r.status + (body.detail ? ' (' + body.detail + ')' : ''));
    return body.he;
  } finally {
    clearTimeout(timer);
  }
}

async function translate(env, text) {
  const key = text.toLowerCase();
  if (cache.has(key)) return [200, { he: cache.get(key) }];
  let he;
  try {
    he = await viaGoogle(text);
  } catch (e1) {
    if (!env.FALLBACK_API) return [502, { error: 'translate_failed', detail: 'google: ' + e1.message }];
    try {
      he = await viaFallback(env, text);
    } catch (e2) {
      return [502, { error: 'translate_failed', detail: 'google: ' + e1.message + ' | fallback: ' + e2.message }];
    }
  }
  cache.set(key, he);
  if (cache.size > 2000) cache.delete(cache.keys().next().value);
  return [200, { he }];
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/api/translate') {
      if (request.method !== 'POST') return json(405, { error: 'method_not_allowed' });
      if (Number(request.headers.get('content-length') || 0) > 8192) return json(413, { error: 'too_large' });
      let body;
      try {
        body = await request.json();
      } catch {
        return json(400, { error: 'bad_json' });
      }
      const text = String((body && body.text) || '').trim().slice(0, MAX_TEXT);
      if (!text) return json(400, { error: 'empty' });
      const [status, out] = await translate(env, text);
      return json(status, out);
    }

    if (url.pathname === '/health') return json(200, { ok: true });
    if (OLD_PATHS.test(url.pathname)) return Response.redirect(url.origin + '/', 301);

    if (env.FALLBACK_API && request.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
      ctx.waitUntil(fetch(env.FALLBACK_API + '/health').catch(() => {}));
    }
    return env.ASSETS.fetch(request);
  },
};
