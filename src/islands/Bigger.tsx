/**
 * Mode 3 — Bigger or smaller: two countries, pick the one with the larger population or area.
 * 10 rounds, deterministic from the puzzle date/seed; tracks a within-round combo streak.
 */
import { useEffect, useRef, useState } from 'preact/hooks';
import { COMPARE_POOL, POP_COMPARE_POOL, type Country } from '../lib/countries';
import { hashString, mulberry32, seededShuffle, msUntilNextUtcMidnight, formatCountdown, puzzleNumber, utcDateString } from '../lib/geo';
import { resolveRoundKeyFromLocation } from '../lib/puzzle';
import { loadStats, saveStats, applyResult, displayedStreak, type StatsState } from '../lib/stats';
import { loadProgress, saveProgress } from '../lib/progress';
import { sanitizeResults, deriveScore, deriveCombo } from '../lib/roundState';
import { shareOrCopy } from '../lib/share';
import { withBase, absoluteUrl } from '../lib/url';
import { site } from '../site.config';

const ROUNDS = 10;
type Metric = 'population' | 'areaKm2';

interface Round {
  a: Country;
  b: Country;
  metric: Metric;
}

function buildRounds(key: string): Round[] {
  const rand = mulberry32(hashString('geostreak:bigger:' + key));
  const rounds: Round[] = [];
  for (let i = 0; i < ROUNDS; i++) {
    const metric: Metric = rand() < 0.5 ? 'population' : 'areaKm2';
    // Population comparisons only pair countries with a recent (same-era) population figure, so a
    // stale vs. fresh snapshot never makes "which is bigger" wrong (see POP_COMPARE_POOL).
    const pool = metric === 'population' ? POP_COMPARE_POOL : COMPARE_POOL;
    const pair = seededShuffle(pool, Math.floor(rand() * 2 ** 31)).slice(0, 2);
    rounds.push({ a: pair[0], b: pair[1], metric });
  }
  return rounds;
}

function fmtValue(c: Country, metric: Metric): string {
  const v = metric === 'population' ? c.population : c.areaKm2;
  if (!v) return '—';
  const unit = metric === 'population' ? '' : ' km²';
  return v.toLocaleString() + unit;
}

