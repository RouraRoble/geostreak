/**
 * Outline SVG data — split out of lib/countries.ts on purpose. `outlines.json` is ~450 KB and only
 * the Outline mode ever draws a silhouette; Capitals and Bigger-or-smaller only need country facts
 * (names, capitals, population, area). Keeping this in its own module means importing lib/countries
 * (as Capitals.tsx and Bigger.tsx do) no longer pulls the outline data into their client bundle.
 */
import outlinesData from '../data/outlines.json';
import { COUNTRIES, type Country } from './countries';

export const OUTLINES: Record<string, string> = outlinesData as Record<string, string>;

export function outlineFor(iso2: string): string {
  return OUTLINES[iso2.toUpperCase()] ?? '';
}

/** Countries with a recognisable land outline — used for the Outline mode's daily pool. */
export const OUTLINE_POOL: Country[] = COUNTRIES.filter((c) => c.daily && outlineFor(c.iso2).length > 0);
