'use strict';
// Smoke test for the translate API, with translation stubbed (sandbox has no access to translate endpoints).
let googleDown = false;
let myMemoryDown = false;
const origFetch = global.fetch;
global.fetch = async (url, opts) => {
  const u = String(url);
  if (u.includes('translate.googleapis.com')) {
    if (googleDown) return { ok: false, status: 503 };
    const q = decodeURIComponent(u.split('&q=')[1]);
    return { ok: true, json: async () => [[['[HE] ' + q, q]]] };
  }
  if (u.includes('api.mymemory.translated.net')) {
    if (myMemoryDown) return { ok: false, status: 503 };
    const q = decodeURIComponent(u.split('&q=')[1]);
    return { ok: true, json: async () => ({ responseData: { translatedText: '[MM] ' + q } }) };
  }
  if (u.startsWith('https://fallback.test/api/translate')) {
    const { text } = JSON.parse(opts.body);
    return new Response(JSON.stringify({ he: '[FB] ' + text }), { status: 200 });
  }
  return origFetch(url, opts);
};
const { app } = require('./server');

(async () => {
  const server = await new Promise((r) => { const s = app.listen(0, () => r(s)); });
  const base = 'http://127.0.0.1:' + server.address().port;
  const post = (text) =>
    origFetch(base + '/api/translate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text }),
    });

  const r1 = await post('привет мир');
  const b1 = await r1.json();

  const r2 = await post('   ');

  googleDown = true;
  const b3 = await (await post('доброе утро')).json();

  myMemoryDown = true;
  const r4 = await post('как дела');
  googleDown = myMemoryDown = false;

  const b5 = await (await post('x'.repeat(2000))).json();
  const health = await (await origFetch(base + '/health')).json();
  const old = await origFetch(base + '/l/ABCDE', { redirect: 'manual' });
  const home = await (await origFetch(base + '/')).text();

  // Cloudflare Worker: same API, static files from the ASSETS binding
  const worker = (await import('./worker/index.js')).default;
  const env = { ASSETS: { fetch: async () => new Response('asset') } };
  const wpost = (body) => worker.fetch(new Request('https://livecap.test/api/translate', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body,
  }), env);
  const w1 = await wpost(JSON.stringify({ text: 'спасибо' }));
  const w1b = await w1.json();
  const w2 = await wpost('not json');
  const w3 = await worker.fetch(new Request('https://livecap.test/l/ABCDE'), env);
  const w4 = await (await worker.fetch(new Request('https://livecap.test/style.css'), env)).text();
  googleDown = true;
  const fbEnv = { ...env, FALLBACK_API: 'https://fallback.test' };
  const w5 = await (await worker.fetch(new Request('https://livecap.test/api/translate', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: 'пока' }),
  }), fbEnv)).json();
  googleDown = false;

  const checks = [
    ['translates russian to hebrew', r1.status === 200 && b1.he === '[HE] привет мир'],
    ['rejects empty text', r2.status === 400],
    ['falls back to MyMemory', b3.he === '[MM] доброе утро'],
    ['reports failure when both fail', r4.status === 502],
    ['truncates long text', b5.he === '[HE] ' + 'x'.repeat(600)],
    ['health ok', health.ok === true],
    ['old listener link redirects home', old.status === 301 && old.headers.get('location') === '/'],
    ['home page has the mic', home.includes('id="mic"')],
    ['worker translates', w1.status === 200 && w1b.he === '[HE] спасибо'],
    ['worker rejects bad json', w2.status === 400],
    ['worker redirects old link', w3.status === 301 && w3.headers.get('location') === 'https://livecap.test/'],
    ['worker serves static files', w4 === 'asset'],
    ['worker falls back to Render when Google is blocked', w5.he === '[FB] пока'],
  ];
  let ok = true;
  for (const [n, p] of checks) { console.log(p ? 'PASS' : 'FAIL', n); ok = ok && !!p; }
  server.close();
  process.exit(ok ? 0 : 1);
})();
