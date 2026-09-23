/**
 * Mode 1 — Outline: guess the country from its silhouette in 6 tries, with a distance/direction/
 * proximity hint after each guess. State (today's country) is resolved client-side on mount so the
 * puzzle always matches the visitor's current UTC date, not the day the static site was last built.
 */
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { searchCountries, matchCountry, getByIso2, type Country } from '../lib/countries';
import { OUTLINE_POOL, outlineFor } from '../lib/outlines';
import { haversineKm, kmToMiles, bearingDeg, bearingToArrow, bearingToCompass, proximityPct, distanceTile, msUntilNextUtcMidnight, formatCountdown, puzzleNumber, utcDateString } from '../lib/geo';
import { resolvePuzzleFromLocation } from '../lib/puzzle';
import { loadStats, saveStats, applyResult, displayedStreak, type StatsState } from '../lib/stats';
import { loadProgress, saveProgress } from '../lib/progress';
import { shareOrCopy } from '../lib/share';
import { withBase, absoluteUrl } from '../lib/url';
import { site } from '../site.config';

const MAX_GUESSES = 6;

interface Guess {
  country: Country;
  distanceKm: number;
  bearing: number;
  proximity: number;
}

export default function Outline() {
  const [ready, setReady] = useState(false);
  const [target, setTarget] = useState<Country | null>(null);
  const [puzzle, setPuzzle] = useState(0);
  const [practice, setPractice] = useState(false);
  const [date, setDate] = useState('');
  const [practiceSeedParam, setPracticeSeedParam] = useState<string | null>(null);
  const [guesses, setGuesses] = useState<Guess[]>([]);
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(-1);
  const [listOpen, setListOpen] = useState(false);
  const [stats, setStats] = useState<StatsState | null>(null);
  const [shareMsg, setShareMsg] = useState('');
  const [countdown, setCountdown] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  // True if, on mount, storage already had a won/lost round for today — so the auto-open-stats effect
  // (below) doesn't re-fire every time a finished daily puzzle is reloaded.
  const restoredFinishedRef = useRef(false);

  useEffect(() => {
    const resolved = resolvePuzzleFromLocation(OUTLINE_POOL, 'outline');
    setTarget(resolved.item);
    setPuzzle(resolved.puzzle);
    setPractice(resolved.practice);
    setDate(resolved.date);
    setPracticeSeedParam(new URLSearchParams(location.search).get('seed'));
    setStats(loadStats());
    // Restore today's guesses (daily rounds only — a practice round is fine to replay). Guesses are
    // stored as iso2 codes only; distance/bearing/proximity are recomputed against today's target so
    // a stale/tampered save can't fabricate a result.
    if (!resolved.practice) {
      const saved = loadProgress<{ guessedIso2: string[] }>('outline', resolved.date);
      if (saved && Array.isArray(saved.guessedIso2)) {
        const restored: Guess[] = [];
        for (const iso of saved.guessedIso2) {
          const country = getByIso2(iso);
          if (!country) continue;
          const distanceKm = haversineKm(resolved.item as Country, country);
          restored.push({ country, distanceKm, bearing: bearingDeg(country, resolved.item as Country), proximity: proximityPct(distanceKm) });
        }
        setGuesses(restored);
        const target = resolved.item as Country;
        const wasFinished = restored.some((g) => g.country.iso2 === target.iso2) || restored.length >= MAX_GUESSES;
        if (wasFinished) restoredFinishedRef.current = true;
      }
    }
    setReady(true);
  }, []);

  // Persist guesses for today's puzzle after every change so a reload can restore them.
  useEffect(() => {
    if (!ready || practice || !date) return;
    saveProgress('outline', date, { guessedIso2: guesses.map((g) => g.country.iso2) });
  }, [guesses, ready, practice, date]);

  const status: 'playing' | 'won' | 'lost' = useMemo(() => {
    if (!target) return 'playing';
    if (guesses.some((g) => g.country.iso2 === target.iso2)) return 'won';
    if (guesses.length >= MAX_GUESSES) return 'lost';
    return 'playing';
  }, [guesses, target]);

  const finished = status !== 'playing';

  // Record the result exactly once when the round finishes (skip practice rounds).
  const recordedRef = useRef(false);
  useEffect(() => {
    if (!finished || practice || !stats || recordedRef.current) return;
    recordedRef.current = true;
    const bucket = status === 'won' ? String(guesses.length) : 'x';
    const { state } = applyResult(stats, { mode: 'outline', puzzle, won: status === 'won', bucket });
    setStats(state);
    saveStats(state);
  }, [finished, practice, stats, status, guesses.length, puzzle]);

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
      window.dispatchEvent(new CustomEvent('geostreak:open-stats', { detail: { mode: 'outline' } }));
    }, 800);
    return () => clearTimeout(id);
  }, [finished]);

  // Countdown to the next daily puzzle, shown once a round is finished.
  useEffect(() => {
    if (!finished || practice) return;
    const tick = () => setCountdown(formatCountdown(msUntilNextUtcMidnight()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [finished, practice]);

  const suggestions = useMemo(() => (query.trim().length ? searchCountries(query, 8) : []), [query]);

  function submitGuess(country: Country) {
    if (!target || finished) return;
    if (guesses.some((g) => g.country.iso2 === country.iso2)) return;
    const distanceKm = haversineKm(target, country);
    const bearing = bearingDeg(country, target);
    const proximity = proximityPct(distanceKm);
    setGuesses((g) => [...g, { country, distanceKm, bearing, proximity }]);
    setQuery('');
    setListOpen(false);
    setActiveIdx(-1);
    inputRef.current?.focus();
  }

  function onFormSubmit(e: Event) {
    e.preventDefault();
    if (activeIdx >= 0 && suggestions[activeIdx]) {
      submitGuess(suggestions[activeIdx]);
      return;
    }
    const exact = matchCountry(query);
    if (exact) submitGuess(exact);
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setListOpen(true);
      setActiveIdx((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Escape') {
      setListOpen(false);
      setActiveIdx(-1);
    }
  }

  const units = stats?.units ?? 'km';
  const hardMode = stats?.hardMode ?? false;
  const path = target ? outlineFor(target.iso2) : '';

  function fmtDistance(km: number) {
    return units === 'mi' ? `${Math.round(kmToMiles(km)).toLocaleString()} mi` : `${Math.round(km).toLocaleString()} km`;
  }

  function shareText(): string {
    const n = practice ? '(practice)' : `#${puzzle}`;
    const rows = guesses.map((g) => distanceTile(g.distanceKm)).join('');
    const line1 = status === 'won' ? `GeoStreak Outline ${n} ${guesses.length}/${MAX_GUESSES}` : `GeoStreak Outline ${n} X/${MAX_GUESSES}`;
    return `${line1}\n${rows}`;
  }

  // A practice round's share link carries its own ?seed= so anyone who opens it plays the exact
  // same round, rather than a fresh random one (a daily round shares its own bare, spoiler-free URL).
  const shareUrl = practice && practiceSeedParam ? `${absoluteUrl(withBase('/outline/'))}?seed=${practiceSeedParam}` : absoluteUrl(withBase('/outline/'));

  async function onShare() {
    const res = await shareOrCopy('GeoStreak', shareText(), shareUrl);
    setShareMsg(res === 'shared' ? 'Shared!' : res === 'copied' ? 'Copied to clipboard' : shareText());
    setTimeout(() => setShareMsg(''), 4000);
  }

  // A daily round's "Challenge a friend" link carries `?date=` (not a fresh random seed) so a friend
  // who opens it plays *this exact* puzzle, not a different one — "beat my score" only means anything
  // if it's the same country (audit-2 finding: the old random-seed link sent friends elsewhere).
  function challengeLink(): string {
    return `${absoluteUrl(withBase('/outline/'))}?date=${date}`;
  }

  if (!ready) {
    return (
      <div class="puzzle-card atlas-bg" aria-busy="true">
        <div class="outline-figure skeleton" style="border-radius:16px" />
      </div>
    );
  }

  if (!target) return null;

  return (
    <div class="puzzle-card atlas-bg">
      <div class="puzzle-head">
        <div class="puzzle-head__meta">
          <span class="streak-chip">
            <span class="streak-chip__flame" aria-hidden="true">🔥</span> {stats ? displayedStreak(stats, 'outline', puzzleNumber(utcDateString(), site.epoch)) : 0} day streak
          </span>
          <span>{practice ? 'Practice round' : `Puzzle #${puzzle}`}</span>
        </div>
        <button type="button" class="btn btn--secondary" data-stats-trigger onClick={() => window.dispatchEvent(new CustomEvent('geostreak:open-stats', { detail: { mode: 'outline' } }))}>
          Stats
        </button>
      </div>

      <div class={`outline-figure${status === 'won' ? ' outline-figure--won' : ''}`}>
        {path ? (
          <svg viewBox="0 0 512 512" role="img" aria-label={finished ? `Outline of ${target.name}` : 'Outline of today’s mystery country'}>
            <path d={path} />
          </svg>
        ) : (
          <p class="muted">Outline unavailable</p>
        )}
      </div>

      <div class="slots" aria-hidden="true">
        {Array.from({ length: MAX_GUESSES }, (_, i) => (
          <span class="slot" key={i}>
            {guesses[i] ? distanceTile(guesses[i].distanceKm) : ''}
          </span>
        ))}
      </div>

      {!finished && (
        <form onSubmit={onFormSubmit}>
          <label htmlFor="outline-guess">Guess the country ({guesses.length}/{MAX_GUESSES})</label>
          <div class="combobox">
            <input
              id="outline-guess"
              ref={inputRef}
              type="text"
              autocomplete="off"
              role="combobox"
              aria-expanded={listOpen && suggestions.length > 0}
              aria-controls="outline-listbox"
              aria-activedescendant={activeIdx >= 0 ? `outline-opt-${activeIdx}` : undefined}
              value={query}
              placeholder="Type a country name…"
              onInput={(e) => {
                setQuery((e.target as HTMLInputElement).value);
                setListOpen(true);
                setActiveIdx(-1);
              }}
              onKeyDown={onKeyDown}
            />
            {listOpen && suggestions.length > 0 && (
              <ul class="combobox__list" role="listbox" id="outline-listbox">
                {suggestions.map((c, i) => (
                  <li
                    key={c.iso2}
                    role="option"
                    id={`outline-opt-${i}`}
                    aria-selected={i === activeIdx}
                    class="combobox__option"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      submitGuess(c);
                    }}
                  >
                    <span aria-hidden="true">{c.flagEmoji}</span> {c.name}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <button type="submit" class="btn" style="margin-top:var(--space-3)" disabled={!matchCountry(query) && !(activeIdx >= 0 && suggestions[activeIdx])}>
            Guess
          </button>
        </form>
      )}

      {guesses.length > 0 && (
        <ol class="guess-list" aria-label="Your guesses">
          {[...guesses].reverse().map((g, i) => (
            <li class="guess-row" key={g.country.iso2}>
              <span class="guess-row__name">
                {g.country.flagEmoji} {g.country.name}
              </span>
              <span>{fmtDistance(g.distanceKm)}</span>
              {!hardMode && (
                <span class="guess-row__arrow" title={bearingToCompass(g.bearing)} aria-label={`Direction: ${bearingToCompass(g.bearing)}`}>
                  {g.country.iso2 === target.iso2 ? '🎯' : bearingToArrow(g.bearing)}
                </span>
              )}
              {!hardMode && <span>{g.proximity}%</span>}
            </li>
          ))}
        </ol>
      )}

      {finished && (
        <div class="result-panel">
          <p class={`status-msg ${status === 'won' ? 'status-msg--win' : 'status-msg--lose'}`} role="status">
            {status === 'won' ? `Solved in ${guesses.length}/${MAX_GUESSES}!` : `Not today — it was ${target.name}.`}
          </p>
          <p>
            {target.flagEmoji} <strong>{target.name}</strong> · Capital: {target.capital ?? '—'} · {target.continent}.{' '}
            <a href={withBase(`/country/${target.slug}/`)}>See the full country page →</a>
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
              Practice round — it doesn't count towards your streak.{' '}
              <a href={withBase('/outline/')}>Play today's puzzle →</a>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
