import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { translate } from '../assets/i18n.js';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('V3 temporarily hides Blog/Contact and adds bilingual For Fun interests', async () => {
  const html = await read('index.html');
  const nav = html.split('<ul class="nav-links">')[1].split('</ul>')[0];
  assert.match(nav, /href="#for-fun">For Fun/);
  assert.doesNotMatch(nav, /href="#(?:blog|contact)"/);
  for (const id of ['blog', 'contact']) assert.match(html, new RegExp(`id="${id}" data-page-disabled="true" hidden`));
  assert.match(html, /tennis, pickleball, and badminton/);
  assert.match(html, /watching all kinds of sports/);
  assert.equal(translate('For Fun', 'zh-Hant'), '興趣');
  const teams = ['Oakland A’s', 'San Francisco Giants', 'Golden State Warriors', 'San Francisco 49ers'];
  for (const team of teams) assert.notEqual(translate(team, 'zh-Hant'), team);
  const list = html.split('<ul class="favorite-teams">')[1].split('</ul>')[0];
  assert.deepEqual([...list.matchAll(/<span>([^<]+)<\/span>/g)].map(match => match[1]), teams);
  assert.doesNotMatch(html.split('id="for-fun"')[1].split('</section>')[0], /Basketball:|Baseball:/);
});

test('four inline team logos are bundled locally with source notes', async () => {
  for (const name of ['golden-state-warriors', 'oakland-athletics', 'san-francisco-giants', 'san-francisco-49ers']) {
    const image = await readFile(new URL(`../assets/logos/${name}.png`, import.meta.url));
    assert.equal(image.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  }
  assert.match(await read('assets/logos/TEAM-SOURCES.txt'), /not emoji characters or public-domain assets/);
});
