# STATUS — GeoStreak (WEB-08)

This is the third builder session on this product. The first two sessions (interrupted by usage
limits) had already built a complete, working MVP — data pipeline, three games, 210 country pages,
stats/streak system, SEO, tests. This session resumed, audited the existing work line by line,
closed two brief-compliance gaps, and re-verified every required command green.

## Done

- **Core tools (3 daily games), all with URL-state / seed sharing:**
  - `/outline/` — daily country silhouette, 6 guesses, distance + 8-way compass + proximity %,
    spoiler-free emoji share strip, practice mode via `?seed=`/`?date=`.
  - `/capitals/` — 10-round capital↔country multiple choice, deterministic per day, share strip.
  - `/bigger/` — 10-round population/area comparison with a combo counter, share strip.
  - All three share one streak/profile system (localStorage), with export/import as JSON and as a
    compact backup code (`GS1:…`) so streaks survive a device change. Hard mode + km/mi toggle.
- **Data pipeline** (`scripts/fetch-countries.mjs` → `build-countries.mjs` → `build-outlines.mjs`):
  210 countries/territories in `src/data/countries.json` (Natural Earth 1:50m, public domain, for
  geometry/adjacency/continent; Wikidata CC0 for capital/population/area/coordinates/ISO codes),
  generated 2026-09-23 and committed — the Astro build never touches the network (verified: build
  succeeds with no network calls). Per-country simplified outline paths in `src/data/outlines.json`
  (210 entries, 512×512 viewBox).
- **Programmatic pages:** `/country/{slug}/` × 210, each with real per-page data (capital, population
  + world rank, area + world rank, coordinates, ISO codes, linked neighbours, outline SVG, quiz-style
  FAQ, per-country satori-rendered OG image). Full build (221 pages incl. OG images) completes in
  ~10–16s, well under the 3-minute cap.
- **Identity:** distinct navy/sunset-orange palette (`#0b1220` / `#f97316`), Bricolage Grotesque +
  Inter font pairing (self-hosted via `@fontsource`), custom globe-and-streak-dots favicon mark, dotted
  atlas background — no template placeholders remain anywhere in `site.config.ts`, favicon, tokens,
  home page or About.
- **Standard pages:** home, About (methodology, formulas, data sources/licences table, visible
  "Data last updated" date, fairness-of-seed explanation), Contact, Privacy, Terms, 404, robots.txt,
  sitemap, manifest, default + per-mode + per-country OG images.
- **This session's fixes:**
  1. `<AdSlot>` placeholders were defined but never rendered anywhere — added below the "How to play"
     section on all three game pages and below the FAQ on every country page (inert until
     `PUBLIC_ADSENSE_CLIENT` is set, never overlapping the game itself).
  2. The header only rendered the logo (no navigation) — added primary nav links (Outline, Capitals,
     Bigger, Countries, Archive) to `SiteHeader` via `Base.astro`, verified no overflow/a11y
     regressions at any viewport.
- **Extra tasks:** `MoreTools.astro` is byte-identical to `foundation/template`'s copy, imported and
  rendered above the footer on the home page, all three game pages, both country routes and the
  archive page. `public/cdaf6d28d35c143e38586b7eb7f2a727.txt` exists and its content matches
  `foundation/indexnow.key` exactly (verified with `diff`-equivalent read).

## Test results (this session, all green)

```
npm test
 Test Files  3 passed (3)
      Tests  42 passed (42)

MSYS_NO_PATHCONV=1 SITE=https://rouraroble.github.io BASE=/geostreak npm run build
 [build] 221 page(s) built in 13.96s
 [seo] audited 221 pages · 0 errors · 0 warnings

MSYS_NO_PATHCONV=1 BASE=/geostreak npm run test:e2e
 52 passed (20.5s)   — smoke + axe (wcag2a/aa, wcag21aa, serious/critical) + 7 viewports
                        (320–1920px) × 11 routes, gameplay flows for all 3 modes, 404, robots/
                        sitemap/manifest/OG existence

npm run build   (plain, root base)
 [build] 221 page(s) built in 10.31s
 [seo] audited 221 pages · 0 errors · 0 warnings
```

