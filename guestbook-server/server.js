/* Shared guestbook backend for "The 2000s Called" museum.
 * Pure node:http — zero npm dependencies. Stores entries in entries.json
 * next to this file. Run with: node server.js  (or: npm start)
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'entries.json');
const MAX_ENTRIES = 500;          // cap stored entries (drop oldest first)
const RATE_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_MAX_POSTS = 10;        // max POSTs per IP per window

const hits = new Map(); // ip -> [timestamps]

function load() {
  try {
    const arr = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    return [];
  }
}

function save(list) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(list));
  } catch (e) {
    console.error('Could not save entries.json:', e.message);
  }
}

/* ---------- presence (ephemeral, in-memory) ---------- */
const presence = new Map(); // visitor id -> last-seen timestamp
const PRESENCE_TTL_MS = 90 * 1000;
function presenceCount() {
  const now = Date.now();
  for (const [id, ts] of presence) if (now - ts > PRESENCE_TTL_MS) presence.delete(id);
  return presence.size;
}

/* ---------- community memory wall (persisted like entries) ---------- */
const MEM_FILE = path.join(__dirname, 'memories.json');
function loadMem() {
  try {
    const arr = JSON.parse(fs.readFileSync(MEM_FILE, 'utf8'));
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    return [];
  }
}
function saveMem(list) {
  try {
    fs.writeFileSync(MEM_FILE, JSON.stringify(list));
  } catch (e) {
    console.error('Could not save memories.json:', e.message);
  }
}

/* Strip control characters, trim, and cap length. */
function clean(value, max) {
  return String(value == null ? '' : value)
    .replace(/[\x00-\x1F\x7F]/g, '')
    .trim()
    .slice(0, max);
}

function rateOk(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS);
  arr.push(now);
  hits.set(ip, arr);
  return arr.length <= RATE_MAX_POSTS;
}

function json(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
}

const server = http.createServer((req, res) => {
  // CORS: the museum page is served from a different origin (GitHub Pages).
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, 'http://localhost');

  if (url.pathname === '/health' && req.method === 'GET') {
    json(res, 200, { ok: true });
    return;
  }

  if (url.pathname === '/api/entries' && req.method === 'GET') {
    json(res, 200, load());
    return;
  }

  if (url.pathname === '/api/entries' && req.method === 'POST') {
    const ip = (req.socket && req.socket.remoteAddress) || 'unknown';
    if (!rateOk(ip)) {
      json(res, 429, { error: 'Too many entries — slow down a little.' });
      return;
    }
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1e6) req.destroy(); // sanity cap on body size
    });
    req.on('end', () => {
      let data;
      try {
        data = JSON.parse(body);
      } catch (e) {
        json(res, 400, { error: 'Bad JSON.' });
        return;
      }
      const who = clean(data.who, 40);
      const where = clean(data.where, 60);
      const msg = clean(data.msg, 500);
      if (!who || !msg) {
        json(res, 400, { error: 'Name and message are required.' });
        return;
      }
      const list = load();
      const entry = { who, where, msg, ts: Date.now() };
      list.push(entry);
      while (list.length > MAX_ENTRIES) list.shift();
      save(list);
      json(res, 201, entry);
    });
    return;
  }

  if (url.pathname === '/api/presence' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > 1e4) req.destroy(); });
    req.on('end', () => {
      let id = '';
      try { id = clean(JSON.parse(body).id, 64); } catch (e) {}
      if (id) presence.set(id, Date.now());
      json(res, 200, { count: presenceCount() });
    });
    return;
  }

  if (url.pathname === '/api/presence' && req.method === 'GET') {
    json(res, 200, { count: presenceCount() });
    return;
  }

  if (url.pathname === '/api/memories' && req.method === 'GET') {
    json(res, 200, loadMem());
    return;
  }

  if (url.pathname === '/api/memories' && req.method === 'POST') {
    const ip = (req.socket && req.socket.remoteAddress) || 'unknown';
    if (!rateOk(ip)) {
      json(res, 429, { error: 'Too many entries \u2014 slow down a little.' });
      return;
    }
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1e6) req.destroy();
    });
    req.on('end', () => {
      let data;
      try {
        data = JSON.parse(body);
      } catch (e) {
        json(res, 400, { error: 'Bad JSON.' });
        return;
      }
      const who = clean(data.who, 40);
      const when = clean(data.when, 12);
      const msg = clean(data.msg, 280);
      if (!who || !msg) {
        json(res, 400, { error: 'Name and memory are required.' });
        return;
      }
      const list = loadMem();
      const entry = { who, when, msg, ts: Date.now() };
      list.push(entry);
      while (list.length > MAX_ENTRIES) list.shift();
      saveMem(list);
      json(res, 201, entry);
    });
    return;
  }

  // DELETE /api/memories — remove entries matching who+when+msg exactly.
  // Same open-write model as POST (this is a small public wall); rate-limited.
  if (url.pathname === '/api/memories' && req.method === 'DELETE') {
    const dip = (req.socket && req.socket.remoteAddress) || 'unknown';
    if (!rateOk(dip)) {
      json(res, 429, { error: 'Too many requests — slow down a little.' });
      return;
    }
    let dbody = '';
    req.on('data', (chunk) => {
      dbody += chunk;
      if (dbody.length > 1e6) req.destroy();
    });
    req.on('end', () => {
      let ddata;
      try {
        ddata = JSON.parse(dbody);
      } catch (e) {
        json(res, 400, { error: 'Bad JSON.' });
        return;
      }
      const dwho = clean(ddata.who, 40);
      const dwhen = clean(ddata.when, 12);
      const dmsg = clean(ddata.msg, 280);
      if (!dwho || !dmsg) {
        json(res, 400, { error: 'who and msg are required to identify the entry.' });
        return;
      }
      const dlist = loadMem();
      const kept = dlist.filter((e) => !(e.who === dwho && e.when === dwhen && e.msg === dmsg));
      if (kept.length === dlist.length) {
        json(res, 404, { error: 'No matching entry.' });
        return;
      }
      saveMem(kept);
      json(res, 200, { deleted: dlist.length - kept.length });
    });
    return;
  }

  json(res, 404, { error: 'Not found.' });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('Guestbook server listening on port ' + PORT));
