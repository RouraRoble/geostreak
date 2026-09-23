import type { APIRoute } from 'astro';
import { renderOg } from '../../../lib/og';
import { COUNTRIES } from '../../../lib/countries';
import { outlineFor } from '../../../lib/outlines';

export function getStaticPaths() {
  return COUNTRIES.map((country) => ({ params: { slug: country.slug }, props: { country } }));
}

export const GET: APIRoute = async ({ props }) => {
  const { country } = props as { country: (typeof COUNTRIES)[number] };
  const subtitle = [country.capital ? `Capital: ${country.capital}` : null, `${country.continent}`, country.population ? `${country.population.toLocaleString()} people` : null]
    .filter(Boolean)
    .join(' · ');
  const png = await renderOg({
    // No emoji font is configured for satori, so a flag emoji here renders as a "NO GLYPH" tofu box
    // (see og.ts) — keep the title plain text; the country outline already carries the visual identity.
    title: country.name,
    subtitle,
    eyebrow: 'GeoStreak · Country data',
    outlinePath: outlineFor(country.iso2),
  });
  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
};
