import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createCoffeeServer } from '../server.mjs';
import { parseMapsUrl } from '../lib/maps-link.mjs';
import { spawnSync } from 'node:child_process';
import { request as httpRequest } from 'node:http';

test('coffee API: public reads, protected writes, validation, persistence, and safe static files', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'coffee-api-'));
  const dataFile = join(directory, 'cafes.json');
  const token = 'a-test-key-with-at-least-24-characters';
  const server = createCoffeeServer({ dataFile, adminToken: token, mapsImporter: async url => parseMapsUrl(url), websiteFinder: async () => ({ website: 'https://coffee.example/', websiteMessage: 'Matched test record.' }) });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    await rm(directory, { recursive: true });
  });
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  const cafe = { name: 'Test café', country: 'United States', state: 'Pennsylvania', city: 'Philadelphia', address: 'Philadelphia', notes: 'Test only, not a real recommendation.', lat: 39.95, lng: -75.16, url: 'https://example.com', googleMapsUrl: 'https://www.google.com/maps?q=39.95,-75.16' };
  const write = (value, extra = {}) => fetch(`${base}/api/coffees`, { method: 'POST', headers, body: JSON.stringify(value), ...extra });

  await t.test('visitors can read but cannot edit', async () => {
    assert.deepEqual(await (await fetch(`${base}/api/coffees`)).json(), []);
    assert.equal((await write(cafe, { headers: { 'Content-Type': 'application/json' } })).status, 401);
    assert.equal((await write(cafe, { headers: { ...headers, Origin: 'https://not-this-site.example' } })).status, 403);
  });
  await t.test('rejects unsafe URLs, coordinates, oversized payloads, and malformed JSON', async () => {
    assert.equal((await write({ ...cafe, url: 'javascript:alert(1)' })).status, 400);
    assert.equal((await write({ ...cafe, lat: 100 })).status, 400);
    assert.equal((await write({ ...cafe, lat: null })).status, 400);
    assert.equal((await write({ ...cafe, country: 'x'.repeat(101) })).status, 400);
    assert.equal((await write({ ...cafe, city: 123 })).status, 400);
    assert.equal((await write({ ...cafe, googleMapsUrl: 'https://example.com/maps' })).status, 400);
    assert.equal((await write({ ...cafe, notes: 'a'.repeat(9000) })).status, 413);
    assert.equal((await write(cafe, { body: '{' })).status, 400);
  });
  let id;
  await t.test('publishes data and persists it to disk', async () => {
    const response = await write(cafe);
    assert.equal(response.status, 201);
    id = (await response.json()).id;
    const entries = await (await fetch(`${base}/api/coffees`)).json();
    assert.equal(entries[0].name, cafe.name);
    assert.equal(entries[0].country, 'United States');
    assert.equal(entries[0].state, 'Pennsylvania');
    assert.equal(entries[0].city, 'Philadelphia');
    assert.equal(entries[0].googleMapsUrl, cafe.googleMapsUrl);
    assert.equal(JSON.parse(await readFile(dataFile, 'utf8'))[0].id, id);
  });
  await t.test('updates existing entries and refuses missing entries', async () => {
    assert.equal((await fetch(`${base}/api/coffees/${id}`, { method: 'PUT', headers, body: JSON.stringify({ ...cafe, notes: 'Updated' }) })).status, 200);
    assert.equal((await fetch(`${base}/api/coffees/not-found`, { method: 'DELETE', headers })).status, 404);
    assert.equal((await (await fetch(`${base}/api/coffees`)).json())[0].notes, 'Updated');
  });
  await t.test('serializes concurrent writes without losing entries', async () => {
    const responses = await Promise.all([write({ ...cafe, name: 'Two' }), write({ ...cafe, name: 'Three' })]);
    assert(responses.every(response => response.status === 201));
    assert.equal((await (await fetch(`${base}/api/coffees`)).json()).length, 3);
  });
  await t.test('imports Google Maps info only for an authorized editor', async () => {
    const path = `${base}/api/coffee-import`;
    const body = JSON.stringify({ googleMapsUrl: 'https://www.google.com/maps/place/Coffee/data=!3d25!4d121' });
    assert.equal((await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body })).status, 401);
    const response = await fetch(path, { method: 'POST', headers, body });
    assert.equal(response.status, 200);
    const imported = await response.json();
    assert.equal(imported.name, 'Coffee');
    assert.equal(imported.website, 'https://coffee.example/');
    const noLookup = await fetch(path, { method: 'POST', headers, body: JSON.stringify({ googleMapsUrl: cafe.googleMapsUrl, lookupWebsite: false }) });
    assert.equal((await noLookup.json()).website, '');
    assert.equal((await fetch(path, { method: 'POST', headers, body: '{}' })).status, 400);
  });
  await t.test('broadcasts saved café changes to public viewers', async () => {
    const controller = new AbortController();
    const response = await fetch(`${base}/api/coffees/events`, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(4000)]) });
    assert.equal(response.headers.get('content-type'), 'text/event-stream');
    const reader = response.body.getReader();
    try {
      await reader.read(); // Initial connection comment.
      await fetch(`${base}/api/coffees/${id}`, { method: 'PUT', headers, body: JSON.stringify(cafe) });
      const event = await reader.read();
      assert.match(new TextDecoder().decode(event.value), /event: cafes/);
    } finally { controller.abort(); reader.releaseLock(); }
  });
  await t.test('deletes entries', async () => {
    assert.equal((await fetch(`${base}/api/coffees/${id}`, { method: 'DELETE', headers })).status, 200);
    assert.equal((await (await fetch(`${base}/api/coffees`)).json()).length, 2);
  });
  await t.test('serves pages and assets, not source code, secrets, or repository metadata', async () => {
    assert.equal((await fetch(base)).status, 200);
    assert.equal((await fetch(`${base}/v1.html`)).status, 404);
    assert.equal((await fetch(`${base}/v2.html`)).status, 404);
    assert.equal((await fetch(`${base}/api/health`)).status, 200);
    assert.equal((await fetch(`${base}/coffee-admin.html`)).status, 200);
    assert.equal((await fetch(`${base}/assets/coffee.js`)).status, 200);
    for (const name of ['server.mjs', '.env', '.git/config', 'data/runtime/coffees.json']) assert.equal((await fetch(`${base}/${name}`)).status, 404);
  });
});