All four required verification commands pass with zero errors/warnings/failures.

## Known issues

- E2E accessibility checks run once per route at the page's default (system) colour scheme; there is
  no separate forced-`prefers-color-scheme: dark` axe pass, even though the CSS fully supports dark
  mode (`tokens.css`) and there is no in-page light/dark toggle to test both states against a fixed
  scheme — light/dark is currently driven only by the visitor's OS preference.
- Outline pool (173 of 210 countries) intentionally excludes small/scattered territories from the
  *daily* rotation for fair-shape reasons; those 37 still get full country pages, just no Outline
  puzzle day — documented in PRODUCT.md and About, not a bug.
- No real ad partner or affiliate link is connected yet (by design — `<AdSlot>` is inert without
  `PUBLIC_ADSENSE_CLIENT`, and PRODUCT.md documents the unbuilt "archive pass" idea instead of a
  placeholder `#` link, since brief §12 only requires the hook to exist, not to be live).
- `astro check` is wired as `check` (`astro check || true`) so a TypeScript diagnostic wouldn't fail
  CI; it wasn't run this session (not in the required verification list) — worth a quick pass before
  wider rollout.
- Country pages' "shares border with" backfill from Wikidata is used only for enclave/micro-state
  edge cases per PRODUCT.md; the general adjacency computation from Natural Earth polygons was not
  independently re-verified this session beyond the existing unit tests.

## Next 5 improvements (ranked by impact)

1. **Dark/light theme toggle in the header** — the tokens already support `data-theme="light"` /
   `"dark"` overrides; exposing a visible toggle (persisted to localStorage) would let users pick
   explicitly and let E2E run axe against both themes deterministically, closing the "light/dark"
   testing gap noted above.
2. **A fourth share surface: per-puzzle-number permalink page** (`/outline/123/` style) so a shared
   result link opens directly into that historical puzzle in practice mode with the right OG image,
   rather than only through `/archive/?date=`.
3. **Continent/subregion index pages** (`/country/continent/{slug}/`) — cheap, real-data programmatic
   pages ("countries in South America by population") that would pick up long-tail "countries in
   {continent}" search intent without new data.
4. **Sponsor/archive-pass monetization actually wired to a provider** once one is chosen — the
   `<AdSlot>` hook and PRODUCT.md notes are ready; needs a real `PUBLIC_ADSENSE_CLIENT` or affiliate
   partner before it does anything.
5. **Higher-resolution outlines for large screens** (swap 1:50m → 1:10m Natural Earth source for the
   outline pool only) — would sharpen the silhouette on desktop/tablet without touching the fact-page
   data, which already uses the full-resolution figures.

## Fixes after audit 1 (mission/audits/geostreak-audit-1.md, verdict BLOCKED, P0=2/P1=5/P2=9/P3=7)

Reproduced every finding before fixing (browser play-throughs for the game bugs, `node -e` against
`scripts/raw/wikidata.json` / `src/data/countries.json` for the data bugs) and re-ran all four required
verification commands after each batch of changes. Final state: `npm test` 58/58 (was 42; +16 new
regression tests), base-path build 221 pages/0 errors, e2e (Playwright + axe light/dark, 7 viewports)
69/69 (was 52; +2 new regression tests), plain build 221 pages/0 errors — all green.

### Fixed

**P0**
1. **Capitals question/option swap.** `src/islands/Capitals.tsx` — the `reverse` ternary in the option
   buttons had the two branches backwards; swapped so "What is the capital of X?" now offers capitals
   and "Which country has capital Y?" now offers countries. Added an e2e regression test
   (`tests/e2e/outline.spec.ts` — "the correct option is never just a repeat of the question") that
   plays all 10 rounds and asserts the question text never contains the `.choice-btn--correct` text.
