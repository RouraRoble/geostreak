/**
 * Typed access to src/data/countries.json + src/data/outlines.json.
 * Pure data helpers — safe to import from both Astro pages (build time) and Preact islands (browser).
 */
import countriesData from '../data/countries.json';

export interface Country {
  slug: string;
  name: string;
  iso2: string;
  iso3: string;
  capital: string | null;
  capitals: string[];
  capitalNote: string | null;
  continent: string;
  subregion: string;
  population: number;
  populationYear: number;
  areaKm2: number | null;
  lat: number;
  lng: number;
  neighbours: string[];
  flagEmoji: string;
  aliases: string[];
  unMember: boolean;
  daily: boolean;
  populationRank: number | null;
  areaRank: number | null;
}

export const COUNTRIES: Country[] = countriesData.countries as Country[];
export const DATA_SOURCES = countriesData.sources;
export const DATA_GENERATED_AT: string = countriesData.generatedAt;

const byIso2 = new Map(COUNTRIES.map((c) => [c.iso2, c]));
const bySlug = new Map(COUNTRIES.map((c) => [c.slug, c]));

export function getByIso2(iso2: string): Country | undefined {
  return byIso2.get(iso2.toUpperCase());
}
export function getBySlug(slug: string): Country | undefined {
  return bySlug.get(slug);
}
export function neighboursOf(c: Country): Country[] {
  return c.neighbours.map((iso) => byIso2.get(iso)).filter((x): x is Country => Boolean(x));
}

// Note: OUTLINE_POOL and outlineFor() live in lib/outlines.ts, not here — see that file's header
// comment for why (outlines.json is ~450 KB and only the Outline mode needs it).

/** Countries with a real capital — used for the Capitals mode. */
export const CAPITALS_POOL: Country[] = COUNTRIES.filter((c) => c.capital);
/** Countries with both population and area — used for the Bigger-or-smaller mode. */
export const COMPARE_POOL: Country[] = COUNTRIES.filter((c) => c.population && c.areaKm2);
/**
 * Countries whose population figure comes from a recent (>= 2022) snapshot — used for the
 * population half of Bigger-or-smaller specifically. Area doesn't have this staleness problem, so
 * area rounds keep using the full COMPARE_POOL; population rounds only pair countries whose figures
 * were measured close enough in time to each other to make "which is bigger" a fair, defensible
 * question (see scripts/build-countries.mjs MIN_POP_YEAR).
 */
export const POP_COMPARE_POOL: Country[] = COMPARE_POOL.filter((c) => c.populationYear >= 2022);

function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

export interface SearchEntry {
  country: Country;
  label: string;
  norm: string;
}
let searchIndex: SearchEntry[] | null = null;
function index(): SearchEntry[] {
  if (searchIndex) return searchIndex;
  const out: SearchEntry[] = [];
  for (const c of COUNTRIES) {
    out.push({ country: c, label: c.name, norm: normalize(c.name) });
    for (const a of c.aliases) out.push({ country: c, label: c.name, norm: normalize(a) });
  }
  searchIndex = out;
  return out;
}

/** Autocomplete: countries whose name/alias starts with (preferred) or contains `query`. Deduped, name-sorted. */
export function searchCountries(query: string, limit = 8): Country[] {
  const q = normalize(query);
  if (!q) return [];
  const starts: Country[] = [];
  const contains: Country[] = [];
  const seen = new Set<string>();
  for (const e of index()) {
    if (seen.has(e.country.iso2)) continue;
    if (e.norm.startsWith(q)) {
      starts.push(e.country);
      seen.add(e.country.iso2);
    } else if (e.norm.includes(q)) {
      contains.push(e.country);
      seen.add(e.country.iso2);
    }
  }
  // Sort each bucket independently so prefix matches always outrank "contains" matches — sorting the
  // combined list alphabetically (the old behaviour) let alphabetically-early "contains" hits push
  // relevant prefix matches (e.g. India, Indonesia for "in") off the end of a `slice(0, limit)`.
  starts.sort((a, b) => a.name.localeCompare(b.name));
  contains.sort((a, b) => a.name.localeCompare(b.name));
  return [...starts, ...contains].slice(0, limit);
}

/** Exact-ish match by typed name or alias (case/diacritic-insensitive), used to validate a guess. */
export function matchCountry(query: string): Country | undefined {
  const q = normalize(query);
  const hit = index().find((e) => e.norm === q);
  return hit?.country;
}
