import { loadMapLibre, createMap, pin, cafeContent } from './maps.js';
import { createLocationPicker } from './location-picker.js';

const form = document.getElementById('cafe-form');
const fields = document.getElementById('editor-fields');
const key = document.getElementById('editor-key');
const status = document.getElementById('editor-status');
const list = document.getElementById('editor-list');
const names = ['name', 'address', 'country', 'state', 'city', 'lat', 'lng', 'notes', 'url', 'googleMapsUrl'];
const importButton = document.getElementById('import-links');
const locations = createLocationPicker(form);
let editing = null, M, map, marker, saving = false, suggestedWebsite = '', localDemo = false;
fields.disabled = true;
importButton.disabled = true;

function point(lat, lng) {
  if (!map) return;
  if (!marker) marker = new M.Marker({ element: pin(), anchor: 'bottom' }).setLngLat([lng, lat]).addTo(map);
  else marker.setLngLat([lng, lat]);
}

function reset() {
  suggestedWebsite = '';
  editing = null;
  form.reset();
  locations.reset();
  document.getElementById('import-website').value = '';
  document.getElementById('import-maps').value = '';
  document.getElementById('form-title').textContent = 'Add a café';
  if (marker) { marker.remove(); marker = null; }
}

async function request(path = '', options = {}) {
  const response = await fetch(`/api/coffees${path}`, { cache: 'no-store', ...options });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Request failed.');
  return data;
}

async function load() {
  const cafes = await request();
  list.replaceChildren();
  for (const cafe of cafes) {
    const item = document.createElement('li');
    item.className = 'coffee-card';
    item.append(cafeContent(cafe));
    const edit = document.createElement('button');
    edit.type = 'button'; edit.textContent = 'Edit';
    edit.addEventListener('click', async () => {
      if (saving) return;
      saving = true; fields.disabled = true;
      try {
        editing = cafe.id;
        suggestedWebsite = '';
        for (const name of names.filter(name => !['country', 'state', 'city'].includes(name))) form.elements[name].value = cafe[name] ?? '';
        await locations.setValues(cafe);
        document.getElementById('import-website').value = cafe.url || '';
        document.getElementById('import-maps').value = cafe.googleMapsUrl || '';
        document.getElementById('form-title').textContent = `Edit ${cafe.name}`;
        point(cafe.lat, cafe.lng);
        map?.jumpTo({ center: [cafe.lng, cafe.lat], zoom: 15 });
      } finally { saving = false; fields.disabled = false; }
      form.elements.name.focus();
    });
    const remove = document.createElement('button');
    remove.type = 'button'; remove.textContent = 'Delete';
    remove.addEventListener('click', async () => {
      if (saving || !confirm(`Delete ${cafe.name} from the public map?`)) return;
      await save(async () => {
        await request(`/${cafe.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${key.value}` } });
        if (editing === cafe.id) reset();
      });
    });
    item.append(edit, remove);
    list.append(item);
  }
  return cafes.length;
}

