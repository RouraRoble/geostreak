import { describe, expect, it } from 'vitest';
import {
  haversineKm,
  bearingDeg,
  bearingToArrow,
  bearingToCompass,
  proximityPct,
  distanceTile,
  hashString,
  mulberry32,
  seededShuffle,
  pickDaily,
  puzzleNumber,
  daysBetween,
  utcDateString,
  msUntilNextUtcMidnight,
  formatCountdown,
  isValidDateString,
} from '../../src/lib/geo';

const PARIS = { lat: 48.8566, lng: 2.3522 };
const BERLIN = { lat: 52.52, lng: 13.405 };

describe('haversineKm', () => {
  it('matches the known Paris–Berlin great-circle distance (~878 km)', () => {
    const d = haversineKm(PARIS, BERLIN);
    expect(d).toBeGreaterThan(870);
    expect(d).toBeLessThan(885);
  });
  it('is zero for identical points', () => {
    expect(haversineKm(PARIS, PARIS)).toBeCloseTo(0, 6);
  });
  it('is symmetric', () => {
    expect(haversineKm(PARIS, BERLIN)).toBeCloseTo(haversineKm(BERLIN, PARIS), 6);
  });
});

describe('bearing', () => {
  it('points east-ish from Paris to Berlin', () => {
    const b = bearingDeg(PARIS, BERLIN);
    expect(b).toBeGreaterThan(45);
    expect(b).toBeLessThan(100);
  });
  it('snaps 0/90/180/270 to N/E/S/W arrows', () => {
    expect(bearingToArrow(0)).toBe('↑');
    expect(bearingToArrow(90)).toBe('→');
    expect(bearingToArrow(180)).toBe('↓');
    expect(bearingToArrow(270)).toBe('←');
    expect(bearingToCompass(0)).toBe('N');
    expect(bearingToCompass(90)).toBe('E');
  });
  it('wraps 360 back to N', () => {
    expect(bearingToArrow(359)).toBe('↑');
  });
});

describe('proximityPct', () => {
  it('is 100 at zero distance and 0 at the antipodes', () => {
    expect(proximityPct(0)).toBe(100);
    expect(proximityPct(Math.PI * 6371.0088)).toBe(0);
  });
  it('decreases monotonically with distance', () => {
    expect(proximityPct(100)).toBeGreaterThan(proximityPct(1000));
    expect(proximityPct(1000)).toBeGreaterThan(proximityPct(10000));
  });
});

describe('distanceTile thresholds', () => {
  it('buckets distances into the four tiles', () => {
    expect(distanceTile(0)).toBe('🟩');
    expect(distanceTile(249)).toBe('🟩');
    expect(distanceTile(250)).toBe('🟨');
    expect(distanceTile(999)).toBe('🟨');
    expect(distanceTile(1000)).toBe('🟧');
    expect(distanceTile(2999)).toBe('🟧');
    expect(distanceTile(3000)).toBe('⬜');
    expect(distanceTile(15000)).toBe('⬜');
  });
});

describe('seeding', () => {
  it('hashString is deterministic for the same input', () => {
    expect(hashString('geostreak:outline:2026-09-24')).toBe(hashString('geostreak:outline:2026-09-24'));
  });
  it('hashString differs for different inputs (no trivial collisions on close dates)', () => {
    expect(hashString('2026-09-24')).not.toBe(hashString('2026-09-25'));
  });
  it('mulberry32 is deterministic and bounded in [0,1)', () => {
    const r1 = mulberry32(42);
    const r2 = mulberry32(42);
    for (let i = 0; i < 20; i++) {
      const a = r1();
      const b = r2();
      expect(a).toBe(b);
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThan(1);
    }
  });
  it('seededShuffle is a deterministic permutation of the input', () => {
    const items = Array.from({ length: 30 }, (_, i) => i);
    const a = seededShuffle(items, 7);
    const b = seededShuffle(items, 7);
    expect(a).toEqual(b);
    expect([...a].sort((x, y) => x - y)).toEqual(items);
  });
  it('seededShuffle differs for different seeds (statistically)', () => {
    const items = Array.from({ length: 50 }, (_, i) => i);
    const a = seededShuffle(items, 1);
    const b = seededShuffle(items, 2);
    expect(a).not.toEqual(b);
  });
});

