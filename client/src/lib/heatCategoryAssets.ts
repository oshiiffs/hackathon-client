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
 * The second HEAT category is ENVIRONMENT (briefly modeled as EDUCATION —
 * reverted back). Icon #2's own source file in the brand kit ("2 (E).png")
 * currently reads "ENVIRONMENT" as its caption, so no label-mismatch
 * workaround (blanking/whitening the caption) is needed — same clean
 * full-card crop as the other three icons.
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
  ENVIRONMENT: '/heat-icons/environment-v6.png',
  AGRICULTURE: '/heat-icons/agriculture-v3.png',
  TOURISM: '/heat-icons/tourism-v3.png',
};

/** Played on the CEO's finalize screen once the team is finalized — see
 * FinalizedView in CeoFinalizePage.tsx. One real video per category, as
 * provided (not a shared/generic clip for all four). */
export const HEAT_CATEGORY_VIDEOS: Record<HeatCategory, string> = {
  HEALTH: '/videos/heat-health.mp4',
  ENVIRONMENT: '/videos/heat-environment.mp4',
  AGRICULTURE: '/videos/heat-agriculture.mp4',
  TOURISM: '/videos/heat-tourism.mp4',
};

/** The brand kit's catch-all clip — used for the pre-selection HEAT briefing
 * gate (see HeatCategoryVideoGate), which isn't category-specific since it
 * plays before a category is even chosen. */
export const HEAT_DEFAULT_VIDEO = '/videos/heat-default.mp4';
