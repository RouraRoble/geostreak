# GeoStreak

A family of three daily geography games — **Outline** (guess the country from its silhouette), **Capitals**
(match capitals to countries), and **Bigger or smaller** (population/area comparisons) — sharing one streak,
one local profile, and a spoiler-free share format. Plus a data page for every one of 210 countries and
territories (capital, population, area, neighbours, outline). Static, no accounts, no server.

## What it is

- `/outline/` — daily country silhouette, 6 guesses, distance + 8-way compass direction + proximity % per
  guess, emoji result strip to share.
- `/capitals/` — 10 daily multiple-choice rounds, capital→country and country→capital, 4 options.
- `/bigger/` — 10 daily rounds comparing population or land area between two countries, with a within-round
  combo counter.
- `/country/{slug}/` — one page per country/territory (210 total): capital, population + world rank, area +
  world rank, neighbours (linked), coordinates, ISO codes, outline SVG, quiz-style FAQ, per-country OG image.
- `/archive/` — practice any past puzzle by date (never affects the streak, never spoils today's answer).
- Streak, win/loss distribution, hard mode and km/mi preference are stored in `localStorage`; a "Stats" panel
  (present on every game page) offers a copyable backup code and a JSON download/upload for moving between
  devices.

## Data sources & licences

| Source | Used for | Licence |
| --- | --- | --- |
| Natural Earth 1:50m Admin 0 — Countries | Outline shapes, land-border adjacency, continent/subregion | Public domain |
| Wikidata (SPARQL snapshot) | Capital(s), population, area, ISO 3166-1 alpha-2/alpha-3 codes, coordinates, "shares border with" (used only to backfill enclave/micro-state borders that 1:50m polygons can miss) | CC0 |

Both are re-derived by `scripts/fetch-countries.mjs` (raw download, cached in `scripts/raw/`, not committed to
`src/`) → `scripts/build-countries.mjs` (→ `src/data/countries.json`) → `scripts/build-outlines.mjs`
(→ `src/data/outlines.json`). These are one-off, manually-run scripts — **the Astro build never touches the
network**. Re-run them to refresh the dataset:

```
node scripts/fetch-countries.mjs   # re-downloads NE geometry + re-queries Wikidata
node scripts/build-countries.mjs   # → src/data/countries.json
node scripts/build-outlines.mjs    # → src/data/outlines.json
```

Curated set: the 193 UN member states plus 17 widely-recognised non-member states/territories (Taiwan,
Kosovo, Palestine, Vatican City, Greenland, Puerto Rico, Hong Kong, Macao, Faroe Islands, Bermuda, New
Caledonia, French Polynesia, Guam, Cayman Islands, Aruba, Curaçao, Isle of Man) = 210 entries. The Outline
daily pool excludes 37 of those whose shape alone (at this simplification level, or because of a scattered/
tiny territory) would not be a fair guessing target — 173 remain in `OUTLINE_POOL`.

## Formulas

- **Distance**: haversine great-circle distance between country centre points, Earth radius 6,371.0088 km.
- **Direction**: initial bearing between the same two points, snapped to the nearest of 8 compass points.
- **Proximity %**: `100 * (1 - d/d_max)^2` where `d_max` is the antipodal distance (`π * R`) — 100% exact,
  0% at the far side of the planet, with a curve that still rewards a guess on the right continent.
- **Daily seed**: `pickDaily(pool, mode, dateUTC, epoch)` — the pool is shuffled once with a seeded
  Fisher–Yates (`mulberry32`, seeded by `hash("geostreak:" + mode)`), then indexed by
  `puzzleNumber = daysSince(epoch) + 1`. No repeats until the whole pool has cycled (173–210 days, well past
  the 60-day requirement). Practice links use a past date (`?date=`) or a one-off random seed (`?seed=`) via
  the same deterministic function, so a "beat my score" link always reproduces the exact same puzzle.
- **Streak**: a mode's streak increments on a win only if the previous *counted* result was exactly one
  puzzle number earlier; any gap or a loss resets it to 0 (then back to 1 on the next win). Recording is
  idempotent per puzzle number so a reload never double-counts.

## Known limits

- Population/area/capital are a single point-in-time Wikidata snapshot (date shown on `/about/`), not live.
- A handful of countries have more than one capital in practice (South Africa, Bolivia, Sri Lanka, eSwatini,
  Palestine, Malaysia, Benin, Tanzania, Côte d'Ivoire, Netherlands, Israel) — the primary one used for the
  games is documented with a note on that country's page.
- Outline shapes drop small/far-flung overseas polygons (rule table in `scripts/build-outlines.mjs`) so the
  silhouette stays legible at 512×512; the country's *fact page* data (population, area, coordinates) still
  covers the whole country, only the drawn shape is trimmed.
- Hong Kong and Macao have no independent capital (they're territories, not states) and are marked as such
  rather than guessed at.
- The archive computes "today" client-side from the visitor's clock; a very long gap between site rebuilds
  doesn't affect it (it's not baked into the static HTML), but the very first days after launch (before
  puzzle #1's date) show an empty archive by design.

## Monetization hooks (not wired up)

- `<AdSlot>` below the fold on every game page (inactive until `PUBLIC_ADSENSE_CLIENT` is set).
- Documented but unbuilt: an "archive pass" (Ko-fi/one-off tip) to unlock a wider archive window or an
  ad-free practice mode — noted here rather than implemented, since no payment provider is connected yet.

## Future ideas (see STATUS.md for the ranked next 5)

- A fourth mode: flag-only guessing, or "guess the country from a silhouette + a progressively-zoomed-out
  hint".
- Per-continent leaderbo-free stats (e.g. "best in Africa Outline puzzles") computed client-side.
- Weekly digest email opt-in (would need a real ESP; out of scope for a static, account-free site today).
- Higher-resolution outlines (1:10m Natural Earth) for a sharper silhouette on large screens.
