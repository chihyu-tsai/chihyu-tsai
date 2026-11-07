import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { countryFlag } from '../assets/country-flag.js';
import { translate } from '../assets/i18n.js';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('country flags use bundled ISO codes, support existing aliases and do not guess unknown countries', async () => {
  const countries = JSON.parse(await read('assets/locations/countries.json'));
  for (const [country, flag] of [['United States', '🇺🇸'], ['USA', '🇺🇸'], ['臺灣', '🇹🇼'], ['日本', '🇯🇵'], ['France', '🇫🇷'], ['DE', '🇩🇪']]) {
    assert.equal(countryFlag(country, countries), flag);
  }
  assert.equal(countryFlag('Unknown place', countries), '');
  assert.equal(countryFlag('', countries), '');
});

test('email uses AT/DOT while About uses @ before school logos', async () => {
  const html = await read('index.html');
  const about = html.split('id="about"')[1].split('<!-- ── Projects')[0];
  assert.match(about, />chihyutsai AT alumni DOT upenn DOT edu<\/a>/);
  assert.match(about, /information technology @/);
  assert.match(about, /Economics @/);
  assert.equal((about.match(/class="inline-school-logo/g) || []).length, 2);
  assert.match(about, /src="assets\/logos\/penn\.svg"/);
  assert.match(about, /src="assets\/logos\/berkeley\.svg"/);
  const contact = html.split('id="contact"')[1];
  assert.match(contact, />chihyutsai AT alumni DOT upenn DOT edu<\/a>/);
  assert.match(html, /A path from economics → computer science\./);
  assert.match(html, /Cafés I’ve visited/);
  assert.doesNotMatch(html, /Country → region → city\. Pick a café to explore\./);
});

test('journey includes the supplied high school and accessible map-to-phase controls', async () => {
  const stops = JSON.parse(await read('data/journey.json'));
  assert.match(stops[1].description, /National Tainan First Senior High School \(台南一中\)/);
  assert.match(translate(stops[1].description, 'zh-Hant'), /台南一中/);
  const html = await read('index.html');
  assert.match(html, /Undergraduate · California/);
  assert.match(html, /Graduate · Pennsylvania/);
  assert.doesNotMatch(html, /College · California|Grad school · Pennsylvania/);
  assert.match(html, /id="journey-map"[^>]*role="group"/);
  const script = await read('assets/journey-map.js');
  assert.match(script, /role: 'button', tabindex: '0'/);
  assert.match(script, /group.addEventListener\('click'/);
  assert.match(script, /group.addEventListener\('keydown'/);
  assert.match(script, /button\?\.focus\(\{ preventScroll: true \}\)/);
  assert.match(script, /description.scrollIntoView/);
  const css = await read('assets/v3.css');
  assert.match(css, /\.journey-marker:focus \{ outline: none; \}/);
  assert.match(css, /\.journey-marker:focus-visible \.journey-halo/);
  assert.match(css, /\.journey-stops button:focus:not\(:focus-visible\) \{ outline: none; \}/);
});
