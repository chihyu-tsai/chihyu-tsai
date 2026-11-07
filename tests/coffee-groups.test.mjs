import test from 'node:test';
import assert from 'node:assert/strict';
import { groupCafes, countryName } from '../assets/coffee-groups.js';

test('normalizes country aliases for the US, Taiwan, and Japan', () => {
  assert.equal(countryName(' USA '), 'United States');
  assert.equal(countryName('台灣'), 'Taiwan');
  assert.equal(countryName('日本'), 'Japan');
  assert.equal(countryName('France'), 'France');
});

test('groups by country, optional region, and optional city without inventing missing locations', () => {
  const groups = groupCafes([
    { name: 'Philly café', country: 'US', state: 'Pennsylvania', city: 'Philadelphia' },
    { name: 'Another Philly café', country: 'USA', state: 'Pennsylvania', city: 'Philadelphia' },
    { name: 'Taipei café', country: 'Taiwan', city: 'Taipei' },
    { name: 'Kyoto café', country: 'Japan', state: 'Kyoto Prefecture', city: 'Kyoto' },
    { name: 'Old saved café' },
  ]);
  assert.equal(groups.length, 4);
  const us = groups.find(group => group.name === 'United States');
  assert.equal(us.count, 2);
  assert.equal(us.regions[0].name, 'Pennsylvania');
  assert.equal(us.regions[0].cities[0].name, 'Philadelphia');
  assert.equal(us.regions[0].cities[0].cafes[0].name, 'Another Philly café');
  assert.equal(groups.find(group => group.name === 'Taiwan').regions[0].name, '');
  assert.equal(groups.find(group => group.name === 'Location not set').count, 1);
  assert.deepEqual(groupCafes([]), []);
});
