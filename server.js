'use strict';
/**
 * Live translate RU -> HE
 * - Speaker's browser does speech recognition (Web Speech API, free) and sends Russian text.
 * - This server translates it to Hebrew (free endpoints, no API key) and fans it out
 *   to every listener in the room over WebSocket.
 */
const http = require('http');
const path = require('path');
const express = require('express');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;
const MAX_ROOMS = 200;
const MAX_TEXT = 600;
const HISTORY = 40;
const INTERIM_MS = 650;
const ROOM_TTL_MS = 6 * 60 * 60 * 1000;

const app = express();
app.disable('x-powered-by');
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));
app.get('/health', (_req, res) => res.json({ ok: true, rooms: rooms.size }));
app.get('/l/:code', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'listen.html')));

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 16 * 1024 });

/** @type {Map<string, Room>} */
const rooms = new Map();

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

/* ---------------- rooms ---------------- */

class Room {
  constructor(code, token) {
    this.code = code;
    this.token = token;
    this.host = null;
    this.listeners = new Set();
    this.history = []; // finals only
    this.interim = null; // {id, text}
    this.interimTimer = null;
    this.lastInterimAt = 0;
    this.seq = 0;
    this.touched = Date.now();
  }
  send(ws, obj) {
    if (ws.readyState === 1) ws.send(JSON.stringify(obj));
  }
  broadcast(obj) {
    const msg = JSON.stringify(obj);
    for (const ws of this.listeners) if (ws.readyState === 1) ws.send(msg);
    if (this.host) this.send(this.host, obj);
  }
  count() {
    return this.listeners.size;
  }
  pushCount() {
    this.broadcast({ t: 'count', n: this.count() });
  }

  async handleSeg({ id, text, final }) {
    text = String(text || '').trim().slice(0, MAX_TEXT);
    if (!text || typeof id !== 'number') return;
    this.touched = Date.now();
    if (final) {
      clearTimeout(this.interimTimer);
      this.interim = null;
      const he = await translate(text);
      const cap = { t: 'cap', id, ru: text, he: he || '⚠ תרגום נכשל', final: true };
      this.history.push(cap);
      if (this.history.length > HISTORY) this.history.shift();
      this.broadcast(cap);
      return;
    }
    // interim: throttle, only the latest text matters
    this.interim = { id, text };
    const wait = Math.max(0, this.lastInterimAt + INTERIM_MS - Date.now());
    if (this.interimTimer) return;
    this.interimTimer = setTimeout(async () => {
      this.interimTimer = null;
      const cur = this.interim;
      if (!cur) return;
      this.lastInterimAt = Date.now();
      const he = await translate(cur.text);
      // drop if finalized/replaced while translating
      if (!he || !this.interim || this.interim.id !== cur.id) return;
      this.broadcast({ t: 'cap', id: cur.id, ru: cur.text, he, final: false });
    }, wait);
  }
}

setInterval(() => {
  const now = Date.now();
  for (const [code, r] of rooms) {
    if (!r.host && r.count() === 0 && now - r.touched > ROOM_TTL_MS) rooms.delete(code);
  }
}, 10 * 60 * 1000).unref();

/* ---------------- websocket ---------------- */

const CODE_RE = /^[A-Z0-9]{4,8}$/;

wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.on('pong', () => (ws.isAlive = true));
  let room = null;
  let role = null;

  ws.on('message', (raw) => {
    let m;
    try {
      m = JSON.parse(raw);
    } catch {
      return;
    }

    if (m.t === 'host') {
      const code = String(m.room || '').toUpperCase();
      const token = String(m.token || '');
      if (!CODE_RE.test(code) || token.length < 8) return ws.send(JSON.stringify({ t: 'error', msg: 'bad_room' }));
      let r = rooms.get(code);
      if (!r) {
        if (rooms.size >= MAX_ROOMS) return ws.send(JSON.stringify({ t: 'error', msg: 'full' }));
        r = new Room(code, token);
        rooms.set(code, r);
      } else if (r.token !== token) {
        return ws.send(JSON.stringify({ t: 'error', msg: 'taken' }));
      }
      if (r.host && r.host !== ws) r.host.close(4000, 'replaced');
      r.host = ws;
      room = r;
      role = 'host';
      r.send(ws, { t: 'hosted', room: code, n: r.count() });
      r.broadcast({ t: 'live', on: true });
      return;
    }

    if (m.t === 'join') {
      const code = String(m.room || '').toUpperCase();
      const r = rooms.get(code);
      if (!r) return ws.send(JSON.stringify({ t: 'error', msg: 'no_room' }));
      room = r;
      role = 'listener';
      r.listeners.add(ws);
      r.send(ws, { t: 'joined', room: code, live: !!r.host, history: r.history });
      r.pushCount();
      return;
    }

    if (m.t === 'seg' && role === 'host' && room) {
      room.handleSeg(m).catch((e) => console.warn('seg error', e.message));
    }
  });

  ws.on('close', () => {
    if (!room) return;
    if (role === 'listener') {
      room.listeners.delete(ws);
      room.pushCount();
    } else if (role === 'host' && room.host === ws) {
      room.host = null;
      room.touched = Date.now();
      room.broadcast({ t: 'live', on: false });
    }
  });
  ws.on('error', () => {});
});

// heartbeat (also keeps proxies from dropping idle sockets)
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) {
      ws.terminate();
      continue;
    }
    ws.isAlive = false;
    ws.ping();
  }
}, 25000).unref();

if (require.main === module) {
  server.listen(PORT, () => console.log('livecap listening on :' + PORT));
}

module.exports = { server, translate, rooms };
