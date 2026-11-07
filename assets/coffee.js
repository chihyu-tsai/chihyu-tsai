import { loadMapLibre, createMap, pin, cafeContent } from './maps.js';
import { groupCafes } from './coffee-groups.js';
import { countryFlag } from './country-flag.js';

const page = document.getElementById('coffee');
const status = document.getElementById('coffee-status');
const list = document.getElementById('coffee-list');
const refresh = document.getElementById('coffee-refresh');
const selection = document.getElementById('coffee-selection');
let map, M, markers = [], busy = false, initialView = true, popup, pendingUpdate = false;
let signature = '', cafeButtons = new Map(), selectedId;
const isV3 = document.documentElement.dataset.design === 'v3';
let countries = [], countryData;

async function ensureMap() {
  if (!map) {
    M = await loadMapLibre();
    map = createMap(M, 'coffee-map');
    map.on('error', () => { status.textContent = 'Map imagery unavailable. You can still explore the café list.'; });
    map.on('load', () => map.resize());
  }
  map.resize();
}

function selectCafe(cafe, button, move = true) {
  selectedId = cafe.id;
  if (move && button) focusBranch(button.closest('.coffee-country'), button.closest('details.coffee-region'));
  list.querySelectorAll('[aria-pressed]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  selection.replaceChildren(cafeContent(cafe));
  selection.hidden = false;
  if (cafe.url && /^https?:\/\//i.test(cafe.url)) {
    const link = document.createElement('a');
    link.href = cafe.url; link.textContent = 'Café website ↗';
    link.target = '_blank'; link.rel = 'noopener noreferrer';
    selection.append(link);
  }
  if (cafe.googleMapsUrl && /^https:\/\//i.test(cafe.googleMapsUrl)) {
    const link = document.createElement('a');
    link.href = cafe.googleMapsUrl; link.textContent = 'Open in Google Maps ↗';
    link.target = '_blank'; link.rel = 'noopener noreferrer';
    link.style.display = 'block'; selection.append(link);
  }
  if (map) {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (move) map.flyTo({ center: [cafe.lng, cafe.lat], zoom: 15, duration: reduced ? 0 : 1100 });
    popup?.remove();
    popup = new M.Popup({ offset: 24 }).setLngLat([cafe.lng, cafe.lat]).setDOMContent(cafeContent(cafe)).addTo(map);
  }
}

function focusBranch(country, region) {
  if (!country) return;
  list.querySelectorAll('.coffee-country').forEach(item => { item.open = item === country; });
  list.querySelectorAll('details.coffee-region').forEach(item => {
    if (region) item.open = item === region;
    else if (!country.contains(item)) item.open = false;
  });
  if (region) region.open = true;
}

function renderList(cafes) {
  const hadGroups = !!list.querySelector('.coffee-country');
  const previousCountry = list.querySelector('.coffee-country[open]')?.dataset.country;
  const previousRegion = list.querySelector('details.coffee-region[open]')?.dataset.region;
  const grouped = groupCafes(cafes);
  const defaultCountry = hadGroups ? previousCountry : (grouped.find(country => country.name === 'United States') || grouped[0])?.name;
  list.replaceChildren();
  selection.hidden = true;
  const buttons = new Map();
  for (const country of grouped) {
    const group = document.createElement('details');
    group.className = 'coffee-country'; group.dataset.country = country.name;
    group.open = country.name === defaultCountry;
    group.addEventListener('toggle', () => { if (group.open) focusBranch(group, null); });
    const summary = document.createElement('summary');
    const label = document.createElement('span'); label.textContent = country.name;
    const count = document.createElement('span'); count.className = 'coffee-count'; count.textContent = country.count;
    if (isV3) {
      const flag = countryFlag(country.name, countries);
      if (flag) {
        const icon = document.createElement('span'); icon.className = 'coffee-country-flag';
        icon.setAttribute('aria-hidden', 'true'); icon.textContent = flag;
        // Keep the country name in its own text node for language switching.
        label.replaceChildren(icon, document.createTextNode(country.name));
      }
    }
    summary.append(label, count); group.append(summary);
    summary.addEventListener('click', event => {
      event.preventDefault();
      if (group.open) {
        group.open = false;
        group.querySelectorAll('details.coffee-region').forEach(item => { item.open = false; });
      } else focusBranch(group, null);
    });
    for (const region of country.regions) {
      const regionBox = document.createElement(region.name ? 'details' : 'div'); regionBox.className = 'coffee-region';
      if (region.name) {
        regionBox.dataset.region = JSON.stringify([country.name, region.name]);
        regionBox.open = group.open && regionBox.dataset.region === previousRegion;
        const heading = document.createElement('summary');
        const name = document.createElement('span'); name.textContent = region.name;
        const count = document.createElement('span'); count.className = 'coffee-count'; count.textContent = region.cities.reduce((sum, city) => sum + city.cafes.length, 0);
        heading.append(name, count); regionBox.append(heading);
        heading.addEventListener('click', event => {
          event.preventDefault();
          if (regionBox.open) regionBox.open = false;
          else focusBranch(group, regionBox);
        });
        regionBox.addEventListener('toggle', () => { if (regionBox.open) focusBranch(group, regionBox); });
      }
      for (const city of region.cities) {
        if (city.name) { const heading = document.createElement('h5'); heading.textContent = city.name; regionBox.append(heading); }
        const items = document.createElement('ul');
        for (const cafe of city.cafes) {
          const item = document.createElement('li');
          const button = document.createElement('button');
          button.type = 'button'; button.className = 'coffee-place'; button.setAttribute('aria-pressed', 'false');
          const name = document.createElement('span'); name.textContent = cafe.name;
          button.append(name);
          if (cafe.address) { const address = document.createElement('small'); address.textContent = cafe.address; button.append(address); }
          button.addEventListener('click', () => selectCafe(cafe, button));
          buttons.set(cafe.id, button);
          item.append(button); items.append(item);
        }
        regionBox.append(items);
      }
      group.append(regionBox);
    }
    list.append(group);
  }
  if (!cafes.length) {
    const empty = document.createElement('p'); empty.className = 'coffee-empty';
    empty.textContent = 'No visits published yet. Cafés will appear here by country, region, and city.';
    list.append(empty);
  }
  return buttons;
}

async function update() {
  if (page.hidden || document.hidden) return;
  if (busy) { pendingUpdate = true; return; }
  busy = true; refresh.disabled = true;
  try {
    if (location.protocol === 'file:') throw new Error('Run npm start and open http://localhost:3000/#coffee.');
    const response = await fetch('/api/coffees', { cache: 'no-store' });
    if (!response.ok) throw new Error('Cafés could not be loaded. Please try Refresh.');
    const cafes = await response.json();
    if (isV3) {
      countryData ||= fetch(new URL('./locations/countries.json', import.meta.url))
        .then(response => response.ok ? response.json() : []).catch(() => []);
      countries = await countryData;
    }
    const changed = signature !== JSON.stringify(cafes);
    if (changed) {
      cafeButtons = renderList(cafes);
      signature = JSON.stringify(cafes);
      const selected = cafes.find(cafe => cafe.id === selectedId);
      if (selected) selectCafe(selected, cafeButtons.get(selectedId), false);
      else { selectedId = undefined; popup?.remove(); }
    }
    const countryCount = groupCafes(cafes).filter(group => group.name !== 'Location not set').length;
    status.textContent = cafes.length ? `${cafes.length} cafés · ${countryCount} countries · a growing journal` : 'A growing journal, one cup at a time. First visits coming soon.';
    try {
      await ensureMap();
      markers.forEach(marker => marker.remove());
      markers = cafes.map(cafe => {
        const element = pin();
        element.setAttribute('role', 'button'); element.tabIndex = 0;
        element.setAttribute('aria-label', cafe.name);
        element.addEventListener('click', () => selectCafe(cafe, cafeButtons.get(cafe.id)));
        element.addEventListener('keydown', event => { if (['Enter', ' '].includes(event.key)) { event.preventDefault(); selectCafe(cafe, cafeButtons.get(cafe.id)); } });
        return new M.Marker({ element, anchor: 'bottom' }).setLngLat([cafe.lng, cafe.lat]).addTo(map);
      });
      if (initialView && cafes.length) {
        const bounds = new M.LngLatBounds();
        cafes.forEach(cafe => bounds.extend([cafe.lng, cafe.lat]));
        map.fitBounds(bounds, { padding: 56, maxZoom: 14, duration: 0 });
        initialView = false;
      }
    } catch { status.textContent += ' Map unavailable; browse all visits in the list.'; }
  } catch (error) { status.textContent = `${error.message} Previously loaded entries are kept.`; }
  finally {
    busy = false; refresh.disabled = false;
    if (pendingUpdate) { pendingUpdate = false; update(); }
  }
}

refresh.addEventListener('click', update);
document.addEventListener('pagechange', event => { if (event.detail === 'coffee') update(); });
document.addEventListener('visibilitychange', () => { if (!document.hidden) update(); });
setInterval(() => {
  // Leave keyboard focus alone while someone is interacting with the sidebar.
  if (list.contains(document.activeElement)) return;
  update();
}, 60000);
// Saves broadcast a small invalidation event; café records are then fetched fresh.
// Minute polling remains a fallback if a proxy or browser interrupts the stream.
if (location.protocol !== 'file:' && window.EventSource) {
  const events = new EventSource('/api/coffees/events');
  events.addEventListener('cafes', update);
  window.addEventListener('pagehide', () => events.close());
}
update();
