import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { translate, translations } from '../assets/i18n.js';

test('Traditional Chinese covers navigation, life stages, theme actions and content', () => {
  assert.equal(translate('About', 'zh-Hant'), '關於我');
  assert.equal(translate('Switch to dark mode', 'zh-Hant'), '切換至深色模式');
  assert.equal(translate('May 2026', 'zh-Hant'), '2026 年 5 月');
  assert.equal(translate('Oct 2025', 'zh-Hant'), '2025 年 10 月');
  assert.equal(translate('3 cafés · 2 countries · a growing journal', 'zh-Hant'), '3 間咖啡館 · 2 個國家 · 持續累積中');
  assert.match(translate('3 cafés · 2 countries · a growing journal Map unavailable; browse all visits in the list.', 'zh-Hant'), /地圖暫時無法使用/);
  assert.match(translate('Cafés could not be loaded. Please try Refresh. Previously loaded entries are kept.', 'zh-Hant'), /已保留先前載入的資料/);
  assert(Object.keys(translations).length > 100);
  for (const english of Object.keys(translations)) assert.equal(translate(english, 'en'), english);
});

test('journey descriptions are translated and unknown user content is not invented', async () => {
  const stops = JSON.parse(await readFile(new URL('../data/journey.json', import.meta.url), 'utf8'));
  for (const stop of stops) {
    assert.notEqual(translate(stop.description, 'zh-Hant'), stop.description);
    assert.notEqual(translate(stop.label, 'zh-Hant'), stop.label);
  }
  for (const text of ['My own café notes', 'https://example.com', 'Café Étoile']) assert.equal(translate(text, 'zh-Hant'), text);
});

test('language switch is V3 only, next to theme toggle, and repositions the underline', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /id="language-toggle"[\s\S]*?lang="zh-Hant">繁<\/span>[\s\S]*?lang="en">EN<\/span>[\s\S]*?id="theme-toggle"/);
  assert.match(html, /src="assets\/i18n.js"/);
  const navigation = await readFile(new URL('../assets/navigation.js', import.meta.url), 'utf8');
  assert.match(navigation, /addEventListener\('languagechange', updateUnderline\)/);
});
