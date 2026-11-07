import test from 'node:test';
import assert from 'node:assert/strict';
import { matchCafeWebsite, findCafeWebsite } from '../lib/cafe-website.mjs';

const place = { name: 'Café Good', lat: 25.033, lng: 121.5654 };
const element = (tags = {}, lat = place.lat, lon = place.lng) => ({ lat, lon, tags: { name: 'Cafe Good', website: 'https://good.example', ...tags } });

test('finds a nearby exact-name website with accent and punctuation normalization', () => {
  assert.equal(matchCafeWebsite(place, [element()]), 'https://good.example/');
  assert.equal(matchCafeWebsite({ ...place, name: '好咖啡' }, [element({ 'name:zh': '好咖啡' })]), 'https://good.example/');
  assert.equal(matchCafeWebsite(place, [{ center: { lat: place.lat, lon: place.lng }, tags: { name: 'Café Good', 'contact:website': 'https://good.example' } }]), 'https://good.example/');
});

test('does not guess for other names, distant places, or ambiguous websites', () => {
  assert.equal(matchCafeWebsite(place, [element({ name: 'Different Cafe' })]), '');
  assert.equal(matchCafeWebsite(place, [element({}, 26, 122)]), '');
  assert.equal(matchCafeWebsite(place, [element(), element({ website: 'https://different.example' })]), '');
  assert.equal(matchCafeWebsite(place, [element(), element()]), 'https://good.example/');
});

test('rejects unsafe websites', () => {
  for (const website of ['javascript:alert(1)', 'https://user:password@good.example', 'http://127.0.0.1/', 'http://my-site.local/', 'not a url']) assert.equal(matchCafeWebsite(place, [element({ website })]), '');
});

test('queries only the fixed public service, without editor credentials, and returns a matched website', async () => {
  const result = await findCafeWebsite(place, async (url, options) => {
    assert.equal(url, 'https://overpass-api.de/api/interpreter');
    assert.equal(options.headers.Authorization, undefined);
    assert.equal(options.redirect, 'error');
    assert.match(options.body.get('data'), /around:120,25.033,121.5654/);
    return Response.json({ elements: [element()] });
  });
  assert.equal(result.website, 'https://good.example/');
  assert.match(result.websiteMessage, /OpenStreetMap/);
});

test('missing name/pin, unavailable service, and unmatched records remain optional', async () => {
  assert.equal((await findCafeWebsite({ name: '', lat: null, lng: null }, () => { throw new Error('must not fetch'); })).website, '');
  assert.equal((await findCafeWebsite(place, async () => new Response('', { status: 429 }))).website, '');
  assert.equal((await findCafeWebsite(place, async () => { throw new Error('offline'); })).website, '');
  assert.equal((await findCafeWebsite(place, async () => Response.json({ elements: [] }))).website, '');
});
