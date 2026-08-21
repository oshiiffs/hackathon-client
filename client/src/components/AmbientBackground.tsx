/**
 * Shared ambient background — halftone dot texture plus two soft drifting
 * brand-color glows, used as the base background treatment across every
 * screen for the "Retro Comic Book / Pop-Art" look. `fixed` (not
 * `absolute`) so it's positioned purely relative to the viewport and never
 * needs `overflow-hidden` on an ancestor — that would break `position:
 * sticky` headers (e.g. AppShell's).
 *
 * The `-z-10` only stays behind things within the nearest ancestor that
 * establishes its own stacking context — every wrapper that renders this
 * must have `isolate` on it, or the wrapper's own opaque background (a
 * plain non-positioned div) paints later in the root stacking context and
 * covers it entirely.
 */
export function AmbientBackground() {
  return (
    <>
      <div
        className="pointer-events-none fixed inset-0 -z-10 halftone opacity-70"
        style={{ backgroundColor: '#F8F9FA' }}
        aria-hidden="true"
      />
      <div className="pointer-events-none fixed -top-40 -left-32 w-[36rem] h-[36rem] rounded-full bg-gold/25 blur-[120px] animate-drift-a -z-10" />
      <div className="pointer-events-none fixed -bottom-48 -right-32 w-[40rem] h-[40rem] rounded-full bg-lime/30 blur-[120px] animate-drift-b -z-10" />
    </>
  );
}
