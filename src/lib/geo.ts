/**
 * Pure geography + puzzle-determinism helpers. No DOM, no I/O — safe to unit test.
 */

const EARTH_RADIUS_KM = 6371.0088;

/** Great-circle distance between two lat/lng points, in kilometres (haversine formula). */
export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const la1 = toRad(a.lat);
  const la2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return EARTH_RADIUS_KM * c;
}

export function kmToMiles(km: number): number {
  return km * 0.621371;
}

/** Initial bearing from a to b, in degrees [0, 360). */
export function bearingDeg(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const la1 = toRad(a.lat);
  const la2 = toRad(b.lat);
  const dLng = toRad(b.lng - a.lng);
  const y = Math.sin(dLng) * Math.cos(la2);
  const x = Math.cos(la1) * Math.sin(la2) - Math.sin(la1) * Math.cos(la2) * Math.cos(dLng);
  const deg = (Math.atan2(y, x) * 180) / Math.PI;
  return (deg + 360) % 360;
}

export const COMPASS_ARROWS = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'] as const;
export const COMPASS_NAMES = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;

/** Snap a bearing to one of 8 compass directions and return its arrow glyph. */
export function bearingToArrow(deg: number): (typeof COMPASS_ARROWS)[number] {
  const idx = Math.round(deg / 45) % 8;
  return COMPASS_ARROWS[idx];
}
export function bearingToCompass(deg: number): (typeof COMPASS_NAMES)[number] {
  const idx = Math.round(deg / 45) % 8;
  return COMPASS_NAMES[idx];
}

/**
 * Proximity percentage: 100% at 0 km, ~0% at (or beyond) half the Earth's circumference.
 * Uses the same curve Worldle-style games use (cosine falloff) so mid-range guesses feel fair.
 */
export function proximityPct(distanceKm: number): number {
  const maxKm = Math.PI * EARTH_RADIUS_KM; // antipodal distance
  const clamped = Math.min(Math.max(distanceKm, 0), maxKm);
  const pct = 100 * (1 - clamped / maxKm) ** 2;
  return Math.round(pct);
}

/** Emoji "heat" tile for a distance guess: 🟩 very close, 🟨 close-ish, 🟧 far, ⬜ very far. */
export function distanceTile(distanceKm: number): '🟩' | '🟨' | '🟧' | '⬜' {
  if (distanceKm < 250) return '🟩';
  if (distanceKm < 1000) return '🟨';
  if (distanceKm < 3000) return '🟧';
  return '⬜';
}

// ---- Deterministic seeding -------------------------------------------------

/** Simple, fast, well-distributed 32-bit string hash (djb2 xor variant). */
export function hashString(str: string): number {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = (h * 33) ^ str.charCodeAt(i);
  }
  return h >>> 0;
}

/** mulberry32: tiny deterministic PRNG. Returns a function yielding floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic Fisher–Yates shuffle of `items`, seeded — same seed always yields the same order. */
export function seededShuffle<T>(items: readonly T[], seed: number): T[] {
  const arr = items.slice();
  const rand = mulberry32(seed);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** UTC calendar date as 'YYYY-MM-DD' for a given Date (defaults to now). */
export function utcDateString(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}

/**
 * True only for a real, round-tripping UTC calendar date in 'YYYY-MM-DD' form — rejects both
 * malformed strings the regex alone would miss (e.g. "2026-13-45", which `Date.parse` silently
 * rolls over into a different date) and anything that isn't the canonical zero-padded form.
 */
export function isValidDateString(d: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  const t = Date.parse(d + 'T00:00:00Z');
  if (Number.isNaN(t)) return false;
  return utcDateString(new Date(t)) === d;
}

/** Whole days between two 'YYYY-MM-DD' UTC date strings (b - a). */
export function daysBetween(aISO: string, bISO: string): number {
  const a = Date.parse(aISO + 'T00:00:00Z');
  const b = Date.parse(bISO + 'T00:00:00Z');
  return Math.round((b - a) / 86_400_000);
}

/** Puzzle number for a date: 1 on the epoch date, 2 the day after, etc. Can be <1 before launch. */
export function puzzleNumber(dateISO: string, epochISO: string): number {
  return daysBetween(epochISO, dateISO) + 1;
}

/**
 * Deterministically pick today's item from a pool for a given mode, without repeats until the
 * whole pool has cycled once (pool.length days). The pool order itself is shuffled once per mode
 * (seeded by the mode name) so the rotation isn't alphabetical, then indexed by puzzle number.
 */
export function pickDaily<T>(pool: readonly T[], mode: string, dateISO: string, epochISO: string): { item: T; puzzle: number; cycle: number } {
  if (pool.length === 0) throw new Error('pickDaily: empty pool');
  const order = seededShuffle(pool, hashString('geostreak:' + mode));
  const puzzle = puzzleNumber(dateISO, epochISO);
  const n = order.length;
  const idx = ((puzzle - 1) % n + n) % n;
  const cycle = Math.floor((puzzle - 1) / n);
  return { item: order[idx], puzzle, cycle };
}

/** Deterministically pick one item for an arbitrary numeric seed (used by practice/"beat my score" links). */
export function pickBySeed<T>(pool: readonly T[], seed: number): T {
  if (pool.length === 0) throw new Error('pickBySeed: empty pool');
  return seededShuffle(pool, seed)[0];
}

/** Milliseconds until the next UTC midnight from `from` (defaults to now). */
export function msUntilNextUtcMidnight(from: Date = new Date()): number {
  const next = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate() + 1, 0, 0, 0, 0);
  return next - from.getTime();
}

/** Format a millisecond duration as HH:MM:SS. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}
