# Nexus Multiverse 2026 — User Flows

This document walks through what each role actually does in the app, in order,
end to end. It's a companion to [README.md](README.md) (which covers the stack
and how rules are enforced) — this one is about the *experience*, not the
implementation.

There are four roles: **Admin**, **Judge**, **Participant**, and **CEO**. A CEO
starts out as a Participant — it's not a separate signup, it's a promotion that
happens mid-event (see the Participant flow below). Judges and Admins are
created directly by an Admin and log in with email/password; Participants log
in with a badge access code.

## The event's phases, at a glance

The whole event moves through one shared phase, tracked server-side and shown
to everyone via [`PhaseProgress`](client/src/components/PhaseProgress.tsx):

| Phase | What's happening |
|---|---|
| `LOBBY` | Participants have logged in and are waiting. Admin is registering people and building the CEO question bank. |
| `CEO_CHALLENGE_ACTIVE` | The timed identification challenge is live; top scorers become CEOs. |
| `DRAFTING` (Team Formation) | New CEOs recruit their 5-person teams by scanning participant QR badges. |
| `SUBMISSIONS_OPEN` | Finalized teams work on their project and can upload/submit deliverables. |
| `SUBMISSIONS_LOCKED` | No more uploads or edits; teams wait for judging. |
| `JUDGING` | Judges score every team against the rubric. |
| `COMPLETE` | Event over — teams can see their judge feedback. |

Only an Admin moves the event between phases. Everything below is written in
the order a person actually experiences it.

---

## 1. Admin flow

The Admin dashboard ([`AdminDashboardPage`](client/src/pages/admin/AdminDashboardPage.tsx))
is the control room for the whole event. Logged in with email + password.

1. **Before doors open**
   - Register participants one at a time (name, home department, optional
     custom access code — auto-generated if left blank) or via the staff-account
     form for judges/other admins.
   - Build the CEO Challenge question bank
     ([`CeoQuestionsPanel`](client/src/pages/admin/CeoQuestionsPanel.tsx)): add
     identification prompts with accepted answers, points, category, and an
     active/inactive toggle. At least **10 active questions** are required
     before the challenge can start — the dashboard shows a live READY /
     NOT READY badge for this.
   - Optionally lock participant devices so nobody can act until go-time.

2. **Running the CEO Challenge**
   - Set seconds-per-topic and how many CEO slots this round produces, then
     **Start CEO challenge**. This immediately unlocks every participant
     device and starts the synchronized timer — every topic plays in lockstep
     for everyone.
   - The [Presenter view](client/src/pages/admin/PresenterPage.tsx) (a
     separate big-screen page meant to be cast to a projector) shows the
     current topic, a live "who's answered" grid of every participant, and
     a top-5-answers recap between topics.
   - An Admin can **Stop CEO challenge** early — whoever's already saved an
     answer at that instant is ranked as-is.
   - When the round ends, the top scorers are auto-promoted to CEO and the
     phase moves to `DRAFTING`.

3. **Team formation window**
   - Watch the **HEAT Category Capacity** panel (max 3 teams per category)
     and the **Teams** list fill in as CEOs recruit.
   - If recruitment is running short on people, toggle **Allow incomplete
     rosters** so CEOs can finalize with fewer than 5 members instead of
     getting stuck.

4. **Submissions**
   - **Open submissions** once teams are ready to start uploading; **Lock
     submissions** when the deadline hits (blocks further uploads/edits).
   - Per-team resource browser lets an Admin view or remove any uploaded
     pitch deck version, document, or asset.

5. **Wrap-up**
   - **Mark event complete** once judging is done — this is what unlocks the
     judge-feedback section on every team's Team Hub.
   - **Start new competition** archives the entire event (participants,
     teams, submissions, judge scores) as a downloadable JSON file, then
     wipes it and resets the phase back to `LOBBY` for a fresh run. Staff
     accounts are kept; everything else is deleted — this is deliberately
     one-way and requires confirming a destructive dialog.

Throughout, the Admin can also regenerate a lost participant's access code,
edit an undrafted participant's department, or remove participants/staff
outright.

---

## 2. Participant flow

Participants log in at [`LoginPage`](client/src/pages/auth/LoginPage.tsx) with
a **badge access code** an Admin gave them (or self-registered with, depending
on event setup).

1. **Waiting room** — while devices are locked, the dashboard just shows a
   "please wait" screen. Once unlocked, a participant can:
   - Edit their display name inline.
   - Fill out their **profile** (nickname, short bio, up to 10 skill tags,
     profile photo) — this is what shows up in the participant directory.
   - Browse the **participant directory** to see everyone else competing
     (name, department, bio, skills) before the challenge starts.

