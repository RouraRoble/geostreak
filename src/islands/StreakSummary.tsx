/** Small hub-page widget: today's combined streak + a button to open the full stats modal. */
import { useEffect, useState } from 'preact/hooks';
import { loadStats, MODES, displayedStreak, overallStreak, type StatsState } from '../lib/stats';
import { puzzleNumber, utcDateString } from '../lib/geo';
import { site } from '../site.config';

const LABEL: Record<string, string> = { outline: 'Outline', capitals: 'Capitals', bigger: 'Bigger' };

export default function StreakSummary() {
  const [stats, setStats] = useState<StatsState | null>(null);
  useEffect(() => setStats(loadStats()), []);
  if (!stats) return <p class="muted small">Loading your streaks…</p>;

  const todayPuzzle = puzzleNumber(utcDateString(), site.epoch);
  const total = overallStreak(stats, todayPuzzle);
  const anyPlayed = MODES.some((m) => stats.modes[m].played > 0);

  return (
    <div class="field-row" style="flex-wrap:wrap">
      {anyPlayed ? (
        <>
          {total > 0 && (
            <span class="streak-chip">
              <span class="streak-chip__flame" aria-hidden="true">🔥</span> Overall {total}
            </span>
          )}
          {MODES.map((m) => (
            <span class="streak-chip" key={m}>
              <span class="streak-chip__flame" aria-hidden="true">🔥</span> {LABEL[m]} {displayedStreak(stats, m, todayPuzzle)}
            </span>
          ))}
        </>
      ) : (
        <span class="muted small">Play a puzzle today to start your streak.</span>
      )}
      {anyPlayed && (
        <button type="button" class="btn btn--secondary" onClick={() => window.dispatchEvent(new CustomEvent('geostreak:open-stats', { detail: { mode: 'outline' } }))}>
          View stats
        </button>
      )}
    </div>
  );
}
