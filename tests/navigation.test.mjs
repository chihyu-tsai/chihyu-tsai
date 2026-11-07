import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../assets/navigation.js', import.meta.url), 'utf8');
function harness({ native = true, reduced = false } = {}) {
  const events = {}, pending = [], dispatched = [];
  const pages = ['about', 'projects', 'education', 'experience', 'coffee', 'for-fun', 'blog', 'contact'].map(id => ({ id, hidden: ['blog', 'contact'].includes(id), dataset: ['blog', 'contact'].includes(id) ? { pageDisabled: 'true' } : {}, querySelector: () => ({ setAttribute() {}, focus() {} }) }));
  let focused;
  const links = pages.filter(page => !page.dataset.pageDisabled).map((page, index) => ({ hash: `#${page.id}`, style: {}, attributes: {}, focus() { focused = this; }, parentElement: { classList: { toggle() {} } }, getBoundingClientRect: () => ({ left: index * 80, bottom: 30, width: 70 }), setAttribute(key, value) { this.attributes[key] = value; }, removeAttribute(key) { delete this.attributes[key]; } }));
  const underline = {};
  const nav = { classList: { add() {} }, style: { setProperty(key, value) { underline[key] = value; } }, getBoundingClientRect: () => ({ left: 0, top: 0 }) };
  let animations = 0;
  const main = { classList: { add() {} }, querySelectorAll: () => pages, animate() { animations++; return { cancel() {} }; } };
  const location = { hash: '', protocol: 'http:' };
  const document = {
    querySelector: selector => selector === 'main' ? main : nav, querySelectorAll: () => links,
    getElementById: () => ({}),
    dispatchEvent: event => dispatched.push(event.detail),
    addEventListener: (name, callback) => { events[`document:${name}`] = callback; },
  };
  if (native) document.startViewTransition = callback => {
    pending.push(callback);
    return { skipTransition() {}, finished: Promise.resolve(), ready: Promise.resolve(), updateCallbackDone: Promise.resolve() };
  };
  vm.runInNewContext(source, {
    document, location,
    requestAnimationFrame: callback => callback(),
    window: { matchMedia: () => ({ matches: reduced }), scrollTo() {}, addEventListener: (name, callback) => { events[name] = callback; } },
    history: { pushState(_, __, hash) { location.hash = hash; } },
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init.detail; } },
  });
  return {
    pages, links, pending, dispatched, underline,
    get animations() { return animations; },
    get focused() { return focused; },
    key(id, key, extra = {}) {
      let prevented = false;
      events['document:keydown']?.({ target: links.find(link => link.hash === `#${id}`) || {}, key, preventDefault() { prevented = true; }, ...extra });
      return prevented;
    },
    click(id) {
      const link = links.find(link => link.hash === `#${id}`);
      events['document:click']({ button: 0, target: { closest: () => link }, preventDefault() {} });
    },
    back(hash) { location.hash = hash; events.popstate(); },
  };
}

test('fixed-order navigation selects the latest rapid click and moves only the underline', () => {
  const ui = harness();
  assert.equal(ui.pages.find(page => !page.hidden).id, 'about');
  ui.click('projects'); ui.click('education'); ui.click('for-fun');
  assert.equal(ui.pages.filter(page => !page.hidden).length, 1);
  assert.equal(ui.pages.find(page => !page.hidden).id, 'for-fun');
  assert.equal(ui.links.find(link => link.attributes['aria-current'] === 'page').hash, '#for-fun');
  assert.equal(ui.links.find(link => link.hash === '#for-fun').style.viewTransitionName, undefined);
  assert.equal(ui.pending.length, 0);
  assert.equal(ui.underline['--active-x'], '400px');
  assert.equal(ui.underline['--active-width'], '70px');
  ui.back('#education');
  assert.equal(ui.pages.find(page => !page.hidden).id, 'education');
  assert.equal(ui.underline['--active-x'], '160px');
});

test('reduced motion switches instantly without native transitions or fades', () => {
  const ui = harness({ reduced: true });
  ui.click('projects');
  assert.equal(ui.pages.find(page => !page.hidden).id, 'projects');
  assert.equal(ui.pending.length, 0);
  assert.equal(ui.animations, 0);
});

test('short content fade does not require View Transitions and retains history handling', () => {
  const ui = harness({ native: false });
  ui.click('for-fun');
  assert.equal(ui.pages.find(page => !page.hidden).id, 'for-fun');
  assert.equal(ui.animations, 1);
  ui.back('#unknown');
  assert.equal(ui.pages.find(page => !page.hidden).id, 'about');
});

test('temporarily disabled Blog and Contact pages stay hidden even for old hashes', () => {
  const ui = harness();
  for (const id of ['blog', 'contact']) {
    ui.back(`#${id}`);
    assert.equal(ui.pages.find(page => !page.hidden).id, 'about');
    assert(ui.pages.find(page => page.id === id).hidden);
  }
});

test('navigation does not implement custom arrow-key or Home/End shortcuts', () => {
  const ui = harness();
  for (const key of ['ArrowRight', 'ArrowLeft', 'Home', 'End']) assert.equal(ui.key('about', key), false);
  assert.equal(ui.pages.find(page => !page.hidden).id, 'about');
  assert(ui.links.every(link => !link.attributes['aria-keyshortcuts']));
  assert.doesNotMatch(source, /addEventListener\('keydown'/);
});

test('navigation leaves non-navigation targets, normal keys and modified keys alone', () => {
  const ui = harness();
  assert.equal(ui.key('outside', 'ArrowRight'), false);
  for (const key of ['Tab', 'Enter', 'a', 'ArrowDown']) assert.equal(ui.key('about', key), false);
  for (const modifier of ['metaKey', 'ctrlKey', 'altKey', 'shiftKey', 'isComposing', 'defaultPrevented']) {
    assert.equal(ui.key('about', 'ArrowRight', { [modifier]: true }), false);
  }
  assert.equal(ui.pages.find(page => !page.hidden).id, 'about');
});
