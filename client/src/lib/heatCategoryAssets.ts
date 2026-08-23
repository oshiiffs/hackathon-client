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
 * provided (not a shared/generic clip for all four) — each is a short,
 * standalone "WELCOME OUR ___ HERO" clip with no shared intro/placeholder
 * text (unlike the older v1 set, which shared heat-default's full template
 * and needed the name-overlay treatment — see CeoFinalizePage.tsx's git
 * history if that's ever needed again for a future edit that reintroduces
 * one). Cropped from a pillarboxed 1920x1080 export back down to true
 * 1080x9:16-native (608x1080) portrait, which is also why these are a
 * fraction of the v1 files' size. */
export const HEAT_CATEGORY_VIDEOS: Record<HeatCategory, string> = {
  HEALTH: '/videos/heat-health-v2.mp4',
  ENVIRONMENT: '/videos/heat-environment-v2.mp4',
  AGRICULTURE: '/videos/heat-agriculture-v2.mp4',
  TOURISM: '/videos/heat-tourism-v2.mp4',
};

/** The brand kit's catch-all clip — used for the pre-selection HEAT briefing
 * gate (see HeatCategoryVideoGate), which isn't category-specific since it
 * plays before a category is even chosen. v2: the "(STARTUP)" placeholder
 * text baked into v1 was removed at the source (re-edited, not just cropped)
 * — see GREETING_NAME_WINDOW/SECTOR_NAME_WINDOW in CeoFinalizePage.tsx for
 * the current overlay timing/positioning measured against this file. Also
 * trimmed to end right after the HEAT letters reveal (v1's now-unused
 * "(SECTOR) HERO"/registration-CTA tail is gone). */
export const HEAT_DEFAULT_VIDEO = '/videos/heat-default-v2.mp4';
