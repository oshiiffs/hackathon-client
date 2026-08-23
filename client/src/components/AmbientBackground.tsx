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
 *
 * Perf note (this mounts on nearly every screen — AppShell, login,
 * presenter, every loading/error state — so it runs continuously for the
 * whole session, not just briefly): a large CSS `blur()` filter is one of
 * the most GPU-expensive things a browser can be asked to redo every frame,
 * and animating `transform` on a blurred element can force exactly that —
 * re-blurring on every frame instead of blurring once and cheaply moving
 * the result — unless the browser is told ahead of time to promote it to
 * its own compositing layer. `will-change-transform` does that: the blur is
 * rendered once onto a GPU layer, and the 18-22s drift animation then just
 * translates/scales that already-blurred texture, which is what actually
 * makes a permanent animated blur affordable on a mid-range phone instead
 * of a constant background tax competing with everything else on the page
 * (video playback, real-time updates, ...). The blur radius was also
 * brought down from 120px to 80px — blur cost grows sharply with radius, so
 * this is a real reduction, not just a visual tweak, while keeping the same
 * soft-glow look. `prefers-reduced-motion` (see index.css) pauses the drift
 * animation entirely for anyone whose OS asks for that, which is also a
 * legitimate perf/battery win on top of being the correct accessibility
 * behavior.
 */
export function AmbientBackground() {
  return (
    <>
      <div
        className="pointer-events-none fixed inset-0 -z-10 halftone opacity-70"
        style={{ backgroundColor: '#F8F9FA' }}
        aria-hidden="true"
      />
      <div className="pointer-events-none fixed -top-40 -left-32 w-[36rem] h-[36rem] rounded-full bg-gold/25 blur-[80px] will-change-transform animate-drift-a -z-10" />
      <div className="pointer-events-none fixed -bottom-48 -right-32 w-[40rem] h-[40rem] rounded-full bg-lime/30 blur-[80px] will-change-transform animate-drift-b -z-10" />
    </>
  );
}