async function save(action) {
  if (!localDemo && !key.value) { status.textContent = 'Enter your private editor key first.'; key.focus(); return; }
  saving = true; fields.disabled = true;
  status.textContent = 'Saving…';
  try {
    await action();
    await load();
    status.textContent = 'Saved. Connected public pages update automatically—no deployment needed.';
  } catch (error) { status.textContent = error.message; }
  finally { saving = false; fields.disabled = false; }
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (saving) return;
  const cafe = Object.fromEntries(names.map(name => [name, form.elements[name].value]));
  Object.assign(cafe, locations.values());
  cafe.lat = Number(cafe.lat); cafe.lng = Number(cafe.lng);
  await save(async () => {
    await request(editing ? `/${editing}` : '', {
      method: editing ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key.value}` },
      body: JSON.stringify(cafe),
    });
    reset();
  });
});
importButton.addEventListener('click', async () => {
  if (saving) return;
  if (!localDemo && !key.value) { status.textContent = 'Enter your private editor key before importing.'; key.focus(); return; }
  const website = document.getElementById('import-website');
  const maps = document.getElementById('import-maps');
  if (!website.reportValidity() || !maps.reportValidity()) return;
  if (!maps.value) { status.textContent = 'Paste a Google Maps place link first.'; maps.focus(); return; }
  saving = true; importButton.disabled = true; fields.disabled = true;
  status.textContent = website.value ? 'Reading your map link…' : 'Reading the map link and looking for the café website…';
  try {
    const response = await fetch('/api/coffee-import', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key.value}` },
      body: JSON.stringify({ googleMapsUrl: maps.value, lookupWebsite: !website.value }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Import failed.');
    form.elements.url.value = website.value || data.website || '';
    if (!website.value && data.website) { website.value = data.website; suggestedWebsite = data.website; }
    form.elements.googleMapsUrl.value = data.googleMapsUrl;
    // Never leave coordinates from a previous import attached to a different café.
    form.elements.lat.value = ''; form.elements.lng.value = '';
    if (marker) { marker.remove(); marker = null; }
    form.elements.name.value = data.name || '';
    if (data.lat !== null && data.lng !== null) {
      form.elements.lat.value = data.lat; form.elements.lng.value = data.lng;
      point(data.lat, data.lng); map?.jumpTo({ center: [data.lng, data.lat], zoom: 15 });
    }
    status.textContent = [data.message, data.websiteMessage].filter(Boolean).join(' ');
  } catch (error) { status.textContent = error.message; }
  finally { saving = false; importButton.disabled = false; fields.disabled = false; }
});
document.getElementById('import-maps').addEventListener('input', () => {
  // A suggestion belongs to one imported place, never the next pasted café.
  const website = document.getElementById('import-website');
  if (suggestedWebsite && website.value === suggestedWebsite) {
    website.value = '';
    if (form.elements.url.value === suggestedWebsite) form.elements.url.value = '';
  }
  suggestedWebsite = '';
});
document.getElementById('cancel-edit').addEventListener('click', reset);
document.getElementById('reload').addEventListener('click', () => load().then(count => { status.textContent = `${count} published café(s).`; }).catch(error => { status.textContent = error.message; }));
for (const name of ['lat', 'lng']) form.elements[name].addEventListener('change', () => {
  if (form.elements.lat.value && form.elements.lng.value && form.elements.lat.validity.valid && form.elements.lng.validity.valid) point(Number(form.elements.lat.value), Number(form.elements.lng.value));
});

async function initialize() {
  try {
    await locations.ready;
    const response = await fetch('/api/editor-config', { cache: 'no-store' });
    if (!response.ok) throw new Error('Could not load editor settings.');
    localDemo = (await response.json()).localDemo === true;
    document.getElementById('editor-key-panel').hidden = localDemo;
    if (localDemo) {
      document.querySelector('h1').textContent = 'Coffee practice editor';
      document.getElementById('editor-notice').textContent = 'Practice mode — no key needed. Only accessible on your computer. Test entries are saved separately from your real café journal.';
    }
    const count = await load();
    status.textContent = localDemo ? `${count} practice café(s). Paste a Maps link below to get started—no password or Terminal command needed.` : `${count} published café(s). Enter your editor key to make changes.`;
    fields.disabled = false;
    importButton.disabled = false;
  } catch (error) { status.textContent = `Start the backend with npm run practice (local testing) or npm start. ${error.message}`; }
}
initialize();
loadMapLibre().then(library => {
  M = library;
  map = createMap(M, 'editor-map');
  map.on('error', () => { document.getElementById('editor-map-error').textContent = 'Map imagery unavailable. You can still enter coordinates manually.'; });
  map.on('click', event => {
    if (saving) return;
    const lat = event.lngLat.lat;
    const lng = ((event.lngLat.lng + 180) % 360 + 360) % 360 - 180;
    form.elements.lat.value = lat.toFixed(6);
    form.elements.lng.value = lng.toFixed(6);
    point(lat, lng);
  });
}).catch(() => { document.getElementById('editor-map').textContent = 'Map unavailable. You can still enter coordinates manually.'; });