test('editor fails closed when no sufficiently long secret is configured', async t => {
  const server = createCoffeeServer({ adminToken: '' });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/coffees`, { method: 'POST' });
  assert.equal(response.status, 503);
});

test('local practice allows keyless editing but rejects foreign hosts and origins', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'coffee-practice-'));
  const server = createCoffeeServer({ localDemo: true, adminToken: '', dataFile: join(directory, 'practice.json'), mapsImporter: async url => parseMapsUrl(url), websiteFinder: async () => ({ website: '', websiteMessage: '' }) });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { await new Promise(resolve => server.close(resolve)); await rm(directory, { recursive: true }); });
  const base = `http://127.0.0.1:${server.address().port}`;
  assert.equal((await (await fetch(`${base}/api/editor-config`)).json()).localDemo, true);
  const cafe = { name: 'Practice only', lat: 39.95, lng: -75.16, address: '', notes: '', url: '' };
  const options = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cafe) };
  const created = await fetch(`${base}/api/coffees`, options);
  assert.equal(created.status, 201);
  const id = (await created.json()).id;
  assert.equal((await fetch(`${base}/api/coffees`, { ...options, headers: { ...options.headers, Origin: 'https://other.example' } })).status, 403);
  assert.equal((await fetch(`${base}/api/coffees`, { ...options, headers: { ...options.headers, 'Sec-Fetch-Site': 'cross-site' } })).status, 403);
  // Node fetch normalizes Host, so use a raw HTTP request to test DNS-rebinding protection.
  const foreignHostStatus = await new Promise((resolve, reject) => {
    const req = httpRequest(`${base}/api/coffees`, { method: 'POST', headers: { ...options.headers, Host: 'other.example' } }, res => { res.resume(); resolve(res.statusCode); });
    req.on('error', reject); req.end(options.body);
  });
  assert.equal(foreignHostStatus, 403);
  assert.equal((await fetch(`${base}/api/coffees/${id}`, { ...options, method: 'PUT', body: JSON.stringify({ ...cafe, name: 'Edited practice' }) })).status, 200);
  assert.equal((await fetch(`${base}/api/coffee-import`, { ...options, body: JSON.stringify({ googleMapsUrl: 'https://www.google.com/maps/place/Practice/data=!3d25!4d121' }) })).status, 200);
  assert.equal((await fetch(`${base}/api/coffees/${id}`, { method: 'DELETE' })).status, 200);
});

test('practice launcher refuses production mode', () => {
  const result = spawnSync(process.execPath, ['scripts/practice.mjs'], { env: { ...process.env, NODE_ENV: 'production' }, encoding: 'utf8', timeout: 5000 });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Practice mode is unavailable in production/);
});
