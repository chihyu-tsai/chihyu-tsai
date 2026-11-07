import http from 'node:http';
import { readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import { resolve, dirname, extname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomUUID, createHash, timingSafeEqual } from 'node:crypto';
import { importMapsUrl, validateMapsUrl } from './lib/maps-link.mjs';
import { findCafeWebsite } from './lib/cafe-website.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.txt': 'text/plain', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.jpg': 'image/jpeg' };

function fail(status, message) { throw Object.assign(new Error(message), { status }); }

function validate(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail(400, 'A café object is required.');
  const text = (key, max, required = false) => {
    if (typeof input[key] !== 'string' || input[key].length > max || (required && !input[key].trim())) fail(400, `Invalid ${key}.`);
    return input[key].trim();
  };
  const name = text('name', 120, true);
  const address = text('address', 240);
  const notes = text('notes', 1200);
  const url = text('url', 500);
  // Optional for compatibility with cafés saved before geographic grouping existed.
  const country = input.country === undefined ? '' : text('country', 100);
  const state = input.state === undefined ? '' : text('state', 100);
  const city = input.city === undefined ? '' : text('city', 100);
  const googleMapsUrl = input.googleMapsUrl === undefined || input.googleMapsUrl === '' ? '' : validateMapsUrl(input.googleMapsUrl).href;
  if (url) {
    try { if (!['http:', 'https:'].includes(new URL(url).protocol)) throw new Error(); }
    catch { fail(400, 'Website must be an http or https URL.'); }
  }
  const { lat, lng } = input;
  if (typeof lat !== 'number' || !Number.isFinite(lat) || Math.abs(lat) > 90 || typeof lng !== 'number' || !Number.isFinite(lng) || Math.abs(lng) > 180) fail(400, 'Invalid map coordinates.');
  return { name, address, country, state, city, notes, url, googleMapsUrl, lat, lng };
}

async function body(req) {
  if (!req.headers['content-type']?.startsWith('application/json')) fail(415, 'Use application/json.');
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 8192) fail(413, 'Request is too large.');
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString()); }
  catch { fail(400, 'Invalid JSON.'); }
}

