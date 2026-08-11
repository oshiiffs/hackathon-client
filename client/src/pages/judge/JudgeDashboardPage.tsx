import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '../../components/Badge';
import { useJudgeTeams } from '../../hooks/useJudge';
import type { EvaluationStatus } from '../../types/api';

const STATUS_FILTERS: { label: string; value: EvaluationStatus | 'ALL' }[] = [
  { label: 'ALL', value: 'ALL' },
  { label: 'NOT STARTED', value: 'NOT_STARTED' },
  { label: 'IN PROGRESS', value: 'IN_PROGRESS' },
  { label: 'SUBMITTED', value: 'SUBMITTED' },
];

const STATUS_TONE: Record<EvaluationStatus, 'neutral' | 'gold' | 'primary'> = {
  NOT_STARTED: 'neutral',
  IN_PROGRESS: 'gold',
  SUBMITTED: 'primary',
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
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <h1 className="text-xl font-black text-slate-100">JUDGE DASHBOARD</h1>
        <p className="text-sm text-slate-400 mt-1" data-testid="judge-team-count">
          Teams to evaluate: {teams.data?.length ?? '—'}
        </p>

        <input
          data-testid="judge-search-input"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search teams…"
          className="mt-4 w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
        />

        <div className="flex flex-wrap gap-2 mt-3">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              data-testid={`judge-filter-${f.value}`}
              onClick={() => setStatusFilter(f.value)}
              className={`text-xs font-bold uppercase px-3 py-1.5 rounded-full border transition ${
                statusFilter === f.value
                  ? 'bg-primary-600 border-primary-600 text-white'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </section>

      <section className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {teams.data?.map((team) => (
          <div
            key={team.id}
            className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col gap-3"
            data-testid={`judge-team-card-${team.id}`}
          >
            <div>
              <p className="font-bold text-slate-100">{team.name ?? '(unnamed)'}</p>
              <p className="text-accent-400 text-xs font-semibold">{team.category}</p>
            </div>
            <p className="text-xs text-slate-500">{team.memberCount} / 5 MEMBERS</p>
            <p className="text-xs text-slate-500">CEO: {team.ceo.name}</p>
            <div className="flex items-center justify-between mt-auto pt-2">
              <div>
                <p className="text-[10px] text-slate-500 uppercase font-semibold">Evaluation</p>
                <Badge tone={STATUS_TONE[team.evaluationStatus]}>{team.evaluationStatus.replace('_', ' ')}</Badge>
              </div>
              <Link
                to={`/judge/teams/${team.id}`}
                data-testid={team.evaluationStatus === 'SUBMITTED' ? `judge-view-button-${team.id}` : `judge-evaluate-button-${team.id}`}
                className="text-sm px-3 py-1.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-semibold"
              >
                {team.evaluationStatus === 'SUBMITTED' ? 'VIEW' : 'EVALUATE'}
              </Link>
            </div>
          </div>
        ))}
        {teams.data?.length === 0 && (
          <p className="text-sm text-slate-500 col-span-full" data-testid="judge-empty-state">
            No teams match your search/filter.
          </p>
        )}
      </section>
    </div>
  );
}
