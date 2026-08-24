import { useRef, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { Badge } from '../../components/Badge';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { CeoQuestionsPanel } from './CeoQuestionsPanel';
import { comicButton, comicHeading, comicHeadingSm, comicLink } from '../../lib/comic';
import { DEPARTMENT_COLORS } from '../../lib/departmentColors';
import {
  useAdminDeletePitchDeckVersion,
  useAdminDeleteTeam,
  useAdminDeleteTeamFile,
  useAdminDeliverables,
  useAdminEvaluations,
  useAdminHackathonState,
  useAdminLeaderboard,
  useAdminOverview,
  useAdminParticipants,
  useAdminParticipantQr,
  useAdminStaff,
  useAdminTeamResources,
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
  useSetAllowIncompleteTeams,
  useSetFinalizeTimers,
  useStartCeoChallenge,
  useStopCeoChallenge,
  useUnlockParticipants,
  useUpdateParticipant,
  useUpdateStaff,
  useDeleteStaff,
  useFetchParticipantBadges,
  useDiagnoseRawDelivery,
  useMigrateRawAuth,
} from '../../hooks/useAdmin';
import type { AdminParticipant, DiagnoseRawDeliveryResult, MigrateRawAuthResult } from '../../hooks/useAdmin';
import { downloadParticipantBadgesPdf } from '../../lib/participantBadges';
import { ALL_DEPARTMENTS, type Department, type HackathonPhase } from '../../types/api';
import { getApiErrorMessage } from '../../lib/apiClient';
import { useAuthStore } from '../../store/authStore';

type PendingAction = { title: string; description: string; confirmLabel: string; tone?: 'primary' | 'danger'; run: () => void };

const tableInput = 'w-full rounded-md bg-white border-2 border-ink px-2 py-1 text-ink font-medium focus:outline-none focus:ring-2 focus:ring-crimson';
const fieldInput = 'mt-1 block rounded-lg bg-white border-[3px] border-ink px-2 py-1.5 text-ink font-medium focus:outline-none focus:ring-2 focus:ring-crimson';

function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function downloadCanvasPng(canvas: HTMLCanvasElement | null, filename: string) {
  if (!canvas) return;
  const link = document.createElement('a');
  link.href = canvas.toDataURL('image/png');
  link.download = filename;
  link.click();
}

/** A participant's QR badge, viewable/downloadable from the admin's
 * participant list — e.g. to reprint a lost or damaged physical badge.
 * Rendered as its own fixed, full-viewport overlay (stacked above the
 * participant-list pop-up) rather than nested inside that pop-up's own
 * box — the list panel's height shrinks/grows with its table content, so
 * anchoring the QR card to it (as a plain `absolute inset-0`) let a short
 * table squeeze the QR/text out of a too-small area. Anchoring to the
 * viewport instead guarantees room regardless of how tall the list panel
 * happens to be. */
function ParticipantQrModal({
  participant,
  onClose,
}: {
  participant: { id: string; fullName: string; homeDepartment: Department };
  onClose: () => void;
}) {
  const qr = useAdminParticipantQr(participant.id);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const accent = DEPARTMENT_COLORS[participant.homeDepartment] ?? '#0E1D3E';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 px-4 py-6"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="comic-panel relative w-full max-w-xs max-h-[90vh] overflow-y-auto p-6 flex flex-col items-center gap-4 text-center"
        style={{ boxShadow: '6px 6px 0px #111111' }}
        onClick={(e) => e.stopPropagation()}
        data-testid="admin-participant-qr-modal"
      >
        <span className="absolute -top-3 -left-3 w-6 h-6 border-[3px] border-ink bg-gold" aria-hidden="true" />
        <div className="w-full flex items-center justify-between">
          <p className="text-xs font-black uppercase text-forest">Participant QR</p>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 shrink-0 rounded-lg border-[3px] border-ink bg-white hover:bg-cream font-black text-ink"
          >
            ✕
          </button>
        </div>

        {qr.isLoading && <p className="text-sm font-bold text-navy py-8">Loading…</p>}
        {qr.isError && (
          <div className="py-6 flex flex-col items-center gap-2">
            <p className="text-sm font-bold text-crimson">Couldn&apos;t load this QR code.</p>
            <p className="text-xs text-navy/60">{getApiErrorMessage(qr.error)}</p>
            <button onClick={() => qr.refetch()} className={comicButton('white', 'xs')}>
              Retry
            </button>
          </div>
        )}

        {qr.data && (
          <>
            <div className="p-3 bg-white border-[3px] border-ink rounded-lg">
              <QRCodeCanvas ref={canvasRef} value={qr.data.qrPayload} size={200} level="M" fgColor="#111111" />
            </div>
            <div>
              <p className="text-ink font-black">{participant.fullName}</p>
              <p className="text-sm font-black mt-0.5" style={{ color: accent }}>
                {participant.homeDepartment}
              </p>
            </div>
            <button
              onClick={() => downloadCanvasPng(canvasRef.current, `${participant.fullName.replace(/\s+/g, '-').toLowerCase()}-qr.png`)}
              className={comicButton('forest', 'sm')}
            >
              Download PNG
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Everything the old always-visible table row used to show (role, team
 * status) plus its actions (get code, view QR, edit department, delete) —
 * moved here so the list itself can stay to just Name + Dept.
 */
function ParticipantDetailModal({
  participant,
  onClose,
  onOpenQr,
  onGetCode,
  gettingCode,
  onDelete,
}: {
  participant: AdminParticipant;
  onClose: () => void;
  onOpenQr: () => void;
  onGetCode: () => void;
  gettingCode: boolean;
  onDelete: () => void;
}) {
  const updateParticipant = useUpdateParticipant();
  const [dept, setDept] = useState(participant.homeDepartment);
  const deptChanged = dept !== participant.homeDepartment;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 px-4 py-6"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="comic-panel relative w-full max-w-sm p-6 flex flex-col gap-3"
        style={{ boxShadow: '6px 6px 0px #111111' }}
        onClick={(e) => e.stopPropagation()}
        data-testid="admin-participant-detail-modal"
      >
        <span className="absolute -top-3 -left-3 w-6 h-6 border-[3px] border-ink bg-gold" aria-hidden="true" />
        <div className="flex items-center justify-between">
          <p className="text-xs font-black uppercase text-forest">Participant</p>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 shrink-0 rounded-lg border-[3px] border-ink bg-white hover:bg-cream font-black text-ink"
          >
            ✕
          </button>
        </div>

        <h3 className="text-lg font-black text-ink">{participant.fullName}</h3>

        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-forest text-xs uppercase font-black">Role</dt>
            <dd className="text-ink font-bold mt-0.5">{participant.role}</dd>
          </div>
          <div>
            <dt className="text-forest text-xs uppercase font-black">Status</dt>
            <dd className="text-ink font-bold mt-0.5">
              {participant.drafted ? `On team (${participant.slotDepartment})` : 'Undrafted'}
            </dd>
          </div>
        </dl>

        <div>
          <label className="text-forest text-xs uppercase font-black">Department</label>
          <div className="flex items-center gap-2 mt-1">
            <select
              disabled={participant.drafted}
              value={dept}
              onChange={(e) => setDept(e.target.value as Department)}
              className={tableInput}
            >
              {ALL_DEPARTMENTS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            {deptChanged && !participant.drafted && (
              <button
                disabled={updateParticipant.isPending}
                onClick={() => updateParticipant.mutate({ id: participant.id, homeDepartment: dept })}
                className={`${comicLink} disabled:opacity-40 text-xs`}
              >
                Save
              </button>
            )}
          </div>
          {participant.drafted && <p className="text-xs text-navy/40 mt-1">Locked — already on a team.</p>}
          {updateParticipant.isError && <p className="text-xs font-bold text-crimson mt-1">{getApiErrorMessage(updateParticipant.error)}</p>}
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-3 border-t-2 border-ink/10">
          <button disabled={gettingCode} onClick={onGetCode} className={`${comicButton('white', 'sm')} disabled:opacity-40`}>
            Get code
          </button>
          <button onClick={onOpenQr} className={comicButton('white', 'sm')}>
            View QR
          </button>
          {participant.drafted ? (
            <span className="text-navy/40 text-xs font-bold">Locked — can&apos;t be removed once on a team.</span>
          ) : (
            <button onClick={onDelete} className="text-crimson hover:text-ink font-black uppercase text-xs ml-auto">
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function AdminDashboardPage() {
  const { data: state } = useAdminHackathonState();
  const overview = useAdminOverview();
  const teams = useAdminTeams();
  const participants = useAdminParticipants();
  const staff = useAdminStaff();
  const deliverables = useAdminDeliverables();
  const evaluations = useAdminEvaluations();
  const leaderboard = useAdminLeaderboard();

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
  const setAllowIncompleteTeams = useSetAllowIncompleteTeams();
  const setFinalizeTimers = useSetFinalizeTimers();

  const [resourcesTeamId, setResourcesTeamId] = useState<string | null>(null);
  const teamResources = useAdminTeamResources(resourcesTeamId);
  const deleteTeamFile = useAdminDeleteTeamFile();
  const deletePitchDeckVersion = useAdminDeletePitchDeckVersion();
  const deleteTeam = useAdminDeleteTeam();
  const [evaluationsTeamId, setEvaluationsTeamId] = useState<string | null>(null);
  const [deleteTeamTarget, setDeleteTeamTarget] = useState<{ id: string; name: string | null } | null>(null);

  const currentUser = useAuthStore((s) => s.user);
  const updateStaff = useUpdateStaff();
  const deleteStaff = useDeleteStaff();

  const [duration, setDuration] = useState(30);
  const [ceoSlots, setCeoSlots] = useState(4);
  const [ceoNameSeconds, setCeoNameSeconds] = useState(60);
  const [heatCategorySeconds, setHeatCategorySeconds] = useState(30);
  const [newName, setNewName] = useState('');
  const [newDept, setNewDept] = useState<Department>('COE');
  const [newAccessCode, setNewAccessCode] = useState('');
  const [lastCreated, setLastCreated] = useState<{ fullName: string; accessCode: string } | null>(null);
  const [revealedCode, setRevealedCode] = useState<{ id: string; fullName: string; accessCode: string } | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [qrTarget, setQrTarget] = useState<{ id: string; fullName: string; homeDepartment: Department } | null>(null);

  const [staffName, setStaffName] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [staffPassword, setStaffPassword] = useState('');
  const [staffRole, setStaffRole] = useState<'JUDGE' | 'ADMIN'>('JUDGE');

  const [deleteTarget, setDeleteTarget] = useState<{ id: string; fullName: string } | null>(null);
  const [detailTarget, setDetailTarget] = useState<AdminParticipant | null>(null);

  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
  const [editStaffName, setEditStaffName] = useState('');
  const [editStaffEmail, setEditStaffEmail] = useState('');
  const [editStaffRole, setEditStaffRole] = useState<'ADMIN' | 'JUDGE'>('JUDGE');
  const [deleteStaffTarget, setDeleteStaffTarget] = useState<{ id: string; fullName: string } | null>(null);

  const [showParticipantList, setShowParticipantList] = useState(false);
  const fetchBadges = useFetchParticipantBadges();
  const [badgesError, setBadgesError] = useState<string | null>(null);

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
        <Stat label="Current phase" value={state?.phaseLabel?.replace(/_/g, ' ') ?? '—'} accent />
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

      <section className="comic-panel p-6">
        <span className="absolute -top-3 -left-3 w-6 h-6 border-[3px] border-ink bg-gold" aria-hidden="true" />
        <h2 className={`text-lg mb-4 ${comicHeading}`}>Main Controller</h2>

        <div className="flex flex-wrap items-center gap-3 mb-5 pb-5 border-b-[3px] border-ink">
          <span className="text-sm text-navy font-bold mr-1">Device lock:</span>
          <Badge tone={state?.participantsLocked ? 'danger' : 'success'}>
            {state?.participantsLocked ? 'Locked' : 'Unlocked'}
          </Badge>
          <button
            onClick={() => lockParticipants.mutate(undefined)}
            disabled={lockParticipants.isPending || state?.participantsLocked}
            className={comicButton('white', 'sm')}
          >
            Lock participants
          </button>
          <button
            onClick={() => unlockParticipants.mutate(undefined)}
            disabled={unlockParticipants.isPending || state?.participantsLocked === false}
            className={comicButton('crimson', 'sm')}
          >
            Unlock participants
          </button>

          <span className="w-1 h-6 bg-ink mx-1" />

          <span className="text-sm text-navy font-bold">Incomplete teams:</span>
          <Badge tone={state?.allowIncompleteTeams ? 'success' : 'neutral'}>
            {state?.allowIncompleteTeams ? 'Allowed' : 'Not allowed'}
          </Badge>
          <button
            onClick={() => setAllowIncompleteTeams.mutate(!state?.allowIncompleteTeams)}
            disabled={setAllowIncompleteTeams.isPending}
            title="Worst-case escape hatch: lets CEOs finalize with fewer than 5 members if recruitment ran short."
            className={comicButton('white', 'sm')}
          >
            {state?.allowIncompleteTeams ? 'Require full rosters' : 'Allow incomplete rosters'}
          </button>
        </div>

        <div className="mb-5 pb-5 border-b-[3px] border-ink">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <p className="text-sm font-bold text-navy">CEO Challenge</p>
            <span className="text-xs text-navy/60">
              · Eligible participants: {overview.data?.eligibleCeoParticipants ?? '—'} · Active questions:{' '}
              {overview.data?.activeCeoQuestionCount ?? '—'}
            </span>
            <Badge tone={overview.data?.ceoQuestionsReady ? 'success' : 'danger'}>
              {overview.data?.ceoQuestionsReady ? 'READY' : 'NOT READY'}
            </Badge>
          </div>
          {overview.data && !overview.data.ceoQuestionsReady && (
            <p className="text-xs font-bold text-forest mb-3">
              At least 10 active CEO challenge questions are required to start — manage the question bank below.
            </p>
          )}
          <div className="flex flex-wrap items-end gap-4">
            <label className="text-sm text-navy font-bold">
              Seconds per topic
              <input
                type="number"
                min={5}
                max={600}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                disabled={!canStartChallenge}
                className={`${fieldInput} w-28 disabled:opacity-50`}
              />
            </label>
            <label className="text-sm text-navy font-bold">
              CEO slots this round
              <input
                type="number"
                min={1}
                max={12}
                value={ceoSlots}
                onChange={(e) => setCeoSlots(Number(e.target.value))}
                disabled={!canStartChallenge}
                className={`${fieldInput} w-28 disabled:opacity-50`}
              />
            </label>
            <button
              disabled={!canStartChallenge || !overview.data?.ceoQuestionsReady || startChallenge.isPending}
              onClick={() => {
                const topicCount = overview.data?.activeCeoQuestionCount ?? 0;
                setPendingAction({
                  title: 'Start the CEO challenge?',
                  description: `This unlocks every participant device immediately. All ${topicCount} topics play in sync for everyone, ${duration}s each plus a 5s answer reveal (~${Math.round(((duration + 5) * topicCount) / 60)} min total). The top ${ceoSlots} scorers become CEOs once the round ends.`,
                  confirmLabel: 'Start challenge',
                  run: () => startChallenge.mutate({ durationSeconds: duration, ceoSlots }),
                });
              }}
              className={comicButton('crimson')}
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
              className={comicButton('white')}
            >
              Stop CEO challenge
            </button>
          </div>
        </div>

        <div className="mb-5 pb-5 border-b-[3px] border-ink">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <p className="text-sm font-bold text-navy">Team Finalization Timers</p>
            <span className="text-xs text-navy/60">
              · Currently active: {state?.ceoNameSelectionSeconds ?? '—'}s name · {state?.heatCategorySelectionSeconds ?? '—'}s
              category
            </span>
          </div>
          <p className="text-xs text-navy/60 mb-3 max-w-md">
            Every CEO's finalize screen is buttonless — a team's name locks in and HEAT category auto-finalizes purely on these
            countdowns. Changing a duration here only affects a team's timer that hasn't started yet.
          </p>
          <div className="flex flex-wrap items-end gap-4">
            <label className="text-sm text-navy font-bold">
              CEO Name Selection (seconds)
              <input
                type="number"
                min={5}
                max={600}
                value={ceoNameSeconds}
                onChange={(e) => setCeoNameSeconds(Number(e.target.value))}
                className={`${fieldInput} w-28`}
              />
            </label>
            <label className="text-sm text-navy font-bold">
              HEAT Category Selection (seconds)
              <input
                type="number"
                min={5}
                max={600}
                value={heatCategorySeconds}
                onChange={(e) => setHeatCategorySeconds(Number(e.target.value))}
                className={`${fieldInput} w-28`}
              />
            </label>
            <button
              disabled={setFinalizeTimers.isPending}
              onClick={() =>
                setFinalizeTimers.mutate({ ceoNameSelectionSeconds: ceoNameSeconds, heatCategorySelectionSeconds: heatCategorySeconds })
              }
              className={comicButton('crimson')}
            >
              Save timers
            </button>
          </div>
        </div>

        <div>
          <p className="text-sm font-bold text-navy mb-3">Submissions &amp; event lifecycle</p>
          <div className="flex flex-wrap gap-3">
            <button
              disabled={!canOpenSubmissions || openSubmissions.isPending}
              onClick={() => openSubmissions.mutate(undefined)}
              className={comicButton('crimson')}
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
              className={comicButton('white')}
            >
              Lock submissions
            </button>
            <button
              disabled={!canComplete || completeEvent.isPending}
              onClick={() => completeEvent.mutate(undefined)}
              className={comicButton('forest')}
            >
              Mark event complete
            </button>
          </div>
        </div>

        {canStartNewCompetition && (
          <div className="mt-5 pt-5 border-t-[3px] border-ink">
            <p className="text-sm font-bold text-navy mb-1">New competition</p>
            <p className="text-xs text-navy/60 mb-3 max-w-md">
              Archives the current event (downloaded as JSON), then permanently deletes its teams, submissions, and
              judge scores, and resets the event back to the lobby. Participant and CEO accounts (badge codes, QR
              codes, profiles) are kept — everyone logs back in with the same badge for the next event.
            </p>
            <button
              disabled={exportEventData.isPending || resetCompetition.isPending}
              onClick={() => void handleStartNewCompetition()}
              className={comicButton('crimson')}
            >
              {exportEventData.isPending ? 'Archiving…' : 'Start new competition'}
            </button>
          </div>
        )}
      </section>

      <CloudinaryMaintenancePanel />

      <section className="comic-panel p-6">
        <span className="absolute -top-3 -left-3 w-6 h-6 border-[3px] border-ink bg-lime" aria-hidden="true" />
        <h2 className={`text-lg mb-4 ${comicHeading}`}>HEAT Category Capacity</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {overview.data?.categoryUsage.map((c) => (
            <div key={c.category} className="bg-white border-[3px] border-ink rounded-lg p-3 text-center shadow-[3px_3px_0px_#111111]">
              <p className="text-xs font-black uppercase text-forest">{c.category}</p>
              <p className="text-lg font-black text-ink">
                {c.used}/{c.capacity}
              </p>
              {c.full && <p className="text-[10px] font-black text-crimson mt-0.5">FULL</p>}
              {c.teams.length > 0 && (
                <ul className="mt-2 text-[11px] text-navy leading-snug">
                  {c.teams.map((t) => (
                    <li key={t.id} className="truncate">
                      {t.name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </section>

      <CeoQuestionsPanel />

      <section className="comic-panel p-6">
        <span className="absolute -top-3 -left-3 w-6 h-6 border-[3px] border-ink bg-forest" aria-hidden="true" />
        <h2 className={`text-lg mb-4 ${comicHeading}`}>People</h2>

        <div className="grid lg:grid-cols-2 gap-6">
          <div className="lg:border-r-[3px] lg:border-ink lg:pr-6">
            <h3 className={`text-sm mb-3 ${comicHeadingSm}`}>Register a participant</h3>
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
              <label className="text-sm text-navy font-bold">
                Full name
                <input value={newName} onChange={(e) => setNewName(e.target.value)} className={fieldInput} />
              </label>
              <label className="text-sm text-navy font-bold">
                Department
                <select value={newDept} onChange={(e) => setNewDept(e.target.value as Department)} className={fieldInput}>
                  {ALL_DEPARTMENTS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-navy font-bold">
                Access code (optional)
                <input
                  value={newAccessCode}
                  onChange={(e) => setNewAccessCode(e.target.value)}
                  placeholder="auto-generated"
                  className={`${fieldInput} w-36 font-mono`}
                />
              </label>
              <button type="submit" disabled={createParticipant.isPending || newName.trim().length < 2} className={comicButton('forest', 'sm')}>
                Add
              </button>
            </form>
            {lastCreated && (
              <p className="mt-3 text-sm font-bold text-forest">
                Created {lastCreated.fullName} — access code:{' '}
                <span className="font-mono font-black">{lastCreated.accessCode}</span>
              </p>
            )}
            {createParticipant.isError && <p className="text-sm font-bold text-crimson mt-2">{getApiErrorMessage(createParticipant.error)}</p>}
          </div>

          <div>
            <h3 className={`text-sm mb-3 ${comicHeadingSm}`}>Create staff account</h3>
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
                <label className="text-sm text-navy font-bold flex-1 min-w-[10rem]">
                  Full name
                  <input value={staffName} onChange={(e) => setStaffName(e.target.value)} className={`${fieldInput} w-full`} />
                </label>
                <label className="text-sm text-navy font-bold">
                  Role
                  <select value={staffRole} onChange={(e) => setStaffRole(e.target.value as 'JUDGE' | 'ADMIN')} className={fieldInput}>
                    <option value="JUDGE">Judge</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </label>
              </div>
              <div className="flex flex-wrap gap-3">
                <label className="text-sm text-navy font-bold flex-1 min-w-[10rem]">
                  Email
                  <input
                    type="email"
                    value={staffEmail}
                    onChange={(e) => setStaffEmail(e.target.value)}
                    className={`${fieldInput} w-full`}
                  />
                </label>
                <label className="text-sm text-navy font-bold flex-1 min-w-[10rem]">
                  Temporary password
                  <input
                    type="text"
                    value={staffPassword}
                    onChange={(e) => setStaffPassword(e.target.value)}
                    className={`${fieldInput} w-full`}
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
                className={`self-start ${comicButton('forest', 'sm')}`}
              >
                {createStaff.isPending ? 'Creating…' : `Create ${staffRole === 'JUDGE' ? 'judge' : 'admin'} account`}
              </button>
              {createStaff.isError && <p className="text-sm font-bold text-crimson">{getApiErrorMessage(createStaff.error)}</p>}
            </form>

            <div className="mt-5">
              <h3 className={`text-sm mb-2 ${comicHeadingSm}`}>Judges &amp; admins</h3>
              <div className="max-h-56 overflow-y-auto overflow-x-auto border-[3px] border-ink rounded-lg">
                <table className="w-full min-w-[36rem] text-sm text-left">
                  <thead className="text-forest text-xs uppercase font-black bg-cream/60">
                    <tr>
                      <th className="py-1 pl-2">Name</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th className="text-right pr-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staff.data?.map((s) => {
                      const isEditingStaff = editingStaffId === s.id;
                      const isSelf = s.id === currentUser?.id;
                      return (
                        <tr key={s.id} className="border-t-2 border-ink/15 text-ink">
                          {isEditingStaff ? (
                            <>
                              <td className="py-1.5 pr-2 pl-2">
                                <input autoFocus value={editStaffName} onChange={(e) => setEditStaffName(e.target.value)} className={tableInput} />
                              </td>
                              <td className="pr-2">
                                <input type="email" value={editStaffEmail} onChange={(e) => setEditStaffEmail(e.target.value)} className={tableInput} />
                              </td>
                              <td className="pr-2">
                                <select
                                  value={editStaffRole}
                                  onChange={(e) => setEditStaffRole(e.target.value as 'ADMIN' | 'JUDGE')}
                                  className={tableInput}
                                >
                                  <option value="JUDGE">JUDGE</option>
                                  <option value="ADMIN">ADMIN</option>
                                </select>
                              </td>
                              <td className="text-right whitespace-nowrap pr-2">
                                <button
                                  disabled={updateStaff.isPending || editStaffName.trim().length < 2 || !editStaffEmail.includes('@')}
                                  onClick={() =>
                                    updateStaff.mutate(
                                      { id: s.id, fullName: editStaffName.trim(), email: editStaffEmail.trim(), role: editStaffRole },
                                      { onSuccess: () => setEditingStaffId(null) },
                                    )
                                  }
                                  className={`${comicLink} disabled:opacity-40 text-xs mr-3`}
                                >
                                  Save
                                </button>
                                <button onClick={() => setEditingStaffId(null)} className="text-navy hover:text-crimson font-bold text-xs">
                                  Cancel
                                </button>
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="py-1.5 pl-2 font-bold">{s.fullName}</td>
                              <td className="text-navy">{s.email}</td>
                              <td>
                                <Badge tone={s.role === 'ADMIN' ? 'gold' : 'primary'}>{s.role}</Badge>
                              </td>
                              <td className="text-right whitespace-nowrap pr-2">
                                <button
                                  onClick={() => {
                                    setEditingStaffId(s.id);
                                    setEditStaffName(s.fullName);
                                    setEditStaffEmail(s.email ?? '');
                                    setEditStaffRole(s.role);
                                  }}
                                  className={`${comicLink} text-xs mr-3`}
                                >
                                  Edit
                                </button>
                                {isSelf ? (
                                  <span className="text-navy/40 text-xs font-bold" title="You can't remove the account you're signed in as.">
                                    (you)
                                  </span>
                                ) : (
                                  <button
                                    onClick={() => setDeleteStaffTarget({ id: s.id, fullName: s.fullName })}
                                    className="text-crimson hover:text-ink font-black uppercase text-xs"
                                  >
                                    Delete
                                  </button>
                                )}
                              </td>
                            </>
                          )}
                        </tr>
                      );
                    })}
                    {staff.data?.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-2 text-navy/40 text-center">
                          No staff accounts yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {updateStaff.isError && <p className="text-sm font-bold text-crimson mt-2">{getApiErrorMessage(updateStaff.error)}</p>}
            </div>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t-[3px] border-ink flex items-center justify-between flex-wrap gap-3">
          <div>
            <h3 className={`text-sm ${comicHeadingSm}`}>All participants</h3>
            <p className="text-xs font-bold text-navy/60 mt-0.5">{participants.data?.length ?? 0} registered</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {badgesError && <p className="text-xs font-bold text-crimson">{badgesError}</p>}
            <button
              data-testid="download-badges-button"
              disabled={fetchBadges.isPending}
              onClick={() => {
                setBadgesError(null);
                fetchBadges.mutate(undefined, {
                  onSuccess: (badges) => {
                    downloadParticipantBadgesPdf(badges).catch(() => setBadgesError('Could not generate the PDF.'));
                  },
                  onError: (err) => setBadgesError(getApiErrorMessage(err)),
                });
              }}
              className={`${comicButton('white', 'sm')} disabled:opacity-40`}
            >
              {fetchBadges.isPending ? 'Preparing PDF…' : 'Download all QR badges'}
            </button>
            <button
              data-testid="open-participant-list-button"
              onClick={() => setShowParticipantList(true)}
              className={comicButton('forest', 'sm')}
            >
              View all participants
            </button>
          </div>
        </div>
      </section>

      {showParticipantList && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-ink/70 px-4 py-8"
          role="dialog"
          aria-modal="true"
          onClick={() => setShowParticipantList(false)}
        >
          <div
            className="comic-panel w-full max-w-2xl max-h-full flex flex-col p-6"
            style={{ boxShadow: '8px 8px 0px #111111' }}
            onClick={(e) => e.stopPropagation()}
            data-testid="participant-list-modal"
          >
            <span className="absolute -top-3 -left-3 w-6 h-6 border-[3px] border-ink bg-forest" aria-hidden="true" />
            <div className="flex items-center justify-between mb-4 shrink-0">
              <h2 className={`text-lg ${comicHeading}`}>All Participants</h2>
              <button
                onClick={() => setShowParticipantList(false)}
                aria-label="Close"
                className="w-8 h-8 shrink-0 rounded-lg border-[3px] border-ink bg-white hover:bg-cream font-black text-ink"
              >
                ✕
              </button>
            </div>

            <div className="overflow-y-auto border-[3px] border-ink rounded-lg">
              <table className="w-full text-sm text-left">
                <thead className="text-forest text-xs uppercase font-black bg-cream/60 sticky top-0">
                  <tr>
                    <th className="py-1 pl-2">Name</th>
                    <th>Dept</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Name + Dept only — tap a row for everything else (role,
                      team status, access code, QR, edit, delete), see
                      ParticipantDetailModal. Keeps this list scannable at a
                      glance for a roster that can run into the hundreds. */}
                  {participants.data?.map((p) => (
                    <tr
                      key={p.id}
                      onClick={() => setDetailTarget(p)}
                      className="border-t-2 border-ink/15 text-ink cursor-pointer hover:bg-cream/50"
                      data-testid={`participant-row-${p.id}`}
                    >
                      <td className="py-1.5 pl-2 font-bold">{p.fullName}</td>
                      <td>{p.homeDepartment}</td>
                    </tr>
                  ))}
                  {participants.data?.length === 0 && (
                    <tr>
                      <td colSpan={2} className="py-3 text-navy/40 text-center">
                        No participants registered yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {updateParticipant.isError && <p className="text-sm font-bold text-crimson mt-2 shrink-0">{getApiErrorMessage(updateParticipant.error)}</p>}
            {revealedCode && (
              <p className="mt-3 text-sm font-bold text-forest flex items-center gap-2 flex-wrap shrink-0">
                {revealedCode.fullName}&apos;s login code:{' '}
                <span className="font-mono font-black bg-cream border-2 border-ink rounded px-1.5 py-0.5">{revealedCode.accessCode}</span>
                <button onClick={() => setRevealedCode(null)} className="text-navy/50 hover:text-crimson text-xs font-bold">
                  dismiss
                </button>
              </p>
            )}

            {qrTarget && <ParticipantQrModal participant={qrTarget} onClose={() => setQrTarget(null)} />}

            {detailTarget && (
              <ParticipantDetailModal
                participant={detailTarget}
                onClose={() => setDetailTarget(null)}
                onOpenQr={() => setQrTarget({ id: detailTarget.id, fullName: detailTarget.fullName, homeDepartment: detailTarget.homeDepartment })}
                onGetCode={() => regenerateCode.mutate(detailTarget.id, { onSuccess: (data) => setRevealedCode(data) })}
                gettingCode={regenerateCode.isPending}
                onDelete={() => {
                  setDeleteTarget({ id: detailTarget.id, fullName: detailTarget.fullName });
                  setDetailTarget(null);
                }}
              />
            )}
          </div>
        </div>
      )}

      <section className="comic-panel p-6">
        <span className="absolute -top-3 -left-3 w-6 h-6 border-[3px] border-ink bg-crimson" aria-hidden="true" />
        <h2 className={`text-lg mb-4 ${comicHeading}`}>Teams</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          {teams.data?.map((team) => {
            const status = deliverables.data?.find((d) => d.teamId === team.id);
            const evalStatus = evaluations.data?.find((e) => e.teamId === team.id);
            return (
              <div
                key={team.id}
                className="bg-white border-[3px] border-ink rounded-lg p-3 shadow-[3px_3px_0px_#111111]"
                data-testid={`admin-team-${team.id}`}
              >
                <p className="font-black text-ink">{team.name ?? '(unnamed draft)'}</p>
                <p className="text-xs text-navy">
                  {team.category ?? 'no category'} · {team.members.length}/5 members ·{' '}
                  {team.finalizedAt ? 'finalized' : 'in progress'} · CEO: {team.ceo.fullName}
                </p>
                <p className="text-xs text-navy/60 mt-1">
                  {team.members.map((m) => `${m.slotDepartment}: ${m.fullName}`).join(' · ')}
                </p>
                <p className="text-xs text-forest mt-1 font-black">
                  Project: {(team.deliverable?.status ?? 'DRAFT').replace(/_/g, ' ')}
                </p>
                {status && (
                  <p className="text-xs text-navy mt-1" data-testid={`admin-team-${team.id}-deliverables`}>
                    Pitch deck: {status.pitchDeck.status === 'UPLOADED' ? `v${status.pitchDeck.latestVersion}` : 'not uploaded'}
                    {' · '}
                    Docs: {status.documentation.status === 'UPLOADED' ? `${status.documentation.count} file(s)` : 'none'}
                  </p>
                )}
                {evalStatus && (
                  <p className="text-xs text-forest font-bold mt-1" data-testid={`admin-team-${team.id}-evaluations`}>
                    Evaluations: {evalStatus.evaluationsSubmitted}/{evalStatus.totalJudges} submitted
                    {evalStatus.evaluationsInProgress > 0 ? ` · ${evalStatus.evaluationsInProgress} in progress` : ''}
                  </p>
                )}

                <div className="flex items-center gap-3 mt-2">
                  <button onClick={() => setResourcesTeamId(resourcesTeamId === team.id ? null : team.id)} className={`text-xs ${comicLink}`}>
                    {resourcesTeamId === team.id ? 'Hide resources' : 'View resources'}
                  </button>
                  {evalStatus && evalStatus.judgeScores.length > 0 && (
                    <button
                      onClick={() => setEvaluationsTeamId(evaluationsTeamId === team.id ? null : team.id)}
                      className={`text-xs ${comicLink}`}
                      data-testid={`admin-team-${team.id}-toggle-scores`}
                    >
                      {evaluationsTeamId === team.id ? 'Hide scores' : 'View scores'}
                    </button>
                  )}
                  <button
                    onClick={() => setDeleteTeamTarget({ id: team.id, name: team.name })}
                    className="text-xs font-bold uppercase tracking-wide text-crimson hover:text-ink transition-colors"
                    data-testid={`admin-team-${team.id}-delete`}
                  >
                    Delete team
                  </button>
                </div>

                {evaluationsTeamId === team.id && evalStatus && (
                  <div className="mt-2 pt-2 border-t-2 border-ink/20 flex flex-col gap-2" data-testid={`admin-team-${team.id}-scores`}>
                    {evalStatus.judgeScores.map((judge, i) => (
                      <div key={i} className="text-xs bg-cream/40 rounded-lg p-2 border-2 border-ink/10">
                        <p className="font-black text-ink">
                          {judge.judgeName} — {judge.total}/{evalStatus.maxTotal}
                        </p>
                        <p className="text-navy/70">
                          {judge.scores.map((s) => `${s.label}: ${s.value}`).join(' · ')}
                        </p>
                        {judge.comments && <p className="text-navy mt-1 whitespace-pre-wrap">&ldquo;{judge.comments}&rdquo;</p>}
                      </div>
                    ))}
                  </div>
                )}

                {resourcesTeamId === team.id && (
                  <div className="mt-2 pt-2 border-t-2 border-ink/20 flex flex-col gap-1.5">
                    {teamResources.isLoading && <p className="text-xs text-navy/50">Loading…</p>}
                    {teamResources.data?.pitchDeckVersions.length === 0 && teamResources.data?.files.length === 0 && (
                      <p className="text-xs text-navy/50">Nothing uploaded yet.</p>
                    )}
                    {teamResources.data?.pitchDeckVersions.map((v) => (
                      <div key={v.id} className="flex items-center justify-between gap-2 text-xs">
                        <a href={v.fileUrl} target="_blank" rel="noreferrer" className="text-navy hover:text-forest font-medium truncate">
                          {v.isCurrent ? '(current) ' : ''}
                          {v.filename} (v{v.version})
                        </a>
                        <button
                          disabled={deletePitchDeckVersion.isPending}
                          onClick={() => deletePitchDeckVersion.mutate({ teamId: team.id, versionId: v.id })}
                          className="text-crimson hover:text-ink font-black shrink-0"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    {teamResources.data?.files.map((f) => (
                      <div key={f.id} className="flex items-center justify-between gap-2 text-xs">
                        <a href={f.fileUrl} target="_blank" rel="noreferrer" className="text-navy hover:text-forest font-medium truncate">
                          {f.filename} ({f.type})
                        </a>
                        <button
                          disabled={deleteTeamFile.isPending}
                          onClick={() => deleteTeamFile.mutate({ teamId: team.id, fileId: f.id })}
                          className="text-crimson hover:text-ink font-black shrink-0"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="comic-panel p-6" data-testid="admin-leaderboard-section">
        <span className="absolute -top-3 -left-3 w-6 h-6 border-[3px] border-ink bg-gold" aria-hidden="true" />
        <h2 className={`text-lg mb-4 ${comicHeading}`}>Leaderboard</h2>
        <p className="text-xs text-navy/60 mb-3">
          Ranked by average submitted judge score — teams with no submitted evaluations yet sort to the bottom.
        </p>
        {leaderboard.data && leaderboard.data.length === 0 && <p className="text-sm text-navy/50">No finalized teams yet.</p>}
        {leaderboard.data && leaderboard.data.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="text-forest text-xs uppercase font-black border-b-2 border-ink">
                  <th className="py-2 pr-2">#</th>
                  <th className="py-2 pr-2">Team</th>
                  <th className="py-2 pr-2">CEO</th>
                  <th className="py-2 pr-2">Category</th>
                  <th className="py-2 pr-2">Score</th>
                  <th className="py-2 pr-2">Judges</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.data.map((row) => (
                  <tr key={row.teamId} className="border-b border-ink/10" data-testid={`leaderboard-row-${row.teamId}`}>
                    <td className="py-2 pr-2 font-black text-ink">{row.evaluationsSubmitted > 0 ? row.rank : '—'}</td>
                    <td className="py-2 pr-2 font-bold text-ink">{row.teamName ?? '(unnamed)'}</td>
                    <td className="py-2 pr-2 text-navy">{row.ceoName}</td>
                    <td className="py-2 pr-2 text-navy">{row.category ?? '—'}</td>
                    <td className="py-2 pr-2 font-black text-forest">
                      {row.evaluationsSubmitted > 0 ? `${row.averageScore.toFixed(1)} / ${row.maxPossibleScore}` : '—'}
                    </td>
                    <td className="py-2 pr-2 text-navy/60">{row.evaluationsSubmitted}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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

      <ConfirmDialog
        open={deleteTeamTarget !== null}
        title="Delete this team?"
        description={
          deleteTeamTarget
            ? `${deleteTeamTarget.name ?? '(unnamed draft)'} will be permanently deleted — its HEAT category slot is freed, and every member (including the CEO) returns to undrafted. This cannot be undone.`
            : undefined
        }
        confirmLabel="Delete"
        tone="danger"
        pending={deleteTeam.isPending}
        onCancel={() => setDeleteTeamTarget(null)}
        onConfirm={() => {
          if (deleteTeamTarget) deleteTeam.mutate(deleteTeamTarget.id);
          setDeleteTeamTarget(null);
        }}
      />

      <ConfirmDialog
        open={deleteStaffTarget !== null}
        title="Remove this staff account?"
        description={
          deleteStaffTarget
            ? `${deleteStaffTarget.fullName} will lose access immediately. This cannot be undone.`
            : undefined
        }
        confirmLabel="Remove"
        tone="danger"
        pending={deleteStaff.isPending}
        onCancel={() => setDeleteStaffTarget(null)}
        onConfirm={() => {
          if (deleteStaffTarget) deleteStaff.mutate(deleteStaffTarget.id);
          setDeleteStaffTarget(null);
        }}
      />
    </div>
  );
}

// One-off Cloudinary maintenance operations, run via a click since this
// deployment's Render plan has no Shell tab (see the server's
// cloudinaryMaintenance.service.ts for what each button actually does).
// Meant to be used once each after the authenticated-delivery fix ships,
// not a routine control — kept low-key and out of the way of the main
// event controls above.
function CloudinaryMaintenancePanel() {
  const diagnose = useDiagnoseRawDelivery();
  const migrate = useMigrateRawAuth();

  return (
    <section className="comic-panel p-6">
      <span className="absolute -top-3 -left-3 w-6 h-6 border-[3px] border-ink bg-gold" aria-hidden="true" />
      <h2 className={`text-lg mb-1 ${comicHeading}`}>Cloudinary Maintenance</h2>
      <p className="text-xs text-navy/60 mb-4 max-w-lg">
        One-time fixes for the pitch deck/document view &amp; download bug. Run Diagnose first — it uploads and
        deletes a throwaway test file and tells you exactly what's happening. If it says "WORKS", run Migrate once to
        fix already-uploaded files (new uploads already work on their own).
      </p>
      <div className="flex flex-wrap gap-3 mb-4">
        <button disabled={diagnose.isPending} onClick={() => diagnose.mutate()} className={comicButton('white')}>
          {diagnose.isPending ? 'Running…' : 'Diagnose'}
        </button>
        <button disabled={migrate.isPending} onClick={() => migrate.mutate()} className={comicButton('forest')}>
          {migrate.isPending ? 'Migrating…' : 'Migrate existing files'}
        </button>
      </div>

      {diagnose.data && <DiagnoseResultView result={diagnose.data} />}
      {migrate.data && <MigrateResultView result={migrate.data} />}
    </section>
  );
}

function DiagnoseResultView({ result }: { result: DiagnoseRawDeliveryResult }) {
  const ok = result.delivery.httpStatus === 200;
  return (
    <div
      className={`rounded-lg border-[3px] border-ink p-4 text-xs font-mono ${ok ? 'bg-lime/30' : 'bg-crimson/10'}`}
      data-testid="diagnose-result"
    >
      <p className={`font-black uppercase mb-2 ${ok ? 'text-forest' : 'text-crimson'}`}>{result.verdict}</p>
      <p>HTTP status: {result.delivery.httpStatus}</p>
      {result.delivery.cldError && <p>Cloudinary error: {result.delivery.cldError}</p>}
      <p>Cloud: {result.cloudName}</p>
      <p>Admin API says type: {result.adminApi.type ?? '(lookup failed)'}</p>
      {result.adminApi.error && <p>Admin API error: {result.adminApi.error}</p>}
    </div>
  );
}

function MigrateResultView({ result }: { result: MigrateRawAuthResult }) {
  return (
    <div className="rounded-lg border-[3px] border-ink bg-white p-4 text-xs font-mono" data-testid="migrate-result">
      <p className="font-black uppercase text-forest mb-1">
        Migrated {result.migrated}, already done {result.alreadyDone}, failed {result.failed} (of {result.total} total)
      </p>
      {result.failures.length > 0 && (
        <ul className="mt-2 text-crimson">
          {result.failures.map((f, i) => (
            <li key={i}>
              ✗ {f.label}: {f.error}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Stat({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: boolean }) {
  return (
    <div className="comic-panel-sm p-4 min-w-0">
      <p className="text-xs uppercase text-forest font-black">{label}</p>
      {/* Phase labels are underscore-joined tokens (e.g. "SUBMISSIONS_LOCKED") with
          no natural break point — break-words forces a wrap instead of overflowing
          this fixed-width box on narrower grids (2-col on mobile). */}
      <p className={`text-2xl font-black break-words ${accent ? 'text-crimson' : 'text-ink'}`}>{value}</p>
      {sub && <p className="text-[10px] text-navy/50 font-bold uppercase">{sub}</p>}
    </div>
  );
}
