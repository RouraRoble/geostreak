// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import preact from '@astrojs/preact';

// SITE and BASE are injected by CI (see .github/workflows/deploy.yml).
// Locally they default to a root deployment so `npm run dev` works without env.
const SITE = process.env.SITE || 'https://rouraroble.github.io';
const BASE = '/' + (process.env.BASE || '').replace(/^[\/]+|[\/]+$/g, '');

export default defineConfig({
  site: SITE,
  base: BASE,
  trailingSlash: 'always',
  compressHTML: true,
  build: { format: 'directory', inlineStylesheets: 'auto' },
  prefetch: { prefetchAll: false, defaultStrategy: 'hover' },
  integrations: [
    preact(),
    sitemap({
      filter: (page) => !/\/404\/?$/.test(page) && !/\/country\/people-s-republic-of-china\/?$/.test(page),
      changefreq: 'weekly',
      priority: 0.7,
      lastmod: new Date(),
    }),
  ],
  security: {
    csp: {
      directives: [
        "default-src 'self'",
        "img-src 'self' data: https:",
        "font-src 'self' data:",
        "connect-src 'self' https:",
        "base-uri 'self'",
        "form-action 'self'",
        "object-src 'none'",
        'upgrade-insecure-requests',
      ],
      styleDirective: { resources: ["'self'", "'unsafe-inline'"] },
      scriptDirective: { resources: ["'self'"] },
    },
  },
  vite: { build: { cssMinify: true } },
});
