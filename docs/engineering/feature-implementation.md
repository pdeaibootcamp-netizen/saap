# Feature Implementation — Engineering

*Owner: engineer · Slug: feature-implementation · Last updated: 2026-04-20*

## 1. Upstream links

- Product: [docs/product/sector-profile-configuration.md](../product/sector-profile-configuration.md), [docs/product/multi-format-delivery.md](../product/multi-format-delivery.md), and all Phase 2 feature PRDs in `docs/product/`.
- Design: [docs/design/trust-and-consent-patterns.md](../design/trust-and-consent-patterns.md), [docs/design/information-architecture.md](../design/information-architecture.md), [docs/design/sector-profile-configuration.md](../design/sector-profile-configuration.md).
- Data: [docs/data/sector-profile-configuration.md](../data/sector-profile-configuration.md), [docs/data/privacy-architecture.md](../data/privacy-architecture.md), [docs/data/cohort-math.md](../data/cohort-math.md).
- Scaffold: [docs/engineering/scaffold.md](scaffold.md).
- Decisions in force: D-004 (Czech only), D-007 (single opt-in), D-008 (settings revocation), D-012 (stop-flow Option A), D-013 (Supabase + Vercel), D-015 (Phase 2 gate).

---

## 2. Summary

Branch `trial-phases-2-4` delivers the Phase 2 MVP application on top of the Phase 1 scaffold. It adds the analyst authoring back-end (`/admin`), the owner brief view and onboarding flow (`/brief`, `/onboarding`, `/consent`), the PDF and email delivery pipeline stubs, the full set of API routes, and — completed in this session — the development seed script, the consent revocation settings page, and this consolidated engineering note. The application is a Next.js 14 App Router project backed by Supabase Postgres; all data-lane boundaries are enforced by DB-level RLS with TypeScript enum guards at the application layer.

---

## 3. Directory map

```
src/
├── app/
│   ├── admin/          Analyst authoring back-end — brief CRUD, publish flow, auth guard
│   ├── api/            Next.js API routes (admin, consent grant/revoke, profile, health)
│   ├── brief/          Owner brief web view (published brief reader)
│   ├── consent/        Consent grant screen (D-007 single opt-in, four-lane declaration)
│   ├── onboarding/     Sector profile configuration flow (NACE, size band, region)
│   ├── settings/       Consent management — /settings/soukromi (revoke) + /odvolano (confirmation)
│   ├── globals.css     Global styles (mobile-first, 375 px min)
│   ├── layout.tsx      Root layout (lang="cs", metadata)
│   └── page.tsx        Root route (redirects to /onboarding or /brief based on consent state)
├── lib/
│   ├── auth.ts         Admin session cookie + George JWT stub (ADR-0001-D, ADR-0001-E)
│   ├── briefs.ts       Brief lane CRUD — SELECT/INSERT/UPDATE on `briefs` table
│   ├── cohort.ts       In-memory cohort resolution + benchmark snapshot builder (stub)
│   ├── consent.ts      Consent ledger read/write via Supabase service-role key
│   ├── db.ts           Brief-lane Postgres connection (brief_lane_role, raw sql tags)
│   ├── db-user.ts      User-contributed-lane Postgres connection (user_contributed_lane_role)
│   ├── pdf.ts          PDF generation stub (Puppeteer, writes to /tmp/)
│   ├── profiles.ts     Sector profile read/write (user_contributed lane via db-user.ts)
│   └── publish.ts      Brief publish pipeline — cohort snapshot + email + PDF dispatch
├── scripts/
│   └── seed.ts         Idempotent development seed (consent events, sector profiles, sample brief)
├── supabase/
│   └── migrations/
│       ├── 0001_init_lanes.sql         DB roles, RLS skeleton, core enums
│       ├── 0002_briefs.sql             briefs + brief_deliveries tables
│       ├── 0003_user_contributed.sql   sector_profiles table (user_contributed lane)
│       ├── 0004_consent_events.sql     consent_events table + current_consent_status view
│       ├── 0005_profile_history.sql    sector_profile_history + prepopulated_seed tables
│       └── migrations.test.ts          Enum smoke tests (vitest)
├── types/
│   └── data-lanes.ts   TypeScript enums mirroring DB enum values (D-010)
├── .env.example        Environment variable template
├── next.config.js      Next.js configuration
├── package.json        Dependencies + scripts
├── tsconfig.json       TypeScript configuration
└── vitest.config.ts    Vitest configuration
```