export function createCoffeeServer({ dataFile = process.env.COFFEE_DATA_FILE || resolve(root, 'data/runtime/coffees.json'), adminToken = process.env.COFFEE_ADMIN_TOKEN || '', mapsImporter = importMapsUrl, websiteFinder = findCafeWebsite, localDemo = false } = {}) {
  if (localDemo && process.env.NODE_ENV === 'production') throw new Error('Practice mode is unavailable in production.');
  let queue = Promise.resolve();
  const viewers = new Set();
  const read = async () => {
    try { return JSON.parse(await readFile(dataFile, 'utf8')); }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
      return JSON.parse(await readFile(resolve(root, 'data/coffees.json'), 'utf8'));
    }
  };
  const mutate = action => {
    const result = queue.then(async () => {
      const cafes = await read();
      const value = action(cafes);
      await mkdir(dirname(dataFile), { recursive: true });
      const temp = `${dataFile}.tmp`;
      await writeFile(temp, JSON.stringify(cafes, null, 2) + '\n', { mode: 0o600 });
      await rename(temp, dataFile);
      for (const viewer of viewers) if (!viewer.destroyed) viewer.write('event: cafes\ndata: updated\n\n');
      return value;
    });
    queue = result.catch(() => {});
    return result;
  };
  const isLocalRequest = req => {
    const addresses = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
    const hosts = new Set(['localhost', '127.0.0.1', '[::1]']);
    try { return addresses.has(req.socket.remoteAddress) && hosts.has(new URL(`http://${req.headers.host}`).hostname); }
    catch { return false; }
  };
  const authorized = req => {
    // Reject browser requests initiated by another website, even in practice mode.
    if (req.headers['sec-fetch-site'] === 'cross-site') fail(403, 'Cross-origin editing is not allowed.');
    if (req.headers.origin) {
      let origin;
      try { origin = new URL(req.headers.origin); } catch { fail(403, 'Cross-origin editing is not allowed.'); }
      if (origin.host !== req.headers.host) fail(403, 'Cross-origin editing is not allowed.');
    }
    if (localDemo) {
      if (!isLocalRequest(req)) fail(403, 'Practice mode is only available on localhost.');
      return;
    }
    if (adminToken.length < 24) fail(503, 'Editor is disabled. Set COFFEE_ADMIN_TOKEN to a secret of at least 24 characters.');
    const digest = value => createHash('sha256').update(value).digest();
    if (!timingSafeEqual(digest(req.headers.authorization || ''), digest(`Bearer ${adminToken}`))) fail(401, 'Incorrect editor key.');
  };
  return http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    const json = (status, value) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(value));
    };
    try {
      const path = new URL(req.url, 'http://localhost').pathname;
      if (path === '/api/health' && req.method === 'GET') return json(200, { ok: true });
      if (path === '/api/editor-config' && req.method === 'GET') return json(200, { localDemo: localDemo && isLocalRequest(req) });
      if (path === '/api/coffee-import') {
        if (req.method !== 'POST') return json(405, { error: 'Method not allowed.' });
        authorized(req);
        const input = await body(req);
        const place = await mapsImporter(input?.googleMapsUrl);
        const lookup = input?.lookupWebsite === false
          ? { website: '', websiteMessage: '' }
          : await websiteFinder(place);
        return json(200, { ...place, ...lookup });
      }
      if (path === '/api/coffees/events') {
        if (req.method !== 'GET') return json(405, { error: 'Method not allowed.' });
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
        res.write(': connected\n\n');
        viewers.add(res);
        const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 25000);
        heartbeat.unref();
        res.on('close', () => { viewers.delete(res); clearInterval(heartbeat); });
        return;
      }
      const match = path.match(/^\/api\/coffees(?:\/([a-zA-Z0-9-]+))?$/);
      if (match) {
        const id = match[1];
        if (req.method === 'GET' && !id) return json(200, await read());
        if (!['POST', 'PUT', 'DELETE'].includes(req.method)) return json(405, { error: 'Method not allowed.' });
        authorized(req);
        if (req.method === 'POST' && !id) {
          const cafe = { ...validate(await body(req)), id: randomUUID() };
          await mutate(cafes => { cafes.push(cafe); });
          return json(201, cafe);
        }
        if (id && ['PUT', 'DELETE'].includes(req.method)) {
          const updates = req.method === 'PUT' ? validate(await body(req)) : null;
          const result = await mutate(cafes => {
            const index = cafes.findIndex(cafe => cafe.id === id);
            if (index < 0) fail(404, 'Café not found.');
            if (updates) return (cafes[index] = { ...updates, id });
            cafes.splice(index, 1);
            return { deleted: true };
          });
          return json(200, result);
        }
        return json(405, { error: 'Method not allowed.' });
      }
      if (!['GET', 'HEAD'].includes(req.method)) return json(405, { error: 'Method not allowed.' });
      const name = path === '/' ? 'index.html' : path.slice(1);
      const file = resolve(root, name);
      const allowed = ['index.html', 'coffee-admin.html'].includes(name) || (name.startsWith('assets/') && file.startsWith(resolve(root, 'assets') + '/'));
      if (!allowed || !types[extname(file)]) return json(404, { error: 'Not found.' });
      const content = await readFile(file);
      res.writeHead(200, { 'Content-Type': `${types[extname(file)]}; charset=utf-8`, 'Cache-Control': 'no-cache' });
      res.end(req.method === 'HEAD' ? undefined : content);
    } catch (error) {
      const status = error.status || (error.code === 'ENOENT' ? 404 : 500);
      if (status === 500) console.error(error);
      json(status, { error: status === 500 ? 'Could not save or load cafés. Please try again.' : error.message });
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const port = Number(process.env.PORT || 3000);
  const host = process.env.HOST || '127.0.0.1';
  createCoffeeServer().listen(port, host, () => {
    console.log(`Website: http://${host}:${port}/`);
    console.log(`Coffee editor: http://${host}:${port}/coffee-admin.html`);
    if (!process.env.COFFEE_ADMIN_TOKEN || process.env.COFFEE_ADMIN_TOKEN.length < 24) console.log('Editor writes disabled: configure COFFEE_ADMIN_TOKEN (24+ characters).');
  });
}
