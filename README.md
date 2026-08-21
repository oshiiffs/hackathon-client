# Nexus Multiverse 2026 — Team Building & Pitch App

A real-time event-orchestration app for a university hackathon: CEO selection via a
timed challenge, QR-code team recruitment across 5 college departments, HEAT
category allocation (max 3 teams/category), an AI concept mentor, a team pitch
deck hub, and judge scoring.

Postgres is the single source of truth for every business rule. Sockets are a
notification layer only — nothing critical lives only in server memory.

## Stack

- **Frontend**: React + TypeScript + Vite + Tailwind CSS + React Router + TanStack Query + Zustand
- **Backend**: Node.js + TypeScript + Fastify + Socket.IO + Zod
- **Database**: Aiven PostgreSQL + Prisma
- **File storage**: Cloudinary (logos, pitch decks — only URLs/metadata are stored in Postgres)
- **AI**: xAI / Grok (`/team/ai/chat`, server-side key only)
- **Hosting**: Render (server as a Web Service, client as a Static Site)

## Repository layout

```
client/    React app (Vite)
server/    Fastify API + Socket.IO + Prisma
  prisma/schema.prisma   Data model — the actual rule enforcement lives here
  src/modules/           auth, hackathon (CEO challenge), team, uploads, ai, admin, judge
  test/unit/             Pure logic tests (no DB needed)
  test/integration/      Real-Postgres tests for the concurrency-sensitive rules
```

## How the core rules are enforced (not just app logic)

| Rule | Mechanism |
|---|---|
| Exactly 5 members/team, 1 per department | `@@unique([teamId, slotDepartment])` on `User` — DB-enforced, caps team size since there are exactly 5 department values |
| CEO is one of the 5, can pick any department | `User.homeDepartment` (real dept, fixed) vs `User.slotDepartment` (team slot, free choice for the CEO) |
| Atomic QR recruitment (no double-draft) | Conditional `UPDATE ... WHERE drafted = false` inside a transaction; loses races cleanly instead of corrupting rosters |
| Max 3 teams per HEAT category | Pre-seeded `CategorySlot` rows; claimed via `UPDATE ... WHERE teamId IS NULL ORDER BY slotNumber LIMIT 1 FOR UPDATE SKIP LOCKED` — only one concurrent finalize can win the last slot |
| Server-authoritative challenge timer | `HackathonState.challengeEndsAt` in Postgres; submissions after that timestamp are rejected server-side regardless of client clock; a restarted server self-heals via lazy finalize on the next read |

## Local development

Prereqs: Node 20+, an Aiven (or any) PostgreSQL instance, and npm.

```bash
# 1. Server
cd server
cp .env.example .env      # fill in DATABASE_URL, JWT_SECRET, QR_TOKEN_SECRET at minimum
npm install
npm run prisma:generate
npm run prisma:migrate    # creates tables + the migration history
npm run prisma:seed       # seeds HEAT category slots, an admin account, a demo judge,
                           # and (non-production only) demo participants
npm run dev                # http://localhost:4000

# 2. Client (separate terminal)
cd client
cp .env.example .env      # VITE_API_URL=http://localhost:4000
npm install
npm run dev                # http://localhost:5173
```

Seeded admin login (change immediately): `admin@hackathon.local` / `ChangeMe123!`
Seeded judge login: `judge1@hackathon.local` / `Judge123!`
Demo participants get random 6-character access codes — see `admin/participants`
in the running app or query the DB directly.

### Generating secrets

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Run it twice — once for `JWT_SECRET`, once for `QR_TOKEN_SECRET`. They must differ.

## Running checks

```bash
# server
cd server && npm run typecheck && npm run lint && npm test && npm run build

# client
cd client && npm run typecheck && npm run lint && npm run build
```

`npm test` in `server/` always runs the unit suite (schema validation, QR token
signing, access-code generation — no DB needed). The integration suite
(`test/integration/`) exercises the real Postgres constraints described in the
table above; it self-skips with a clear message unless `DATABASE_URL` points at a
real, migrated database when you run the tests.

## Deployment

### 1. Database — Aiven PostgreSQL

1. Create a PostgreSQL service in the Aiven console.
2. Copy the connection URI Aiven gives you and change its scheme from `postgres://`
   to `postgresql://` (Prisma requires that scheme) — everything else stays the same,
   including `?sslmode=require`.
3. Set that as `DATABASE_URL` in the server's environment.
4. From your machine (or a one-off Render shell), run:
   ```bash
   cd server
   npm run prisma:deploy   # applies committed migrations, does NOT prompt
   npm run prisma:seed     # seeds category slots + admin account
   ```

### 2. File storage — Cloudinary

1. Create a free Cloudinary account, grab **Cloud name**, **API key**, **API secret**
   from the dashboard.
2. Set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` on the
   server. Uploads go to `hackathon/teams/{teamId}/logo` and
   `hackathon/teams/{teamId}/pitch-decks/vN` — only the resulting secure URL and
   Cloudinary `public_id` are written to Postgres (`Deliverable`, `PitchDeckVersion`).

### 3. AI — xAI / Grok

1. Get an API key from the xAI console.
2. Set `XAI_API_KEY` (and optionally `XAI_MODEL`, default `grok-4-fast`) on the
   server only. The key never reaches the client — `POST /team/ai/chat` is the only
   way the frontend talks to Grok, and it goes through server-side Zod validation
   and rate limiting first.

### 4. Hosting — Render

**Server (Web Service)**
- Root directory: `server`
- Build command: `npm install && npm run build && npm run prisma:generate`
- Start command: `npm run prisma:deploy && npm start`
- Environment: all vars from `server/.env.example`, with `DATABASE_URL` from Aiven,
  `CORS_ORIGIN` set to your deployed client's origin, `NODE_ENV=production`.
- Render terminates TLS and proxies both HTTP and WebSocket upgrades to the same
  service, so Socket.IO works without extra config on a single instance.

**Client (Static Site)**
- Root directory: `client`
- Build command: `npm install && npm run build`
- Publish directory: `dist`
- Environment: `VITE_API_URL=https://<your-render-server>.onrender.com`
- Add a rewrite rule `/* -> /index.html` (SPA fallback) so React Router deep links work.

### Scaling note (be aware of this, don't silently assume it away)

Socket.IO here keeps its room/connection state in the Node process's memory, which
is fine for a **single Render instance**. All state that actually matters
(challenge timer, rosters, category slots, uploads) lives in Postgres, so a
restart or redeploy never loses data — clients simply resync via REST + a fresh
socket connection. If you scale the server to multiple Render instances, add the
`@socket.io/redis-adapter` (backed by e.g. Aiven for Redis) so broadcasts reach
sockets connected to a different instance; without it, real-time push would only
reach clients on the same instance that produced the event (REST polling still
covers you as a fallback either way).

## Environment variables reference

See `server/.env.example` and `client/.env.example` for the authoritative list —
each package reads its own `.env`, not the root one. The root `.env.example` is
just an index of both.