---

## 4. How to run locally

```bash
# 1. Install dependencies (includes tsx for the seed script)
cd src
npm install

# 2. Copy env template and fill in your Supabase credentials
cp .env.example .env.local
# Required vars:
#   NEXT_PUBLIC_SUPABASE_URL        — from Supabase dashboard > Project Settings > API
#   NEXT_PUBLIC_SUPABASE_ANON_KEY   — from Supabase dashboard > Project Settings > API
#   SUPABASE_SERVICE_ROLE_KEY       — from Supabase dashboard > Project Settings > API
#   DATABASE_URL                    — postgres connection string (direct or pooler)
#   ADMIN_PASSWORD_HASH             — set to the literal string "test" for development
#                                     (auth.ts compares passwords as plain strings at MVP trial;
#                                      omit the var entirely and auth.ts accepts "test" by fallback)
#   GEORGE_JWT_SECRET               — any string for local dev; defaults to a hardcoded dev secret

# 3. Apply database migrations
npm run db:migrate    # runs: supabase db push
# Or for local Docker-based Supabase:
#   supabase start    # applies migrations automatically

# 4. Run the development seed (idempotent — safe to re-run)
npm run seed
# Creates: 15 sector_profiles + matching consent_events + prepopulated_seed rows,
# 1 published sample brief for NACE 46, prints analyst login instructions.

# 5. Start the dev server
npm run dev
# → http://localhost:3000

# 6. Test entry points
#   /admin               Analyst back-end — password: test
#   /onboarding          Owner onboarding flow
#   /consent             Consent grant screen
#   /settings/soukromi   Consent revocation screen

# 7. Run unit tests
npm test
```

---

## 5. What is stubbed and why

| Feature | Stub behaviour | Why |
|---|---|---|
| **Email delivery (Resend)** | Logs the email payload to console when `RESEND_API_KEY` is absent; does not throw | New third-party dependency (escalated OQ — see open-questions); safe local dev without an API key |
| **PDF generation (Puppeteer)** | Uses local Chromium if installed; writes to `/tmp/strategy-radar-pdfs/`; falls back gracefully if Chromium absent | Puppeteer requires a Chromium binary not present in all environments; flagged in scaffold.md as a Phase 3 concern |
| **Signed brief URL** | Brief PDF links are plain `/api/briefs/<id>/pdf` paths, not signed S3/GCS URLs | Storage backend not yet decided; plain path works for trial |
| **George Business redirect** | `/fake-george` route issues a stub George JWT for local testing without a live George embed | Real George JWT comes from the George Business WebView at production; the stub enables end-to-end local testing |
| **Cohort computation** | In-memory `SEED_COHORTS` array in `cohort.ts`; no `cohort_stats` DB table | Real cohort compute is Track B, Increment 2 (cohort-math.md §3); seed data is structurally correct fiction |
| **Admin authentication** | Plain string comparison against `ADMIN_PASSWORD_HASH` env var | bcrypt adds a new dependency (OQ for orchestrator decision); acceptable for internal trial tooling |

---

## 6. Deviations from ADRs and designs

### Table naming: `sector_profiles` vs. `user_db.sector_profile`

The data doc (`sector-profile-configuration.md` §2) refers to the table as `user_db.sector_profile` (using a schema prefix and singular form). The migration (`0003_user_contributed.sql`) creates the table as `sector_profiles` (public schema, plural). These names differ. The implementation uses `sector_profiles` — the migration is the authoritative source. The `user_db` prefix in the data doc was descriptive shorthand for the user-contributed lane, not a literal Postgres schema name. Confirmed aligned in practice; the data doc language should be treated as lane notation, not a schema name.

### No `cohort_stats` table

The seed brief references `cohort.ts` returns an in-memory `SEED_COHORTS` array. There is no `cohort_stats` table in the migrations. This is the intended MVP stub posture per `cohort.ts` header comment.

### `sector_profiles.nace_sector` vs. `nace_division`

