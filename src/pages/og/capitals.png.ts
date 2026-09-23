import type { APIRoute } from 'astro';
import { renderOg } from '../../lib/og';

export const GET: APIRoute = async () => {
  const png = await renderOg({ title: 'Capital Ladder', subtitle: 'Ten rounds a day matching capitals to countries.', eyebrow: 'GeoStreak · Mode 2' });
  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
};
