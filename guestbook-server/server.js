/* Shared guestbook backend for the y2kcalled.ppc museum.
 * Pure node:http — zero npm dependencies.
 *
 * Storage: Upstash Redis (REST API) when UPSTASH_REDIS_REST_URL and
 * UPSTASH_REDIS_REST_TOKEN are set — survives redeploys and restarts.
 * Without them, falls back to the local JSON files next to this file
 * (ephemeral on Render free: entries are lost on redeploy/restart).
 * The disk files are always written as a warm backup, and on boot any
 * disk entries are restored into Redis if Redis is empty.
 *
 * Run with: node server.js  (or: npm start)
 */
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'entries.json');
const MEM_FILE = path.join(__dirname, 'memories.json');
const KEY_ENTRIES = 'museum:entries';
const KEY_MEMORIES = 'museum:memories';
const MAX_ENTRIES = 500;          // cap stored entries (drop oldest first)
const RATE_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_MAX_POSTS = 10;        // max POSTs per IP per window

const UPSTASH_URL = (process.env.UPSTASH_REDIS_REST_URL || '').replace(/\/+$/, '');
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || '';
const useRedis = !!(UPSTASH_URL && UPSTASH_TOKEN);

/* ---------- Upstash Redis REST helper (body-style: POST a JSON array) ---------- */
function redis(cmd) {
  return new Promise((resolve, reject) => {
    let body;
    try { body = JSON.stringify(cmd); } catch (e) { reject(e); return; }
    let u;
    try { u = new URL(UPSTASH_URL); } catch (e) { reject(e); return; }
    const req = https.request({
      hostname: u.hostname,
      port: u.port || 443,
      path: '/',
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + UPSTASH_TOKEN,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed && parsed.error) reject(new Error('upstash: ' + parsed.error));
          else resolve(parsed ? parsed.result : undefined);
        } catch (e) { reject(new Error('upstash: bad response')); }
      });
    });
    req.on('error', reject);
    req.setTimeout(8000, () => req.destroy(new Error('upstash: timeout')));
    req.end(body);
  });
}

/* ---------- storage: Redis primary, disk as warm backup ---------- */
function readDisk(file) {
  try {
    const arr = JSON.parse(fs.readFileSync(file, 'utf8'));
    return Array.isArray(arr) ? arr : [];
  } catch (e) { return []; }
}
function writeDisk(file, list) {
  try { fs.writeFileSync(file, JSON.stringify(list)); }
  catch (e) { console.error('Could not write ' + file + ':', e.message); }
}

async function loadList(key, file) {
  if (useRedis) {
    try {
      const raw = await redis(['GET', key]);
      if (raw != null) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) return arr;
      }
    } catch (e) { console.error('redis read failed, using disk backup:', e.message); }
  }
  return readDisk(file);
}

async function saveList(key, file, list) {
  if (useRedis) {
    try { await redis(['SET', key, JSON.stringify(list)]); }
    catch (e) { console.error('redis write failed:', e.message); }
  }
  writeDisk(file, list);
}

