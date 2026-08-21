import { NavLink } from 'react-router-dom';

export function NavTab({ to, end, children }: { to: string; end?: boolean; children: string }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `px-3 py-1.5 rounded-lg text-sm font-black uppercase tracking-wide border-[3px] transition-transform duration-100 hover:translate-x-0.5 hover:translate-y-0.5 ${
          isActive
            ? 'bg-crimson text-ink border-ink shadow-[3px_3px_0px_#111111]'
            : 'text-navy border-transparent hover:border-ink hover:bg-cream'
        }`
      }
    >
      {children}
    </NavLink>
  );
}
