'use strict';
// RU -> HE translation shared by the Render server (server.js) and the Cloudflare Worker (worker/index.js).
// Free endpoints, no API key: Google gtx first, MyMemory as fallback.

const MAX_TEXT = 600;

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

// Per-IP limit (in memory: per process on Render, per isolate on Cloudflare).
const RATE_LIMIT = 300; // requests per minute (interim updates are ~1-2/s)
const hits = new Map(); // ip -> {n, reset}
function limited(ip) {
  const now = Date.now();
  let h = hits.get(ip);
  if (!h || now > h.reset) {
    if (hits.size > 5000) for (const [k, v] of hits) if (now > v.reset) hits.delete(k);
    h = { n: 0, reset: now + 60000 };
    hits.set(ip, h);
  }
  return ++h.n > RATE_LIMIT;
}

/** Shared API logic: returns [status, body]. */
async function handleTranslate(ip, body) {
  if (limited(ip)) return [429, { error: 'rate_limited' }];
  const text = String((body && body.text) || '').trim().slice(0, MAX_TEXT);
  if (!text) return [400, { error: 'empty' }];
  const he = await translate(text);
  if (!he) return [502, { error: 'translate_failed' }];
  return [200, { he }];
}

module.exports = { translate, handleTranslate };