export default function Bigger() {
  const [ready, setReady] = useState(false);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [puzzle, setPuzzle] = useState(0);
  const [practice, setPractice] = useState(false);
  const [date, setDate] = useState('');
  const [practiceSeedParam, setPracticeSeedParam] = useState<string | null>(null);
  // `results` is the single source of truth for round progress; step/score/combo are always derived
  // from it (never stored/restored separately — see roundState.ts for why).
  const [results, setResults] = useState<boolean[]>([]);
  // Ephemeral (never persisted) reveal state: which round is currently showing its answered colours,
  // and which side was picked. A reload always lands between rounds, never mid-reveal.
  const [revealIndex, setRevealIndex] = useState<number | null>(null);
  const [picked, setPicked] = useState<'a' | 'b' | null>(null);
  const [stats, setStats] = useState<StatsState | null>(null);
  const [shareMsg, setShareMsg] = useState('');
  const [countdown, setCountdown] = useState('');
  // True if, on mount, storage already had a finished round for today — so the auto-open-stats effect
  // (below) doesn't re-fire every time a finished daily puzzle is reloaded.
  const restoredFinishedRef = useRef(false);

  useEffect(() => {
    const rk = resolveRoundKeyFromLocation('bigger');
    setRounds(buildRounds(rk.key));
    setPuzzle(rk.puzzle);
    setPractice(rk.practice);
    setDate(rk.date);
    setPracticeSeedParam(new URLSearchParams(location.search).get('seed'));
    setStats(loadStats());
    if (!rk.practice) {
      const saved = loadProgress<{ results: boolean[] }>('bigger', rk.date);
      if (saved) {
        const restored = sanitizeResults(saved.results, ROUNDS);
        setResults(restored);
        if (restored.length >= ROUNDS) restoredFinishedRef.current = true;
      }
    }
    setReady(true);
  }, []);

  // Persist round-by-round progress for today's puzzle so a reload can restore it. Only `results` is
  // saved — it's written synchronously in `choose()`, before the reveal's setTimeout, so a reload at
  // any point (including mid-reveal) restores exactly the rounds that were actually committed.
  useEffect(() => {
    if (!ready || practice || !date) return;
    saveProgress('bigger', date, { results });
  }, [results, ready, practice, date]);

  const step = revealIndex ?? results.length;
  const score = deriveScore(results);
  const { combo, bestCombo } = deriveCombo(results);
  const finished = results.length >= ROUNDS && revealIndex === null;
  const recordedRef = useRef(false);
  useEffect(() => {
    if (!finished || practice || !stats || recordedRef.current) return;
    recordedRef.current = true;
    const { state } = applyResult(stats, { mode: 'bigger', puzzle, won: score >= ROUNDS / 2, bucket: String(score) });
    setStats(state);
    saveStats(state);
  }, [finished, practice, stats, score, puzzle]);

  // Auto-open the stats modal shortly after a round ends, per the spec ("Win/lose -> stats modal") —
  // but only the first time this round view actually finishes, not every time a page that was already
  // finished on load gets reloaded (see restoredFinishedRef above).
  useEffect(() => {
    if (!finished || practice) return;
    if (restoredFinishedRef.current) {
      restoredFinishedRef.current = false;
      return;
    }
    const id = setTimeout(() => {
      window.dispatchEvent(new CustomEvent('geostreak:open-stats', { detail: { mode: 'bigger' } }));
    }, 800);
    return () => clearTimeout(id);
  }, [finished]);

  useEffect(() => {
    if (!finished || practice) return;
    const tick = () => setCountdown(formatCountdown(msUntilNextUtcMidnight()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [finished, practice]);

  const current = rounds[step];

  function choose(side: 'a' | 'b') {
    if (picked || !current) return;
    const idx = results.length; // the round being answered right now
    setPicked(side);
    setRevealIndex(idx);
    const chosen = side === 'a' ? current.a : current.b;
    const other = side === 'a' ? current.b : current.a;
    const chosenVal = (current.metric === 'population' ? chosen.population : chosen.areaKm2) ?? 0;
    const otherVal = (current.metric === 'population' ? other.population : other.areaKm2) ?? 0;
    const correct = chosenVal > otherVal;
    // Committed immediately (and persisted by the effect above right after) — a reload at any point,
    // including during the reveal below, restores exactly this and nothing more, so the round can
    // never be answered twice.
    setResults((r) => [...r, correct]);
    setTimeout(() => {
      setPicked(null);
      setRevealIndex(null);
    }, 2000); // long enough to actually read both values before the next round replaces them
  }

  // A practice round's share link carries its own ?seed= so it's reproducible (see Outline.tsx).
  const shareUrl = practice && practiceSeedParam ? `${absoluteUrl(withBase('/bigger/'))}?seed=${practiceSeedParam}` : absoluteUrl(withBase('/bigger/'));
  function shareText(): string {
    const n = practice ? '(practice)' : `#${puzzle}`;
    const squares = results.map((ok) => (ok ? '🟩' : '🟥')).join('');
    return `GeoStreak Bigger ${n} ${score}/${ROUNDS} · best combo ${bestCombo}\n${squares}`;
  }
  async function onShare() {
    const res = await shareOrCopy('GeoStreak', shareText(), shareUrl);
    setShareMsg(res === 'shared' ? 'Shared!' : res === 'copied' ? 'Copied to clipboard' : shareText());
    setTimeout(() => setShareMsg(''), 4000);
  }
  // A daily round's "Challenge a friend" link carries `?date=` (not a fresh random seed) so a friend
  // who opens it plays *this exact* puzzle, not a different one — "beat my score" only means anything
  // if it's the same countries (audit-2 finding: the old random-seed link sent friends elsewhere).
  function challengeLink(): string {
    return `${absoluteUrl(withBase('/bigger/'))}?date=${date}`;
  }

  if (!ready) {
    return (
      <div class="puzzle-card atlas-bg" aria-busy="true">
        <div class="skeleton" style="height:220px;border-radius:16px" />
      </div>
    );
  }

  const metricLabel = current?.metric === 'population' ? 'population' : 'area';

  function renderCard(side: 'a' | 'b') {
    if (!current) return null;
    const c = side === 'a' ? current.a : current.b;
    const other = side === 'a' ? current.b : current.a;
    const isPicked = picked === side;
    const chosenVal = (current.metric === 'population' ? c.population : c.areaKm2) ?? 0;
    const otherVal = (current.metric === 'population' ? other.population : other.areaKm2) ?? 0;
    const isBigger = chosenVal > otherVal;
    const cls = picked ? (isBigger ? ' compare-card--correct' : isPicked ? ' compare-card--wrong' : '') : '';
    return (
      <button key={c.iso2} type="button" class={`compare-card${cls}`} disabled={!!picked} onClick={() => choose(side)}>
        <span class="compare-card__flag" aria-hidden="true">
          {c.flagEmoji}
        </span>
        <strong>{c.name}</strong>
        <span class="small muted">{c.continent}</span>
        {picked && <span class="compare-card__value">{fmtValue(c, current.metric)}</span>}
      </button>
    );
  }

  return (
    <div class="puzzle-card atlas-bg">
      <div class="puzzle-head">
        <div class="puzzle-head__meta">
          <span class="streak-chip">
            <span class="streak-chip__flame" aria-hidden="true">🔥</span> {stats ? displayedStreak(stats, 'bigger', puzzleNumber(utcDateString(), site.epoch)) : 0} day streak
          </span>
          <span>{practice ? 'Practice round' : `Puzzle #${puzzle}`}</span>
        </div>
        <button type="button" class="btn btn--secondary" data-stats-trigger onClick={() => window.dispatchEvent(new CustomEvent('geostreak:open-stats', { detail: { mode: 'bigger' } }))}>
          Stats
        </button>
      </div>

      {!finished && current && (
        <div>
          <p class="eyebrow">
            Round {step + 1} of {ROUNDS} · Score {score} · Combo {combo}
          </p>
          <h2 style="margin-top:0">Which country has the bigger {metricLabel}?</h2>
          <div class="compare-row" role="group" aria-label="Choose the bigger country">
            {renderCard('a')}
            <span class="compare-row__vs" aria-hidden="true">
              vs
            </span>
            {renderCard('b')}
          </div>
        </div>
      )}

      {finished && (
        <div class="result-panel">
          <p class="status-msg" role="status">
            You scored {score}/{ROUNDS} · best combo {bestCombo}.
          </p>
          <div class="field-row">
            <button type="button" class="btn" onClick={onShare}>
              Share result
            </button>
            {!practice && (
              <a class="btn btn--secondary" href={challengeLink()}>
                Challenge a friend (same puzzle)
              </a>
            )}
          </div>
          {shareMsg && (
            <pre class="small" style="white-space:pre-wrap;margin-top:var(--space-2)">
              {shareMsg}
            </pre>
          )}
          {!practice && (
            <p class="small muted" style="margin-top:var(--space-4)">
              Next puzzle in <span class="countdown">{countdown}</span>
            </p>
          )}
          {practice && (
            <p class="small muted" style="margin-top:var(--space-4)">
              Practice round — it doesn't count towards your streak. <a href={withBase('/bigger/')}>Play today's puzzle →</a>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
