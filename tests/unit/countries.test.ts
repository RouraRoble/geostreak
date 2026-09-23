import { describe, expect, it } from 'vitest';
import { COUNTRIES, searchCountries, matchCountry, POP_COMPARE_POOL } from '../../src/lib/countries';

// Regression tests for audit findings #2 (raw Wikidata QIDs published as capitals), #5 (population
// years mixed across decades) and #6 (autocomplete prefix ordering / "China" exact match).

describe('data integrity (src/data/countries.json)', () => {
  const QID = /^Q\d+$/;

  it('never publishes a raw Wikidata QID as a capital', () => {
    for (const c of COUNTRIES) {
      if (c.capital != null) expect(c.capital, `${c.name} capital`).not.toMatch(QID);
      for (const cap of c.capitals) expect(cap, `${c.name} capitals[]`).not.toMatch(QID);
    }
  });

  it('Norway and Antigua and Barbuda have real capital names, not their QID fallback', () => {
    const no = COUNTRIES.find((c) => c.iso2 === 'NO');
    const ag = COUNTRIES.find((c) => c.iso2 === 'AG');
    expect(no?.capital).toBe('Oslo');
    expect(ag?.capital).toBe("St. John's");
  });

  it('never publishes a zero or missing area for a country that has one', () => {
    for (const c of COUNTRIES) {
      if (c.areaKm2 != null) expect(c.areaKm2, `${c.name} areaKm2`).toBeGreaterThan(0);
    }
  });

  it('Bigger-or-smaller population comparisons only draw from recent (>= 2022) figures', () => {
    expect(POP_COMPARE_POOL.length).toBeGreaterThan(50);
    for (const c of POP_COMPARE_POOL) expect(c.populationYear, c.name).toBeGreaterThanOrEqual(2022);
  });
});

describe('searchCountries prefix ordering', () => {
  it('puts prefix matches (India, Indonesia) ahead of unrelated "contains" matches for "in"', () => {
    const names = searchCountries('in', 8).map((c) => c.name);
    expect(names).toContain('India');
    expect(names).toContain('Indonesia');
    const firstContainsOnly = names.findIndex((n) => !n.toLowerCase().startsWith('in'));
    const indiaIdx = names.indexOf('India');
    // India starts with "in", so it must appear before any non-prefix match, not get sliced off.
    if (firstContainsOnly !== -1) expect(indiaIdx).toBeLessThan(firstContainsOnly);
  });

  it('ranks Germany ahead of a country that merely contains "ger"', () => {
    const names = searchCountries('ger', 8).map((c) => c.name);
    expect(names[0]).toBe('Germany');
  });
});

describe('matchCountry exact match', () => {
  it('matches "China" exactly (the short display name, not just the long Wikidata label)', () => {
    const hit = matchCountry('China');
    expect(hit?.iso2).toBe('CN');
  });
});
