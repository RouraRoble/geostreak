/**
 * Per-day, per-mode game progress, persisted to localStorage so a reload mid-round doesn't wipe
 * guesses (and can't be used to get fresh guesses/rounds for free), and a finished daily puzzle
 * comes back finished — read-only — instead of re-playable. Practice rounds (?seed=, or a ?date=
 * that isn't today) are intentionally never persisted here: they don't count towards streaks, so
 * replaying one is fine, and callers should not call save/load for a practice round.
 */
import type { Mode } from './stats';

function storageKey(mode: Mode, date: string): string {
  return `geostreak:progress:${mode}:${date}`;
}

function hasStorage(): boolean {
  try {
    return typeof localStorage !== 'undefined';
  } catch {
    return false;
  }
}

/** Returns the saved progress for `mode` on `date`, or null if there is none / it can't be read. */
export function loadProgress<T>(mode: Mode, date: string): T | null {
  if (!hasStorage()) return null;
  try {
    const raw = localStorage.getItem(storageKey(mode, date));
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function saveProgress<T>(mode: Mode, date: string, data: T): void {
  if (!hasStorage()) return;
  try {
    localStorage.setItem(storageKey(mode, date), JSON.stringify(data));
  } catch {
    /* storage full or blocked — ignore, nothing to persist to server */
  }
}
