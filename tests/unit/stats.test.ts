import { describe, expect, it } from 'vitest';
import { applyResult, emptyStats, exportCode, exportJson, importCode, importJson, isValidCode, isStreakAtRisk, displayedStreak, overallStreak, type StatsState } from '../../src/lib/stats';
import type { Mode } from '../../src/lib/stats';

describe('applyResult streak rules', () => {
  it('starts a streak at 1 on the first win', () => {
    const s0 = emptyStats();
    const { state, status } = applyResult(s0, { mode: 'outline', puzzle: 10, won: true, bucket: '3' });
    expect(status).toBe('recorded');
    expect(state.modes.outline.currentStreak).toBe(1);
    expect(state.modes.outline.maxStreak).toBe(1);
    expect(state.modes.outline.played).toBe(1);
    expect(state.modes.outline.won).toBe(1);
  });
  it('extends the streak on consecutive-day wins', () => {
    let s = emptyStats();
    s = applyResult(s, { mode: 'outline', puzzle: 10, won: true, bucket: '2' }).state;
    s = applyResult(s, { mode: 'outline', puzzle: 11, won: true, bucket: '4' }).state;
    s = applyResult(s, { mode: 'outline', puzzle: 12, won: true, bucket: '1' }).state;
    expect(s.modes.outline.currentStreak).toBe(3);
    expect(s.modes.outline.maxStreak).toBe(3);
  });
  it('resets the streak to 0 on a loss', () => {
    let s = emptyStats();
    s = applyResult(s, { mode: 'outline', puzzle: 10, won: true, bucket: '2' }).state;
    s = applyResult(s, { mode: 'outline', puzzle: 11, won: false, bucket: 'x' }).state;
    expect(s.modes.outline.currentStreak).toBe(0);
    expect(s.modes.outline.maxStreak).toBe(1);
    expect(s.modes.outline.played).toBe(2);
  });
  it('resets the streak to 0 (then 1 on a subsequent win) when a day is missed', () => {
    let s = emptyStats();
    s = applyResult(s, { mode: 'outline', puzzle: 10, won: true, bucket: '2' }).state;
    // Puzzle 11 skipped entirely.
    s = applyResult(s, { mode: 'outline', puzzle: 12, won: true, bucket: '3' }).state;
    expect(s.modes.outline.currentStreak).toBe(1);
    expect(s.modes.outline.maxStreak).toBe(1);
  });
  it('is idempotent: replaying the same puzzle number does not double-count', () => {
    let s = emptyStats();
    s = applyResult(s, { mode: 'outline', puzzle: 10, won: true, bucket: '2' }).state;
    const second = applyResult(s, { mode: 'outline', puzzle: 10, won: true, bucket: '5' });
    expect(second.status).toBe('already-played');
    expect(second.state.modes.outline.played).toBe(1);
    expect(second.state.modes.outline.distribution).toEqual({ '2': 1 });
  });
  it('tracks distribution buckets independently per mode', () => {
    let s = emptyStats();
    s = applyResult(s, { mode: 'outline', puzzle: 1, won: true, bucket: '3' }).state;
    s = applyResult(s, { mode: 'capitals', puzzle: 1, won: true, bucket: '9' }).state;
    expect(s.modes.outline.distribution).toEqual({ '3': 1 });
    expect(s.modes.capitals.distribution).toEqual({ '9': 1 });
    expect(s.modes.bigger.played).toBe(0);
  });
  it('does not mutate the input state', () => {
    const s0 = emptyStats();
    const frozen = JSON.stringify(s0);
    applyResult(s0, { mode: 'outline', puzzle: 1, won: true, bucket: '1' });
    expect(JSON.stringify(s0)).toBe(frozen);
  });
});

describe('isStreakAtRisk', () => {
  it('is true once a day has been missed after a positive streak', () => {
    let s = emptyStats();
    s = applyResult(s, { mode: 'outline', puzzle: 10, won: true, bucket: '2' }).state;
    expect(isStreakAtRisk(s, 'outline', 12)).toBe(true);
    expect(isStreakAtRisk(s, 'outline', 11)).toBe(false);
  });
});

