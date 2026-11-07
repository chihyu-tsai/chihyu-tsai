import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('V3 is the sole retained design with no archived pages or broken comparison links', async () => {
  const current = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  for (const path of ['v1.html', 'v2.html', 'assets/v1/coffee.css', 'assets/v1/book.css', 'assets/v2/coffee.css', 'assets/v2/navigation.js', 'assets/v2.css', 'assets/book.js', 'assets/book.css']) {
    await assert.rejects(readFile(new URL(`../${path}`, import.meta.url)), { code: 'ENOENT' });
  }
  assert.match(current, /data-design="v3"/);
  assert.match(current, /assets\/v3\.css/);
  assert.doesNotMatch(current, /href="v[12]\.html"/);
  const css = await readFile(new URL('../assets/v3.css', import.meta.url), 'utf8');
  assert.match(css, /@import url\("\.\/base\.css"\)/);
  assert.doesNotMatch(css, /v2\.css/);
  assert.match(await readFile(new URL('../assets/base.css', import.meta.url), 'utf8'), /--bg:/);
  assert.match(current, /Coffee atlas/);
  assert.doesNotMatch(current, /A small field notebook|class="brewing-cup"/);
  assert.match(current, /chihyutsai AT alumni DOT upenn DOT edu/);
  assert.match(current, /href="mailto:chihyutsai@alumni\.upenn\.edu"/);
  assert.match(current, /assets\/navigation\.js/);
  assert.doesNotMatch(current, /assets\/book\.(js|css)/);
  assert.match(current, /family=Fira\+Sans/);
  assert.match(current, /family=Source\+Code\+Pro/);
  assert.match(current, /Highest Distinction in General Scholarship/);
  assert.match(current, /lang="zh-Hant">蔡智宇/);
});

test('favicon assets match the supplied branding and declared sizes', async () => {
  const png = await readFile(new URL('../assets/favicon-32.png', import.meta.url));
  assert.equal(png.readUInt32BE(16), 32);
  assert.equal(png.readUInt32BE(20), 32);
  const touch = await readFile(new URL('../assets/apple-touch-icon.png', import.meta.url));
  assert.equal(touch.readUInt32BE(16), 180);
  const ico = await readFile(new URL('../assets/favicon.ico', import.meta.url));
  assert.equal(ico.readUInt16LE(2), 1);
  assert.equal(ico.readUInt16LE(4), 3);
  for (const file of ['index.html', 'coffee-admin.html']) {
    const html = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');
    assert.match(html, /assets\/favicon-32\.png/);
  }
});
