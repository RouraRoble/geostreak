import { describe, expect, it } from 'vitest';
import { sanitizeResults, deriveStep, deriveScore, deriveCombo } from '../../src/lib/roundState';

// Regression coverage for the audit-2 P1 finding: "a reload during the answer reveal lets you answer
// the same round again". The fix makes `results` the only persisted value and derives step/score/combo
// from it — these tests pin exactly the derivations the Bigger/Capitals islands now rely on.
describe('roundState derivations', () => {
  it('deriveStep is just how many rounds have a recorded result', () => {
    expect(deriveStep([])).toBe(0);
    expect(deriveStep([true, false, true])).toBe(3);
  });

  it('deriveScore counts only the true entries', () => {
    expect(deriveScore([true, false, true, true])).toBe(3);
    expect(deriveScore([])).toBe(0);
    expect(deriveScore([false, false])).toBe(0);
  });

  it('deriveCombo tracks the trailing streak and the best streak ever reached', () => {
    expect(deriveCombo([])).toEqual({ combo: 0, bestCombo: 0 });
    expect(deriveCombo([true, true, true])).toEqual({ combo: 3, bestCombo: 3 });
    expect(deriveCombo([true, true, false, true])).toEqual({ combo: 1, bestCombo: 2 });
    expect(deriveCombo([false, true, true, false])).toEqual({ combo: 0, bestCombo: 2 });
  });

  describe('sanitizeResults (restoring a persisted round)', () => {
    it('passes through a valid boolean array unchanged', () => {
      expect(sanitizeResults([true, false, true], 10)).toEqual([true, false, true]);
    });
    it('drops anything that is not an array', () => {
      expect(sanitizeResults(undefined, 10)).toEqual([]);
      expect(sanitizeResults(null, 10)).toEqual([]);
      expect(sanitizeResults('nope', 10)).toEqual([]);
      expect(sanitizeResults({ step: 3 }, 10)).toEqual([]);
    });
    it('filters out non-boolean entries rather than trusting them', () => {
      expect(sanitizeResults([true, 'true', 1, null, false], 10)).toEqual([true, false]);
    });
    it('caps the restored array at `rounds` entries — this is the core of the P1 fix: even a', () => {
      // tampered or corrupted save with more than ROUNDS entries (e.g. the audit's 20-entry
      // `results` from the old desync bug) can never restore into a re-answerable or over-long round.
      expect(sanitizeResults(Array(20).fill(true), 10)).toHaveLength(10);
    });
  });
});
