import type { Department } from '../types/api';

// Distinct accent per department, used to color-code QR badges (and anywhere
// else a department needs to be told apart at a glance) — no equivalent
// token existed anywhere in the codebase before this. Plain hex, not Tailwind
// utility classes: these are inlined as CSS custom properties/styles, not
// picked from the `primary`/`accent`/`neutral` semantic scale in index.css,
// since that scale has no notion of "department."
// Colors only — department full names aren't defined anywhere in this
// codebase, so this deliberately doesn't guess at them.
export const DEPARTMENT_COLORS: Record<Department, string> = {
  COE: '#3B82F6', // blue
  CCS: '#8B5CF6', // violet
  CHS: '#F43F5E', // rose
  CBM: '#F59E0B', // amber
  CAF: '#10B981', // emerald
};