The data doc uses the field name `nace_division`; the migration and all application code use `nace_sector`. These refer to the same field. The implementation follows the migration column name. The data doc field name was an alternative label. No data is lost; the constraint `CHECK (nace_sector ~ '^\d{2}$')` correctly enforces 2-digit NACE codes.

### `sector_profiles` source values

The data doc specifies `source` as `prepopulated | self_selected`. The migration defines `CHECK (source IN ('user_entered', 'prepopulated', 'user_correction'))`. There is a mismatch: `self_selected` (data doc) vs. `user_entered` (migration). The implementation uses `user_entered` per the migration. This should be aligned in a future migration if the data doc naming is preferred. Logged here as a known drift.

### Existing `/api/consent/route.ts` parameter mismatch

The existing `POST /api/consent` route calls `grantConsent` and `revokeConsent` with `ip_address` and `user_agent` parameters that do not match the function signatures in `consent.ts` (which accept `surface`, `channel`, `ip_prefix`). This is a pre-existing bug in code written before `consent.ts` was finalised. The new `/api/consent/revoke/route.ts` calls `revokeConsent` with the correct parameters. The original `/api/consent/route.ts` will fail at runtime if the `grant` action is used via that route. Flagged for a follow-up fix but not touched here per scope constraints.

---

## 7. Known gaps and follow-ups

These items were either flagged in the scaffold or surfaced during Phase 2 implementation. Open questions are cross-referenced by ID to `docs/project/open-questions.md`; do not duplicate content from there.

| ID | Gap | OQ reference |
|---|---|---|
| EN-S-001 | Test execution not confirmed in session — `npm install && npm test` must be run by a human or CI to confirm all tests pass. Tooling constraint, not a code issue. | None — environment constraint |
| EN-S-002 | FK ordering between `0003_user_contributed.sql` and `0004_consent_events.sql` must be verified on first `supabase db push`. | None |
| EN-S-003 | `brief_lane_role` created as NOLOGIN in migrations — Supabase connection-string mapping not yet verified. See scaffold.md §7. | OQ-002 (resolved: Supabase chosen), but role-to-connection-string mapping is still a Phase 2 task |
| EN-S-004 | Direct sign-up auth hand-off (`resolveUserId` in `auth.ts`) is a stub returning `null`. OQ-050 tracks this. | OQ-050 |
| EN-001 | `/api/consent/route.ts` calls `grantConsent`/`revokeConsent` with incorrect parameter names (`ip_address`, `user_agent`). Needs a one-line fix to match the `consent.ts` signature (`surface`, `channel`, `ip_prefix`). | None — new finding |
| EN-002 | `sector_profiles.source` enum values differ between the data doc (`self_selected`) and the migration (`user_entered`). One should be updated to match the other; requires a migration if the column CHECK is changed. | None — noted as drift above |
| EN-003 | OQ-007 (ČS support contact) used as `[OQ-007 placeholder]` in `/settings/soukromi/odvolano/page.tsx`. Must be replaced before production. | OQ-007 |
| EN-004 | The `/settings/soukromi/page.tsx` server component reads `sr_user_id` cookie. That cookie name must match whatever cookie the `/onboarding` or `/consent` flow sets. Verify cookie name consistency across those routes before testing the revocation flow end-to-end. | None — integration touchpoint |

---

## 8. Deployment and rollback

See [scaffold.md §8](scaffold.md#8-deployment--rollback) for the base deployment model. No changes to the deployment model in Phase 2; all migrations remain additive.

**Feature flag:** The `/settings/soukromi` route has no feature flag. If revocation must be hidden, remove the link from the brief detail footer (design §6 entry point) — the route itself is always present but not discoverable without the link.

---

## 9. Open questions

Cross-reference to `docs/project/open-questions.md`:

- **OQ-007** — ČS support contact for post-revocation screen.
- **OQ-050** — Direct sign-up auth hand-off (affects `resolveUserId` in `auth.ts` and `/api/consent/revoke/route.ts`).
- **EN-001** (new, see §7) — `/api/consent/route.ts` parameter mismatch. Not logged in `open-questions.md` as it is a local bug fix, not a cross-domain decision.

---

## Changelog

- 2026-04-20 — initial consolidated note — engineer. Covers Phase 2 branch `trial-phases-2-4`: directory map, run instructions, stub inventory, ADR/design deviations, known gaps EN-S-001..004 plus new EN-001..004.
