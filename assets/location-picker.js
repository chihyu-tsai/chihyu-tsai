import { countryName } from './coffee-groups.js';

const CUSTOM = '__custom__';
const same = (a, b) => a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase();

export function createLocationPicker(form) {
  const selects = Object.fromEntries(['country', 'state', 'city'].map(key => [key, form.elements[key]]));
  const custom = Object.fromEntries(['country', 'state', 'city'].map(key => [key, document.getElementById(`${key}-custom`)]));
  const status = document.getElementById('location-status');
  const publish = document.getElementById('publish-cafe');
  const cache = new Map();
  let countries = [], data = null, version = 0;

  const value = key => selects[key].value === CUSTOM ? custom[key].value.trim() : selects[key].value;
  function showCustom(key) {
    const active = selects[key].value === CUSTOM;
    custom[key].hidden = !active;
    custom[key].disabled = !active;
    custom[key].required = key === 'country' && active;
  }
  function options(key, choices, placeholder) {
    selects[key].replaceChildren(new Option(placeholder, ''));
    for (const name of choices) selects[key].append(new Option(name, name));
    selects[key].append(new Option('Other / enter manually…', CUSTOM));
    custom[key].value = '';
    showCustom(key);
  }
  function assign(key, text = '') {
    const match = Array.from(selects[key].options).find(option => option.value !== CUSTOM && same(option.value, text));
    selects[key].value = match ? match.value : CUSTOM;
    custom[key].value = match ? '' : text;
    showCustom(key);
  }
  function cities(selectedCity = '') {
    const state = data?.states.find(item => same(item.name, value('state')));
    options('city', state?.cities || data?.cities || [], state ? 'Choose city (optional)' : 'Choose a region first, or enter manually');
    assign('city', selectedCity);
  }
  async function loadCountry(selectedState = '', selectedCity = '') {
    const request = ++version;
    data = null;
    options('state', [], 'Choose state / prefecture / region (optional)');
    options('city', [], 'Choose a region first, or enter manually');
    const country = countries.find(item => item.name === value('country'));
    if (!country) { assign('state', selectedState); assign('city', selectedCity); publish.disabled = false; return; }
    publish.disabled = true;
    status.textContent = 'Loading location choices…';
    try {
      if (!cache.has(country.code)) {
        cache.set(country.code, fetch(`/assets/locations/${country.code}.json`).then(response => {
          if (!response.ok) throw new Error('Location choices unavailable.');
          return response.json();
        }).catch(error => { cache.delete(country.code); throw error; }));
      }
      const result = await cache.get(country.code);
      if (request !== version) return;
      data = result;
      options('state', data.states.map(state => state.name), data.states.length ? 'Choose state / prefecture / region (optional)' : 'No region listed — skip or enter manually');
      assign('state', selectedState);
      cities(selectedCity);
      status.textContent = 'Choose a region to narrow the cities. Missing a place? Select “Other / enter manually”. Confirm these fields match the map pin.';
    } catch {
      if (request !== version) return;
      assign('state', selectedState); assign('city', selectedCity);
      status.textContent = 'Location choices could not load. Use “Other / enter manually”; your café can still be saved.';
    } finally { if (request === version) publish.disabled = false; }
  }

  const ready = (async () => {
    options('country', [], 'Choose country');
    options('state', [], 'Choose a country first');
    options('city', [], 'Choose a region first, or enter manually');
    try {
      const response = await fetch('/assets/locations/countries.json');
      if (!response.ok) throw new Error();
      countries = await response.json();
      const favoriteCodes = ['US', 'TW', 'JP'];
      const favorites = favoriteCodes.map(code => countries.find(country => country.code === code)).filter(Boolean);
      options('country', [...favorites, ...countries.filter(country => !favoriteCodes.includes(country.code))].map(country => country.name), 'Choose country');
      status.textContent = 'Select country → state/prefecture → city. The list is community-maintained; custom entries are welcome.';
    } catch { status.textContent = 'Location list unavailable. Select “Other / enter manually” to continue.'; }
  })();

  selects.country.addEventListener('change', () => { showCustom('country'); loadCountry(); });
  selects.state.addEventListener('change', () => { showCustom('state'); cities(); });
  selects.city.addEventListener('change', () => showCustom('city'));

  return {
    ready,
    values: () => Object.fromEntries(['country', 'state', 'city'].map(key => [key, value(key)])),
    async setValues(cafe) {
      await ready;
      assign('country', cafe.country ? countryName(cafe.country) : '');
      await loadCountry(cafe.state || '', cafe.city || '');
    },
    reset() {
      ++version; data = null;
      assign('country', '');
      options('state', [], 'Choose a country first');
      options('city', [], 'Choose a region first, or enter manually');
      publish.disabled = false;
    },
  };
}
