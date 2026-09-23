// Builds src/data/countries.json from the raw downloads made by scripts/fetch-countries.mjs.
//   node scripts/build-countries.mjs
// Sources: Natural Earth 1:50m admin_0 countries (public domain) for continent/subregion, label point, adjacency
// (computed from the shared polygon arcs with topojson) and POP_EST fallback; Wikidata (CC0) for capital,
// population (latest point in time), area and ISO codes. Runs offline once the raw files exist.
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { topology } from 'topojson-server';
import { neighbors } from 'topojson-client';

const raw = fileURLToPath(new URL('./raw/', import.meta.url));
const ne = JSON.parse(await readFile(raw + 'ne_50m_admin_0_countries.geojson', 'utf8'));
const wd = JSON.parse(await readFile(raw + 'wikidata.json', 'utf8'));

// The 193 UN member states (ISO 3166-1 alpha-2).
const UN = `AF AL DZ AD AO AG AR AM AU AT AZ BS BH BD BB BY BE BZ BJ BT BO BA BW BR BN BG BF BI CV KH CM CA CF TD CL CN CO KM CG CD CR CI HR CU CY CZ DK DJ DM DO EC EG SV GQ ER EE SZ ET FJ FI FR GA GM GE DE GH GR GD GT GN GW GY HT HN HU IS IN ID IR IQ IE IL IT JM JP JO KZ KE KI KP KR KW KG LA LV LB LS LR LY LI LT LU MG MW MY MV ML MT MH MR MU MX FM MD MC MN ME MA MZ MM NA NR NP NL NZ NI NE NG MK NO OM PK PW PA PG PY PE PH PL PT QA RO RU RW KN LC VC WS SM ST SA SN RS SC SL SG SK SI SB SO ZA SS ES LK SD SR SE CH SY TJ TZ TH TL TG TO TT TN TR TM TV UG UA AE GB US UY UZ VU VE VN YE ZM ZW`.split(/\s+/);
if (new Set(UN).size !== 193) throw new Error(`UN list has ${new Set(UN).size} entries, expected 193`);
// Well-known non-member states and territories that people expect in a geography game.
const EXTRA = ['TW', 'XK', 'PS', 'VA', 'GL', 'PR', 'HK', 'MO', 'FO', 'BM', 'NC', 'PF', 'GU', 'KY', 'AW', 'CW', 'IM'];
const WANT = [...UN, ...EXTRA];

