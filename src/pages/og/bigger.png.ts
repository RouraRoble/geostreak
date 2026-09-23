import type { APIRoute } from 'astro';
import { renderOg } from '../../lib/og';

export const GET: APIRoute = async () => {
  const png = await renderOg({ title: 'Bigger or Smaller', subtitle: 'Pick the country with the bigger population or area.', eyebrow: 'GeoStreak · Mode 3' });
  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
};
