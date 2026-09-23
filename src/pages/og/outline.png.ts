import type { APIRoute } from 'astro';
import { renderOg } from '../../lib/og';

export const GET: APIRoute = async () => {
  const png = await renderOg({ title: 'Outline', subtitle: 'Guess the country from its shape — 6 guesses a day.', eyebrow: 'GeoStreak · Mode 1' });
  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
};