// Display-name overrides (Wikidata labels are otherwise used).
const NAMES = {
  US: 'United States', NL: 'Netherlands', CZ: 'Czechia', CI: "Côte d'Ivoire", CV: 'Cabo Verde', CD: 'DR Congo', CG: 'Republic of the Congo',
  CN: 'China',
  KP: 'North Korea', KR: 'South Korea', TL: 'Timor-Leste', FM: 'Micronesia', VA: 'Vatican City', PS: 'Palestine', RU: 'Russia', SY: 'Syria',
  IR: 'Iran', LA: 'Laos', BN: 'Brunei', VN: 'Vietnam', BO: 'Bolivia', VE: 'Venezuela', TZ: 'Tanzania', MD: 'Moldova', MK: 'North Macedonia',
  GB: 'United Kingdom', AE: 'United Arab Emirates', MO: 'Macao', FO: 'Faroe Islands', ST: 'São Tomé and Príncipe', BA: 'Bosnia and Herzegovina',
  SZ: 'Eswatini', TR: 'Turkey', MM: 'Myanmar', GM: 'The Gambia', BS: 'The Bahamas', KN: 'Saint Kitts and Nevis', VC: 'Saint Vincent and the Grenadines',
  LC: 'Saint Lucia', TT: 'Trinidad and Tobago', AG: 'Antigua and Barbuda', PG: 'Papua New Guinea', SB: 'Solomon Islands', MH: 'Marshall Islands',
  CF: 'Central African Republic', DO: 'Dominican Republic', GQ: 'Equatorial Guinea', GW: 'Guinea-Bissau', SS: 'South Sudan', LK: 'Sri Lanka',
  NZ: 'New Zealand', SA: 'Saudi Arabia', ZA: 'South Africa', SL: 'Sierra Leone', BF: 'Burkina Faso', CR: 'Costa Rica', SV: 'El Salvador',
  PF: 'French Polynesia', NC: 'New Caledonia', KY: 'Cayman Islands', IM: 'Isle of Man', TW: 'Taiwan', XK: 'Kosovo', HK: 'Hong Kong',
};
// Search aliases (what people actually type).
const ALIASES = {
  US: ['USA', 'United States of America', 'America', 'U.S.', 'U.S.A.', 'States'],
  GB: ['UK', 'Britain', 'Great Britain', 'England', 'Scotland', 'Wales', 'U.K.'],
  AE: ['UAE', 'Emirates'],
  CD: ['Democratic Republic of the Congo', 'DRC', 'Congo-Kinshasa', 'Zaire'],
  CG: ['Congo', 'Congo-Brazzaville'],
  CI: ['Ivory Coast', 'Cote d Ivoire'],
  CZ: ['Czech Republic'],
  CV: ['Cape Verde'],
  KP: ['DPRK', 'Democratic People\'s Republic of Korea'],
  KR: ['Korea', 'Republic of Korea'],
  MM: ['Burma'],
  SZ: ['Swaziland'],
  TL: ['East Timor'],
  TR: ['Türkiye', 'Turkiye'],
  NL: ['Holland', 'The Netherlands'],
  RU: ['Russian Federation'],
  IR: ['Persia'],
  VA: ['Vatican', 'Holy See'],
  MK: ['Macedonia'],
  FM: ['Federated States of Micronesia'],
  ST: ['Sao Tome and Principe', 'Sao Tome'],
  VN: ['Viet Nam'],
  LA: ['Lao'],
  BN: ['Brunei Darussalam'],
  TW: ['Republic of China', 'Formosa'],
  CN: ['People\'s Republic of China', 'PRC'],
  SY: ['Syrian Arab Republic'],
  BA: ['Bosnia'],
  TT: ['Trinidad'],
  AG: ['Antigua'],
  KN: ['St Kitts and Nevis', 'Saint Kitts'],
  LC: ['St Lucia'],
  VC: ['St Vincent and the Grenadines', 'Saint Vincent'],
  BS: ['Bahamas'],
  GM: ['Gambia'],
  PG: ['PNG'],
  NZ: ['Aotearoa'],
  EH: ['Western Sahara'],
  MO: ['Macau'],
  FO: ['Faeroe Islands'],
  PS: ['State of Palestine', 'West Bank', 'Gaza'],
  ZA: ['RSA'],
  DO: ['Dominican Rep'],
  CF: ['CAR'],
  SA: ['KSA'],
  MD: ['Moldavia'],
  KH: ['Kampuchea'],
  LK: ['Ceylon'],
  ET: ['Abyssinia'],
  IS: [],
};
// Primary capital for the game when Wikidata lists several (all are kept in `capitals`).
const PRIMARY_CAPITAL = { ZA: 'Pretoria', BO: 'Sucre', LK: 'Sri Jayawardenepura Kotte', SZ: 'Mbabane', PS: 'Ramallah', MY: 'Kuala Lumpur', BJ: 'Porto-Novo', TZ: 'Dodoma', CI: 'Yamoussoukro', NL: 'Amsterdam', CL: 'Santiago', MV: 'Malé' };
const CAPITAL_NOTES = {
  ZA: 'Pretoria is the executive capital; Cape Town is the legislative capital and Bloemfontein the judicial capital.',
  BO: 'Sucre is the constitutional capital; La Paz is the seat of government.',
  LK: 'Sri Jayawardenepura Kotte is the official capital; Colombo is the commercial capital.',
  SZ: 'Mbabane is the administrative capital; Lobamba is the royal and legislative capital.',
  PS: 'Ramallah is the administrative centre; East Jerusalem is the proclaimed capital.',
  MY: 'Kuala Lumpur is the official capital; Putrajaya is the administrative centre.',
  BJ: 'Porto-Novo is the official capital; Cotonou is the seat of government.',
  TZ: 'Dodoma is the official capital; Dar es Salaam is the largest city and former capital.',
  CI: 'Yamoussoukro is the official capital; Abidjan is the economic capital.',
  NL: 'Amsterdam is the constitutional capital; the government sits in The Hague.',
  IL: 'Jerusalem is the proclaimed capital; most embassies are in Tel Aviv.',
};
// Wikidata's label service occasionally has no English (or `mul`) label for the capital item, in
// which case `capitalLabel` falls back to the raw QID (e.g. Norway -> "Q585"). Hand-verified fixes,
// keyed by the capital item's QID (from the `capital` entity URI) so this is robust to iso2 mapping.
// A build assertion below also fails hard if any QID ever reaches the output despite this map.
const CAPITAL_LABEL_OVERRIDES = { Q585: 'Oslo', Q36262: "St. John's" };
// Population is only trustworthy for comparisons when every value comes from roughly the same point
// in time. Wikidata population statements vary wildly in date (2013-2026); only statements from this
// year onward are used, everything older falls back to the single-snapshot Natural Earth POP_EST.
const MIN_POP_YEAR = 2022;

