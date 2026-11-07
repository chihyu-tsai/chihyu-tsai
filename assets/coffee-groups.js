// Shared country aliases keep US/USA and Japanese/Taiwanese variants together.
export function countryName(value) {
  const text = (value || '').trim();
  const aliases = {
    us: 'United States', usa: 'United States', 'u.s.': 'United States', 'u.s.a.': 'United States',
    'united states': 'United States', 'united states of america': 'United States', '美國': 'United States',
    tw: 'Taiwan', taiwan: 'Taiwan', '台灣': 'Taiwan', '臺灣': 'Taiwan',
    jp: 'Japan', japan: 'Japan', '日本': 'Japan',
  };
  return aliases[text.toLowerCase()] || text || 'Location not set';
}

export function groupCafes(cafes) {
  const countries = new Map();
  for (const cafe of cafes) {
    const country = countryName(cafe.country);
    if (!countries.has(country)) countries.set(country, { name: country, count: 0, regions: new Map() });
    const entry = countries.get(country);
    entry.count++;
    const state = (cafe.state || '').trim();
    if (!entry.regions.has(state)) entry.regions.set(state, new Map());
    const cities = entry.regions.get(state);
    const city = (cafe.city || '').trim();
    if (!cities.has(city)) cities.set(city, []);
    cities.get(city).push(cafe);
  }
  const sort = entries => Array.from(entries).sort(([a], [b]) => a.localeCompare(b));
  return sort(countries).map(([, country]) => ({
    ...country,
    regions: sort(country.regions).map(([name, cities]) => ({
      name,
      cities: sort(cities).map(([name, cafes]) => ({ name, cafes: cafes.slice().sort((a, b) => a.name.localeCompare(b.name)) })),
    })),
  }));
}