2. **Wikidata QID published as a capital (Norway "Q585", Antigua and Barbuda "Q36262").**
   `scripts/build-countries.mjs` — added `CAPITAL_LABEL_OVERRIDES` keyed by the capital item's QID
   (Norway → Oslo, Antigua and Barbuda → St. John's), and a build-time assertion that throws if any
   `capital`/`capitals[]` value ever matches `/^Q\d+$/` again. Re-ran the data pipeline and hand-verified
   the two records. Added `tests/unit/countries.test.ts` asserting no QID reaches `countries.json` and
   pinning these two capitals by name.

**P1**
3. **Game progress only in memory (reload wipes guesses / replays a finished round).** New
   `src/lib/progress.ts` (`loadProgress`/`saveProgress`, `geostreak:progress:<mode>:<date>` in
   localStorage). Wired into `Outline.tsx`, `Capitals.tsx` and `Bigger.tsx`: today's guesses/round state
   restore on mount (recomputing distance/bearing/proximity from the target rather than trusting stored
   numbers) and persist after every change; a finished round now renders read-only on reload because the
   restored state makes `finished` true before the guess form would render. Practice rounds
   (`?seed=`/past `?date=`) are intentionally never persisted — replaying one is fine, it doesn't count.
   Added an e2e test ("reloading mid-round restores guesses instead of resetting the daily puzzle").
4. **Capitals share strip always green, only 5 tiles.** `Capitals.tsx` now tracks a `results: boolean[]`
   per round (set in `choose()`) and the share string maps it to 🟩/🟥 — no more "every played round is
   green" and no more `.slice(0, ROUNDS)` truncating a UTF-16 string of 2-code-unit emoji.
5. **Population years mixed 2013–2026 (wrong Bigger/Smaller answers, wrong ranks).**
   `scripts/build-countries.mjs` now only accepts Wikidata population statements from 2022 onward
   (`MIN_POP_YEAR`), falling back to the single-snapshot Natural Earth `POP_EST` otherwise — narrows the
   spread from 13 years to effectively two snapshots. India, Nigeria and the Netherlands still have no
   Wikidata statement newer than 2020/2021/2013 (re-fetched from Wikidata live to confirm this isn't a
   stale-cache artifact — it's a real gap in the upstream data), so per the audit's own suggested
   compromise, **`POP_COMPARE_POOL`** (`src/lib/countries.ts`) restricts the *population* half of
   Bigger-or-smaller to countries with a populationYear ≥ 2022 — India/China, Nigeria/Brazil etc. simply
   no longer get paired against each other for population, so the game can't mark a stale comparison
   "wrong". Area rounds are unaffected (no dating problem there). Also fixed while in this code: Vatican
   City's area was rounding 0.49 km² down to 0 (areas under 10 km² now keep 2 decimal places), and a
   build assertion now rejects any `areaKm2 <= 0`. New unit tests cover the QID/area assertions and the
   `POP_COMPARE_POOL` year floor.
6. **All 210 OG images show "NO GLYPH" boxes for the flag; Outline autocomplete drops India/Indonesia
   for "in" and can't submit "China" exactly.** `src/pages/og/country/[slug].png.ts` — dropped the flag
   emoji from the satori title (no emoji font is configured; the outline SVG already carries the visual
   identity). `src/lib/countries.ts` `searchCountries` — sort the "starts with" and "contains" buckets
   independently instead of alphabetising the combined list before slicing (the old order let
   alphabetically-early "contains" hits push "India"/"Indonesia" off the end of the top 8).
   `scripts/build-countries.mjs` — added a `China` display-name override (was "People's Republic of
   China", so `matchCountry('China')` failed and the slug/H1/FAQ all used the long form — this also
   closes the matching P2 finding below). New unit tests cover the prefix-ordering and the exact "China"
   match.

**P2 (9 found; fixed 7, see Remaining for the other 2)**
- Stats modal never auto-opens on finish → each island now dispatches `geostreak:open-stats` ~800ms
  after a (non-practice) round finishes, per the spec.
- "Challenge a friend" seed re-randomised on every render (including every countdown tick), and a
  practice round's own share link had no seed → the challenge seed is now computed once with `useMemo`
  when the round finishes, and a practice round's share link now carries its own `?seed=`.
- Tomorrow's puzzle playable via `?date=`, contradicting the About page → `src/lib/geo.ts` adds
  `isValidDateString` (rejects overflowing dates like `2026-13-45` via a round-trip check, not just the
  regex) and `src/lib/puzzle.ts` now ignores any `?date=` that is invalid *or later than today*, falling
  back to today's daily puzzle. This also fixes the separate "malformed `?date=` renders a blank Outline
  island" finding, since a bad date now falls back to a real puzzle instead of `pickDaily` indexing
  `order[NaN]`.
- Stale streaks shown after a missed day; no overall streak displayed → `src/lib/stats.ts` adds
  `displayedStreak`/`overallStreak` (a lapsed streak reads 0 immediately, without mutating the stored
  `currentStreak`, which only `applyResult` ever touches); used in `StreakSummary.tsx` (now shows an
  "Overall" chip) and each island's streak chip.
- Import overwrites stats with no confirmation/validation → `StatsModal.tsx` now calls
  `window.confirm(...)` before an import replaces any existing (non-zero) stats; `stats.ts`
  `mergeWithDefaults` now clamps every imported number to a non-negative integer, `won ≤ played`,
  `currentStreak`/`maxStreak ≤ played`, and only a literal boolean `true` (not the string `"false"`)
  enables hard mode. New unit tests cover the clamps and the stringly-boolean case.
- Stats modal a11y: the hidden file input had no accessible name (axe critical) → added
  `aria-label`; focus now returns to whatever triggered the modal on close (was falling through to
  `<body>`); added a Tab/Shift+Tab focus trap while open. (The full ARIA tabs pattern for the mode
  tablist — `tabpanel`, arrow-key navigation — is not done; see Remaining.)
- Capitals/Bigger shipping 449 KB of Outline-only data → moved `outlineFor`/`OUTLINES`/`OUTLINE_POOL`
  out of `src/lib/countries.ts` into a new `src/lib/outlines.ts` that only `Outline.tsx` (plus the
  server-only country/OG pages) imports. Verified in the built output: the Outline page's own chunk is
  now ~378 KB and the chunk shared by all three game pages dropped from 449 KB to ~78 KB; `capitals`
  and `bigger` no longer reference the Outline chunk at all.
- Misleading "play today's puzzle" CTA on the 37 non-daily country pages → `country/[slug].astro` now
  shows a different CTA copy when `!country.daily`, explaining the country isn't in the outline
  rotation, instead of implying it is.
- "People's Republic of China" as the display name/slug (duplicate of a P1 fix above) → covered by the
  `China` `NAMES` override in `scripts/build-countries.mjs`; slug is now `/country/china/`.

**P3 (7 found; fixed 5, see Remaining for the other 2)**
- About's "Puzzle #1 was {epoch}" was tense-wrong on launch day (epoch is *tomorrow* relative to today,
  not the past) → changed to "Puzzle #1 is {epoch} (days before that are puzzle #0 and lower)".
- Duplicate continent text ("...a country in South America, South America...") → `country/[slug].astro`
  only prints the subregion when it differs from the continent.
- Territories called "a country" (Hong Kong, Puerto Rico, Greenland, ...) → added a small
  `COUNTRY_LIKE_NON_MEMBERS` allow-list (Taiwan, Kosovo, Palestine, Vatican City); everything else that
  isn't a UN member now reads "a territory".
- Bigger-or-smaller: no share strip, 1s reveal → added a `results`-based 🟩/🟥 strip to the share text
  (same pattern as the Capitals fix) and extended the pre-next-round reveal from 1000ms to 2000ms
  (updated the e2e test's wait to match).
- Skip-link sliver always visible (`top:-40px` vs. ~41.6px rendered height) → switched to
  `transform: translateY(-150%)` / `translateY(0)` on focus, which fully hides it regardless of exact
  rendered height.

### Remaining (not fixed this session, with reasons)

- **P2 — Outline/Capitals/Bigger accessibility gaps**: guess feedback isn't in an `aria-live` region,
  focus isn't moved to a heading after each Capitals/Bigger answer (keyboard users must tab from the
  top each round), and the mode tablist in the stats modal doesn't implement the full ARIA tabs pattern
  (`tabpanel`, arrow-key nav). Not done — each is a real, somewhat separate UI change and the modal's
  worst issue (the unlabelled file input, axe-critical) and the worst focus issue (return-to-trigger) are
  fixed; the rest is comfort/completeness, not a broken flow, and didn't fit this pass.
- **P2 — Outline CLS (~0.0999 at desktop)**: the skeleton loading placeholder doesn't match the final
  card's height. Not done — needs measuring the real rendered heights per viewport and is easy to get
  subtly wrong without a visual regression check; left as a follow-up.
- **P1/P2 data limitation — population still not fully current for every country**: India, Nigeria and
  the Netherlands have no Wikidata population statement newer than 2020/2021/2013 (confirmed live, not
  a stale cache), so their `populationYear` still doesn't match 2026. The fix in this session narrows
  the *inconsistency* (single 2022+ Wikidata snapshot or single NE 2019 snapshot, not a 13-year spread)
  and excludes exactly these stale-vs-fresh pairings from the Bigger/Smaller *game* via
  `POP_COMPARE_POOL`, so the game can no longer mark a stale comparison as a "wrong" answer — but the
  country-page population *figure and rank badge* for these few countries is still whatever the best
  available snapshot is, not a true 2026 figure. A full fix needs a proper, licensed, up-to-date single
  source (e.g. UN WPP 2024 with attribution) fetched and reconciled for all ~210 places, which is a
  larger, separate data task.
- **P3 — flag emoji render as letter pairs on Windows** ("SN Senegal"): the spec lists `flag-icons` SVGs
  as optional for exactly this reason; swapping ~210 emoji for SVGs across the UI (not just OG, which is
  already fixed) is a real design/perf task, not a quick fix.
- **P3 — no dedicated practice entry point; mobile header nav wraps at ≤400px**: both are small feature/
  layout additions rather than bugs in existing behaviour; left for a follow-up pass given the time spent
  on the P0/P1/P2 correctness fixes above.

### New tests added this session

- `tests/unit/countries.test.ts` (new file): no-QID / no-zero-area data-integrity assertions,
  `POP_COMPARE_POOL` year floor, `searchCountries` prefix ordering (India/Indonesia for "in", Germany
  for "ger"), `matchCountry('China')`.
- `tests/unit/geo.test.ts`: `isValidDateString` (leap years, month/day overflow, non-zero-padded, empty).
- `tests/unit/stats.test.ts`: `displayedStreak`/`overallStreak` lapse behaviour; import clamping
  (won > played, negative streak, `maxStreak: 1e308`), stringly `"false"` hard-mode rejection, negative
  distribution counts.
- `tests/e2e/outline.spec.ts`: Capitals question/option-swap regression (10 rounds); Outline daily-round
  reload-preserves-guesses (progress persistence).

## Fixes after audit 2 (mission/audits/geostreak-audit-2.md, verdict NEEDS FIXES, P1=1/P2=1/P3=6)

Reproduced every finding before fixing (a scratch Playwright script against the base-path preview
server for the P1 regression and the two stats-modal P3s; direct reads of the built HTML for the
wording/redirect/About-page P3s) and re-ran all four required verification commands after each batch of
changes. Final state: `npm test` 67/67 (was 58; +9 new regression tests), base-path build 222 pages/0
errors, e2e (Playwright + axe light/dark, 7 viewports) 72/72 (was 69; +3 new regression tests), plain
build 222 pages/0 errors — all green.

### Fixed

**P1**
1. **REGRESSION: a reload during the answer reveal lets you answer the same round again ("You scored
   15/10").** Root cause: `Bigger.tsx`/`Capitals.tsx` persisted `step`, `score`, `combo`/`bestCombo` and
   `results` as four separately-updated pieces of state, but only `results` (and `score`/`combo`, which
   were derived from it inline in `choose()`) were written *before* the reveal's `setTimeout`; `step`
   only advanced *inside* that timeout. A reload mid-reveal restored the mismatched pair (an extra
   `results` entry, but the old `step`), so the just-answered round rendered as still-open and could be
   answered again, repeatedly.
   Fix: new `src/lib/roundState.ts` (`sanitizeResults`, `deriveStep`/`deriveScore`/`deriveCombo`) makes
   `results: boolean[]` the *only* persisted value for both modes — step, score, combo and best-combo
   are always derived from it, never stored or restored independently, so there is nothing left to
   desync. The reveal itself (which round is showing its answered colours) is now tracked by a separate
   `revealIndex` state that is deliberately **never persisted** — a reload always lands between rounds.
   `sanitizeResults` also caps a restored array at `ROUNDS` and drops non-boolean entries, so even an
   old corrupted (e.g. 20-entry) save can't produce an over-long or re-answerable round.
   New tests: `tests/unit/roundState.test.ts` (pins the derivations directly) and two e2e regression
   tests ("a reload during the reveal does not let a round be answered twice") for both Capitals
   (850ms window) and Bigger (2s window) — click, reload at ~250–300ms (inside the old bug's window),
   assert the next round shown is round 2 (not 1 again), play the rest out, and assert the final score
   is never above 10.

**P3 (6 found; fixed 5, see Remaining for the other 1)**
- **Stats modal re-opens on every reload of a finished round, and closing it after an auto-open loses
  focus to `<body>`.** Both bugs share a root cause: the per-mode "auto-open stats ~800ms after
  finishing" effect fired on *any* transition to `finished = true`, including the one that happens on
  mount when a saved round is restored already-finished — and an auto-open (from a `setTimeout`, not a
  click) has nothing meaningful focused when it fires, so the modal's "return focus to whatever
  triggered this" logic returned focus to `<body>`. Fixed both: each island (`Outline.tsx`,
  `Capitals.tsx`, `Bigger.tsx`) now sets a `restoredFinishedRef` when the *initial* restore was already
  finished, and the auto-open effect skips (once) when that ref is set. `StatsModal.tsx` now only
  captures a trigger element when `document.activeElement` isn't `<body>`, and on close falls back to
  this page's "Stats" button (`[data-stats-trigger]`, now on all three islands' Stats buttons) when
  there's no real trigger or it's no longer in the document, instead of silently dropping focus. New e2e
  test: "a finished daily round auto-opens stats once, but not again on reload" (Bigger) — plays a full
  round, confirms the modal auto-opens, closes it, reloads, and asserts it does not reopen.
- **"Overall" streak is the sum of the per-mode streaks** (three 5-day per-mode streaks read as
  "Overall 15", which looks like 15 days played). `stats.ts` adds a genuine combined-participation
  counter (`StatsState.overall`: `currentStreak`/`maxStreak`/`lastPuzzle`), updated inside `applyResult`
  itself — bumped once per calendar puzzle the first time *any* mode finishes that day (win or lose,
  unlike the per-mode streaks, and never double-counted when a second mode finishes the same day) and
  reset like any other streak when a day is missed. `overallStreak()`/`isOverallStreakAtRisk()` now read
  this instead of summing `displayedStreak` across modes; `mergeWithDefaults` clamps the imported shape
  the same way as the per-mode stats. `StreakSummary.tsx` needed no changes (same function signature).
  New unit tests cover same-day-multiple-modes (no double count), participation surviving a loss, and
  the exact "three 5-day streaks ≠ Overall 15" case from the audit.
- **Daily "Challenge a friend" link still sends friends a different puzzle.** All three islands'
  `challengeLink()` used a fresh `practiceSeedFor()` random seed on every finish, including for a daily
  (non-practice) round — a friend opening it played a different country/rounds, not "beat my score" for
  the puzzle just played. Since the challenge link only ever renders for `!practice` (daily) rounds, it
  now links with `?date=${date}` (today's date) instead of a random seed: `usableDateParam` (already
  fixed in audit-1) accepts a past-or-today date, so a friend opening it the same day gets the identical
  puzzle, and opening it a later day replays it as a practice round. `practiceSeedFor()` is now dead
  (nothing else called it) and was removed from `puzzle.ts`. Button copy updated from "(practice seed)"
  to "(same puzzle)" to match. Not separately unit-tested (it's a one-line URL construction covered
  indirectly by the existing `usableDateParam`/`?date=` tests), but manually verified via the built HTML.
- **Hong Kong (and other capital-less territories) say "The capital of Hong Kong is not applicable."**
  `country/[slug].astro`'s meta description/lead paragraph now says "Hong Kong has no separate capital
  city." for any place with no `c.capital`, instead of interpolating "not applicable" into the
  "the capital of X is …" template.
- **Old URL `/country/people-s-republic-of-china/` 404s with no redirect.** Added a new static page at
  that exact path (`src/pages/country/people-s-republic-of-china.astro`) with a `<meta http-equiv=
  "refresh">` to `/country/china/`, `canonical` pointing at the China page, and `noindex` — so a stale
  bookmark or indexed link lands on the current page instead of a dead end. Excluded from the sitemap
  (`astro.config.mjs`) alongside the existing 404 exclusion. The SEO audit now shows 2 warnings (both
  intentional: "canonicalised to an alias page" and "page is noindex" on this one redirect page) instead
  of 0 — there are still 0 errors, which is what all four verification commands gate on.
- **About page credits Wikidata for all population figures and calls them "recent".** Since audit-1's
  fix, ~74 of 210 records actually fall back to Natural Earth's `POP_EST` (a different, older single
  snapshot) when there's no Wikidata statement from 2022 onward. `about.astro`'s sources table and body
  text now say so explicitly (Wikidata 2022+ preferred, Natural Earth `POP_EST` as the named fallback,
  year shown per-country), instead of implying every figure comes from the same recent Wikidata
  snapshot.