const byIso = new Map();
for (const f of ne.features) {
  const p = f.properties;
  const iso = p.ISO_A2_EH && p.ISO_A2_EH !== '-99' ? p.ISO_A2_EH : p.ISO_A2;
  if (iso && iso !== '-99' && !byIso.has(iso)) byIso.set(iso, f);
}
// Natural Earth quirk: Cyprus/Northern Cyprus, Somalia/Somaliland, Kashmir are separate features; keep the ISO one only.

function slugify(name) {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
function flagEmoji(iso2) {
  return String.fromCodePoint(...[...iso2.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}
function parsePoint(s) {
  const m = /Point\(([-\d.eE]+) ([-\d.eE]+)\)/.exec(s || '');
  return m ? { lng: +m[1], lat: +m[2] } : null;
}

// Wikidata reductions.
const wdBase = new Map();
for (const r of wd.base) {
  const iso = r.iso2;
  // Skip the odd duplicate items (Antarctic Treaty area, "Cyprus" disambiguation entry).
  if (iso === 'CY' && !/Q229$/.test(r.item)) continue;
  if (iso === 'AQ' && !/Q51$/.test(r.item)) continue;
  const e = wdBase.get(iso) || { label: r.itemLabel, iso3: r.iso3, capitals: [], areas: [], coord: parsePoint(r.coord) };
  let capLabel = r.capitalLabel;
  if (capLabel && /^Q\d+$/.test(capLabel)) {
    const capQid = r.capital ? r.capital.split('/').pop() : null;
    capLabel = (capQid && CAPITAL_LABEL_OVERRIDES[capQid]) || capLabel;
  }
  if (capLabel && !e.capitals.some((c) => c.name === capLabel)) e.capitals.push({ name: capLabel, preferred: /PreferredRank/.test(r.capRank || '') });
  if (r.areaM2 && !e.areas.includes(+r.areaM2)) e.areas.push(+r.areaM2);
  wdBase.set(iso, e);
}
const wdPop = new Map();
for (const r of wd.population) {
  const date = r.date || '0000';
  const year = +date.slice(0, 4);
  // Skip stale statements outright: a country with only pre-2022 Wikidata population data falls
  // back to the (single-snapshot) Natural Earth POP_EST below, rather than mixing decades.
  if (!Number.isFinite(year) || year < MIN_POP_YEAR) continue;
  const cur = wdPop.get(r.iso2);
  if (!cur || date > cur.date) wdPop.set(r.iso2, { pop: Math.round(+r.pop), date });
}

const countries = [];
for (const iso2 of WANT) {
  const f = byIso.get(iso2);
  if (!f) throw new Error(`No Natural Earth feature for ${iso2}`);
  const p = f.properties;
  const w = wdBase.get(iso2);
  if (!w) throw new Error(`No Wikidata row for ${iso2}`);
  const name = NAMES[iso2] || w.label;
  const caps = w.capitals.slice().sort((a, b) => Number(b.preferred) - Number(a.preferred)).map((c) => c.name);
  let capital = PRIMARY_CAPITAL[iso2] || caps[0] || null;
  if (capital && !caps.includes(capital)) caps.unshift(capital);
  const pop = wdPop.get(iso2);
  const areaM2 = w.areas.length ? Math.max(...w.areas) : null;
  // Round to a whole km² normally, but keep 2 decimal places for micro-states under 10 km² (e.g.
  // Vatican City, 0.49 km²), where rounding to the nearest whole km² would collapse them to 0.
  const areaKm2 = areaM2 == null ? null : areaM2 / 1e6 < 10 ? Math.round((areaM2 / 1e6) * 100) / 100 : Math.round(areaM2 / 1e6);
  let continent = p.CONTINENT;
  if (continent === 'Seven seas (open ocean)') continent = /Africa/.test(p.SUBREGION) ? 'Africa' : /Asia/.test(p.SUBREGION) ? 'Asia' : 'Oceania';
  countries.push({
    slug: slugify(name),
    name,
    iso2,
    iso3: w.iso3 || p.ISO_A3_EH || p.ADM0_A3,
    capital,
    capitals: caps,
    capitalNote: CAPITAL_NOTES[iso2] || null,
    continent,
    subregion: p.SUBREGION,
    population: pop ? pop.pop : Math.round(p.POP_EST),
    populationYear: pop && pop.date !== '0000' ? +pop.date.slice(0, 4) : +p.POP_YEAR,
    areaKm2,
    lat: +(+p.LABEL_Y).toFixed(3),
    lng: +(+p.LABEL_X).toFixed(3),
    neighbours: [],
    flagEmoji: flagEmoji(iso2),
    aliases: ALIASES[iso2] || [],
    unMember: UN.includes(iso2),
    daily: false,
    _adm0: p.ADM0_A3,
  });
}

// Adjacency from shared polygon arcs (Natural Earth is topologically consistent).
const feats = countries.map((c) => byIso.get(c.iso2));
const topo = topology({ c: { type: 'FeatureCollection', features: feats } }, 1e5);
const nb = neighbors(topo.objects.c.geometries);
for (let i = 0; i < countries.length; i++) countries[i].neighbours = nb[i].map((j) => countries[j].iso2);
// Wikidata "shares border with" is used only for enclaves/micro-states whose polygon may not share arcs at 1:50m.
const MICRO = new Set(['VA', 'SM', 'MC', 'LI', 'AD', 'SG', 'BH', 'HK', 'MO', 'PS', 'GL', 'PR']);
const isoSet = new Set(WANT);
for (const r of wd.borders) {
  if (!MICRO.has(r.iso2) || !isoSet.has(r.nb) || r.iso2 === r.nb) continue;
  const a = countries.find((c) => c.iso2 === r.iso2);
  const b = countries.find((c) => c.iso2 === r.nb);
  // Land borders only for these: Singapore, Bahrain, Greenland and Puerto Rico have none.
  if (['SG', 'BH', 'GL', 'PR'].includes(r.iso2)) continue;
  if (!a.neighbours.includes(b.iso2)) a.neighbours.push(b.iso2);
  if (!b.neighbours.includes(a.iso2)) b.neighbours.push(a.iso2);
}
for (const c of countries) c.neighbours.sort();

// Ranks (among all entries) and daily-pool eligibility.
const byPop = countries.filter((c) => c.population).slice().sort((a, b) => b.population - a.population);
const byArea = countries.filter((c) => c.areaKm2).slice().sort((a, b) => b.areaKm2 - a.areaKm2);
for (const c of countries) {
  c.populationRank = byPop.indexOf(c) + 1 || null;
  c.areaRank = byArea.indexOf(c) + 1 || null;
  // Outline puzzles need a recognisable shape: skip micro-states and scattered specks below 2,500 km².
  c.daily = (c.areaKm2 || 0) >= 2500 && !['PF', 'NC', 'GL', 'PR', 'KI'].includes(c.iso2) || ['PR', 'GL'].includes(c.iso2);
  delete c._adm0;
}
countries.sort((a, b) => a.name.localeCompare(b.name));

// Data-integrity guards: never let a raw Wikidata QID or a zero/missing area reach the published data.
const QID = /^Q\d+$/;
for (const c of countries) {
  if (c.capital && QID.test(c.capital)) throw new Error(`Capital for ${c.name} (${c.iso2}) is a raw Wikidata QID: ${c.capital}`);
  if (c.capitals.some((cap) => QID.test(cap))) throw new Error(`capitals[] for ${c.name} (${c.iso2}) contains a raw Wikidata QID`);
  if (c.areaKm2 != null && c.areaKm2 <= 0) throw new Error(`areaKm2 for ${c.name} (${c.iso2}) is ${c.areaKm2}`);
}

const out = {
  generatedAt: new Date().toISOString().slice(0, 10),
  sources: {
    naturalEarth: 'Natural Earth 1:50m Admin 0 – Countries v5.1.1 (public domain)',
    wikidata: `Wikidata (CC0), SPARQL snapshot ${wd.fetchedAt.slice(0, 10)}`,
  },
  countries,
};
const dest = fileURLToPath(new URL('../src/data/countries.json', import.meta.url));
await writeFile(dest, JSON.stringify(out));
console.log(`[build-countries] ${countries.length} countries, ${countries.filter((c) => c.daily).length} in the daily pool → src/data/countries.json`);
for (const c of countries) if (!c.capital) console.log('  no capital:', c.name);
for (const c of countries) if (!c.areaKm2 || !c.population) console.log('  missing pop/area:', c.name, c.population, c.areaKm2);
