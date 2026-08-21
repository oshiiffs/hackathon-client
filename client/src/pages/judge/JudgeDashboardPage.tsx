import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '../../components/Badge';
import { comicHeading } from '../../lib/comic';
import { useJudgeTeams } from '../../hooks/useJudge';
import type { EvaluationStatus } from '../../types/api';

const STATUS_FILTERS: { label: string; value: EvaluationStatus | 'ALL' }[] = [
  { label: 'ALL', value: 'ALL' },
  { label: 'NOT STARTED', value: 'NOT_STARTED' },
  { label: 'IN PROGRESS', value: 'IN_PROGRESS' },
  { label: 'SUBMITTED', value: 'SUBMITTED' },
];

const STATUS_TONE: Record<EvaluationStatus, 'neutral' | 'warning' | 'success'> = {
  NOT_STARTED: 'neutral',
  IN_PROGRESS: 'warning',
  SUBMITTED: 'success',
};

export function JudgeDashboardPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<EvaluationStatus | 'ALL'>('ALL');
  const teams = useJudgeTeams({
    search: search.trim() || undefined,
    status: statusFilter === 'ALL' ? undefined : statusFilter,
  });

  return (
    <div className="flex flex-col gap-6" data-testid="judge-dashboard">
      <section className="comic-panel p-6">
        <span className="absolute -top-3 -left-3 w-6 h-6 border-[3px] border-ink bg-gold" aria-hidden="true" />
        <h1 className={`text-xl ${comicHeading}`}>JUDGE DASHBOARD</h1>
        <p className="text-sm font-bold text-navy mt-1" data-testid="judge-team-count">
          Teams to evaluate: {teams.data?.length ?? '—'}
        </p>

        <input
          data-testid="judge-search-input"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search teams…"
          className="mt-4 w-full rounded-lg bg-white border-[3px] border-ink px-3 py-2 text-sm text-ink font-medium focus:outline-none focus:ring-2 focus:ring-crimson"
        />

        <div className="flex flex-wrap gap-2 mt-3">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              data-testid={`judge-filter-${f.value}`}
              onClick={() => setStatusFilter(f.value)}
              className={`text-xs font-black uppercase px-3 py-1.5 rounded-full border-[3px] border-ink transition-transform duration-100 hover:translate-x-0.5 hover:translate-y-0.5 ${
                statusFilter === f.value ? 'bg-crimson text-ink shadow-[3px_3px_0px_#111111]' : 'bg-white text-navy hover:bg-cream'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </section>

      <section className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {teams.data?.map((team) => (
          <div key={team.id} className="comic-panel p-5 flex flex-col gap-3" data-testid={`judge-team-card-${team.id}`}>
            <div>
              <p className="font-black text-ink">{team.name ?? '(unnamed)'}</p>
              <p className="text-crimson text-xs font-black uppercase">{team.category}</p>
            </div>
            <p className="text-xs font-bold text-navy">{team.memberCount} / 5 MEMBERS</p>
            <p className="text-xs font-bold text-navy">CEO: {team.ceo.name}</p>
            <div className="flex items-center justify-between mt-auto pt-2">
              <div>
                <p className="text-[10px] text-forest uppercase font-black">Evaluation</p>
                <Badge tone={STATUS_TONE[team.evaluationStatus]}>{team.evaluationStatus.replace('_', ' ')}</Badge>
              </div>
              <Link
                to={`/judge/teams/${team.id}`}
                data-testid={team.evaluationStatus === 'SUBMITTED' ? `judge-view-button-${team.id}` : `judge-evaluate-button-${team.id}`}
                className="text-sm px-3 py-1.5 rounded-lg border-[3px] border-ink bg-forest text-cream font-black uppercase shadow-[3px_3px_0px_#111111] transition-transform duration-100 hover:translate-x-0.5 hover:translate-y-0.5"
              >
                {team.evaluationStatus === 'SUBMITTED' ? 'VIEW' : 'EVALUATE'}
              </Link>
            </div>
          </div>
        ))}
        {teams.data?.length === 0 && (
          <p className="text-sm font-bold text-navy col-span-full" data-testid="judge-empty-state">
            No teams match your search/filter.
          </p>
        )}
      </section>
    </div>
  );
}
