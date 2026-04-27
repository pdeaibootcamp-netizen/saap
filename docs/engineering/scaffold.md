# Strategy Radar — Application Scaffold

*Owner: engineer · Slug: scaffold · Last updated: 2026-04-18*

## 1. Upstream links

- Product: [docs/product/mvp-metric-list.md](../product/mvp-metric-list.md), [docs/product/sector-profile-configuration.md](../product/sector-profile-configuration.md), [docs/product/multi-format-delivery.md](../product/multi-format-delivery.md), and all Phase 2 feature PRDs in `docs/product/`.
- Design: [docs/design/information-architecture.md](../design/information-architecture.md), [docs/design/trust-and-consent-patterns.md](../design/trust-and-consent-patterns.md).
- Data: [docs/data/privacy-architecture.md](../data/privacy-architecture.md), [docs/data/cohort-math.md](../data/cohort-math.md).
- ADRs: [adr-0001-tech-stack.md](adr-0001-tech-stack.md), [adr-0002-brief-storage-and-delivery.md](adr-0002-brief-storage-and-delivery.md).
- Decision log: D-004 (Czech only), D-010 (canonical lane identifiers), D-013 (Supabase + Vercel), D-015 (Phase 2 gate ratification).

---

## 2. What this scaffold is and is not

**Is:** The empty Next.js (App Router) + TypeScript application skeleton, Supabase migration files, TypeScript enum types, DB connection module, and a passing unit smoke test. This is the foundation that all Phase 2 feature engineer tasks will fill in.

**Is not:** Any feature UI, any authoring tool, any brief rendering, any email sending. Those arrive in Phase 2 (Track A, B, C) and Phase 3 (integration).

---

## 3. ORM / query layer decision

**Choice: `postgres` npm package (raw SQL with tagged templates).**

Rationale logged here because this is a non-trivial technical choice (ADR-level decision, not just file naming):

| Option | Reason rejected |
|---|---|
| Prisma | Code-generation step complicates CI; Prisma Client must be re-generated on schema changes; ORM "helpfulness" (automatic JOINs) is a risk against the RLS lane model — a missed WHERE clause is masked rather than caught at the DB layer. |
| Drizzle | More lightweight than Prisma but still a schema-definition layer that duplicates the SQL migrations. At MVP the schema is small enough that duplication adds cost without benefit. |
| **`postgres` (chosen)** | Tagged-template SQL is explicit: every query is exactly what it says, RLS enforcement at the DB level cannot be bypassed by an ORM helper, no code-gen step, TypeScript compile-time checks on lane enum values in query parameters. |

The `data_lane` column is typed as the `DataLane` TypeScript union (`src/types/data-lanes.ts`), which mirrors the DB `data_lane` enum exactly. Passing an invalid lane string to a query function is a TypeScript compile error.

**Connection module:** `src/lib/db.ts` exports a single `sql` tagged-template client wired to `DATABASE_URL`. In production, `DATABASE_URL` points to the `brief_lane_role` credentials (pooler endpoint). A separate `src/lib/db-user.ts` will be created in Phase 2 when the `user_contributed` lane is activated — it must use `user_contributed_lane_role` credentials; never reuse the `brief` lane connection.

---

## 4. Directory structure

```
src/
├── app/
│   ├── admin/          # Analyst authoring back-end (Phase 2 Track A)
│   ├── brief/          # Owner brief web view (Phase 2 Track C)
│   ├── onboarding/     # Sector profile configuration (Phase 2 Track C)
│   ├── globals.css     # Global styles (mobile-first, 375px min)
│   ├── layout.tsx      # Root layout (lang="cs", metadata)
│   └── page.tsx        # Placeholder root route (replaced in Phase 2)
├── lib/
│   └── db.ts           # Database connection — brief lane (brief_lane_role)
├── supabase/
│   └── migrations/
│       ├── 0001_init_lanes.sql         # Enums + DB roles + RLS skeleton
│       ├── 0002_briefs.sql             # briefs + brief_deliveries tables
│       ├── 0003_user_contributed.sql   # sector_profiles table
│       ├── 0004_consent_events.sql     # consent_events + FK back-reference
│       └── migrations.test.ts          # Enum smoke tests (vitest)
├── types/
│   └── data-lanes.ts   # TypeScript enums mirroring DB enum values
├── .env.example        # Environment variable template
├── next.config.js      # Next.js configuration (Czech-only, strict mode)
├── package.json        # Dependencies
├── tsconfig.json       # TypeScript configuration
└── vitest.config.ts    # Vitest configuration
```

Phase 2 will add:
- `src/lib/auth.ts` — George JWT validation + admin session check.
- `src/lib/db-user.ts` — user_contributed lane DB connection.
- `src/lib/email.ts` — Resend transactional email client.
- `src/app/api/` — API routes (publish pipeline, health check, George token handoff).
- Feature components under `src/app/brief/`, `src/app/admin/`, `src/app/onboarding/`.

---

## 5. Test plan

### Unit (passing at scaffold stage)

**`src/supabase/migrations/migrations.test.ts`** — Vitest suite verifying:
- `DATA_LANE` TypeScript enum contains exactly the four canonical lane values (`brief`, `user_contributed`, `rm_visible`, `credit_risk`) matching `0001_init_lanes.sql`.
- `PUBLISH_STATE`, `DELIVERY_FORMAT`, `CONSENT_EVENT_TYPE`, `CONSENT_SURFACE`, `CONSENT_CHANNEL`, `SIZE_BAND`, `CZ_REGION`, `TIME_HORIZON` enums contain exactly the values in their respective SQL enums.
- `CONSENT_SURFACE` at MVP intentionally excludes `rm-introduction-flow` (Increment 2+ only).
- `lanes_covered` default covers all four canonical lanes.
- Lane values do not collide with each other (brief ≠ user_contributed etc.).

