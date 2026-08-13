import { useState } from 'react';
import { Badge } from '../../components/Badge';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { CeoQuestionsPanel } from './CeoQuestionsPanel';
import {
  useAdminDeliverables,
  useAdminEvaluations,
  useAdminHackathonState,
  useAdminOverview,
  useAdminParticipants,
  useAdminTeams,
  useCompleteEvent,
  useCreateParticipant,
  useCreateStaff,
  useDeleteParticipant,
  useExportEventData,
  useLockParticipants,
  useLockSubmissions,
  useOpenSubmissions,
  useRegenerateAccessCode,
  useResetCompetition,
  useStartCeoChallenge,
  useStopCeoChallenge,
  useUnlockParticipants,
  useUpdateParticipant,
} from '../../hooks/useAdmin';
import { ALL_DEPARTMENTS, type Department, type HackathonPhase } from '../../types/api';
import { getApiErrorMessage } from '../../lib/apiClient';

type PendingAction = { title: string; description: string; confirmLabel: string; tone?: 'primary' | 'danger'; run: () => void };

function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function AdminDashboardPage() {
  const { data: state } = useAdminHackathonState();
  const overview = useAdminOverview();
  const teams = useAdminTeams();
  const participants = useAdminParticipants();
  const deliverables = useAdminDeliverables();
  const evaluations = useAdminEvaluations();

  const lockParticipants = useLockParticipants();
  const unlockParticipants = useUnlockParticipants();
  const startChallenge = useStartCeoChallenge();
  const stopChallenge = useStopCeoChallenge();
  const openSubmissions = useOpenSubmissions();
  const lockSubmissions = useLockSubmissions();
  const completeEvent = useCompleteEvent();
  const createParticipant = useCreateParticipant();
  const createStaff = useCreateStaff();
  const updateParticipant = useUpdateParticipant();
  const deleteParticipant = useDeleteParticipant();
  const regenerateCode = useRegenerateAccessCode();
  const exportEventData = useExportEventData();
  const resetCompetition = useResetCompetition();

  const [duration, setDuration] = useState(30);
  const [ceoSlots, setCeoSlots] = useState(4);
  const [newName, setNewName] = useState('');
  const [newDept, setNewDept] = useState<Department>('COE');
  const [newAccessCode, setNewAccessCode] = useState('');
  const [lastCreated, setLastCreated] = useState<{ fullName: string; accessCode: string } | null>(null);
  const [revealedCode, setRevealedCode] = useState<{ id: string; fullName: string; accessCode: string } | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);

  const [staffName, setStaffName] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [staffPassword, setStaffPassword] = useState('');
  const [staffRole, setStaffRole] = useState<'JUDGE' | 'ADMIN'>('JUDGE');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDept, setEditDept] = useState<Department>('COE');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; fullName: string } | null>(null);

  const phase: HackathonPhase | undefined = state?.phase;
  // Mirrors the backend's transition table for UX only — the server is the
  // real authority and rejects invalid transitions regardless of this.
  const canStartChallenge = phase === 'LOBBY' || phase === 'DRAFTING';
  const canStopChallenge = phase === 'CEO_CHALLENGE_ACTIVE';
  const canOpenSubmissions = phase === 'DRAFTING' || phase === 'SUBMISSIONS_LOCKED';
  const canLockSubmissions = phase === 'SUBMISSIONS_OPEN';
  const canComplete = phase === 'SUBMISSIONS_LOCKED';
  const canStartNewCompetition = phase === 'COMPLETE';

  const availableParticipants = overview.data ? overview.data.undraftedParticipants : undefined;

  async function handleStartNewCompetition() {
    const data = await exportEventData.mutateAsync();
    downloadJson(data, `hackathon-archive-${new Date().toISOString().slice(0, 10)}.json`);
    setPendingAction({
      title: 'Start a new competition?',
      description: `An archive was just downloaded (${data.participants.length} participants, ${data.teams.length} teams, ${data.judgeScores.length} evaluations). Continuing permanently deletes all of it — participants, teams, submissions, and judge scores — and resets the event back to the lobby. Admin/Judge accounts are kept.`,
      confirmLabel: 'Delete & start new competition',
      tone: 'danger',
      run: () => resetCompetition.mutate(undefined),
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Current phase" value={state?.phaseLabel ?? '—'} accent />
        <Stat
          label="Participants"
          value={overview.data ? `${overview.data.draftedParticipants}/${overview.data.totalParticipants}` : '—'}
          sub="drafted / total"
        />
        <Stat label="Teams" value={overview.data ? `${overview.data.finalizedTeams}/${overview.data.totalTeams}` : '—'} sub="finalized / total" />
        <Stat label="Connected now" value={state?.connectedParticipants ?? '—'} sub="participant clients" />
      </section>

      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Available" value={availableParticipants ?? '—'} sub="not yet drafted" />
        <Stat label="Drafted" value={overview.data?.draftedParticipants ?? '—'} sub="on a team" />
        <Stat label="Device lock" value={state?.participantsLocked ? 'LOCKED' : 'UNLOCKED'} sub="participant kiosk" />
        <Stat label="Submissions" value={state?.submissionsLocked ? 'LOCKED' : 'OPEN'} sub="team hub uploads" />
      </section>

      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <h2 className="text-lg font-bold text-slate-100 mb-4">Main Controller</h2>

        <div className="flex flex-wrap items-center gap-3 mb-5 pb-5 border-b border-slate-800">
          <span className="text-sm text-slate-400 mr-1">Device lock:</span>
          <Badge tone={state?.participantsLocked ? 'danger' : 'primary'}>
            {state?.participantsLocked ? 'Locked' : 'Unlocked'}
          </Badge>
          <button
            onClick={() => lockParticipants.mutate(undefined)}
            disabled={lockParticipants.isPending || state?.participantsLocked}
            className="rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-100 text-sm font-semibold px-4 py-2 transition"
          >
            Lock participants
          </button>
          <button
            onClick={() => unlockParticipants.mutate(undefined)}
            disabled={unlockParticipants.isPending || state?.participantsLocked === false}
            className="rounded-lg bg-primary-600 hover:bg-primary-700 disabled:opacity-40 text-white text-sm font-semibold px-4 py-2 transition"
          >
            Unlock participants
          </button>
        </div>

        <div className="mb-5 pb-5 border-b border-slate-800">
          <div className="flex items-center gap-2 mb-3">
            <p className="text-sm text-slate-400">CEO Challenge</p>
            <span className="text-xs text-slate-500">
              · Eligible participants: {overview.data?.eligibleCeoParticipants ?? '—'} · Active questions:{' '}
              {overview.data?.activeCeoQuestionCount ?? '—'}
            </span>
            <Badge tone={overview.data?.ceoQuestionsReady ? 'primary' : 'danger'}>
              {overview.data?.ceoQuestionsReady ? 'READY' : 'NOT READY'}
            </Badge>
          </div>
          {overview.data && !overview.data.ceoQuestionsReady && (
            <p className="text-xs text-accent-400 mb-3">
              At least 10 active CEO challenge questions are required to start — manage the question bank below.
            </p>
          )}
          <div className="flex flex-wrap items-end gap-4">
            <label className="text-sm text-slate-300">
              Duration (sec)
              <input
                type="number"
                min={5}
                max={600}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                disabled={!canStartChallenge}
                className="mt-1 w-28 rounded-lg bg-slate-800 border border-slate-700 px-2 py-1.5 text-slate-100 disabled:opacity-50"
              />
            </label>
            <label className="text-sm text-slate-300">
              CEO slots this round
              <input
                type="number"
                min={1}
                max={12}
                value={ceoSlots}
                onChange={(e) => setCeoSlots(Number(e.target.value))}
                disabled={!canStartChallenge}
                className="mt-1 w-28 rounded-lg bg-slate-800 border border-slate-700 px-2 py-1.5 text-slate-100 disabled:opacity-50"
              />
            </label>
            <button
              disabled={!canStartChallenge || !overview.data?.ceoQuestionsReady || startChallenge.isPending}
              onClick={() =>
                setPendingAction({
                  title: 'Start the CEO challenge?',
                  description: `This unlocks every participant device immediately and starts a ${duration}-second timed quiz (${overview.data?.activeCeoQuestionCount ?? 0} questions). The top ${ceoSlots} scorers become CEOs once the round ends.`,
                  confirmLabel: 'Start challenge',
                  run: () => startChallenge.mutate({ durationSeconds: duration, ceoSlots }),
                })
              }
              className="rounded-lg bg-primary-600 hover:bg-primary-700 disabled:opacity-40 text-white font-semibold px-4 py-2 text-sm transition"
            >
              Start CEO challenge
            </button>
            <button
              disabled={!canStopChallenge || stopChallenge.isPending}
              onClick={() =>
                setPendingAction({
                  title: 'Stop the CEO challenge?',
                  description: 'This immediately ends the round and promotes the top scorers among everyone who has submitted so far.',
                  confirmLabel: 'Stop challenge',
                  tone: 'danger',
                  run: () => stopChallenge.mutate(undefined),
                })
              }
              className="rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-100 font-semibold px-4 py-2 text-sm transition"
            >
              Stop CEO challenge
            </button>
          </div>
        </div>

        <div>
          <p className="text-sm text-slate-400 mb-3">Submissions &amp; event lifecycle</p>
          <div className="flex flex-wrap gap-3">
            <button
              disabled={!canOpenSubmissions || openSubmissions.isPending}
              onClick={() => openSubmissions.mutate(undefined)}
              className="rounded-lg bg-primary-600 hover:bg-primary-700 disabled:opacity-40 text-white font-semibold px-4 py-2 text-sm transition"
            >
              Open submissions
            </button>
            <button
              disabled={!canLockSubmissions || lockSubmissions.isPending}
              onClick={() =>
                setPendingAction({
                  title: 'Lock submissions?',
                  description: 'Teams will no longer be able to upload logos, pitch decks, or edit deliverable links.',
                  confirmLabel: 'Lock submissions',
                  tone: 'danger',
                  run: () => lockSubmissions.mutate(undefined),
                })
              }
              className="rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-100 font-semibold px-4 py-2 text-sm transition"
            >
              Lock submissions
            </button>
            <button
              disabled={!canComplete || completeEvent.isPending}
              onClick={() => completeEvent.mutate(undefined)}
              className="rounded-lg bg-accent-500 hover:bg-accent-400 disabled:opacity-40 text-slate-950 font-semibold px-4 py-2 text-sm transition"
            >
              Mark event complete
            </button>
          </div>
        </div>

        {canStartNewCompetition && (
          <div className="mt-5 pt-5 border-t border-slate-800">
            <p className="text-sm text-slate-400 mb-1">New competition</p>
            <p className="text-xs text-slate-500 mb-3 max-w-md">
              Archives the current event (downloaded as JSON) then permanently deletes its participants, teams,
              submissions, and judge scores, and resets the event back to the lobby.
            </p>
            <button
              disabled={exportEventData.isPending || resetCompetition.isPending}
              onClick={() => void handleStartNewCompetition()}
              className="rounded-lg bg-red-700 hover:bg-red-600 disabled:opacity-40 text-white font-semibold px-4 py-2 text-sm transition"
            >
              {exportEventData.isPending ? 'Archiving…' : 'Start new competition'}
            </button>
          </div>
        )}
      </section>

      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <h2 className="text-lg font-bold text-slate-100 mb-4">HEAT Category Capacity</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {overview.data?.categoryUsage.map((c) => (
            <div key={c.category} className="bg-slate-800 rounded-xl p-3 text-center">
              <p className="text-xs font-bold text-slate-400">{c.category}</p>
              <p className="text-lg font-black text-slate-100">
                {c.used}/{c.capacity}
              </p>
              {c.full && <p className="text-[10px] font-bold text-accent-400 mt-0.5">FULL</p>}
            </div>
          ))}
        </div>
      </section>

      <CeoQuestionsPanel />

      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <h2 className="text-lg font-bold text-slate-100 mb-4">People</h2>

        <div className="grid lg:grid-cols-2 gap-6">
          <div className="lg:border-r lg:border-slate-800 lg:pr-6">
            <h3 className="text-sm font-bold text-slate-300 mb-3">Register a participant</h3>
            <form
              className="flex flex-wrap items-end gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                createParticipant.mutate(
                  { fullName: newName, homeDepartment: newDept, accessCode: newAccessCode.trim() || undefined },
                  {
                    onSuccess: (data) => {
                      setLastCreated({ fullName: data.fullName, accessCode: data.accessCode });
                      setNewName('');
                      setNewAccessCode('');
                    },
                  },
                );
              }}
            >
              <label className="text-sm text-slate-300">
                Full name
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="mt-1 block rounded-lg bg-slate-800 border border-slate-700 px-2 py-1.5 text-slate-100"
                />
              </label>
              <label className="text-sm text-slate-300">
                Department
                <select
                  value={newDept}
                  onChange={(e) => setNewDept(e.target.value as Department)}
                  className="mt-1 block rounded-lg bg-slate-800 border border-slate-700 px-2 py-1.5 text-slate-100"
                >
                  {ALL_DEPARTMENTS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-slate-300">
                Access code (optional)
                <input
                  value={newAccessCode}
                  onChange={(e) => setNewAccessCode(e.target.value)}
                  placeholder="auto-generated"
                  className="mt-1 block w-36 rounded-lg bg-slate-800 border border-slate-700 px-2 py-1.5 text-slate-100 font-mono"
                />
              </label>
              <button
                type="submit"
                disabled={createParticipant.isPending || newName.trim().length < 2}
                className="rounded-lg bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white font-semibold px-4 py-2 text-sm"
              >
                Add
              </button>
            </form>
            {lastCreated && (
              <p className="mt-3 text-sm text-primary-400">
                Created {lastCreated.fullName} — access code:{' '}
                <span className="font-mono font-bold">{lastCreated.accessCode}</span>
              </p>
            )}
            {createParticipant.isError && (
              <p className="text-sm text-red-400 mt-2">{getApiErrorMessage(createParticipant.error)}</p>
            )}
          </div>

          <div>
            <h3 className="text-sm font-bold text-slate-300 mb-3">Create staff account</h3>
            <form
              className="flex flex-col gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                createStaff.mutate(
                  { fullName: staffName, email: staffEmail, password: staffPassword, role: staffRole },
                  {
                    onSuccess: () => {
                      setStaffName('');
                      setStaffEmail('');
                      setStaffPassword('');
                    },
                  },
                );
              }}
            >
              <div className="flex flex-wrap gap-3">
                <label className="text-sm text-slate-300 flex-1 min-w-[10rem]">
                  Full name
                  <input
                    value={staffName}
                    onChange={(e) => setStaffName(e.target.value)}
                    className="mt-1 block w-full rounded-lg bg-slate-800 border border-slate-700 px-2 py-1.5 text-slate-100"
                  />
                </label>
                <label className="text-sm text-slate-300">
                  Role
                  <select
                    value={staffRole}
                    onChange={(e) => setStaffRole(e.target.value as 'JUDGE' | 'ADMIN')}
                    className="mt-1 block rounded-lg bg-slate-800 border border-slate-700 px-2 py-1.5 text-slate-100"
                  >
                    <option value="JUDGE">Judge</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </label>
              </div>
              <div className="flex flex-wrap gap-3">
                <label className="text-sm text-slate-300 flex-1 min-w-[10rem]">
                  Email
                  <input
                    type="email"
                    value={staffEmail}
                    onChange={(e) => setStaffEmail(e.target.value)}
                    className="mt-1 block w-full rounded-lg bg-slate-800 border border-slate-700 px-2 py-1.5 text-slate-100"
                  />
                </label>
                <label className="text-sm text-slate-300 flex-1 min-w-[10rem]">
                  Temporary password
                  <input
                    type="text"
                    value={staffPassword}
                    onChange={(e) => setStaffPassword(e.target.value)}
                    className="mt-1 block w-full rounded-lg bg-slate-800 border border-slate-700 px-2 py-1.5 text-slate-100"
                  />
                </label>
              </div>
              <button
                type="submit"
                disabled={
                  createStaff.isPending ||
                  staffName.trim().length < 2 ||
                  !staffEmail.includes('@') ||
                  staffPassword.length < 8
                }
                className="self-start rounded-lg bg-accent-500 hover:bg-accent-400 disabled:opacity-50 text-slate-950 font-black px-4 py-2 text-sm transition"
              >
                {createStaff.isPending ? 'Creating…' : `Create ${staffRole === 'JUDGE' ? 'judge' : 'admin'} account`}
              </button>
              {createStaff.isError && <p className="text-sm text-red-400">{getApiErrorMessage(createStaff.error)}</p>}
            </form>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-slate-800">
          <h3 className="text-sm font-bold text-slate-300 mb-3">All participants</h3>
          <div className="max-h-72 overflow-y-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-slate-500 text-xs uppercase">
                <tr>
                  <th className="py-1">Name</th>
                  <th>Dept</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {participants.data?.map((p) => {
                  const isEditing = editingId === p.id;
                  return (
                    <tr key={p.id} className="border-t border-slate-800 text-slate-300">
                      {isEditing ? (
                        <>
                          <td className="py-1.5">{p.fullName}</td>
                          <td className="pr-2">
                            <select
                              autoFocus
                              value={editDept}
                              onChange={(e) => setEditDept(e.target.value as Department)}
                              className="rounded-md bg-slate-800 border border-slate-700 px-2 py-1 text-slate-100"
                            >
                              {ALL_DEPARTMENTS.map((d) => (
                                <option key={d} value={d}>
                                  {d}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>{p.role}</td>
                          <td>undrafted</td>
                          <td className="text-right whitespace-nowrap">
                            <button
                              disabled={updateParticipant.isPending}
                              onClick={() =>
                                updateParticipant.mutate(
                                  { id: p.id, homeDepartment: editDept },
                                  { onSuccess: () => setEditingId(null) },
                                )
                              }
                              className="text-primary-400 hover:text-primary-300 disabled:opacity-40 font-semibold text-xs mr-3"
                            >
                              Save
                            </button>
                            <button onClick={() => setEditingId(null)} className="text-slate-400 hover:text-slate-200 text-xs">
                              Cancel
                            </button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="py-1.5">{p.fullName}</td>
                          <td>{p.homeDepartment}</td>
                          <td>{p.role}</td>
                          <td>{p.drafted ? `on team (${p.slotDepartment})` : 'undrafted'}</td>
                          <td className="text-right whitespace-nowrap">
                            <button
                              disabled={regenerateCode.isPending}
                              onClick={() =>
                                regenerateCode.mutate(p.id, {
                                  onSuccess: (data) => setRevealedCode(data),
                                })
                              }
                              className="text-accent-400 hover:text-accent-300 disabled:opacity-40 font-semibold text-xs mr-3"
                            >
                              Get code
                            </button>
                            {p.drafted ? (
                              <span className="text-slate-600 text-xs">locked</span>
                            ) : (
                              <>
                                <button
                                  onClick={() => {
                                    setEditingId(p.id);
                                    setEditDept(p.homeDepartment);
                                  }}
                                  className="text-primary-400 hover:text-primary-300 font-semibold text-xs mr-3"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => setDeleteTarget({ id: p.id, fullName: p.fullName })}
                                  className="text-red-400 hover:text-red-300 font-semibold text-xs"
                                >
                                  Delete
                                </button>
                              </>
                            )}
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {updateParticipant.isError && (
            <p className="text-sm text-red-400 mt-2">{getApiErrorMessage(updateParticipant.error)}</p>
          )}
          {revealedCode && (
            <p className="mt-3 text-sm text-accent-400 flex items-center gap-2">
              {revealedCode.fullName}&apos;s login code:{' '}
              <span className="font-mono font-bold">{revealedCode.accessCode}</span>
              <button
                onClick={() => setRevealedCode(null)}
                className="text-slate-500 hover:text-slate-300 text-xs font-semibold"
              >
                dismiss
              </button>
            </p>
          )}
        </div>
      </section>

      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <h2 className="text-lg font-bold text-slate-100 mb-4">Teams</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          {teams.data?.map((team) => {
            const status = deliverables.data?.find((d) => d.teamId === team.id);
            const evalStatus = evaluations.data?.find((e) => e.teamId === team.id);
            return (
              <div key={team.id} className="bg-slate-800 rounded-xl p-3" data-testid={`admin-team-${team.id}`}>
                <p className="font-bold text-slate-100">{team.name ?? '(unnamed draft)'}</p>
                <p className="text-xs text-slate-400">
                  {team.category ?? 'no category'} · {team.members.length}/5 members ·{' '}
                  {team.finalizedAt ? 'finalized' : 'in progress'} · CEO: {team.ceo.fullName}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {team.members.map((m) => `${m.slotDepartment}: ${m.fullName}`).join(' · ')}
                </p>
                <p className="text-xs text-accent-400 mt-1 font-semibold">
                  Project: {(team.deliverable?.status ?? 'DRAFT').replace(/_/g, ' ')}
                </p>
                {status && (
                  <p className="text-xs text-slate-400 mt-1" data-testid={`admin-team-${team.id}-deliverables`}>
                    Pitch deck: {status.pitchDeck.status === 'UPLOADED' ? `v${status.pitchDeck.latestVersion}` : 'not uploaded'}
                    {' · '}
                    Docs: {status.documentation.status === 'UPLOADED' ? `${status.documentation.count} file(s)` : 'none'}
                  </p>
                )}
                {evalStatus && (
                  <p className="text-xs text-primary-400 mt-1" data-testid={`admin-team-${team.id}-evaluations`}>
                    Evaluations: {evalStatus.evaluationsSubmitted}/{evalStatus.totalJudges} submitted
                    {evalStatus.evaluationsInProgress > 0 ? ` · ${evalStatus.evaluationsInProgress} in progress` : ''}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <ConfirmDialog
        open={pendingAction !== null}
        title={pendingAction?.title ?? ''}
        description={pendingAction?.description}
        confirmLabel={pendingAction?.confirmLabel}
        tone={pendingAction?.tone}
        pending={startChallenge.isPending || stopChallenge.isPending || lockSubmissions.isPending}
        onCancel={() => setPendingAction(null)}
        onConfirm={() => {
          pendingAction?.run();
          setPendingAction(null);
        }}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Remove this participant?"
        description={deleteTarget ? `${deleteTarget.fullName} will be permanently removed. This cannot be undone.` : undefined}
        confirmLabel="Remove"
        tone="danger"
        pending={deleteParticipant.isPending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deleteParticipant.mutate(deleteTarget.id);
          setDeleteTarget(null);
        }}
      />
    </div>
  );
}

function Stat({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: boolean }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
      <p className="text-xs uppercase text-slate-500 font-semibold">{label}</p>
      <p className={`text-2xl font-black ${accent ? 'text-accent-400' : 'text-slate-100'}`}>{value}</p>
      {sub && <p className="text-[10px] text-slate-500">{sub}</p>}
    </div>
  );
}
