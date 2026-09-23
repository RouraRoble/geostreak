/**
 * Shared helpers for "N rounds, one result each" games (Capitals, Bigger-or-smaller).
 *
 * The persisted/restored state for these modes is a single `results: boolean[]` array — step, score,
 * combo and best-combo are always *derived* from it, never stored or restored independently. That's
 * what makes a reload safe at any point, including mid-reveal: the audit-2 P1 regression happened
 * because `step` and `score`/`results` were three separately-persisted values that could (and did, on
 * a reload during the ~1–2s reveal window) go out of sync — `results` had already gained an entry but
 * `step` hadn't advanced yet, so the restored round was answerable a second time. Deriving everything
 * from `results` removes that whole class of bug: there is nothing left to desync.
 */

/** Validates/clamps a value loaded from storage into a safe `results` array: only booleans, capped at
 *  `rounds` entries. Anything else (wrong shape, too long, tampered) is dropped rather than trusted,
 *  same spirit as `stats.ts`'s import clamping. */
export function sanitizeResults(raw: unknown, rounds: number): boolean[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((v): v is boolean => typeof v === 'boolean').slice(0, rounds);
}

/** The round index to play/show next — always just how many results are recorded so far. */
export function deriveStep(results: boolean[]): number {
  return results.length;
}

/** Total correct answers, derived from `results`. */
export function deriveScore(results: boolean[]): number {
  return results.reduce((n, ok) => n + (ok ? 1 : 0), 0);
}

/** Current trailing combo and the best combo reached so far, both derived from `results`. */
export function deriveCombo(results: boolean[]): { combo: number; bestCombo: number } {
  let combo = 0;
  let bestCombo = 0;
  for (const ok of results) {
    combo = ok ? combo + 1 : 0;
    if (combo > bestCombo) bestCombo = combo;
  }
  return { combo, bestCombo };
}
