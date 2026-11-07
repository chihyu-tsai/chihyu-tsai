import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Pinned open-data snapshot; generated files retain its ODbL license.
const revision = '30fcbf267d538f96dafd0e4e451f5e43b2989700';
const base = `https://raw.githubusercontent.com/dr5hn/countries-states-cities-database/${revision}`;
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const target = resolve(root, 'assets/locations');
const source = process.argv[2]
  ? JSON.parse(await readFile(process.argv[2], 'utf8'))
  : await (await fetch(`${base}/json/countries%2Bstates%2Bcities.json`, { signal: AbortSignal.timeout(90000) })).json();
const names = items => [...new Set((items || []).map(item => item.name).filter(Boolean))].sort((a, b) => a.localeCompare(b));
await mkdir(target, { recursive: true });
const countries = [];
for (const country of source) {
  if (!/^[A-Z]{2}$/.test(country.iso2) || typeof country.name !== 'string') throw new Error('Invalid location source.');
  countries.push({ name: country.name, code: country.iso2 });
  const data = {
    name: country.name,
    states: (country.states || []).map(state => ({ name: state.name, cities: names(state.cities) })).sort((a, b) => a.name.localeCompare(b.name)),
    cities: names(country.cities),
  };
  await writeFile(resolve(target, `${country.iso2}.json`), JSON.stringify(data) + '\n');
}
countries.sort((a, b) => a.name.localeCompare(b.name));
await writeFile(resolve(target, 'countries.json'), JSON.stringify(countries) + '\n');
const licenseResponse = await fetch(`${base}/LICENSE`, { signal: AbortSignal.timeout(30000) });
if (!licenseResponse.ok) throw new Error('Could not retrieve the dataset license.');
await writeFile(resolve(target, 'LICENSE.txt'), await licenseResponse.text());
await writeFile(resolve(target, 'SOURCE.txt'), `Location dropdown data derived from Countries States Cities Database by dr5hn and contributors.\nhttps://github.com/dr5hn/countries-states-cities-database\nSource revision: ${revision}\nLicense: Open Database License (ODbL) 1.0; see LICENSE.txt.\nModification: retained country/region/city names only, split by country, sorted and deduplicated.\nThis is community-maintained reference data, not a USPS or government validation service. Names/administrative levels may vary; custom entry is supported.\n`);
console.log(`Generated offline-ready location choices for ${countries.length} countries/territories.`);
