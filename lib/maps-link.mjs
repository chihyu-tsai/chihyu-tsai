const fullHosts = new Set(['google.com', 'www.google.com', 'maps.google.com', 'www.google.co.jp', 'www.google.com.tw', 'www.google.co.uk']);
const shortHosts = new Set(['maps.app.goo.gl', 'goo.gl']);

function invalid(message) { throw Object.assign(new Error(message), { status: 400 }); }

export function validateMapsUrl(value) {
  if (typeof value !== 'string' || value.length > 4096) invalid('Enter a valid Google Maps URL.');
  let url;
  try { url = new URL(value.trim()); } catch { invalid('Enter a valid Google Maps URL.'); }
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) invalid('Use a public HTTPS Google Maps URL.');
  const full = fullHosts.has(url.hostname) && (url.pathname.startsWith('/maps') || url.hostname === 'maps.google.com');
  const short = shortHosts.has(url.hostname) && (url.hostname !== 'goo.gl' || url.pathname.startsWith('/maps/'));
  if (!full && !short) invalid('Use a google.com/maps or maps.app.goo.gl link.');
  return url;
}

export function parseMapsUrl(value) {
  const url = validateMapsUrl(value);
  const place = url.pathname.match(/\/place\/([^/]+)/);
  let name = '';
  try { if (place) name = decodeURIComponent(place[1].replace(/\+/g, ' ')).slice(0, 120); }
  catch { invalid('The Google Maps link contains invalid encoding.'); }
  const number = '(-?\\d+(?:\\.\\d+)?)';
  // !3d / !4d identify the place pin, unlike @lat,lng (the viewport center).
  let coordinates = url.href.match(new RegExp(`!3d${number}!4d${number}`));
  if (!coordinates) {
    for (const key of ['query', 'q']) {
      const text = url.searchParams.get(key) || '';
      // ll alone is a viewport; only use a coordinates-only query or q.
      coordinates = text.match(new RegExp(`^\\s*${number}\\s*,\\s*${number}\\s*$`));
      if (coordinates) break;
    }
  }
  const lat = coordinates ? Number(coordinates[1]) : null;
  const lng = coordinates ? Number(coordinates[2]) : null;
  if (coordinates && (Math.abs(lat) > 90 || Math.abs(lng) > 180)) invalid('The map link has invalid coordinates.');
  return {
    name, lat, lng, googleMapsUrl: url.href,
    message: coordinates
      ? 'Pin imported. Review its location, café name, and country/region/city before publishing.'
      : 'No exact place pin was found in this link. Choose the café on the editor map or enter its coordinates. Map viewport coordinates are not treated as a café location.',
  };
}

export async function importMapsUrl(value, fetcher = fetch) {
  let url = validateMapsUrl(value);
  // Resolve only explicit Google Maps short links, with every redirect checked.
  // Never fetch the supplied café website or scrape Google page content.
  if (shortHosts.has(url.hostname)) {
    for (let redirect = 0; redirect < 5; redirect++) {
      let response;
      try { response = await fetcher(url.href, { method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(5000) }); }
      catch { invalid('Could not resolve this short link. Paste the full Google Maps URL instead.'); }
      await response.body?.cancel();
      if (![301, 302, 303, 307, 308].includes(response.status)) break;
      const target = response.headers.get('location');
      if (!target) invalid('Short link has no destination. Paste the full Maps URL.');
      url = validateMapsUrl(new URL(target, url).href);
      if (fullHosts.has(url.hostname)) return parseMapsUrl(url.href);
    }
    invalid('This short link could not be expanded safely. Open it in your browser and paste the full Google Maps URL.');
  }
  return parseMapsUrl(url.href);
}
