import type { HeatCategory } from '../types/api';

/**
 * HEAT category branding assets (icons + post-finalization reveal videos),
 * sourced from the NEXUS MULTIVERSE brand kit. Centralized here — like
 * departmentColors.ts does for department accents — so both the icon and the
 * video mapping stay in exactly one place.
 *
 * Each icon is the source card cropped tight to its own alpha bounding box
 * (full rounded card + shadow + glyph, nothing chopped off) then padded to a
 * square canvas.
 *
 * The second HEAT category is EDUCATION (previously modeled as ENVIRONMENT —
 * renamed to match the brand kit's own "EDUCATION" icon caption, so there's
 * no more label mismatch to work around).
 *
 * Filenames carry a version suffix deliberately: files under public/ are
 * served by Vite/the CDN as-is (no content-hash fingerprinting like
 * processed assets get), so re-editing health.png/etc. in place while
 * iterating left browsers and Vercel's edge cache still serving old bytes
 * under the same unchanged URL. Bump the suffix again if these ever need
 * re-editing.
 */
export const HEAT_CATEGORY_ICONS: Record<HeatCategory, string> = {
  HEALTH: '/heat-icons/health-v3.png',
  EDUCATION: '/heat-icons/education-v1.png',
  AGRICULTURE: '/heat-icons/agriculture-v3.png',
  TOURISM: '/heat-icons/tourism-v3.png',
};

/** Played on the CEO's finalize screen once the team is finalized — see
 * FinalizedView in CeoFinalizePage.tsx. One real video per category, as
 * provided (not a shared/generic clip for all four). */
export const HEAT_CATEGORY_VIDEOS: Record<HeatCategory, string> = {
  HEALTH: '/videos/heat-health.mp4',
  EDUCATION: '/videos/heat-education.mp4',
  AGRICULTURE: '/videos/heat-agriculture.mp4',
  TOURISM: '/videos/heat-tourism.mp4',
};

/** The brand kit's catch-all clip — used for the pre-selection HEAT briefing
 * gate (see HeatCategoryVideoGate), which isn't category-specific since it
 * plays before a category is even chosen. */
export const HEAT_DEFAULT_VIDEO = '/videos/heat-default.mp4';
