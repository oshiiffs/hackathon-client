import { useState } from 'react';
import { Link } from 'react-router-dom';
import { LoadingState, ErrorState } from '../../components/StateViews';
import { useParticipantDirectory } from '../../hooks/useParticipantDirectory';
import { DEPARTMENT_COLORS } from '../../lib/departmentColors';
import { getApiErrorMessage } from '../../lib/apiClient';
import type { Department, DirectoryParticipant } from '../../types/api';

function Avatar({ person }: { person: DirectoryParticipant }) {
  const accent = DEPARTMENT_COLORS[person.homeDepartment as Department] ?? '#0E1D3E';
  const initial = person.fullName.trim().charAt(0).toUpperCase() || '?';
  if (person.avatarUrl) {
    return (
      <img
        src={person.avatarUrl}
        alt={`${person.fullName}'s profile picture`}
        className="w-12 h-12 rounded-full object-cover border-[3px] border-ink"
        style={{ backgroundColor: accent }}
      />
    );
  }
  return (
    <div
      className="w-12 h-12 rounded-full flex items-center justify-center text-white font-black border-[3px] border-ink"
      style={{ backgroundColor: accent }}
    >
      {initial}
    </div>
  );
}

/** Browse-everyone directory (req: "view all information of other
 * participants before the CEO Challenge"). Read-only — profile editing lives
 * on each participant's own dashboard. */
export function ParticipantDirectoryPage() {
  const { data: people, isLoading, error, refetch } = useParticipantDirectory();
  const [search, setSearch] = useState('');

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
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-black uppercase tracking-wide text-ink">Participants</h2>
          <p className="text-sm font-bold text-navy">Everyone competing today.</p>
        </div>
        <Link to="/participant" className="text-xs font-black uppercase text-forest hover:text-crimson transition">
          ← Back to dashboard
        </Link>
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name, department, or skill…"
        className="w-full rounded-lg bg-white border-[3px] border-ink px-3 py-2 text-sm text-ink font-medium focus:outline-none focus:ring-2 focus:ring-crimson"
      />

      {isLoading && <LoadingState label="Loading participants…" />}
      {error && <ErrorState message={getApiErrorMessage(error)} onRetry={() => refetch()} />}

      {people && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((person) => (
            <div key={person.id} className="comic-panel-sm p-4 flex gap-3">
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
                  </div>
                )}
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="text-navy font-bold text-sm col-span-full text-center py-8">No participants match your search.</p>
          )}
        </div>
      )}
    </div>
  );
}
