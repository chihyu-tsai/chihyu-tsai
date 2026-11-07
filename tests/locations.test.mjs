import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const load = async file => JSON.parse(await readFile(new URL(`../assets/locations/${file}`, import.meta.url), 'utf8'));

test('bundled location choices include global countries and key café destinations', async () => {
  const countries = await load('countries.json');
  assert(countries.length >= 240);
  assert.equal(new Set(countries.map(country => country.code)).size, countries.length);
  for (const code of ['US', 'TW', 'JP']) assert(countries.some(country => country.code === code));
  const us = await load('US.json');
  const pa = us.states.find(state => state.name === 'Pennsylvania');
  assert(pa.cities.includes('Philadelphia'));
  assert(us.states.some(state => state.name === 'California'));
  assert((await load('JP.json')).states.some(state => state.name === 'Tokyo'));
  assert((await load('TW.json')).states.some(state => state.name === 'Taipei'));
});

test('every bundled country has well-formed region and city choices', async () => {
  for (const country of await load('countries.json')) {
    assert.match(country.code, /^[A-Z]{2}$/);
    const data = await load(`${country.code}.json`);
    assert.equal(data.name, country.name);
    assert(Array.isArray(data.states) && Array.isArray(data.cities));
    for (const state of data.states) {
      assert.equal(typeof state.name, 'string');
      assert(state.cities.every(city => typeof city === 'string' && city));
      assert.equal(new Set(state.cities).size, state.cities.length);
    }
  }
});
