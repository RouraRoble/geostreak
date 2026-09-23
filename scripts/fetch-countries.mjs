// One-off data fetch (run manually, NOT during the build):
//   node scripts/fetch-countries.mjs
// 1. Downloads Natural Earth 1:110m + 1:50m admin_0 countries GeoJSON (public domain) into scripts/raw/.
// 2. Runs three SPARQL queries against Wikidata (CC0) and stores the raw rows in scripts/raw/wikidata.json.
// The committed dataset in src/data/ is then produced by scripts/build-countries.mjs and scripts/build-outlines.mjs.
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const raw = fileURLToPath(new URL('./raw/', import.meta.url));
await mkdir(raw, { recursive: true });

const NE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/';
for (const f of ['ne_110m_admin_0_countries.geojson', 'ne_50m_admin_0_countries.geojson']) {
  const out = raw + f;
  if (existsSync(out)) continue;
  const res = await fetch(NE + f);
  if (!res.ok) throw new Error(`NE download failed: ${f} ${res.status}`);
  await writeFile(out, Buffer.from(await res.arrayBuffer()));
  console.log('[fetch] wrote', f);
}

const ENDPOINT = 'https://query.wikidata.org/sparql';
const UA = 'GeoStreak/0.1 (https://rouraroble.github.io/geostreak/; roura.roble@gmail.com) node-fetch';

async function sparql(query) {
  const url = ENDPOINT + '?format=json&query=' + encodeURIComponent(query);
  for (let attempt = 1; attempt <= 4; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/sparql-results+json' } });
    if (res.ok) {
      const json = await res.json();
      return json.results.bindings.map((row) => Object.fromEntries(Object.entries(row).map(([k, v]) => [k, v.value])));
    }
    console.warn(`[wikidata] attempt ${attempt} failed: ${res.status}`);
    await new Promise((r) => setTimeout(r, 3000 * attempt));
  }
  throw new Error('Wikidata query failed');
}

// Q1: base facts for every item that carries an ISO 3166-1 alpha-2 code.
const qBase = `
SELECT ?item ?itemLabel ?iso2 ?iso3 ?capital ?capitalLabel ?capRank ?areaM2 ?coord ?inception WHERE {
  ?item wdt:P297 ?iso2 .
  OPTIONAL { ?item wdt:P298 ?iso3 . }
  OPTIONAL {
    ?item p:P36 ?capStmt . ?capStmt ps:P36 ?capital . ?capStmt wikibase:rank ?capRank .
    FILTER NOT EXISTS { ?capStmt pq:P582 ?end . }
    FILTER (?capRank != wikibase:DeprecatedRank)
  }
  OPTIONAL { ?item p:P2046 ?areaStmt . ?areaStmt psn:P2046 ?areaNode . ?areaNode wikibase:quantityAmount ?areaM2 . ?areaStmt wikibase:rank ?areaRank . FILTER (?areaRank != wikibase:DeprecatedRank) }
  OPTIONAL { ?item wdt:P625 ?coord . }
  OPTIONAL { ?item wdt:P571 ?inception . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}`;

// Q2: every population statement with its point in time (reduced to the latest in build-countries.mjs).
const qPop = `
SELECT ?iso2 ?pop ?date WHERE {
  ?item wdt:P297 ?iso2 .
  ?item p:P1082 ?st . ?st ps:P1082 ?pop . ?st wikibase:rank ?rank .
  FILTER (?rank != wikibase:DeprecatedRank)
  OPTIONAL { ?st pq:P585 ?date . }
}`;

// Q3: "shares border with" pairs (used only for micro-states that have no polygon in Natural Earth).
const qBorders = `
SELECT ?iso2 ?nb WHERE {
  ?item wdt:P297 ?iso2 .
  ?item wdt:P47 ?other . ?other wdt:P297 ?nb .
}`;

const out = {};
for (const [name, q] of [['base', qBase], ['population', qPop], ['borders', qBorders]]) {
  console.log('[wikidata] query', name);
  out[name] = await sparql(q);
  console.log('[wikidata]', name, out[name].length, 'rows');
}
out.fetchedAt = new Date().toISOString();
await writeFile(raw + 'wikidata.json', JSON.stringify(out));
console.log('[fetch] wrote scripts/raw/wikidata.json');
