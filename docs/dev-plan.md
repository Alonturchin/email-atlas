# Dev Plan — Email Creative Intelligence Platform

Source spec: [description.md](description.md).

Dev environment runs in **Docker** (Next.js app container + Postgres container, orchestrated via `docker-compose`). SQLite is dropped — Postgres is used in both dev and prod so the schema, migrations, and `templateHtml` `@db.Text` behavior match. Package manager: **pnpm** (via Corepack inside the container).

---

## Phase 0 — Repo & Docker scaffold

**Goal:** `docker compose up` boots a working (empty) Next.js app talking to Postgres.

- Initialize Next.js 15 (App Router, TS, Tailwind) at repo root.
- Add `shadcn/ui` init, Lucide, TanStack Query provider, Fraunces + Inter via `next/font/google`.
- Add Prisma; configure `DATABASE_URL` from env.
- `Dockerfile` (Node 20-alpine, multi-stage: deps → dev/runtime). Dev target runs `next dev` with mounted source.
- `docker-compose.yml`:
  - `web`: builds dev target, mounts `.:/app`, exposes `3000`, depends on `db`.
  - `db`: `postgres:16-alpine`, named volume `pgdata`, exposes `5432`, healthcheck.
- `.env.example` (committed) + `.env.local` (gitignored) with `KLAVIYO_API_KEY` placeholder and `DATABASE_URL=postgresql://postgres:postgres@db:5432/emailintel`.
- `.dockerignore`, `.gitignore`.

**Exit criteria:** `docker compose up` serves `localhost:3000` with a placeholder page; `docker compose exec web npx prisma migrate dev` succeeds against the `db` service.

---

## Phase 1 — Schema & Prisma migration

**Goal:** Persisted `Campaign` model matches the spec.

- Port the schema from the spec into `prisma/schema.prisma` (Postgres provider).
- Keep `tags` / `audienceNames` as JSON strings (per spec) — easy to swap to native `Json` later if needed.
- Run initial migration inside the container; commit `prisma/migrations/`.
- Add `lib/db.ts` with the singleton Prisma client pattern (avoid hot-reload connection leaks).

**Exit criteria:** Migration applied; `prisma studio` (via `docker compose exec web npx prisma studio`) opens and shows the empty `Campaign` table.

---

## Phase 2 — Klaviyo client + types

**Goal:** Typed, retry-aware Klaviyo wrapper. No DB writes yet.

- `lib/klaviyo/client.ts`: typed `fetch` wrapper with `Authorization`, `revision: 2024-10-15`, `accept: application/vnd.api+json` headers baked in. Server-only (`import 'server-only'`).
- 429 retry with exponential backoff + `Retry-After` honor.
- `lib/klaviyo/types.ts`: Zod schemas for JSON:API envelopes — campaigns list, campaign-message, template, metrics list, campaign-values-report response.
- `lib/klaviyo/enrich.ts`: `deriveSeason` + `deriveHoliday` (±3-day windows for the holidays listed in the spec, including computed Mother's/Father's/Memorial Day/Thanksgiving). Unit-testable pure functions.
- Add `vitest` (runs inside container) and a small test file for `enrich.ts`.

**Exit criteria:** A throwaway script (`scripts/probe-klaviyo.ts`) run inside the container against a real key returns parsed/validated campaigns. Enrich unit tests pass.

**🛑 PAUSE POINT:** Confirm with user — provide Klaviyo API key, verify probe works end-to-end against their account.

---

## Phase 3 — Sync job

**Goal:** `POST /api/sync` populates the DB from Klaviyo, idempotently.

- `lib/klaviyo/sync.ts`:
  1. Fetch "Placed Order" metric ID (cache for run duration).
  2. List campaigns with `include=campaign-messages,tags`.
  3. For each campaign → fetch message → fetch template HTML.
  4. Fetch `campaign-values-report` (batch where possible) for metrics.
  5. Run enrichment, `upsert` into `Campaign` (key on Klaviyo ID).
  6. Structured progress logs (start, per-step, summary with counts + duration).
- `app/api/sync/route.ts`: `POST` triggers `sync()`. Guard with a server-only secret header (`x-sync-token`) to avoid drive-by triggers.
- Skip-gracefully behavior for campaigns missing template HTML (SMS, drafts) — store `templateHtml: null`.

**Exit criteria:** `curl -X POST -H "x-sync-token: ..." localhost:3000/api/sync` populates Postgres with real campaigns. Re-running is idempotent (no dupes, updates in place).

**🛑 PAUSE POINT:** User runs first sync against their Klaviyo account. Validate row count + spot-check a couple of campaigns in Prisma Studio.

---

## Phase 4 — Campaigns API

**Goal:** Filtered/paginated read endpoint that the UI will consume.

- `GET /api/campaigns` accepting: `q` (matches name/subject), `tags[]`, `holiday`, `season`, `from`, `to`, `minOpenRate`, `sort` (date | revenue | openRate | clickRate, asc/desc), `favoritesOnly`, `page`, `pageSize`.
- `GET /api/campaigns/[id]` for detail.
- `PATCH /api/campaigns/[id]` for `favorited` toggle.
- Zod-validate query params; return `{ items, total, page, pageSize }`.
- Indexes already in schema cover `sendDate`, `holiday`, `season`; add `@@index([openRate])` if profiling shows it's needed.

**Exit criteria:** Hand-crafted `curl` queries return the expected slices. `/api/campaigns?sort=revenue:desc&season=summer` works.

---

## Phase 5 — Gallery page (`/`)

**Goal:** Pinterest-style browse experience.

