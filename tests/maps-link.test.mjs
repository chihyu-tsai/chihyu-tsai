import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMapsUrl, importMapsUrl, validateMapsUrl } from '../lib/maps-link.mjs';

test('imports a place name and exact pin, not the different viewport center', () => {
  const place = parseMapsUrl('https://www.google.com/maps/place/Good+Coffee/@39,-75,15z/data=!3d25.033!4d121.5654');
  assert.equal(place.name, 'Good Coffee');
  assert.equal(place.lat, 25.033);
  assert.equal(place.lng, 121.5654);
});

test('supports coordinate queries, Unicode names, and missing pin coordinates honestly', () => {
  const point = parseMapsUrl('https://www.google.com/maps?q=35.1,139.7');
  assert.equal(point.lat, 35.1);
  assert.equal(point.lng, 139.7);
  const place = parseMapsUrl('https://www.google.com/maps/place/%E5%92%96%E5%95%A1/@25,121,16z');
  assert.equal(place.name, '咖啡');
  assert.equal(place.lat, null);
  assert.match(place.message, /No exact place pin/);
});

test('rejects non-Maps URLs, credentialed URLs, invalid protocols, and coordinates', () => {
  for (const value of ['https://example.com', 'http://maps.google.com/', 'https://google.com.evil.example/maps', 'https://user:pass@www.google.com/maps', 'https://www.google.com:123/maps', 'https://www.google.com/search?q=coffee', 'https://www.google.com/maps?q=100,200']) {
    assert.throws(() => parseMapsUrl(value), error => error.status === 400);
  }
  assert.throws(() => validateMapsUrl(null));
});

test('resolves a Maps short link without scraping any page body', async () => {
  let calls = 0;
  const result = await importMapsUrl('https://maps.app.goo.gl/example', async (url, options) => {
    calls++;
    assert.equal(options.redirect, 'manual');
    return new Response(null, { status: 302, headers: { location: 'https://www.google.com/maps/place/Coffee/data=!3d35!4d139' } });
  });
  assert.equal(calls, 1);
  assert.equal(result.name, 'Coffee');
  assert.equal(result.lng, 139);
});

test('rejects unsafe redirects and handles unresolved short links', async () => {
  await assert.rejects(importMapsUrl('https://maps.app.goo.gl/example', async () => new Response(null, { status: 302, headers: { location: 'http://127.0.0.1/private' } })), error => error.status === 400);
  await assert.rejects(importMapsUrl('https://maps.app.goo.gl/example', async () => new Response('No redirect', { status: 200 })), /full Google Maps URL/);
  await assert.rejects(importMapsUrl('https://maps.app.goo.gl/example', async () => { throw new Error('network unavailable'); }), /full Google Maps URL/);
});
