import { ALL_DEPARTMENTS, type Team } from '../types/api';

/**
 * Shared 5-slot department roster, used by both the CEO department-assignment
 * confirmation view and the CEO dashboard so the two never drift out of sync.
 */
export function TeamRosterGrid({ team }: { team: Team }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold text-slate-300">Team roster</h3>
        <span className="text-xs font-bold text-accent-400" data-testid="member-count">
          {team.members.length} / 5 MEMBERS
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
        {ALL_DEPARTMENTS.map((dept) => {
          const member = team.members.find((m) => m.slotDepartment === dept);
          const isCeo = member?.id === team.ceoId;
          return (
            <div
              key={dept}
              className={`rounded-xl p-3 text-center border ${
                member ? 'bg-primary-950 border-primary-700' : 'bg-slate-800 border-slate-700 border-dashed'
              }`}
            >
              <p className="text-xs font-bold text-slate-400">{dept}</p>
              <p className="text-sm mt-1 text-slate-100 truncate">
                {member ? (
                  <>
                    {member.fullName}
                    {isCeo && <span className="ml-1">👑</span>}
                  </>
                ) : (
                  'Available'
                )}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
