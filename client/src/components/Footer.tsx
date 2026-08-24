import { comicHeading } from '../lib/comic';

/** Event sponsors/partners — logos copied byte-for-byte from the NEXUS
 * MULTIVERSE brand kit (`logos/` and `logos/partners/`), unaltered (verified
 * via matching md5 checksums against the source files — no crop/pad/resize
 * of the asset content itself). Each source file carries its own, quite
 * different amount of internal whitespace padding, so consistent on-screen
 * sizing here comes entirely from the display container (a fixed height +
 * object-contain below) — never from touching the files. */
// Most logos share the same display height, but idea2startup.png's own
// content is a short, wide wordmark sitting in a tall canvas with lots of
// vertical whitespace baked in — at the shared height it reads much smaller
// than the others, so it gets a taller box (still object-contain, so the
// wordmark itself just scales up within it — the file isn't touched).
const SPONSOR_HEIGHT = 'h-12 sm:h-14';
const SPONSORS: { src: string; alt: string; heightClass?: string }[] = [
  { src: '/sponsors/naga-city-seal.png', alt: 'City of Naga' },
  { src: '/sponsors/ncf.png', alt: 'Naga College Foundation' },
  { src: '/sponsors/dih.png', alt: 'Naga City Digital Innovation Hub' },
  { src: '/sponsors/naganext.png', alt: 'NagaNext' },
  { src: '/sponsors/tbi.png', alt: 'TBI' },
  { src: '/sponsors/idea2startup.png', alt: 'Idea2Startup', heightClass: 'h-16 sm:h-20' },
];

const DEVELOPERS = [
  'Daniel Bonito',
  'Joshua Rovic Sanota',
  'John Paul Cambiado',
  'Ray Lawrence Nodado',
  'Francine De La Torre',
  'Phoebe Marie Viñas',
];

/**
 * Site-wide footer — mounted once in AppShell (covers every authenticated
 * dashboard: Admin/Judge/Participant/CEO/Team) and once in LoginPage (the
 * one real page that doesn't use AppShell). Deliberately NOT mounted in
 * PresenterPage — that's a fullscreen projector/kiosk display, not a normal
 * page, and a footer there would just get in the way.
 *
 * Two columns (Sponsors left, Dev team right, divided by a vertical rule on
 * md+) kept tight: small section-label margins, a 2-col name grid so the six
 * names take three rows instead of six, and no copyright bar underneath —
 * the previous version's biggest source of extra height with the least
 * information in it. AppShell's own flex layout (not this component) is
 * what keeps the footer pinned to the true bottom of a short page with no
 * gap trailing it.
 */
export function Footer() {
  return (
    <footer className="border-t-[3px] border-ink bg-white mt-4" data-testid="site-footer">
      <div className="max-w-5xl mx-auto px-4 py-4 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-forest mb-2">Sponsors &amp; Partners</p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {SPONSORS.map((s) => (
              <img key={s.src} src={s.src} alt={s.alt} className={`${s.heightClass ?? SPONSOR_HEIGHT} w-auto object-contain`} />
            ))}
          </div>
        </div>

        <div className="md:border-l-[3px] md:border-ink md:pl-6">
          <p className="text-xs font-black uppercase tracking-widest text-forest mb-1.5">
            Development Team <span className={`normal-case tracking-normal text-navy ${comicHeading}`}>· ANAYAG</span>
          </p>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs font-bold text-ink">
            {DEVELOPERS.map((name) => (
              <li key={name} className="flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-crimson shrink-0" aria-hidden="true" />
                {name}
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-[11px] font-bold text-navy/60">
            Mentor · <span className="text-navy">John Roy Galvez</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
