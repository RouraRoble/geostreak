/**
 * Build-time Open Graph image generation (1200x630 PNG) with satori + sharp.
 * Usage in an endpoint: `return new Response(await renderOg({ title, subtitle }), { headers: { 'Content-Type': 'image/png' } })`
 */
import satori from 'satori';
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { site } from '../site.config';

const require = createRequire(import.meta.url);
let fontCache: { bold: Buffer; regular: Buffer } | null = null;

async function fonts() {
  if (!fontCache) {
    const bold = await readFile(require.resolve('@fontsource/inter/files/inter-latin-800-normal.woff'));
    const regular = await readFile(require.resolve('@fontsource/inter/files/inter-latin-400-normal.woff'));
    fontCache = { bold, regular };
  }
  return fontCache;
}

export interface OgOptions {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  accent?: string;
  bg?: string;
  fg?: string;
  /** An SVG path `d` string in a 512×512 viewBox (e.g. a country outline) drawn on the right. */
  outlinePath?: string;
}

// satori accepts React-like element objects; we build them without JSX.
const h = (type: string, props: Record<string, unknown>, ...children: unknown[]) => ({
  type,
  props: { ...props, children: children.length === 0 ? undefined : children.length === 1 ? children[0] : children },
});

export async function renderOg(opts: OgOptions): Promise<Buffer> {
  const { bold, regular } = await fonts();
  const accent = opts.accent ?? site.accent;
  const bg = opts.bg ?? '#0b1220';
  const fg = opts.fg ?? '#ffffff';
  const title = opts.title.length > 90 ? opts.title.slice(0, 87) + '…' : opts.title;
  const titleSize = title.length > 60 ? 52 : title.length > 36 ? 64 : 76;

  const outline = opts.outlinePath
    ? h(
        'svg',
        { width: 340, height: 340, viewBox: '0 0 512 512', style: { position: 'absolute', right: '40px', top: '145px', opacity: 0.9 } },
        h('path', { d: opts.outlinePath, fill: accent }),
      )
    : null;

  const tree = h(
    'div',
    {
      style: {
        width: '1200px',
        height: '630px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '64px 72px',
        background: `linear-gradient(135deg, ${bg} 0%, ${bg} 70%, ${accent} 230%)`,
        color: fg,
        fontFamily: 'Inter',
        position: 'relative',
      },
    },
    outline,
    h(
      'div',
      { style: { display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '700px' } },
      h('div', { style: { fontSize: 26, fontWeight: 400, opacity: 0.85, letterSpacing: 2, textTransform: 'uppercase' } }, opts.eyebrow ?? site.name),
      h('div', { style: { fontSize: titleSize, fontWeight: 800, lineHeight: 1.08, letterSpacing: -2 } }, title),
      opts.subtitle ? h('div', { style: { fontSize: 30, fontWeight: 400, opacity: 0.85, lineHeight: 1.35 } }, opts.subtitle) : '',
    ),
    h(
      'div',
      { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 26 } },
      h(
        'div',
        { style: { display: 'flex', alignItems: 'center', gap: '14px', fontWeight: 800 } },
        h('div', { style: { width: 22, height: 22, borderRadius: 6, background: accent } }),
        h('div', { style: { display: 'flex' } }, site.name),
      ),
      h('div', { style: { display: 'flex', opacity: 0.7 } }, 'Free · No sign-up'),
    ),
  );

  const svg = await satori(tree as never, {
    width: 1200,
    height: 630,
    fonts: [
      { name: 'Inter', data: bold, weight: 800, style: 'normal' },
      { name: 'Inter', data: regular, weight: 400, style: 'normal' },
    ],
  });
  return sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
}
