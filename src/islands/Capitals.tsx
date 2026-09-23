/**
 * Mode 2 — Capital ladder: 10 rounds, given a capital pick the country (or reverse), 4 options each.
 * The 10 rounds and their options are derived deterministically from the puzzle date/seed, so a
 * "beat my score" link reproduces the exact same round set.
 */
import { useEffect, useRef, useState } from 'preact/hooks';
import { CAPITALS_POOL, type Country } from '../lib/countries';
import { hashString, mulberry32, seededShuffle, msUntilNextUtcMidnight, formatCountdown, puzzleNumber, utcDateString } from '../lib/geo';
import { resolveRoundKeyFromLocation } from '../lib/puzzle';
import { loadStats, saveStats, applyResult, displayedStreak, type StatsState } from '../lib/stats';
import { loadProgress, saveProgress } from '../lib/progress';
import { sanitizeResults, deriveScore } from '../lib/roundState';
import { shareOrCopy } from '../lib/share';
import { withBase, absoluteUrl } from '../lib/url';
import { site } from '../site.config';

const ROUNDS = 10;
const OPTIONS = 4;

interface Round {
  target: Country;
  options: Country[];
  /** false: "Which country has capital X?" · true: "What is the capital of X?" */
  reverse: boolean;
}

function buildRounds(key: string): Round[] {
  const order = seededShuffle(CAPITALS_POOL, hashString('geostreak:capitals-targets:' + key));
  const targets = order.slice(0, ROUNDS);
  return targets.map((target, i) => {
    const rand = mulberry32(hashString('geostreak:capitals-round:' + key + ':' + i));
    const others = CAPITALS_POOL.filter((c) => c.iso2 !== target.iso2);
    const distractors = seededShuffle(others, Math.floor(rand() * 2 ** 31)).slice(0, OPTIONS - 1);
    const options = seededShuffle([target, ...distractors], Math.floor(rand() * 2 ** 31));
    return { target, options, reverse: rand() < 0.5 };
  });
}

