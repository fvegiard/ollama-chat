#!/usr/bin/env node
/**
 * AG ⚡ FVD — OLLAMA CHAT
 * Zero-dependency node:http server.
 * Serves public/index.html and proxies to a local (or LAN/Tailscale) Ollama.
 *
 * Alliance Gagnante — Francis Végiard Dev
 */
'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const PORT = Number(process.env.PORT || 4200);
const OLLAMA_BASE_URL = (process.env.OLLAMA_BASE_URL || 'http://localhost:11434').replace(/\/+$/, '');
const CHAT_TIMEOUT_MS = 120_000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function readBody(req, limit = 5 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        reject(new Error('payload too large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function handleModels(res) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const r = await fetch(`${OLLAMA_BASE_URL}/api/tags`, { signal: controller.signal });
    if (!r.ok) throw new Error(`ollama status ${r.status}`);
    const data = await r.json();
    const models = (data.models || []).map((m) => m.name).filter(Boolean);
    sendJson(res, 200, { online: true, models });
  } catch {
    sendJson(res, 200, { online: false, models: [] });
  } finally {
    clearTimeout(timer);
  }
}

async function handleChat(req, res) {
  let payload;
  try {
    const raw = await readBody(req);
    payload = JSON.parse(raw);
  } catch {
    sendJson(res, 400, { error: 'Invalid JSON body' });
    return;
  }
  const { model, messages } = payload || {};
  if (!model || !Array.isArray(messages)) {
    sendJson(res, 400, { error: 'Expected { model, messages: [{role, content}] }' });
    return;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CHAT_TIMEOUT_MS);
  // Client disconnected → abort upstream too
  res.on('close', () => controller.abort());

  let upstream;
  try {
    upstream = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, stream: true }),
      signal: controller.signal,
    });
    if (!upstream.ok || !upstream.body) {
      throw new Error(`ollama status ${upstream.status}`);
    }
  } catch (err) {
    clearTimeout(timer);
    const offline = controller.signal.aborted
      ? 'Ollama timeout or aborted'
      : 'Ollama offline — run `ollama serve`';
    sendJson(res, 502, { error: offline });
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'application/x-ndjson; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Accel-Buffering': 'no',
    'Connection': 'keep-alive',
  });

  // Pipe the NDJSON stream straight through to the browser.
  try {
    const reader = upstream.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!res.write(value)) {
        await new Promise((r) => res.once('drain', r));
      }
    }
    res.end();
  } catch {
    res.end();
  } finally {
    clearTimeout(timer);
  }
}

function serveStatic(req, res) {
  const publicDir = path.join(__dirname, 'public');
  let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  const filePath = path.normalize(path.join(publicDir, urlPath));
  if (!filePath.startsWith(publicDir)) {
    sendJson(res, 403, { error: 'Forbidden' });
    return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      sendJson(res, 404, { error: 'Not found' });
      return;
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const url = (req.url || '/').split('?')[0];
  if (req.method === 'GET' && url === '/api/health') return sendJson(res, 200, { ok: true });
  if (req.method === 'GET' && url === '/api/models') return void handleModels(res);
  if (req.method === 'POST' && url === '/api/chat') return void handleChat(req, res);
  if (req.method === 'GET') return serveStatic(req, res);
  sendJson(res, 405, { error: 'Method not allowed' });
});

server.listen(PORT, () => {
  console.log(`⚡ AG x FVD — OLLAMA CHAT`);
  console.log(`   → http://localhost:${PORT}`);
  console.log(`   → Ollama: ${OLLAMA_BASE_URL}`);
});
