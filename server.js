'use strict';
/**
 * Live translate RU -> HE, single user.
 * - The browser does speech recognition (Web Speech API, free) and posts Russian text.
 * - This server translates it to Hebrew (free endpoints, no API key) and returns it.
 */
const path = require('path');
const express = require('express');

const PORT = process.env.PORT || 3000;
const MAX_TEXT = 600;
const RATE_LIMIT = 300; // requests per IP per minute (interim updates are ~1-2/s)

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.get('/health', (_req, res) => res.json({ ok: true }));
// Old two-screen URLs (installed shortcuts, shared links) now open the single app.
app.get(['/speaker.html', '/speaker', '/listen.html', '/listen', '/l/:code'], (_req, res) => res.redirect(301, '/'));
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

/* ---------------- translation ---------------- */

const cache = new Map();
function cacheSet(k, v) {
  cache.set(k, v);
  if (cache.size > 2000) cache.delete(cache.keys().next().value);
}

async function fetchJson(url, ms = 4000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { 'user-agent': 'Mozilla/5.0' } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } finally {
    clearTimeout(timer);
  }
}

async function viaGoogle(text) {
  const url =
    'https://translate.googleapis.com/translate_a/single?client=gtx&sl=ru&tl=iw&dt=t&q=' +
    encodeURIComponent(text);
  const data = await fetchJson(url);
  return data[0].map((s) => s[0]).join('').trim();
}

async function viaMyMemory(text) {
  const url = 'https://api.mymemory.translated.net/get?langpair=ru|he&q=' + encodeURIComponent(text);
  const data = await fetchJson(url);
  const t = data && data.responseData && data.responseData.translatedText;
  if (!t) throw new Error('empty');
  return String(t).trim();
}

async function translate(text) {
  const key = text.toLowerCase();
  if (cache.has(key)) return cache.get(key);
  let out;
  try {
    out = await viaGoogle(text);
  } catch (e1) {
    try {
      out = await viaMyMemory(text);
    } catch (e2) {
      console.warn('translate failed:', e1.message, '|', e2.message);
      return null;
    }
  }
  cacheSet(key, out);
  return out;
}

/* ---------------- api ---------------- */

const hits = new Map(); // ip -> {n, reset}
function limited(ip) {
  const now = Date.now();
  let h = hits.get(ip);
  if (!h || now > h.reset) {
    h = { n: 0, reset: now + 60000 };
    hits.set(ip, h);
  }
  return ++h.n > RATE_LIMIT;
}
setInterval(() => {
  const now = Date.now();
  for (const [ip, h] of hits) if (now > h.reset) hits.delete(ip);
}, 60000).unref();

app.post('/api/translate', express.json({ limit: '8kb' }), async (req, res) => {
  if (limited(req.ip)) return res.status(429).json({ error: 'rate_limited' });
  const text = String((req.body && req.body.text) || '').trim().slice(0, MAX_TEXT);
  if (!text) return res.status(400).json({ error: 'empty' });
  const he = await translate(text);
  if (!he) return res.status(502).json({ error: 'translate_failed' });
  res.json({ he });
});

if (require.main === module) {
  app.listen(PORT, () => console.log('livecap listening on :' + PORT));
}

module.exports = { app, translate };