2. **CEO Challenge** — the moment the Admin starts it, every unlocked
   participant is redirected to the challenge page automatically. For each
   topic, in sync with everyone else:
   - A synchronized countdown appears with the prompt.
   - Type a one-word answer; it's saved to the server the instant the clock
     moves past that topic — not batched, so a slow submit never gets lost if
     the round is cut short.
   - A brief "reveal" window shows the correct answer before the next topic.
   - After the last topic, there's a short "calculating results…" beat, then
     one of two outcomes:
     - **Became CEO** → routed into the [CEO flow](#3-ceo-flow) below.
     - **Did not become CEO** → back to "Candidate Mode": show your QR badge
       and wait to be recruited.

3. **Candidate mode (not selected as CEO)**
   - The dashboard shows a **View My QR Code** button
     ([`ParticipantQrPage`](client/src/pages/participant/ParticipantQrPage.tsx)).
   - A CEO scans this badge to recruit the participant onto their team. The
     QR payload is stable (doesn't regenerate on refresh) but stops working
     the instant the participant is actually recruited.
   - Once recruited, the participant's own screen updates in real time (via
     socket) and redirects them into the [Team Hub](#team-hub-shared-by-every-team-member).

---

## 3. CEO flow

Becoming CEO is a promotion, not a separate login — same account, new
capabilities. A CEO's own department slot is auto-assigned to their home
department the moment they're promoted, so recruiting only ever needs to fill
the remaining 4 department slots.

1. **Recruiting** ([`CeoRecruitPage`](client/src/pages/ceo/CeoRecruitPage.tsx))
   - Point the device camera at a candidate's QR badge.
   - The scan shows a preview (name, department, availability) before
     anything commits — tap **Recruit** to confirm.
   - Recruitment is atomic and re-validated server-side at the moment of
     confirming (not just at scan time), so a badge that got recruited by
     someone else a second earlier is rejected cleanly instead of causing a
     duplicate.
   - Repeats until all 5 department slots are filled (or the Admin has
     allowed incomplete rosters and the CEO chooses to move on early).

2. **Finalizing the team** ([`CeoFinalizePage`](client/src/pages/ceo/CeoFinalizePage.tsx))
   - Once the roster is ready, pick a **team name** and a **HEAT category**
     (Health, Environment, Agriculture, Tourism — capped at 3 teams each; full
     categories are disabled in the picker).
   - Confirm in a dialog, then finalize. This is a one-way action — normal
     recruitment closes for that team afterward.

3. **Team Hub** — see the shared section below. As CEO specifically, the CEO
   is the only one who can rename the team after finalization and the only
   one who can hit **Submit** on the project (once a pitch deck is uploaded
   and submissions are open).

### Team Hub (shared by every team member)

Once a team is finalized, every member — CEO or recruit — sees the same
[`TeamHubPage`](client/src/pages/team/TeamHubPage.tsx):

- **Team overview**: name, HEAT category, CEO, member count, status, created/
  finalized dates, and the full 5-slot roster.
- **Project details** — title, problem statement, proposed solution, target
  users, technology stack. Any team member can edit and save this, not just
  the CEO.
- **Deliverables** — upload/replace the **pitch deck** (versioned, with a
  full history of previous uploads), plus separate **documents** and
  **project assets** panels. Anyone can upload; only the CEO can delete
  files.
- **AI Mentor** — a per-team chat with an AI assistant for brainstorming
  project ideas, with multiple saved sessions.
- **Project status** — shows DRAFT vs SUBMITTED; the CEO submits once a
  pitch deck exists and submissions are open. Submitting doesn't lock further
  edits (until the Admin locks submissions) — it just marks the team as done.
- **Judge feedback** — appears automatically once the event reaches
  `COMPLETE`: each judge's per-criterion scores, total, and written comments.

---

## 4. Judge flow

Judges log in with email/password (accounts created by an Admin) and land on
[`JudgeDashboardPage`](client/src/pages/judge/JudgeDashboardPage.tsx).

1. **Team list**
   - See every finalized team assigned for evaluation, with a search box and
     a status filter (All / Not Started / In Progress / Submitted).
   - Each card shows the team name, HEAT category, member count, CEO, and the
     judge's own evaluation status for that team.

2. **Evaluating a team** ([`JudgeTeamDetailPage`](client/src/pages/judge/JudgeTeamDetailPage.tsx))
   - Full team roster and project write-up (problem statement, solution,
     target users, tech stack).
   - Deliverables: view PDFs inline, or download any pitch deck / document /
     asset the team uploaded.
   - Scoring form: one slider + number input per rubric criterion (each with
     its own min/max), plus a free-text comments box.
   - **Save draft** at any point — scores persist without submitting.
   - **Submit evaluation** is a confirmed, one-way action: once submitted, the
     score is locked and the team's page instead shows "EVALUATION
     SUBMITTED" with the total and timestamp — no further edits possible.

That's the full loop: an Admin sets the stage and runs the clock, Participants
compete to become CEOs and then get recruited, CEOs build and submit a
project as a team, and Judges score the finished submissions.