export default function Capitals() {
  const [ready, setReady] = useState(false);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [puzzle, setPuzzle] = useState(0);
  const [practice, setPractice] = useState(false);
  const [date, setDate] = useState('');
  const [practiceSeedParam, setPracticeSeedParam] = useState<string | null>(null);
  // `results` is the single source of truth for round progress; step/score are always derived from it
  // (never stored/restored separately — see roundState.ts for why: this is what fixes the audit-2 P1
  // reload-during-reveal regression).
  const [results, setResults] = useState<boolean[]>([]);
  // Ephemeral (never persisted) reveal state: which round is currently showing its answered colours.
  // A reload always lands between rounds, never mid-reveal.
  const [revealIndex, setRevealIndex] = useState<number | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [stats, setStats] = useState<StatsState | null>(null);
  const [shareMsg, setShareMsg] = useState('');
  const [countdown, setCountdown] = useState('');
  // True if, on mount, storage already had a finished round for today — so the auto-open-stats effect
  // (below) doesn't re-fire every time a finished daily puzzle is reloaded.
  const restoredFinishedRef = useRef(false);

  useEffect(() => {
    const rk = resolveRoundKeyFromLocation('capitals');
    setRounds(buildRounds(rk.key));
    setPuzzle(rk.puzzle);
    setPractice(rk.practice);
    setDate(rk.date);
    setPracticeSeedParam(new URLSearchParams(location.search).get('seed'));
    setStats(loadStats());
    if (!rk.practice) {
      const saved = loadProgress<{ results: boolean[] }>('capitals', rk.date);
      if (saved) {
        const restored = sanitizeResults(saved.results, ROUNDS);
        setResults(restored);
        if (restored.length >= ROUNDS) restoredFinishedRef.current = true;
      }
    }
    setReady(true);
  }, []);

  // Persist round-by-round progress for today's puzzle so a reload can restore it. Only `results` is
  // saved — written synchronously in `choose()`, before the reveal's setTimeout, so a reload at any
  // point (including mid-reveal) restores exactly the rounds that were actually committed.
  useEffect(() => {
    if (!ready || practice || !date) return;
    saveProgress('capitals', date, { results });
  }, [results, ready, practice, date]);

  const step = revealIndex ?? results.length;
  const score = deriveScore(results);
  const finished = results.length >= ROUNDS && revealIndex === null;
  const recordedRef = useRef(false);
  useEffect(() => {
    if (!finished || practice || !stats || recordedRef.current) return;
    recordedRef.current = true;
    const { state } = applyResult(stats, { mode: 'capitals', puzzle, won: score >= ROUNDS / 2, bucket: String(score) });
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
      window.dispatchEvent(new CustomEvent('geostreak:open-stats', { detail: { mode: 'capitals' } }));
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

  function choose(c: Country) {
    if (picked) return;
    setPicked(c.iso2);
    setRevealIndex(results.length);
    const correct = c.iso2 === current.target.iso2;
    // Committed immediately — a reload at any point, including during the reveal below, restores
    // exactly this and nothing more, so the round can never be answered twice.
    setResults((r) => [...r, correct]);
    setTimeout(() => {
      setPicked(null);
      setRevealIndex(null);
    }, 850);
  }

  // A practice round's share link carries its own ?seed= so it's reproducible (see Outline.tsx).
  const shareUrl = practice && practiceSeedParam ? `${absoluteUrl(withBase('/capitals/'))}?seed=${practiceSeedParam}` : absoluteUrl(withBase('/capitals/'));
  function shareText(): string {
    const n = practice ? '(practice)' : `#${puzzle}`;
    // One emoji per round, correct or not — built from `results` (an array, not a sliced string) so
    // this is never wrong about which rounds were missed, and never truncated by UTF-16 code units.
    const squares = results.map((ok) => (ok ? '🟩' : '🟥')).join('');
    return `GeoStreak Capitals ${n} ${score}/${ROUNDS}\n${squares}`;
  }
  async function onShare() {
    const res = await shareOrCopy('GeoStreak', shareText(), shareUrl);
    setShareMsg(res === 'shared' ? 'Shared!' : res === 'copied' ? 'Copied to clipboard' : shareText());
    setTimeout(() => setShareMsg(''), 4000);
  }
  // A daily round's "Challenge a friend" link carries `?date=` (not a fresh random seed) so a friend
  // who opens it plays *this exact* puzzle, not a different one — "beat my score" only means anything
  // if it's the same 10 rounds (audit-2 finding: the old random-seed link sent friends elsewhere).
  function challengeLink(): string {
    return `${absoluteUrl(withBase('/capitals/'))}?date=${date}`;
  }

  if (!ready) {
    return (
      <div class="puzzle-card atlas-bg" aria-busy="true">
        <div class="skeleton" style="height:220px;border-radius:16px" />
      </div>
    );
  }

  return (
    <div class="puzzle-card atlas-bg">
      <div class="puzzle-head">
        <div class="puzzle-head__meta">
          <span class="streak-chip">
            <span class="streak-chip__flame" aria-hidden="true">🔥</span> {stats ? displayedStreak(stats, 'capitals', puzzleNumber(utcDateString(), site.epoch)) : 0} day streak
          </span>
          <span>{practice ? 'Practice round' : `Puzzle #${puzzle}`}</span>
        </div>
        <button type="button" class="btn btn--secondary" data-stats-trigger onClick={() => window.dispatchEvent(new CustomEvent('geostreak:open-stats', { detail: { mode: 'capitals' } }))}>
          Stats
        </button>
      </div>

      {!finished && current && (
        <div>
          <p class="eyebrow">
            Round {step + 1} of {ROUNDS} · Score {score}
          </p>
          <h2 style="margin-top:0">
            {current.reverse ? (
              <>What is the capital of {current.target.flagEmoji} {current.target.name}?</>
            ) : (
              <>Which country has {current.target.capital} as its capital?</>
            )}
          </h2>
          <div class="choice-grid" role="group" aria-label="Answer options">
            {current.options.map((c) => {
              const isPicked = picked === c.iso2;
              const isTarget = c.iso2 === current.target.iso2;
              const cls = picked ? (isTarget ? ' choice-btn--correct' : isPicked ? ' choice-btn--wrong' : '') : '';
              return (
                <button key={c.iso2} type="button" class={`choice-btn${cls}`} disabled={!!picked} onClick={() => choose(c)}>
                  {current.reverse ? (
                    <>{c.capital}</>
                  ) : (
                    <>
                      {c.flagEmoji} {c.name}
                    </>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {finished && (
        <div class="result-panel">
          <p class="status-msg" role="status">
            You scored {score}/{ROUNDS}.
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
              Practice round — it doesn't count towards your streak. <a href={withBase('/capitals/')}>Play today's puzzle →</a>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
