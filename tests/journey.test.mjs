import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('bundled journey preserves four chronological life stages and approximate city centers', async () => {
  const source = JSON.parse(await read('data/journey.json'));
  const map = JSON.parse(await read('assets/geography/education-journey.json'));
  assert.deepEqual(source.map(stop => stop.id), ['kaohsiung', 'tainan', 'bay-area', 'philadelphia']);
  assert.equal(map.stops.length, 4);
  assert.equal(map.lands.length, 177);
  assert.match(map.taiwan, /^M/);
  map.stops.forEach((stop, i) => {
    assert.deepEqual(stop.coordinates, source[i].coordinates);
    assert.equal(stop.description, source[i].description);
    assert(stop.point.every(Number.isFinite));
    assert(stop.point[0] >= 0 && stop.point[0] <= map.width);
    assert(stop.point[1] >= 0 && stop.point[1] <= map.height);
    if (i < 2) assert(stop.insetPoint.every(Number.isFinite));
    else assert.equal(stop.insetPoint, null);
  });
  assert(map.stops[0].insetPoint[1] > map.stops[1].insetPoint[1]);
  assert.deepEqual(map.routes.map(({ from, to }) => [from, to]), [
    ['kaohsiung', 'tainan'], ['tainan', 'bay-area'], ['bay-area', 'philadelphia'],
  ]);
  for (const path of [...map.lands, map.taiwan, ...map.routes.map(route => route.path)]) {
    assert.doesNotMatch(path, /NaN|Infinity|undefined/);
  }
  assert.match(await read('assets/geography/SOURCE.txt'), /public domain/);
  assert.match(await read('assets/geography/D3-LICENSE.txt'), /Copyright/);
});

test('V3 alone uses the portrait, Chinese print font, theme-aware logos and journey controls', async () => {
  const html = await read('index.html');
  const css = await read('assets/v3.css');
  assert.match(html, /family=Noto\+Serif\+TC/);
  assert.match(css, /"Noto Serif TC", "Songti TC", "PMingLiU", serif/);
  assert.match(css, /background: radial-gradient/);
  assert.match(html, /class="profile-portrait"/);
  assert.doesNotMatch(html, /Photo to come|Leaving a little room/);
  assert.match(css, /border-radius: 50%/);
  assert.match(html, /medical-decision-modeling-transparent\.png/);
  assert.match(html, /medical-decision-modeling-dark\.png/);
  assert.equal((html.match(/data-journey-stop=/g) || []).length, 4);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /assets\/journey-map\.js/);
  const portrait = await readFile(new URL('../assets/portraits/chih-yu-tsai.jpg', import.meta.url));
  assert.equal(portrait.readUInt16BE(0), 0xffd8);
  assert.equal(portrait.includes(Buffer.from('Exif\0\0')), false);
  for (const file of ['medical-decision-modeling-transparent.png', 'medical-decision-modeling-dark.png']) {
    const png = await readFile(new URL(`../assets/logos/${file}`, import.meta.url));
    assert.equal(png[25], 6, 'Logo uses RGBA transparency');
  }
});