// One-time boot: if Redis is empty but the disk has entries, restore them.
async function migrateDiskToRedis() {
  for (const pair of [[KEY_ENTRIES, DATA_FILE], [KEY_MEMORIES, MEM_FILE]]) {
    const key = pair[0], file = pair[1];
    try {
      const raw = await redis(['GET', key]);
      const disk = readDisk(file);
      if ((raw == null || raw === '[]') && disk.length > 0) {
        await redis(['SET', key, JSON.stringify(disk)]);
        console.log('migrated ' + disk.length + ' records from disk to redis: ' + key);
      }
    } catch (e) { console.error('migration check failed for ' + key + ':', e.message); }
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

/* Strip control characters, trim, and cap length. */
function clean(value, max) {
  return String(value == null ? '' : value)
    .replace(/[\x00-\x1F\x7F]/g, '')
    .trim()
    .slice(0, max);
}

const hits = new Map(); // ip -> [timestamps]
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

function readBody(req, cap) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > cap) { req.destroy(); reject(new Error('body too large')); }
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

async function handle(req, res) {
  // CORS: the museum page is served from a different origin (GitHub Pages).
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, 'http://localhost');
  const ip = (req.socket && req.socket.remoteAddress) || 'unknown';

  if (url.pathname === '/health' && req.method === 'GET') {
    json(res, 200, { ok: true, store: useRedis ? 'redis' : 'disk' });
    return;
  }

  if (url.pathname === '/api/entries' && req.method === 'GET') {
    json(res, 200, await loadList(KEY_ENTRIES, DATA_FILE));
    return;
  }

  if (url.pathname === '/api/entries' && req.method === 'POST') {
    if (!rateOk(ip)) {
      json(res, 429, { error: 'Too many entries — slow down a little.' });
      return;
    }
    let data;
    try { data = JSON.parse(await readBody(req, 1e6)); }
    catch (e) { json(res, 400, { error: 'Bad JSON.' }); return; }
    const who = clean(data.who, 40);
    const where = clean(data.where, 60);
    const msg = clean(data.msg, 500);
    if (!who || !msg) {
      json(res, 400, { error: 'Name and message are required.' });
      return;
    }
    const list = await loadList(KEY_ENTRIES, DATA_FILE);
    const entry = { who, where, msg, ts: Date.now() };
    list.push(entry);
    while (list.length > MAX_ENTRIES) list.shift();
    await saveList(KEY_ENTRIES, DATA_FILE, list);
    json(res, 201, entry);
    return;
  }

  if (url.pathname === '/api/presence' && req.method === 'POST') {
    let id = '';
    try { id = clean(JSON.parse(await readBody(req, 1e4)).id, 64); } catch (e) {}
    if (id) presence.set(id, Date.now());
    json(res, 200, { count: presenceCount() });
    return;
  }

  if (url.pathname === '/api/presence' && req.method === 'GET') {
    json(res, 200, { count: presenceCount() });
    return;
  }

  if (url.pathname === '/api/memories' && req.method === 'GET') {
    json(res, 200, await loadList(KEY_MEMORIES, MEM_FILE));
    return;
  }

  if (url.pathname === '/api/memories' && req.method === 'POST') {
    if (!rateOk(ip)) {
      json(res, 429, { error: 'Too many entries — slow down a little.' });
      return;
    }
    let data;
    try { data = JSON.parse(await readBody(req, 1e6)); }
    catch (e) { json(res, 400, { error: 'Bad JSON.' }); return; }
    const who = clean(data.who, 40);
    const when = clean(data.when, 12);
    const msg = clean(data.msg, 280);
    if (!who || !msg) {
      json(res, 400, { error: 'Name and memory are required.' });
      return;
    }
    const list = await loadList(KEY_MEMORIES, MEM_FILE);
    const entry = { who, when, msg, ts: Date.now() };
    list.push(entry);
    while (list.length > MAX_ENTRIES) list.shift();
    await saveList(KEY_MEMORIES, MEM_FILE, list);
    json(res, 201, entry);
    return;
  }

  // DELETE /api/memories — remove entries matching who+when+msg exactly.
  // Same open-write model as POST (this is a small public wall); rate-limited.
  if (url.pathname === '/api/memories' && req.method === 'DELETE') {
    if (!rateOk(ip)) {
      json(res, 429, { error: 'Too many requests — slow down a little.' });
      return;
    }
    let data;
    try { data = JSON.parse(await readBody(req, 1e6)); }
    catch (e) { json(res, 400, { error: 'Bad JSON.' }); return; }
    const dwho = clean(data.who, 40);
    const dwhen = clean(data.when, 12);
    const dmsg = clean(data.msg, 280);
    if (!dwho || !dmsg) {
      json(res, 400, { error: 'who and msg are required to identify the entry.' });
      return;
    }
    const dlist = await loadList(KEY_MEMORIES, MEM_FILE);
    const kept = dlist.filter((e) => !(e.who === dwho && e.when === dwhen && e.msg === dmsg));
    if (kept.length === dlist.length) {
      json(res, 404, { error: 'No matching entry.' });
      return;
    }
    await saveList(KEY_MEMORIES, MEM_FILE, kept);
    json(res, 200, { deleted: dlist.length - kept.length });
    return;
  }

  json(res, 404, { error: 'Not found.' });
}

const server = http.createServer((req, res) => {
  handle(req, res).catch((e) => {
    console.error('request failed:', e.message);
    try { json(res, 500, { error: 'Server hiccup — try again.' }); } catch (_) {}
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, async () => {
  console.log('Guestbook server listening on port ' + PORT + ' (store: ' + (useRedis ? 'redis' : 'disk') + ')');
  if (useRedis) await migrateDiskToRedis();
});
