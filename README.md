# Toph — Farm Activity Dashboard

An implementation of the Figma design for **Toph**, a platform farm workers use to log field
work by voice ("Toph will transcribe and record the important information from their log"),
which farmers then review on a web dashboard.

Built for the LavaLab Fall 2026 Dev Challenge final round.

## Stack, and why

**Next.js 16 (App Router) + TypeScript + PostgreSQL, one deployable app.**

- **Why a monolith, not a separate backend:** this is the pattern most small teams — and most
  early-stage AI/software startups — actually reach for when there's no ML workload that needs
  its own service. Server Components and Server Actions let the UI talk to Postgres directly, so
  there's one deploy target, no CORS, no cross-service auth. A split frontend/backend (e.g. a
  FastAPI service) earns its place when something genuinely needs Python — here, that would be
  live audio transcription, which is out of scope for this challenge (the transcript is data to
  render, not something being generated live).
- **Drizzle ORM instead of Prisma:** a deliberate, not incidental, choice — Drizzle has no
  binary query-engine to download at install time, so the schema is just TypeScript, `drizzle-kit
  push` syncs it straight to Postgres, and queries stay close to SQL rather than behind a second
  query language.
- **Auth is hand-rolled, not a library** — following [Next.js's own recommended pattern](https://nextjs.org/docs/app/guides/authentication):
  a stateless session (`jose`-signed JWT in an httpOnly cookie), a Data Access Layer
  (`src/lib/dal.ts`) that centralizes `verifySession()`/`getCurrentUser()`, and `src/proxy.ts` for
  optimistic route protection (Next.js 16 renamed `middleware.ts` → `proxy.ts`). For a
  single-provider credentials flow, a full auth library is more surface area than the problem
  needs.
- **Leaflet** for the field map (real lat/lng per field, Esri World Imagery satellite tiles, no
  API key) — an above-and-beyond over a static map image, and it's the "Expand Map" interaction
  from the Figma.

## Running it

Requires Node 20.9+ and Postgres (a `docker-compose.yml` is included if you don't have Postgres
running locally).

```bash
# 1. Start Postgres (skip if you already have one running)
docker compose up -d

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# .env's default DATABASE_URL already matches the docker-compose service.
# Generate a real AUTH_SECRET for anything beyond local use: npx auth secret

# 4. Push the schema and seed demo data
npm run db:push
npm run db:seed

# 5. Run it
npm run dev
```

Open `http://localhost:3000` — you'll land on `/login`.

**Demo credentials** (all seeded users share the password `password123`):

| Email | Role |
|---|---|
| `admin@baysranch.farm` | Admin (Bays Ranch) |
| `isaac@baysranch.farm` | Employee |
| `maya@baysranch.farm` | Employee |
| `liam@baysranch.farm` | Employee |
| `sophia@baysranch.farm` | Employee |

Or sign up fresh at `/signup` — it creates a new farm and an admin account.

## What's real vs. stubbed

**Fully implemented and backed by Postgres:**

- Email/password auth (signup, login, logout), sessions, role-based access
- "Switch User" — an admin can jump into another account on the same farm without re-entering a
  password (still a real `createSession()` call, not a client-side illusion; gated to admins only)
- Dashboard: live stat cards (today's recordings, active workers, average response accuracy —
  all computed from the database, not hardcoded)
- Activity log table: sort, filter by activity type, "This Month" toggle, expand/collapse
- Expanded entry: simulated audio playback, tag add/remove (persisted), transcript summary +
  structured Q&A pairs, real interactive field map
- "New Employee Log" — lets an admin add a log by hand; proves the app is a real CRUD app, not a
  static mock (refresh the page — it's still there)
- Employees and Map pages, both reading live data

**Intentionally out of scope**, and say so in the UI rather than faking it: Audit Manager,
Reports, Schedule, Performance, Messages, Settings, Support. These are stubbed with a plain
"out of scope" page rather than built shallow, so nothing pretends to work that doesn't.

## Data model

See `src/db/schema.ts`. Worth calling out: the voice transcript isn't stored as one text blob —
it's `transcriptQA: jsonb`, an array of `{ key, prompt, answer }` pairs, because Toph's actual
product value is *structured* data pulled out of audio, not a wall of text. The flat
`transcriptSummary` field is a rendered summary on top of that.

## Project structure

```
src/
  app/
    login/, signup/          — auth pages
    dashboard/                — protected route group (layout fetches the current user + sidebar)
    actions/                  — Server Actions (auth.ts, logs.ts)
  components/                 — sidebar, activity log table, forms, map
  db/                         — Drizzle schema, client, seed script
  lib/                        — session (jose), DAL, query helpers, zod schemas
  proxy.ts                    — route protection (Next.js 16's middleware → proxy rename)
```
