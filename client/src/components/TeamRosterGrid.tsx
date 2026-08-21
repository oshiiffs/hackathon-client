import { ALL_DEPARTMENTS, type Team } from '../types/api';

/**
 * Shared 5-slot department roster, used by both the CEO department-assignment
 * confirmation view and the CEO dashboard so the two never drift out of sync.
 */
export function TeamRosterGrid({ team }: { team: Team }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-black uppercase tracking-wide text-navy">Team roster</h3>
        <span className="text-xs font-black uppercase text-crimson" data-testid="member-count">
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
              className={`rounded-lg p-3 text-center border-[3px] ${
                member ? 'bg-lime/40 border-ink shadow-[3px_3px_0px_#111111]' : 'bg-white border-ink border-dashed'
              }`}
            >
              <p className="text-xs font-black uppercase text-forest">{dept}</p>
              <p className="text-sm mt-1 text-ink font-bold truncate">
                {member ? (
                  <>
                    {member.fullName}
                    {isCeo && <span className="ml-1">👑</span>}
                  </>
                ) : (
                  <span className="text-navy/40 font-medium">Available</span>
                )}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
