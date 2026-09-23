/**
 * Streak & stats logic. Pure reducer functions (`applyResult`, `emptyStats`) are unit-tested directly;
 * `loadStats`/`saveStats` are the only bits that touch `localStorage`, guarded for SSR/build safety.
 */

export type Mode = 'outline' | 'capitals' | 'bigger';
export const MODES: Mode[] = ['outline', 'capitals', 'bigger'];

export interface ModeStats {
  played: number;
  won: number;
  currentStreak: number;
  maxStreak: number;
  /** Puzzle number of the last *counted* (non-practice) result, or null if never played. */
  lastPuzzle: number | null;
  /** Outcome buckets: for 'outline' the guess count ('1'..'6') or 'x' for a loss; for the other two
   *  modes the score out of 10 ('0'..'10'). Used to draw the results histogram. */
  distribution: Record<string, number>;
}

/** Tracks *participation* across all three modes: consecutive days on which at least one mode was
 *  completed (win or lose — unlike a per-mode streak, which only counts wins). This is deliberately
 *  separate from summing the three per-mode streaks (the audit-2 finding this replaces): three modes
 *  each on a 5-day win streak is still only 5 *days* played, not "Overall 15". */
export interface OverallStats {
  currentStreak: number;
  maxStreak: number;
  /** Puzzle number of the last day any mode's result was counted, or null if never played. */
  lastPuzzle: number | null;
}

export interface StatsState {
  version: 1;
  hardMode: boolean;
  units: 'km' | 'mi';
  modes: Record<Mode, ModeStats>;
  overall: OverallStats;
}

export function emptyModeStats(): ModeStats {
  return { played: 0, won: 0, currentStreak: 0, maxStreak: 0, lastPuzzle: null, distribution: {} };
}

export function emptyOverallStats(): OverallStats {
  return { currentStreak: 0, maxStreak: 0, lastPuzzle: null };
}

export function emptyStats(): StatsState {
  return {
    version: 1,
    hardMode: false,
    units: 'km',
    modes: { outline: emptyModeStats(), capitals: emptyModeStats(), bigger: emptyModeStats() },
    overall: emptyOverallStats(),
  };
}

export interface ResultInput {
  mode: Mode;
  puzzle: number;
  won: boolean;
  /** Bucket key for the distribution histogram, e.g. '3' guesses or a '7' out of 10 score. */
  bucket: string;
}

export type ApplyOutcome = { state: StatsState; status: 'recorded' | 'already-played' };

/** Pure reducer: applies one daily result to a mode's stats. Never mutates the input. */
export function applyResult(state: StatsState, input: ResultInput): ApplyOutcome {
  const prev = state.modes[input.mode];
  if (prev.lastPuzzle === input.puzzle) {
    // Already recorded today's puzzle for this mode — ignore (idempotent on reload/resubmit).
    return { state, status: 'already-played' };
  }
  const consecutive = prev.lastPuzzle !== null && input.puzzle - prev.lastPuzzle === 1;
  const streakBase = consecutive ? prev.currentStreak : 0;
  const currentStreak = input.won ? streakBase + 1 : 0;
  const next: ModeStats = {
    played: prev.played + 1,
    won: prev.won + (input.won ? 1 : 0),
    currentStreak,
    maxStreak: Math.max(prev.maxStreak, currentStreak),
    lastPuzzle: input.puzzle,
    distribution: { ...prev.distribution, [input.bucket]: (prev.distribution[input.bucket] ?? 0) + 1 },
  };
  // Overall (participation) streak: bump it once per day the first time *any* mode is completed that
  // day — a second or third mode finished on the same puzzle day doesn't count again, and win/lose
  // both keep it alive (only a *missed* day breaks it).
  let overall = state.overall;
  if (overall.lastPuzzle !== input.puzzle) {
    const overallConsecutive = overall.lastPuzzle !== null && input.puzzle - overall.lastPuzzle === 1;
    const overallStreakVal = (overallConsecutive ? overall.currentStreak : 0) + 1;
    overall = { currentStreak: overallStreakVal, maxStreak: Math.max(overall.maxStreak, overallStreakVal), lastPuzzle: input.puzzle };
  }
  return { state: { ...state, modes: { ...state.modes, [input.mode]: next }, overall }, status: 'recorded' };
}

/** True once a streak has effectively lapsed for `mode` as of `puzzle` (i.e. yesterday's puzzle was missed). */
export function isStreakAtRisk(state: StatsState, mode: Mode, puzzle: number): boolean {
  const m = state.modes[mode];
  return m.currentStreak > 0 && m.lastPuzzle !== null && m.lastPuzzle < puzzle - 1;
}

/**
 * The streak number to *show* right now, given today's puzzle number: a lapsed streak (yesterday's
 * puzzle was missed) reads as 0 immediately, rather than showing the stale `currentStreak` until the
 * player next plays and formally resets it (`currentStreak` itself is left untouched here — it's
 * only ever mutated by `applyResult` — this is purely a display-time projection of "is it still alive").
 */
export function displayedStreak(state: StatsState, mode: Mode, todayPuzzle: number): number {
  const m = state.modes[mode];
  if (isStreakAtRisk(state, mode, todayPuzzle)) return 0;
  return m.currentStreak;
}

