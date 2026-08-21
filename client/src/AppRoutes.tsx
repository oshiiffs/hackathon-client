import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { RequireAuth, RequireRole } from './components/RoleGuard';
import { LoadingState } from './components/StateViews';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/auth/LoginPage';
import { NotFoundPage } from './pages/errors/NotFoundPage';
import { ParticipantLayout } from './components/layouts/ParticipantLayout';
import { CEOLayout } from './components/layouts/CEOLayout';
import { TeamLayout } from './components/layouts/TeamLayout';
import { ParticipantDashboardPage } from './pages/participant/ParticipantDashboardPage';
import { ParticipantChallengePage } from './pages/participant/ParticipantChallengePage';
import { TeamHubPage } from './pages/team/TeamHubPage';

// Code-split the heavier/role-specific pages so participants (the largest
// audience) don't pay for the admin/judge/CEO bundles.
const CeoDashboardPage = lazy(() => import('./pages/ceo/CeoDashboardPage').then((m) => ({ default: m.CeoDashboardPage })));
const CeoRecruitPage = lazy(() => import('./pages/ceo/CeoRecruitPage').then((m) => ({ default: m.CeoRecruitPage })));
const CeoFinalizePage = lazy(() =>
  import('./pages/ceo/CeoFinalizePage').then((m) => ({ default: m.CeoFinalizePage })),
);
const ParticipantQrPage = lazy(() =>
  import('./pages/participant/ParticipantQrPage').then((m) => ({ default: m.ParticipantQrPage })),
);
const AdminLayout = lazy(() => import('./components/layouts/AdminLayout').then((m) => ({ default: m.AdminLayout })));
const AdminDashboardPage = lazy(() =>
  import('./pages/admin/AdminDashboardPage').then((m) => ({ default: m.AdminDashboardPage })),
);
const PresenterPage = lazy(() => import('./pages/admin/PresenterPage').then((m) => ({ default: m.PresenterPage })));
const JudgeLayout = lazy(() => import('./components/layouts/JudgeLayout').then((m) => ({ default: m.JudgeLayout })));
const JudgeDashboardPage = lazy(() =>
  import('./pages/judge/JudgeDashboardPage').then((m) => ({ default: m.JudgeDashboardPage })),
);
const JudgeTeamDetailPage = lazy(() =>
  import('./pages/judge/JudgeTeamDetailPage').then((m) => ({ default: m.JudgeTeamDetailPage })),
);

function PageFallback() {
  return <LoadingState fullScreen />;
}

/**
 * The route tree, deliberately separated from BrowserRouter/RealtimeProvider so
 * it can be rendered under a MemoryRouter in tests without pulling in sockets.
 */
export function AppRoutes() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route element={<RequireAuth />}>
          <Route path="/" element={<HomePage />} />

          <Route path="/team" element={<TeamLayout />}>
            <Route index element={<Navigate to="overview" replace />} />
            <Route path="overview" element={<TeamHubPage />} />
          </Route>

          {/* Also allows CEO here (not just PARTICIPANT): the CEO Selection
              Challenge promotes a winner's role server-side the moment the
              round ends, and the client picks that up via a socket-triggered
              /auth/me refetch (see RealtimeProvider's onChallengeEnd) while
              the winner is often still sitting on /participant/challenge
              mid-"revealing" animation. A PARTICIPANT-only guard here used to
              yank that in-progress screen out from under them into a 403 the
              instant their role flipped, before they ever saw "YOU ARE THE
              CEO" or could click through to /ceo. These pages already handle
              a freshly-promoted CEO themselves (see e.g.
              ParticipantDashboardPage's own `role === 'CEO'` redirect) — this
              guard just needs to get out of their way and let that run. */}
          <Route element={<RequireRole roles={['PARTICIPANT', 'CEO']} />}>
            <Route path="/participant" element={<ParticipantLayout />}>
              <Route index element={<ParticipantDashboardPage />} />
              <Route path="challenge" element={<ParticipantChallengePage />} />
              <Route path="qr" element={<ParticipantQrPage />} />
            </Route>
          </Route>

          <Route element={<RequireRole roles={['CEO']} />}>
            <Route path="/ceo" element={<CEOLayout />}>
              <Route index element={<CeoDashboardPage />} />
              <Route path="recruit" element={<CeoRecruitPage />} />
              <Route path="team/finalize" element={<CeoFinalizePage />} />
            </Route>
          </Route>

          <Route element={<RequireRole roles={['ADMIN']} />}>
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<AdminDashboardPage />} />
            </Route>
            {/* Full-bleed, no AppShell chrome — meant to be cast to an LCD/projector. */}
            <Route path="/admin/presenter" element={<PresenterPage />} />
          </Route>

          <Route element={<RequireRole roles={['JUDGE']} />}>
            <Route path="/judge" element={<JudgeLayout />}>
              <Route index element={<Navigate to="teams" replace />} />
              <Route path="teams" element={<JudgeDashboardPage />} />
              <Route path="teams/:teamId" element={<JudgeTeamDetailPage />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