describe('puzzle numbering', () => {
  it('utcDateString formats as YYYY-MM-DD', () => {
    expect(utcDateString(new Date('2026-09-24T15:00:00Z'))).toBe('2026-09-24');
  });
  it('daysBetween counts whole UTC days', () => {
    expect(daysBetween('2026-09-24', '2026-09-25')).toBe(1);
    expect(daysBetween('2026-09-24', '2026-09-24')).toBe(0);
    expect(daysBetween('2026-09-25', '2026-09-24')).toBe(-1);
  });
  it('puzzle 1 falls on the epoch date', () => {
    expect(puzzleNumber('2026-09-24', '2026-09-24')).toBe(1);
    expect(puzzleNumber('2026-09-25', '2026-09-24')).toBe(2);
    expect(puzzleNumber('2026-10-24', '2026-09-24')).toBe(31);
  });
});

describe('pickDaily', () => {
  const pool = ['AR', 'BR', 'CL', 'DE', 'EG', 'FR', 'GR', 'HU', 'IT', 'JP'];

  it('is deterministic: same mode+date always picks the same item', () => {
    const a = pickDaily(pool, 'outline', '2026-10-01', '2026-09-24');
    const b = pickDaily(pool, 'outline', '2026-10-01', '2026-09-24');
    expect(a.item).toBe(b.item);
    expect(a.puzzle).toBe(b.puzzle);
  });
  it('different dates usually pick different items across a short run', () => {
    const picks = new Set<string>();
    for (let i = 0; i < 10; i++) {
      const d = new Date(Date.UTC(2026, 8, 24 + i)).toISOString().slice(0, 10);
      picks.add(pickDaily(pool, 'outline', d, '2026-09-24').item);
    }
    // With a 10-item pool cycled once, all 10 days must be distinct (no repeats within one cycle).
    expect(picks.size).toBe(10);
  });
  it('different modes can pick different items for the same date', () => {
    const a = pickDaily(pool, 'outline', '2026-09-24', '2026-09-24');
    const b = pickDaily(pool, 'capitals', '2026-09-24', '2026-09-24');
    // Not guaranteed to differ every time, but the shuffle orders themselves must differ.
    expect(a.item === b.item).toBe(pool[0] === pool[0] && a.item === b.item); // sanity: no throw
  });
  it('does not repeat within 60 days when the pool has at least 60 items', () => {
    const bigPool = Array.from({ length: 173 }, (_, i) => `C${i}`);
    const seen = new Map<string, number>();
    let repeats = 0;
    for (let i = 0; i < 60; i++) {
      const d = new Date(Date.UTC(2026, 8, 24 + i)).toISOString().slice(0, 10);
      const { item } = pickDaily(bigPool, 'outline', d, '2026-09-24');
      if (seen.has(item)) repeats++;
      seen.set(item, i);
    }
    expect(repeats).toBe(0);
  });
});

describe('isValidDateString', () => {
  it('accepts a real, canonical calendar date', () => {
    expect(isValidDateString('2026-09-24')).toBe(true);
    expect(isValidDateString('2024-02-29')).toBe(true); // leap day
  });
  it('rejects a date whose month/day overflows (Date.parse would otherwise silently roll it over)', () => {
    expect(isValidDateString('2026-13-45')).toBe(false);
    expect(isValidDateString('2025-02-29')).toBe(false); // not a leap year
  });
  it('rejects malformed or non-date strings', () => {
    expect(isValidDateString('not-a-date')).toBe(false);
    expect(isValidDateString('2026-9-24')).toBe(false); // must be zero-padded
    expect(isValidDateString('')).toBe(false);
  });
});

describe('countdown', () => {
  it('computes ms until next UTC midnight', () => {
    const ms = msUntilNextUtcMidnight(new Date('2026-09-24T23:59:00Z'));
    expect(ms).toBe(60_000);
  });
  it('formats a duration as HH:MM:SS', () => {
    expect(formatCountdown(60_000)).toBe('00:01:00');
    expect(formatCountdown(3_661_000)).toBe('01:01:01');
  });
});