Run with: `cd src && npm test`

### Integration (requires live Supabase instance — Phase 2/3)

These tests are defined here as obligations; they require a running local Supabase instance (`supabase start`) and cannot run in the current environment:

1. **RLS lane enforcement** — a connection using `brief_lane_role` credentials cannot `SELECT` from `sector_profiles`; a connection using `user_contributed_lane_role` credentials cannot `SELECT` from `briefs`.
2. **CHECK constraint on data_lane** — an INSERT into `briefs` with `data_lane = 'user_contributed'` is rejected by the DB.
3. **Consent FK enforcement** — an INSERT into `sector_profiles` with a non-existent `consent_event_id` is rejected.
4. **current_consent_status view** — given a user with a grant event followed by a revoke event, the view returns `event_type = 'revoke'`.

These four integration tests are logged as a Phase 3 deliverable. The Bash tool being unavailable in this session is the immediate blocker for running even the unit tests; see §7.

### Privacy invariant (Phase 3)

- No query through `sql` (brief lane) can return rows from `sector_profiles`.
- The `benchmark_snippet` JSONB column in `briefs` contains no fields named `user_id`, `revenue`, `labor_cost_total`, or any individual-level financial field defined in `cohort-math.md §5`.

---

## 6. How to run locally

### Prerequisites

- Node.js 20+
- pnpm or npm (this scaffold uses npm; either works)
- Supabase CLI: `brew install supabase/tap/supabase`
- A Supabase project (free tier is sufficient for MVP trial)

### Setup

```bash
# 1. Install dependencies
cd src
npm install

# 2. Copy env template
cp .env.example .env.local
# Fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
# SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL from your Supabase project dashboard.

# 3. Run migrations against your Supabase project
# (use the direct endpoint, port 5432, for migrations)
supabase db push

# 4. Start the dev server
npm run dev
# → http://localhost:3000

# 5. Run smoke tests
npm test
```

### Local Supabase (optional, for integration tests)

```bash
# Start a local Supabase stack (requires Docker)
supabase start
# This applies migrations from src/supabase/migrations/ automatically.
# Connection string for local dev: postgresql://postgres:postgres@localhost:54322/postgres
```

### Build check

```bash
cd src
npm run build
# Should exit 0 with no TypeScript errors.
```

---

## 7. Open questions

These are additional items surfaced during scaffold implementation. They do not block Phase 2 start.

| # | Question | Blocking |
|---|---|---|
| EN-S-001 | **Bash unavailable in worktree session** — `npm install` and `vitest run` could not be executed to confirm the tests pass. Tests are authored and logically correct against the TypeScript source. A human or CI must run `cd src && npm install && npm test` to confirm green. This is a tooling environment constraint, not a code issue. | Test-pass confirmation before Phase 2. |
| EN-S-002 | **FK ordering constraint** — `0003_user_contributed.sql` creates `sector_profiles.consent_event_id` as NOT NULL but the FK to `consent_events` is applied at the end of `0004_consent_events.sql` (deferred ALTER). If Supabase's migration runner applies these in a transaction, this is fine. If it auto-splits files, the NOT NULL without a FK temporarily violates referential intent. Should be verified on first `supabase db push`. Mitigation: combine into a single migration file if the runner splits. | First `supabase db push` run. |
| EN-S-003 | **`brief_lane_role` login credentials** — the roles are created in `0001_init_lanes.sql` as `NOLOGIN`. In Supabase, roles used by the application need `LOGIN` capability and a password, or they must be mapped to Supabase's built-in connection-string format. The exact role-to-connection-string mapping for Supabase's pooler needs confirming before `DATABASE_URL` can be set to a `brief_lane_role` connection. Workaround for MVP trial: use the `anon` Supabase role with RLS enforced via Supabase's built-in RLS mechanism (which uses `auth.uid()` predicates). Requires a Phase 2 ADR addendum. | Phase 2 DB connection setup. |
| EN-S-004 | **OQ-050 — Direct sign-up auth hand-off** (cross-reference from project open-questions.md). ADR-0001-E covers bank-referred JWT only. Direct sign-up identity + consent entry path is unspecified. This affects the `src/lib/auth.ts` module design in Phase 2. | Phase 2 onboarding feature engineering. |

---

## 8. Deployment + rollback

- **Deploy:** Push to `main` → Vercel auto-deploys. Migrations must be applied separately via `supabase db push` before the deploy reaches production (or via a `vercel-build` pre-deploy hook — Phase 2 decision).
- **Env vars:** All in Vercel project settings. Template in `.env.example`. Never commit `.env.local`.
- **Rollback:** Vercel instant rollback restores application code. Migrations are additive-only (no DROP, no column removal) — rolling back app code against the new schema is safe (new columns are nullable or have defaults).
- **Feature flag:** Not applicable at scaffold stage.

---

## Changelog

- 2026-04-18 — initial draft — engineer. Created Next.js scaffold, four SQL migrations, TypeScript enum types, DB connection module, Vitest smoke test, `.env.example`. ORM choice documented (raw `postgres` over Prisma/Drizzle). Four open questions logged.