describe('export/import round trip', () => {
  it('exportCode -> importCode reproduces the same state', () => {
    let s = emptyStats();
    s = applyResult(s, { mode: 'outline', puzzle: 4, won: true, bucket: '2' }).state;
    s = applyResult(s, { mode: 'bigger', puzzle: 4, won: false, bucket: '6' }).state;
    s = { ...s, hardMode: true, units: 'mi' };
    const code = exportCode(s);
    expect(code.startsWith('GS1:')).toBe(true);
    const back = importCode(code);
    expect(back).toEqual(s);
  });
  it('exportJson -> importJson reproduces the same state', () => {
    let s = emptyStats();
    s = applyResult(s, { mode: 'capitals', puzzle: 9, won: true, bucket: '10' }).state;
    const json = exportJson(s);
    const back = importJson(json);
    expect(back).toEqual(s);
  });
  it('rejects a malformed code', () => {
    expect(() => importCode('not-a-code')).toThrow();
    expect(isValidCode('not-a-code')).toBe(false);
    expect(isValidCode(exportCode(emptyStats()))).toBe(true);
  });
  it('rejects JSON that is not a stats object', () => {
    expect(() => importJson('{"foo":1}')).toThrow();
    expect(() => importJson('not json')).toThrow();
  });
  it('fills in defaults for a partial/older shape instead of throwing', () => {
    const partial: unknown = { modes: { outline: { played: 3, won: 2 } } };
    const back = importJson(JSON.stringify(partial));
    expect(back.modes.outline.played).toBe(3);
    expect(back.modes.outline.won).toBe(2);
    expect(back.modes.outline.currentStreak).toBe(0);
    expect(back.modes.capitals).toEqual(emptyStats().modes.capitals);
    expect(back.units).toBe('km');
  });

  describe('displayedStreak / overallStreak (audit: "stale streaks after missed days")', () => {
  it('keeps showing the streak the day right after playing (today == lastPuzzle) and the day after that (lastPuzzle == today - 1)', () => {
    let s = emptyStats();
    s = applyResult(s, { mode: 'outline', puzzle: 10, won: true, bucket: '2' }).state;
    expect(displayedStreak(s, 'outline', 10)).toBe(1);
    expect(displayedStreak(s, 'outline', 11)).toBe(1);
  });
  it('shows 0 once a day has been missed, even though currentStreak itself is untouched until the next play', () => {
    let s = emptyStats();
    s = applyResult(s, { mode: 'outline', puzzle: 10, won: true, bucket: '2' }).state;
    expect(s.modes.outline.currentStreak).toBe(1); // the raw counter still says 1...
    expect(displayedStreak(s, 'outline', 12)).toBe(0); // ...but puzzle 11 was missed, so it reads 0
  });
  // Regression coverage for the audit-2 finding: "Overall" was the *sum* of the three per-mode
  // streaks, so three 5-day win streaks read as "Overall 15" (which looks like 15 days played, not
  // 5). It should instead count consecutive *days* with any mode completed.
  it('overallStreak counts consecutive days with any mode completed, not a sum of per-mode streaks', () => {
    let s = emptyStats();
    // Same day (puzzle 10): playing two modes doesn't double-count the day.
    s = applyResult(s, { mode: 'outline', puzzle: 10, won: true, bucket: '2' }).state;
    s = applyResult(s, { mode: 'capitals', puzzle: 10, won: true, bucket: '7' }).state;
    expect(overallStreak(s, 10)).toBe(1);
    expect(overallStreak(s, 12)).toBe(0); // lapsed (puzzle 11 was missed by every mode)
  });
  it('overallStreak stays alive across a loss (participation, not a win streak) and advances once per day', () => {
    let s = emptyStats();
    s = applyResult(s, { mode: 'outline', puzzle: 1, won: true, bucket: '2' }).state;
    s = applyResult(s, { mode: 'capitals', puzzle: 2, won: false, bucket: '3' }).state; // a loss still counts as "played"
    s = applyResult(s, { mode: 'bigger', puzzle: 3, won: true, bucket: '8' }).state;
    expect(overallStreak(s, 3)).toBe(3);
  });
  it('does not read "Overall 15" for three independent 5-day per-mode streaks played on the same 5 days', () => {
    let s = emptyStats();
    const modes: Mode[] = ['outline', 'capitals', 'bigger'];
    for (let puzzle = 1; puzzle <= 5; puzzle++) {
      for (const mode of modes) {
        s = applyResult(s, { mode, puzzle, won: true, bucket: '1' }).state;
      }
    }
    for (const mode of modes) expect(s.modes[mode].currentStreak).toBe(5);
    expect(overallStreak(s, 5)).toBe(5); // not 15
  });
});

// Regression tests for audit finding: "Import overwrites every stat without confirmation or
  // validation" — a hand-edited or malicious payload must not be able to fabricate an impossible
  // state (negative counts, an out-of-range win rate/streak, or a stringy "false" enabling hard mode).
  it('clamps an impossible imported state (won > played, maxStreak absurdly large, negative streak)', () => {
    const malicious = { modes: { outline: { played: 0, won: 99, currentStreak: -5, maxStreak: 1e308 } } };
    const back = importJson(JSON.stringify(malicious));
    expect(back.modes.outline.played).toBe(0);
    expect(back.modes.outline.won).toBe(0); // can't exceed played
    expect(back.modes.outline.currentStreak).toBe(0); // can't exceed played, and negative is invalid
    expect(back.modes.outline.maxStreak).toBe(0); // can't exceed played
  });
  it('does not enable hard mode from a stringly "false" value (only a real boolean true counts)', () => {
    const back = importJson(JSON.stringify({ modes: {}, hardMode: 'false' }));
    expect(back.hardMode).toBe(false);
  });
  it('clamps negative distribution counts to zero', () => {
    const back = importJson(JSON.stringify({ modes: { outline: { played: 1, won: 1, distribution: { '3': -4 } } } }));
    expect(back.modes.outline.distribution['3']).toBe(0);
  });
});
