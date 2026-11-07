import { isIP } from 'node:net';

const normalize = value => String(value || '').normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

function safeWebsite(value) {
  try {
    if (typeof value !== 'string' || value.length > 500) return '';
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || isIP(url.hostname) || !url.hostname.includes('.') || /\.(local|localhost|internal)$/.test(url.hostname)) return '';
    return url.href;
  } catch { return ''; }
}

export function matchCafeWebsite(place, elements) {
  const name = normalize(place.name);
  if (!name || !Array.isArray(elements)) return '';
  const websites = new Set();
  for (const element of elements) {
    const lat = element.lat ?? element.center?.lat;
    const lng = element.lon ?? element.center?.lon;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const distance = Math.hypot((lat - place.lat) * 111320, (lng - place.lng) * 111320 * Math.cos(place.lat * Math.PI / 180));
    if (distance > 120) continue;
    const tags = element.tags || {};
    const names = ['name', 'name:en', 'name:zh', 'name:ja', 'official_name', 'alt_name'].flatMap(key => String(tags[key] || '').split(';'));
    if (!names.some(candidate => normalize(candidate) === name)) continue;
    const website = safeWebsite(tags.website || tags['contact:website']);
    if (website) websites.add(website);
  }
  // Ambiguous records must not silently choose an unrelated business website.
  return websites.size === 1 ? [...websites][0] : '';
}

export async function findCafeWebsite(place, fetcher = fetch) {
  const empty = message => ({ website: '', websiteMessage: message });
  if (!place.name || !Number.isFinite(place.lat) || !Number.isFinite(place.lng) || Math.abs(place.lat) > 90 || Math.abs(place.lng) > 180) {
    return empty('Website lookup needs a café name and exact pin. You can leave the website blank or enter it manually.');
  }
  const around = `around:120,${place.lat},${place.lng}`;
  const query = `[out:json][timeout:8];(nwr(${around})["amenity"~"^(cafe|restaurant|fast_food)$"];nwr(${around})["shop"="coffee"];);out center 40;`;
  try {
    const response = await fetcher('https://overpass-api.de/api/interpreter', {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10000),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'ChihYuTsaiCoffeeJournal/1.0' },
      body: new URLSearchParams({ data: query }),
    });
    if (!response.ok) return empty('Website lookup is temporarily unavailable. The map pin was still imported; a website is optional.');
    const result = await response.json();
    const website = matchCafeWebsite(place, result.elements);
    return website
      ? { website, websiteMessage: 'Website found in OpenStreetMap. Please confirm it belongs to this café before publishing.' }
      : empty('No confidently matching website was found in OpenStreetMap. Leave it blank or add it manually.');
  } catch {
    return empty('Website lookup is temporarily unavailable. You can still publish the café without a website.');
  }
}
