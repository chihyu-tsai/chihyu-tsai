import { countryName } from './coffee-groups.js';

// Reuse the bundled global country list instead of guessing from café names.
export function countryFlag(name, countries) {
  const normalized = countryName(name);
  const entry = countries.find(country => country.name === normalized || country.code === normalized.toUpperCase());
  if (!entry || !/^[A-Z]{2}$/.test(entry.code)) return '';
  return [...entry.code].map(letter => String.fromCodePoint(0x1f1e6 + letter.charCodeAt(0) - 65)).join('');
}
