/**
 * Resolves "today's" (or a practice) puzzle for a mode from the current URL, browser-side only.
 * Call this from a `useEffect` after mount — never during server rendering — so the server-rendered
 * HTML and the first client render match (both show a neutral loading state), and so "today" always
 * reflects the visitor's actual clock rather than the last time the static site was built.
 */
import { site } from '../site.config';
import { pickDaily, pickBySeed, puzzleNumber, utcDateString, isValidDateString } from './geo';

/** A `?date=` is only honoured when it's a real calendar date that isn't later than today — a
 *  malformed date (e.g. "2026-13-45") or a future date both fall back to today's daily puzzle,
 *  rather than rendering a blank round or leaking tomorrow's (or a nonsense) answer early. */
function usableDateParam(dateParam: string | null, today: string): string | null {
  if (!dateParam || !isValidDateString(dateParam) || dateParam > today) return null;
  return dateParam;
}

export interface ResolvedPuzzle<T> {
  item: T;
  /** 1-based puzzle number for the resolved date; 0 for a seed-only practice challenge. */
  puzzle: number;
  /** True for anything that should NOT count towards the streak (archive replays, ?seed= challenges). */
  practice: boolean;
  date: string;
}

export function resolvePuzzleFromLocation<T>(pool: readonly T[], mode: string): ResolvedPuzzle<T> {
  const params = new URLSearchParams(location.search);
  const seedParam = params.get('seed');
  const dateParam = params.get('date');
  const today = utcDateString();

  if (seedParam && /^\d+$/.test(seedParam)) {
    const item = pickBySeed(pool, Number(seedParam));
    return { item, puzzle: 0, practice: true, date: today };
  }
  const usableDate = usableDateParam(dateParam, today);
  if (usableDate) {
    const { item, puzzle } = pickDaily(pool, mode, usableDate, site.epoch);
    return { item, puzzle, practice: usableDate !== today, date: usableDate };
  }
  const { item, puzzle } = pickDaily(pool, mode, today, site.epoch);
  return { item, puzzle, practice: false, date: today };
}

export interface RoundKey {
  /** Unique deterministic string to derive every round's seed from. */
  key: string;
  puzzle: number;
  practice: boolean;
  date: string;
}

/** Same URL contract as `resolvePuzzleFromLocation`, but for modes built from a *set* of rounds
 *  (Capitals, Bigger) rather than a single target — returns a seed key instead of a pool item. */
export function resolveRoundKeyFromLocation(mode: string): RoundKey {
  const params = new URLSearchParams(location.search);
  const seedParam = params.get('seed');
  const dateParam = params.get('date');
  const today = utcDateString();

  if (seedParam && /^\d+$/.test(seedParam)) {
    return { key: `${mode}:seed:${seedParam}`, puzzle: 0, practice: true, date: today };
  }
  const usableDate = usableDateParam(dateParam, today);
  if (usableDate) {
    return { key: `${mode}:${usableDate}`, puzzle: puzzleNumber(usableDate, site.epoch), practice: usableDate !== today, date: usableDate };
  }
  return { key: `${mode}:${today}`, puzzle: puzzleNumber(today, site.epoch), practice: false, date: today };
}
