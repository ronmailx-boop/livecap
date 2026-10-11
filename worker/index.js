// Cloudflare Worker: static files come from public/ (assets binding); this script handles
// only what is not a file there: the translate API, health check and old two-screen URLs.
import { handleTranslate } from '../translate.js';

const OLD_PATHS = /^\/(speaker|listen)(\.html)?$|^\/l\/[^/]+$/;
const json = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });

export default {
  async fetch(request, env) {
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
      const ip = request.headers.get('cf-connecting-ip') || 'unknown';
      const [status, out] = await handleTranslate(ip, body);
      return json(status, out);
    }

    if (url.pathname === '/health') return json(200, { ok: true });
    if (OLD_PATHS.test(url.pathname)) return Response.redirect(url.origin + '/', 301);

    return env.ASSETS.fetch(request);
  },
};
