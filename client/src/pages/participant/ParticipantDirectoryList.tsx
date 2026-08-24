import { useState } from 'react';
import { Badge } from '../../components/Badge';
import { LoadingState, ErrorState } from '../../components/StateViews';
import { useParticipantDirectory } from '../../hooks/useParticipantDirectory';
import { DEPARTMENT_COLORS } from '../../lib/departmentColors';
import { getApiErrorMessage } from '../../lib/apiClient';
import type { Department, DirectoryParticipant } from '../../types/api';

function Avatar({ person, size = 48 }: { person: DirectoryParticipant; size?: number }) {
  const accent = DEPARTMENT_COLORS[person.homeDepartment as Department] ?? '#0E1D3E';
  const initial = person.fullName.trim().charAt(0).toUpperCase() || '?';
  if (person.avatarUrl) {
    return (
      <img
        src={person.avatarUrl}
        alt={`${person.fullName}'s profile picture`}
        className="rounded-full object-cover border-[3px] border-ink shrink-0"
        style={{ backgroundColor: accent, width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="rounded-full flex items-center justify-center text-white font-black border-[3px] border-ink shrink-0"
      style={{ backgroundColor: accent, width: size, height: size, fontSize: size / 2.5 }}
    >
      {initial}
    </div>
  );
}

/** Full-detail view for one participant — the untruncated bio and complete
 * skills list (the grid card below clips both for density), opened by
 * clicking a card. Layered above the directory list itself rather than
 * navigating anywhere, since the list is already inside a pop-up. */
function ParticipantDetailModal({ person, onClose }: { person: DirectoryParticipant; onClose: () => void }) {
  return (
    <div
      className="absolute inset-0 z-10 flex items-center justify-center bg-ink/70 px-4 py-6 rounded-[inherit]"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="comic-panel w-full max-w-sm max-h-full overflow-y-auto p-6"
        style={{ boxShadow: '6px 6px 0px #111111' }}
        onClick={(e) => e.stopPropagation()}
        data-testid="participant-detail-modal"
      >
        <span className="absolute -top-3 -left-3 w-6 h-6 border-[3px] border-ink bg-gold" aria-hidden="true" />
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar person={person} size={64} />
            <div className="min-w-0">
              <p className="text-ink font-black truncate">{person.fullName}</p>
              {person.nickname && <p className="text-navy/50 text-xs truncate">"{person.nickname}"</p>}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 shrink-0 rounded-lg border-[3px] border-ink bg-white hover:bg-cream font-black text-ink"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-4">
          <span className="text-xs font-black uppercase" style={{ color: DEPARTMENT_COLORS[person.homeDepartment] }}>
            {person.homeDepartment}
          </span>
          {person.role === 'CEO' && <Badge tone="gold">CEO</Badge>}
        </div>

        <div className="mb-4">
          <p className="text-xs font-black uppercase text-forest mb-1">Bio</p>
          <p className="text-sm text-navy whitespace-pre-wrap">{person.bio || <span className="text-navy/40">Not set</span>}</p>
        </div>

        <div>
          <p className="text-xs font-black uppercase text-forest mb-1">Skills</p>
          {person.skills.length === 0 ? (
            <p className="text-sm text-navy/40">None added</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {person.skills.map((skill) => (
                <span key={skill} className="rounded-full bg-cream border-2 border-ink text-ink px-2 py-0.5 text-xs font-bold">
                  {skill}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Browse-everyone directory (req: "view all information of other
 * participants before the CEO Challenge"). Read-only — profile editing lives
 * on each participant's own dashboard. Rendered inside a pop-up from the
 * participant dashboard (see ParticipantDashboardPage) rather than its own
 * route, so this is just the search input + results grid — no page-level
 * chrome (heading/back link) of its own. */
export function ParticipantDirectoryList() {
  const { data: people, isLoading, error, refetch } = useParticipantDirectory();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<DirectoryParticipant | null>(null);

  const filtered = (people ?? []).filter((p) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      p.fullName.toLowerCase().includes(q) ||
      (p.nickname?.toLowerCase().includes(q) ?? false) ||
      p.homeDepartment.toLowerCase().includes(q) ||
      p.skills.some((s) => s.toLowerCase().includes(q))
    );
  });

  return (
    <div className="relative flex flex-col gap-4 min-h-0 flex-1">
      <input
        autoFocus
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name, department, or skill…"
        className="w-full shrink-0 rounded-lg bg-white border-[3px] border-ink px-3 py-2 text-sm text-ink font-medium focus:outline-none focus:ring-2 focus:ring-crimson"
      />

      {isLoading && <LoadingState label="Loading participants…" />}
      {error && <ErrorState message={getApiErrorMessage(error)} onRetry={() => refetch()} />}

      {people && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 overflow-y-auto min-h-0 flex-1">
          {filtered.map((person) => (
            <button
              type="button"
              key={person.id}
              onClick={() => setSelected(person)}
              data-testid={`directory-card-${person.id}`}
              className="comic-panel-sm p-4 flex gap-3 text-left transition-transform duration-100 hover:translate-x-0.5 hover:translate-y-0.5"
            >
              <Avatar person={person} />
              <div className="min-w-0 flex-1">
                <p className="text-ink font-black truncate">{person.fullName}</p>
                {person.nickname && <p className="text-navy/50 text-xs truncate">"{person.nickname}"</p>}
                <p className="text-xs font-black mt-0.5" style={{ color: DEPARTMENT_COLORS[person.homeDepartment] }}>
                  {person.homeDepartment}
                  {person.role === 'CEO' && ' · CEO'}
                </p>
                {person.bio && <p className="text-navy text-xs mt-1.5 line-clamp-2">{person.bio}</p>}
                {person.skills.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {person.skills.slice(0, 4).map((skill) => (
                      <span key={skill} className="rounded-full bg-cream border-2 border-ink text-ink px-2 py-0.5 text-[10px] font-bold">
                        {skill}
                      </span>
                    ))}
                    {person.skills.length > 4 && (
                      <span className="text-[10px] font-bold text-navy/50 self-center">+{person.skills.length - 4} more</span>
                    )}
                  </div>
                )}
                <p className="text-[10px] font-bold uppercase text-forest/70 mt-2">Click to view complete info</p>
              </div>
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="text-navy font-bold text-sm col-span-full text-center py-8">No participants match your search.</p>
          )}
        </div>
      )}

      {selected && <ParticipantDetailModal person={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
