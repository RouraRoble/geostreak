// Builds src/data/outlines.json: one simplified SVG path per country in a 512×512 viewBox.
//   node scripts/build-outlines.mjs
// Geometry: Natural Earth 1:50m admin_0 countries (public domain). Each country is projected with an
// azimuthal equal-area projection centred on itself (so shapes look like they do on a globe and the
// antimeridian is a non-issue), fitted into the box and simplified with Douglas–Peucker (simplify-js).
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { geoAzimuthalEqualArea, geoArea, geoBounds, geoCentroid } from 'd3-geo';
import simplify from 'simplify-js';

const raw = fileURLToPath(new URL('./raw/', import.meta.url));
const ne = JSON.parse(await readFile(raw + 'ne_50m_admin_0_countries.geojson', 'utf8'));
const { countries } = JSON.parse(await readFile(new URL('../src/data/countries.json', import.meta.url), 'utf8'));

const SIZE = 512;
const PAD = 14;
const TOLERANCE = 0.9; // px in the 512 box

const byIso = new Map();
for (const f of ne.features) {
  const p = f.properties;
  const iso = p.ISO_A2_EH && p.ISO_A2_EH !== '-99' ? p.ISO_A2_EH : p.ISO_A2;
  if (iso && iso !== '-99' && !byIso.has(iso)) byIso.set(iso, f);
}

// Polygons to drop so the mainland shape stays readable (far-flung dependencies/islands).
// Each rule is a predicate on the polygon's [lng, lat] centroid.
const DROP = {
  FR: ([x, y]) => !(x > -10 && x < 15 && y > 40 && y < 52), // overseas departments
  NL: ([, y]) => y < 45, // Caribbean Netherlands
  NO: ([x, y]) => y > 72 || x < -3, // Svalbard, Jan Mayen, Bouvet
  ES: ([, y]) => y < 34, // Canary Islands
  PT: ([x]) => x < -12, // Azores (Madeira stays)
  US: ([x, y]) => (x < -157 && y < 25) || x > 0, // Hawaii and the far Aleutians; Alaska stays
  EC: ([x]) => x < -85, // Galápagos
  CL: ([x]) => x < -80, // Easter Island, Juan Fernández
  AU: ([x, y]) => x < 100 || y > -8, // Indian Ocean territories
  IN: ([x, y]) => x > 90 && y < 15, // Andaman & Nicobar keep? drop for a cleaner outline
  CO: ([x, y]) => x < -80 && y > 12, // San Andrés
  VE: ([x, y]) => y > 13,
  ZA: ([, y]) => y < -40, // Prince Edward Islands
  MU: ([x]) => x > 60, // Rodrigues stays close enough; drop Agaléga specks
  BR: ([x]) => x > -30,
  MX: ([x, y]) => x < -117 && y < 20,
  CR: ([x]) => x < -86.5,
  HN: ([x]) => x < -85 && false,
  NZ: ([x, y]) => x < 0 || y > -30 || y < -50,
  JP: ([x, y]) => (y < 25 && x < 135) || x > 154, // Ryukyu tail beyond, Ogasawara, Minamitorishima
  KR: ([, y]) => y < 33,
  DK: ([, y]) => y > 60,
  GB: ([x]) => x < -8.5 || x > 2,
  IT: ([x, y]) => y < 35.4 && x > 12, // Lampedusa/Pantelleria keep Sicily
  GR: ([x, y]) => y < 34.5,
  TR: () => false,
  RU: () => false,
  CA: ([, y]) => y > 84,
  MY: () => false,
  ID: () => false,
  PH: () => false,
  CN: ([x, y]) => y < 15, // South China Sea specks
  TW: ([x, y]) => x < 119 || y < 21.5 || y > 26,
  YE: ([x]) => x > 52 && false,
  OM: () => false,
  AE: () => false,
  SA: () => false,
  AR: ([x, y]) => x < -70 && y < -54, // keep Tierra del Fuego; drop far islands
  MA: () => false,
  TZ: () => false,
  GQ: ([x, y]) => y < 0, // Annobón
  ST: () => false,
  CV: () => false,
  KM: () => false,
  SC: ([x, y]) => x < 50 || y < -6, // outer islands
  MV: () => false,
  KI: () => false,
  FJ: ([x]) => x < 0 && x > -177, // keep Vanua Levu/Viti Levu and Lau; drop far Rotuma? (x≈177) keep
  TO: () => false,
  WS: () => false,
  PF: () => false,
  NC: () => false,
  PG: ([x]) => x > 158,
  SB: ([x]) => x > 170,
  VU: () => false,
  BS: () => false,
  TT: () => false,
  PA: () => false,
  HK: () => false,
  MO: () => false,
};

function polygons(geometry) {
  return geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
}
function polyArea(rings) {
  const a = geoArea({ type: 'Polygon', coordinates: rings });
  return Math.min(a, 4 * Math.PI - a);
}
function bboxDistance(a, b) {
  const dx = Math.max(0, a[0][0] - b[1][0], b[0][0] - a[1][0]);
  const dy = Math.max(0, a[0][1] - b[1][1], b[0][1] - a[1][1]);
  return Math.hypot(dx, dy);
}

const out = {};
let total = 0;
for (const c of countries) {
  const f = byIso.get(c.iso2);
  const polys = polygons(f.geometry).map((rings) => ({ rings, area: polyArea(rings), bbox: geoBounds({ type: 'Polygon', coordinates: rings }), centroid: geoCentroid({ type: 'Polygon', coordinates: rings }) }));
  polys.sort((a, b) => b.area - a.area);
  const main = polys[0];
  const diag = Math.hypot(main.bbox[1][0] - main.bbox[0][0], main.bbox[1][1] - main.bbox[0][1]);
  const maxDist = Math.max(1.5, 0.2 * diag);
  const drop = DROP[c.iso2];
  const keep = polys.filter((p, i) => {
    if (drop && drop(p.centroid)) return false;
    if (i === 0) return true;
    // Keep islands near the mainland, or any polygon that is a sizeable share of the country.
    return bboxDistance(main.bbox, p.bbox) <= maxDist || p.area >= 0.08 * main.area;
  });
  const multi = { type: 'MultiPolygon', coordinates: keep.map((p) => p.rings) };
  const centre = geoCentroid(multi);
  const proj = geoAzimuthalEqualArea().rotate([-centre[0], -centre[1]]).fitExtent([[PAD, PAD], [SIZE - PAD, SIZE - PAD]], multi);
  const parts = [];
  for (const p of keep) {
    for (const ring of p.rings) {
      const pts = ring.map(([x, y]) => { const q = proj([x, y]); return { x: q[0], y: q[1] }; });
      const s = simplify(pts, TOLERANCE, true);
      if (s.length < 4) continue;
      const xs = s.map((q) => q.x), ys = s.map((q) => q.y);
      const w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys);
      if (w < 2 && h < 2) continue; // specks
      parts.push('M' + s.map((q, i) => `${i ? 'L' : ''}${q.x.toFixed(1)} ${q.y.toFixed(1)}`).join('').replace(/\.0(?=[ L])/g, '') + 'Z');
    }
  }
  const d = parts.join('');
  out[c.iso2] = d;
  total += d.length;
}
const dest = fileURLToPath(new URL('../src/data/outlines.json', import.meta.url));
await writeFile(dest, JSON.stringify(out));
console.log(`[build-outlines] ${Object.keys(out).length} outlines, ${(total / 1024).toFixed(0)} KB of path data → src/data/outlines.json`);
