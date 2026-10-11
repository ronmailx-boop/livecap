'use strict';
/**
 * Live translate RU -> HE, single user (Render host; Cloudflare runs worker/index.js).
 * - The browser does speech recognition (Web Speech API, free) and posts Russian text.
 * - This server translates it to Hebrew (translate.js) and returns it.
 */
const path = require('path');
const express = require('express');
const { translate, handleTranslate } = require('./translate');

const PORT = process.env.PORT || 3000;

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.get('/health', (_req, res) => res.json({ ok: true }));
// Old two-screen URLs (installed shortcuts, shared links) now open the single app.
app.get(['/speaker.html', '/speaker', '/listen.html', '/listen', '/l/:code'], (_req, res) => res.redirect(301, '/'));
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

app.post('/api/translate', express.json({ limit: '8kb' }), async (req, res) => {
  const [status, body] = await handleTranslate(req.ip, req.body);
  res.status(status).json(body);
});

if (require.main === module) {
  app.listen(PORT, () => console.log('livecap listening on :' + PORT));
}

module.exports = { app, translate };