- Layout: sticky top bar (logo, debounced search, favorites toggle); left filter sidebar (collapsible); main grid.
- TanStack Query hooks (`useCampaigns(filters)`) talking to `/api/campaigns`.
- Filter state lives in URL query string (shareable links); sidebar reads/writes via `useSearchParams` + `router.replace`.
- `<CampaignCard>`: thumbnail iframe + date/holiday badge + name (Fraunces italic) + subject + 3-stat row.
- `<TemplatePreview>` iframe per spec — `sandbox=""`, `pointer-events: none`, scaled.
- Toolbar above grid: result count, sort dropdown, density toggle (3/4/5 cols).
- Visual treatment: cream `#faf8f3` background, mono labels, generous whitespace.

**Exit criteria:** User can browse, filter, search, and sort their real campaigns in the browser.

---

## Phase 6 — Detail page (`/campaigns/[id]`)

**Goal:** Single-campaign deep-dive.

- Split layout: full-size template iframe on the left, metrics block on the right.
- Big-number metric display, subject/preview text, tags as pills.
- "Similar campaigns" section: same `holiday` OR `tags` overlap ≥ 1; limit 6, sorted by revenue desc.
- Favorite toggle button → calls `PATCH /api/campaigns/[id]`.
- "Add to compare" action (stashes ID in URL state for `/compare`).

**Exit criteria:** Clicking a card → full detail view with similar-campaign suggestions.

---

## Phase 7 — Compare page (`/compare?ids=a,b`)

**Goal:** Side-by-side comparison with per-metric winners.

- Two-column layout (extend to 3–4 later if desired); each column = same content shape as the detail page.
- Per-metric winner badge (highest open/click/revenue/CTOR; lowest unsub).
- Empty-state when `ids` is missing or one ID.

**Exit criteria:** Pick two campaigns from gallery → compare view highlights winners.

---

## Phase 8 — Polish & ops

- Nightly sync: documented `docker compose run --rm web npm run sync` cron pattern (the route already exists; this is just scheduling).
- Loading skeletons for grid + detail; error boundaries; empty states.
- Lighthouse pass on `/`; lazy-load offscreen iframes (`loading="lazy"` + IntersectionObserver if needed for perf with many cards).
- README with Docker quickstart + first-sync instructions.
- Production Dockerfile target (`next build` → `next start`) and a prod-shaped `docker-compose.prod.yml` (separate; not required for dev).

**Exit criteria:** Cold-start a fresh machine → `docker compose up` → run sync → browse the gallery, with no manual steps beyond pasting the API key.

---

## Phase 9 — Admin panel + login ✅

**Goal:** Gate the app behind a real login; admins can invite/manage users.

- **Auth stack:** Auth.js v5 with credentials provider + Prisma adapter + bcryptjs. **JWT** session strategy (required for credentials provider). Role + `mustChangePassword` flag baked into the JWT and re-hydrated on `session.update()`.
- **Schema:** `User`, `Account`, `Session`, `VerificationToken` + `UserRole` enum (`ADMIN | MEMBER`).
- **Bootstrap:** [`lib/bootstrap-admin.ts`](../lib/bootstrap-admin.ts), called from [`instrumentation.ts`](../instrumentation.ts) on Node start. Creates user with `ADMIN_EMAIL` + `ADMIN_PASSWORD` if missing; promotes to ADMIN if user already exists with a different role. Skips when env vars are unset or still placeholder.
- **Middleware:** [`middleware.ts`](../middleware.ts) gates everything except `/login`, `/api/auth/*`, `/api/sync` (its own `x-sync-token` guard), and static assets. `/admin/*` additionally requires `role === "ADMIN"`.
- **Pages:** `/login` (server-action sign-in) · `/admin/users` (list + add + reset password modal + delete; can't self-delete).
- **Top bar:** user-menu dropdown with email/role/sign-out; "Admin" link visible to admins only.

**Exit criteria met:** Unauthenticated `GET /` → 307 to `/login`. Sign-in via `/api/auth/callback/credentials` returns 302 + `authjs.session-token` cookie. Authenticated `GET /` → 200. Admin can create a member from the panel; member can sign in but `/admin/users` redirects them to `/`.

**Dev-mode gotcha worth recording:** Server Action IDs rotate on every `next dev` restart, so any page kept open across a restart will throw `UnrecognizedActionError` on submit. Hard refresh fixes it. Doesn't affect prod (`next build` produces stable IDs per deploy).

---

## Phase 10 — Daily auto-sync ✅

**Goal:** Klaviyo data refreshes without anyone clicking anything.

- New `cron` service in [docker-compose.yml](../docker-compose.yml) — `alpine:3` + `curl` + `busybox crond`, `TZ=America/New_York`.
- Crontab: `0 6 * * *` — fires `POST http://web:3000/api/sync` with `x-sync-token: $SYNC_TOKEN` daily at **06:00 ET**.
- Output piped to PID-1 stdout so it surfaces under `docker compose logs cron`.
- Failure handling: if the sync route returns 5xx, cron logs it and moves on; the next morning's run picks up where it left off (sync is idempotent).

**Exit criteria met:** `docker compose up -d cron` → crontab installed at 06:00 EDT, network reachability and auth handshake verified (bad token returns 401, real token reaches sync).

---

## Guardrails carried through every phase

- Klaviyo key only on the server. No `NEXT_PUBLIC_*` exposure.
- Iframes always `sandbox=""` with no `allow-scripts`.
- Zod-parse every Klaviyo response at the boundary.
- Graceful fallbacks for missing template HTML.
- Idempotent sync (safe to re-run anytime).