### Remaining (not fixed this session, with reasons)

- **P2 — population figures/ranks on country pages still dated for ~1/3 of places** (India, Nigeria,
  the Netherlands, etc. via the Natural Earth 2019 fallback): this is the data-source task audit-1
  already flagged as out of scope for a quick fix (needs one licensed, current, single-year source —
  e.g. UN WPP 2024 — fetched and reconciled for all ~210 places) and audit-2 confirms it's still open;
  didn't fit this session's P1-first time box.
- **P2 — game-widget accessibility (aria-live regions, focus-to-heading after an answer, full ARIA tabs
  pattern for the mode tablist)**: unchanged from audit-1's "acknowledged, not fixed" — still a real,
  separable UI task that didn't fit alongside the P1 regression and the six P3s above.
- **P3 — flag emoji render as letter pairs on Windows; no dedicated practice entry point; mobile nav
  wraps at ≤400px; country titles don't match the spec's keyword pattern**: unchanged from audit-1/2 —
  each is a real but separate design/content task, not a bug fix, and didn't fit this time box.

### New tests added this session

- `tests/unit/roundState.test.ts` (new file): `deriveStep`/`deriveScore`/`deriveCombo` pinned directly;
  `sanitizeResults` rejects non-arrays and non-boolean entries and caps a restored array at `ROUNDS`
  (the core of the P1 fix).
- `tests/unit/stats.test.ts`: overall (participation) streak — same-day multi-mode no-double-count,
  survives a loss, and the "three 5-day per-mode streaks ≠ Overall 15" regression case.
- `tests/e2e/outline.spec.ts`: reload-during-reveal double-answer regression for both Capitals (850ms
  window) and Bigger (2s window); finished-daily-round auto-opens stats once but not again on reload.
