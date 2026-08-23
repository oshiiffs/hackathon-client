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
const SPONSOR_HEIGHT = 'h-6 sm:h-7';
const SPONSORS: { src: string; alt: string; heightClass?: string }[] = [
  { src: '/sponsors/naga-city-seal.png', alt: 'City of Naga' },
  { src: '/sponsors/ncf.png', alt: 'Naga College Foundation' },
  { src: '/sponsors/dih.png', alt: 'Naga City Digital Innovation Hub' },
  { src: '/sponsors/naganext.png', alt: 'NagaNext' },
  { src: '/sponsors/tbi.png', alt: 'TBI' },
  { src: '/sponsors/idea2startup.png', alt: 'Idea2Startup', heightClass: 'h-10 sm:h-12' },
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
    <footer className="border-t-[3px] border-ink bg-white mt-6" data-testid="site-footer">
      <div className="max-w-5xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {SPONSORS.map((s) => (
            <img key={s.src} src={s.src} alt={s.alt} className={`${s.heightClass ?? SPONSOR_HEIGHT} w-auto object-contain`} />
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[10px] font-bold text-ink/70">
          <span className="uppercase tracking-widest text-forest font-black">Dev</span>
          <span className={`normal-case tracking-normal text-navy ${comicHeading}`}>ANAYAG</span>
          <span aria-hidden="true">·</span>
          {DEVELOPERS.map((name, i) => (
            <span key={name}>
              {name}
              {i < DEVELOPERS.length - 1 ? ',' : ''}
            </span>
          ))}
          <span aria-hidden="true">·</span>
          <span>Mentor: John Roy Galvez</span>
        </div>
      </div>

      <div className="border-t-[3px] border-ink bg-cream/40 py-1 text-center">
        <p className="text-[9px] font-bold uppercase tracking-wide text-navy/50">
          © {new Date().getFullYear()} Team Building &amp; Pitch App
        </p>
      </div>
    </footer>
  );
}
