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
const SPONSOR_HEIGHT = 'h-14 sm:h-16';
const SPONSORS: { src: string; alt: string; heightClass?: string }[] = [
  { src: '/sponsors/naga-city-seal.png', alt: 'City of Naga' },
  { src: '/sponsors/ncf.png', alt: 'Naga College Foundation' },
  { src: '/sponsors/dih.png', alt: 'Naga City Digital Innovation Hub' },
  { src: '/sponsors/naganext.png', alt: 'NagaNext' },
  { src: '/sponsors/tbi.png', alt: 'TBI' },
  { src: '/sponsors/idea2startup.png', alt: 'Idea2Startup', heightClass: 'h-24 sm:h-28' },
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
 */
export function Footer() {
  return (
    <footer className="border-t-[3px] border-ink bg-white mt-10" data-testid="site-footer">
      <div className="max-w-5xl mx-auto px-4 py-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-forest mb-2">Sponsors &amp; Partners</p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            {SPONSORS.map((s) => (
              <img key={s.src} src={s.src} alt={s.alt} className={`${s.heightClass ?? SPONSOR_HEIGHT} w-auto object-contain`} />
            ))}
          </div>
        </div>

        <div className="md:border-l-[3px] md:border-ink md:pl-6">
          <p className="text-xs font-black uppercase tracking-widest text-forest mb-1">
            Development Team <span className={`normal-case tracking-normal text-navy ${comicHeading}`}>· ANAYAG</span>
          </p>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs font-bold text-ink mt-1.5">
            {DEVELOPERS.map((name) => (
              <li key={name} className="flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-crimson shrink-0" aria-hidden="true" />
                {name}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] font-bold text-navy/60">
            Mentor · <span className="text-navy">John Roy Galvez</span>
          </p>
        </div>
      </div>

      <div className="border-t-[3px] border-ink bg-cream/40 py-2.5 text-center">
        <p className="text-[10px] font-bold uppercase tracking-wide text-navy/50">
          © {new Date().getFullYear()} Nexus Multiverse — Team Building &amp; Pitch App
        </p>
      </div>
    </footer>
  );
}
