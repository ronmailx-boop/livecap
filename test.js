'use strict';
// Smoke test: host + 2 listeners, with translation stubbed (sandbox has no access to translate endpoints).
const WebSocket = require('ws');
const origFetch = global.fetch;
global.fetch = async (url) => {
  if (String(url).includes('translate.googleapis.com')) {
    const q = decodeURIComponent(String(url).split('&q=')[1]);
    return { ok: true, json: async () => [[['[HE] ' + q, q]]] };
  }
  return origFetch(url);
};
const { server } = require('./server');

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const open = (ws) => new Promise((r) => ws.on('open', r));

(async () => {
  await new Promise((r) => server.listen(0, r));
  const url = 'ws://127.0.0.1:' + server.address().port + '/ws';
  const got = { a: [], b: [] };
  const host = new WebSocket(url);
  await open(host);
  host.send(JSON.stringify({ t: 'host', room: 'TEST1', token: 'secret-token-123' }));
  await wait(100);

  const mk = async (k) => {
    const w = new WebSocket(url);
    w.on('message', (d) => got[k].push(JSON.parse(d)));
    await open(w);
    w.send(JSON.stringify({ t: 'join', room: 'test1' }));
    return w;
  };
  const a = await mk('a');
  await wait(100);

  host.send(JSON.stringify({ t: 'seg', id: 1, text: 'привет', final: false }));
  await wait(900);
  host.send(JSON.stringify({ t: 'seg', id: 1, text: 'привет мир', final: true }));
  await wait(300);
  const b = await mk('b'); // late joiner gets history
  await wait(200);

  // impostor cannot hijack the room
  const bad = new WebSocket(url);
  let badMsg;
  bad.on('message', (d) => (badMsg = JSON.parse(d)));
  await open(bad);
  bad.send(JSON.stringify({ t: 'host', room: 'TEST1', token: 'wrong-token-999' }));
  await wait(150);

  const fin = (k) => got[k].filter((m) => m.t === 'cap' && m.final);
  const checks = [
    ['listener A got interim', got.a.some((m) => m.t === 'cap' && !m.final && m.he === '[HE] привет')],
    ['listener A got final', fin('a').length === 1 && fin('a')[0].he === '[HE] привет мир'],
    ['late joiner B got history', got.b.some((m) => m.t === 'joined' && m.history.length === 1)],
    ['impostor rejected', badMsg && badMsg.msg === 'taken'],
    ['listener count broadcast', got.a.some((m) => m.t === 'count' && m.n === 2)],
  ];
  let ok = true;
  for (const [n, p] of checks) { console.log(p ? 'PASS' : 'FAIL', n); ok = ok && !!p; }
  process.exit(ok ? 0 : 1);
})();
