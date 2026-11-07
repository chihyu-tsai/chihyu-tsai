import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import vm from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(root, 'assets/geography');
const revision = 'ca96624a56bd078437bca8184e78163e5039ad19';
const sourceUrl = `https://raw.githubusercontent.com/nvkelso/natural-earth-vector/${revision}/geojson/ne_110m_admin_0_countries.geojson`;
async function text(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(45000) });
  if (!response.ok) throw new Error(`Map build resource failed: HTTP ${response.status}`);
  return response.text();
}
const [source, d3Code, license] = await Promise.all([
  text(sourceUrl),
  text('https://cdn.jsdelivr.net/npm/d3@7.9.0/dist/d3.min.js'),
  text('https://cdn.jsdelivr.net/npm/d3@7.9.0/LICENSE'),
]);
if (createHash('sha256').update(d3Code).digest('hex') !== 'f2094bbf6141b359722c4fe454eb6c4b0f0e42cc10cc7af921fc158fceb86539') throw new Error('D3 build-tool checksum mismatch.');
const context = { setTimeout, clearTimeout, setInterval, clearInterval, performance };
vm.runInNewContext(d3Code, context, { timeout: 5000 });
const d3 = context.d3;
const world = JSON.parse(source);
for (const feature of world.features) {
  // D3 uses clockwise spherical exteriors; normalize RFC-style source rings.
  if (d3.geoArea(feature) > Math.PI * 2) {
    if (feature.geometry.type === 'Polygon') feature.geometry.coordinates.forEach(ring => ring.reverse());
    if (feature.geometry.type === 'MultiPolygon') feature.geometry.coordinates.forEach(polygon => polygon.forEach(ring => ring.reverse()));
  }
}
const projection = d3.geoNaturalEarth1().rotate([160, 0]).fitExtent([[8, 8], [892, 350]], { type: 'Sphere' });
const path = d3.geoPath(projection).digits(2);
const taiwan = world.features.find(feature => feature.properties.ADMIN === 'Taiwan');
if (!taiwan) throw new Error('Taiwan geometry is required for the inset.');
const inset = d3.geoMercator().fitExtent([[80, 275], [145, 410]], taiwan);
const round = point => point.map(value => Number(value.toFixed(2)));
const stops = JSON.parse(await readFile(resolve(root, 'data/journey.json'), 'utf8')).map(stop => ({ ...stop, point: round(projection(stop.coordinates)), insetPoint: stop.region === 'Taiwan' ? round(inset(stop.coordinates)) : null }));
const arc = (from, to, height) => {
  const a = from.point, b = to.point;
  return `M${a[0]},${a[1]} Q${((a[0] + b[0]) / 2).toFixed(2)},${(Math.min(a[1], b[1]) - height).toFixed(2)} ${b[0]},${b[1]}`;
};
const routes = [
  { from: 'kaohsiung', to: 'tainan', inset: true, path: `M${stops[0].insetPoint.join(',')} Q66,374 ${stops[1].insetPoint.join(',')}` },
  { from: 'tainan', to: 'bay-area', path: arc(stops[1], stops[2], 100) },
  { from: 'bay-area', to: 'philadelphia', path: arc(stops[2], stops[3], 48) },
];
await mkdir(output, { recursive: true });
await writeFile(resolve(output, 'education-journey.json'), JSON.stringify({
  width: 900, height: 440,
  lands: world.features.map(feature => path(feature)).filter(Boolean),
  taiwan: d3.geoPath(inset).digits(2)(taiwan), stops, routes,
}) + '\n');
await writeFile(resolve(output, 'SOURCE.txt'), `Education journey map: custom Pacific-centered design.\nBase geography: Natural Earth, 1:110m countries, public domain.\nhttps://www.naturalearthdata.com/about/terms-of-use/\nSource: ${sourceUrl}\nModifications: projected into simplified SVG paths; Taiwan detail inset; custom city-center markers and illustrative connecting curves.\nProjection generated with D3 7.9.0 (ISC), used at build time only. See D3-LICENSE.txt.\nCity centers are approximate, not personal addresses. Curves indicate the order of life stages, not exact travel routes. No high-school institution or dates have been inferred.\n`);
await writeFile(resolve(output, 'D3-LICENSE.txt'), license);
console.log(`Built education journey: ${world.features.length} country paths, ${stops.length} stops, Pacific-centered view with Taiwan inset.`);
console.log(stops.map(stop => `${stop.label}: ${stop.point.join(', ')}${stop.insetPoint ? `; inset ${stop.insetPoint.join(', ')}` : ''}`).join('\n'));
