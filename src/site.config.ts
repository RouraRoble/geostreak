/**
 * Product-level configuration. Every product edits this file.
 * Keep values honest: they end up in metadata, structured data and legal pages.
 */
export const site = {
  name: 'GeoStreak',
  slug: 'geostreak',
  tagline: 'Three daily geography puzzles. One streak.',
  description: 'Guess the country from its outline, climb the capital ladder and pick the bigger country — three free daily geography games with one streak, plus a data page for every country.',
  locale: 'en',
  ogLocale: 'en_US',
  themeColor: '#0b1220',
  backgroundColor: '#0b1220',
  accent: '#f97316',
  author: { name: 'RouraRoble', url: 'https://github.com/RouraRoble' },
  contactEmail: 'roura.roble@gmail.com',
  launched: '2026-09-23',
  category: 'GameApplication', // schema.org SoftwareApplication applicationCategory
  keywords: [
    'geography game',
    'guess the country game',
    'country outline quiz',
    'capital cities quiz',
    'daily geography quiz',
    'country shape quiz',
  ] as string[],
  social: { twitter: '' },
  /** Days since this date = the puzzle number (UTC). */
  epoch: '2026-09-24',
  // Monetization / analytics hooks (all optional, env-driven at build time)
  adsenseClient: import.meta.env.PUBLIC_ADSENSE_CLIENT || '',
  beaconUrl: import.meta.env.PUBLIC_BEACON_URL || '',
  plausibleDomain: import.meta.env.PUBLIC_PLAUSIBLE_DOMAIN || '',
};
export type SiteConfig = typeof site;