/** Same lapse check as `isStreakAtRisk`, for the combined overall (participation) streak. */
export function isOverallStreakAtRisk(state: StatsState, todayPuzzle: number): boolean {
  const o = state.overall;
  return o.currentStreak > 0 && o.lastPuzzle !== null && o.lastPuzzle < todayPuzzle - 1;
}

/** Consecutive days with *any* mode completed (win or lose) — not a sum of the three per-mode win
 *  streaks. Two 3-day per-mode streaks read as "Overall 3" (both days coincide), not "Overall 6". */
export function overallStreak(state: StatsState, todayPuzzle: number): number {
  if (isOverallStreakAtRisk(state, todayPuzzle)) return 0;
  return state.overall.currentStreak;
}

// ---- localStorage I/O -------------------------------------------------------

const STORAGE_KEY = 'geostreak:stats:v1';

function hasStorage(): boolean {
  try {
    return typeof localStorage !== 'undefined';
  } catch {
    return false;
  }
}

export function loadStats(): StatsState {
  if (!hasStorage()) return emptyStats();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyStats();
    const parsed = JSON.parse(raw);
    return mergeWithDefaults(parsed);
  } catch {
    return emptyStats();
  }
}

export function saveStats(state: StatsState): void {
  if (!hasStorage()) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage full or blocked — ignore, nothing to persist to server */
  }
}

/** A finite, non-negative integer, or `fallback` for anything else (NaN, Infinity, negative, non-numeric). */
function nonNegInt(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
}

/** Fills in any missing fields from a partial/older shape so imports and schema drift don't crash the UI.
 *  Also clamps anything a hand-edited or malicious import could otherwise use to fabricate an
 *  impossible state (negative counts, a win rate over 100%, a streak bigger than games played, an
 *  unbounded `maxStreak`, or a truthy `hardMode` from the string `"false"`). */
function mergeWithDefaults(input: unknown): StatsState {
  const base = emptyStats();
  if (!input || typeof input !== 'object') return base;
  const obj = input as Partial<StatsState>;
  const modes = { ...base.modes };
  for (const m of MODES) {
    const incoming = (obj.modes as Record<string, Partial<ModeStats>> | undefined)?.[m];
    if (incoming) {
      const played = nonNegInt(incoming.played);
      const won = Math.min(nonNegInt(incoming.won), played);
      const currentStreak = Math.min(nonNegInt(incoming.currentStreak), played);
      const maxStreak = Math.min(Math.max(nonNegInt(incoming.maxStreak), currentStreak), played);
      const lastPuzzle = incoming.lastPuzzle == null ? null : nonNegInt(incoming.lastPuzzle, 0);
      const distribution: Record<string, number> = {};
      if (incoming.distribution && typeof incoming.distribution === 'object') {
        for (const [k, v] of Object.entries(incoming.distribution)) distribution[k] = nonNegInt(v);
      }
      modes[m] = { played, won, currentStreak, maxStreak, lastPuzzle, distribution };
    }
  }
  let overall = base.overall;
  const incomingOverall = obj.overall as Partial<OverallStats> | undefined;
  if (incomingOverall) {
    const currentStreak = nonNegInt(incomingOverall.currentStreak);
    const maxStreak = Math.max(nonNegInt(incomingOverall.maxStreak), currentStreak);
    const lastPuzzle = incomingOverall.lastPuzzle == null ? null : nonNegInt(incomingOverall.lastPuzzle, 0);
    overall = { currentStreak, maxStreak, lastPuzzle };
  }
  return {
    version: 1,
    hardMode: obj.hardMode === true,
    units: obj.units === 'mi' ? 'mi' : 'km',
    modes,
    overall,
  };
}

// ---- Export / import codec ---------------------------------------------------

const CODE_PREFIX = 'GS1:';

/** Compact, copy-pasteable code string encoding the full stats state (base64 JSON, versioned). */
export function exportCode(state: StatsState): string {
  const json = JSON.stringify(state);
  const b64 = typeof btoa === 'function' ? btoa(unescape(encodeURIComponent(json))) : Buffer.from(json, 'utf8').toString('base64');
  return CODE_PREFIX + b64;
}

/** Same data as pretty JSON, for the "download a file" option. */
export function exportJson(state: StatsState): string {
  return JSON.stringify(state, null, 2);
}

export class ImportError extends Error {}

export function importCode(code: string): StatsState {
  const trimmed = code.trim();
  if (!trimmed.startsWith(CODE_PREFIX)) throw new ImportError('Not a GeoStreak code: it should start with "GS1:".');
  const b64 = trimmed.slice(CODE_PREFIX.length);
  let json: string;
  try {
    json = typeof atob === 'function' ? decodeURIComponent(escape(atob(b64))) : Buffer.from(b64, 'base64').toString('utf8');
  } catch {
    throw new ImportError('That code is not valid base64.');
  }
  return importJson(json);
}

export function importJson(json: string): StatsState {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new ImportError('That file is not valid JSON.');
  }
  if (!parsed || typeof parsed !== 'object' || !('modes' in parsed)) {
    throw new ImportError('That file does not look like GeoStreak stats.');
  }
  return mergeWithDefaults(parsed);
}

/** Round-trip check used by the import UI: does this code parse without throwing? */
export function isValidCode(code: string): boolean {
  try {
    importCode(code);
    return true;
  } catch {
    return false;
  }
}
