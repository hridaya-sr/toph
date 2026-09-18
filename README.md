# Toph - Dev Challenge

Farm workers log their work by voice in the field; Toph transcribes and structures each entry (activity type, field, chemicals/rates, timing, a response-accuracy score) into a searchable record, and admins review, tag, and act on that data from a dashboard. This submission implements the full product end-to-end — logging, review, scheduling, messaging, reporting — against a real Postgres/Drizzle backend, not just a single screen.

## Tech stack

- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript
- **Database:** PostgreSQL
- **ORM:** Drizzle

## Setup / running locally

```bash
cp .env.example .env   # then set AUTH_SECRET to any random string
docker compose up && npm install && npm run db:push && npm run db:seed && npm run dev
```

Then sign in at `http://localhost:3000/login` with:

- **priya@sunrisevalley.farm / password123** (admin)
- or `isaac` / `grace` / `liam` / `sophia` `@sunrisevalley.farm` (employees) — same password

`npm run db:seed` gives you a minimal, hand-authored dataset (one farm, five accounts, a handful of logs/shifts/announcements) — enough to sanity-check that each feature works. If you want something closer to a real farm — **13 accounts, ~2 weeks of non-uniform activity logs, DM/announcement read state, a populated schedule** — run `npm run db:seed:demo` instead (same commands otherwise; it prints its own login list and password on completion). Use the minimal seed for a quick functional check; use the demo seed when you want Performance, Reports, or the notification badges to show real trends instead of a handful of rows.

## Live deployment

**toph-gamma.vercel.app**

Pre-seeded with the demo dataset — no setup needed, just log in with one of the demo credentials above and start clicking around.

- Support Tab not implemented

## Key design decisions

**Monolith (Next.js + Postgres) instead of a separate backend service.** Server Components and Server Actions talk to Postgres directly through Drizzle — there's no standalone API service in front of it. A split backend (Express/tRPC service + a thin Next.js client) was the alternative, but for one team building the whole product on one timeline, that split buys nothing (extra deploy, extra network hop, a second auth surface to keep in sync) and the framework's own server layer already *is* the backend.

**Drizzle ORM instead of Prisma.** Drizzle's query builder (`and()`, `eq()`, `gte()`, raw `sql` escape hatches for aggregates — see `src/lib/queries.ts`) maps directly onto SQL you already know, with no code-gen step or duplicated schema file. Prisma has a more polished DX and bigger ecosystem, but for a schema this size that tradeoff wasn't worth losing the lighter, more predictable query surface — and Drizzle's cold-start footprint is friendlier on serverless.

**Hand-rolled auth (jose-signed JWT, a DAL, `proxy.ts`) instead of NextAuth.** Sessions are a JWT signed with `jose` in an httpOnly cookie (`src/lib/session.ts`); `src/lib/dal.ts` is the one place real authorization checks happen; `proxy.ts` (Next 16's renamed middleware) does a cheap, DB-free redirect off the cookie alone. This app needed exactly one auth strategy plus one non-standard feature — admin "Switch User" impersonation, which doesn't map cleanly onto NextAuth's provider/session model — so rolling it by hand kept the auth surface small, fully auditable, and easy to bend around that feature instead of fighting a library's assumptions.

**Leaflet for the field map instead of a static image.** Fields carry real `centerLat`/`centerLng` in the schema, and both the Map page and each log's expanded view need to show *which* field interactively (pan/zoom, multiple fields at once), which a static image can't do. `react-leaflet` is dynamically imported client-only (`ssr: false`) to avoid a `window`-not-defined build error, and OpenStreetMap tiles need no API key or billing setup — appropriate for a challenge submission with no ops budget.

**Transcript modeled as structured Q&A (jsonb) instead of a text blob.** `transcriptQA` is an array of `{ key, prompt, answer }` triples alongside a separate free-text `transcriptSummary`. The product's value is "voice log → structured farm record," not "voice log → paragraph" — Audit Manager and the log detail view need to show exactly what was asked and answered (which chemical, what rate) and flag a specific low-confidence answer, not the whole blob. Storing it structured from the start means the UI renders Q&A pairs directly, with no second parsing pass over free text.

