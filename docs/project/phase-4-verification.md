# Phase 4 Verification — Trial Run (branch `trial-phases-2-4`)

*Owner: orchestrator. Status: initial paper verification. Created: 2026-04-20. Source: [build-plan.md §7](build-plan.md).*

This report is a **static** verification of the trial-branch implementation against the Phase 4 acceptance criteria in the build plan. Runtime checks (e.g., time-to-first-verdict, live email send, end-to-end George stub) require the user to run `npm install && npm run db:migrate && npm run seed && npm run dev` and exercise the flows in a browser. Runtime items are explicitly marked below.

Subagent Bash access was restricted, so `npm run build` / `tsc --noEmit` / `vitest run` were not executed by the engineer agents. The user should run them locally before treating this branch as green.

---

## Check-by-check

### V1 — Every brief contains 2–4 time-horizon-tagged actions (PRD §7, §8.1)

**STATIC PASS.** Count enforced at both client and server:
- Server: [src/lib/publish.ts](../../src/lib/publish.ts) L73–L84 — `publishBrief` rejects if `observations.length` or `closing_actions.length` is outside `[2, 4]`.
- Client: [src/app/admin/briefs/[id]/edit/page.tsx](../../src/app/admin/briefs/[id]/edit/page.tsx) L1080–L1088 — same bounds surfaced as Czech error copy (`"Přidejte alespoň 2 pozorování před publikováním."` etc.).

Time-horizon tag enforced via the frozen four-value enum (`TIME_HORIZON` in [src/types/data-lanes.ts](../../src/types/data-lanes.ts)): **Okamžitě / Do 3 měsíců / Do 12 měsíců / Více než rok**. Enum referenced by 7 files including publish, briefs module, edit form, seed, brief render page.

### V2 — Statistical-validity floor enforced (PRD §10, §13.5, A-017)

**STATIC PASS.** Floor logic lives in [src/lib/cohort.ts](../../src/lib/cohort.ts) (N≥30 global / N≥50 for working capital cycle + pricing power proxy per `docs/data/cohort-math.md`). Below-floor cells emit `achieved_rung = 4` and are treated by the brief renderer as suppressed. References found in `cohort.ts`, `briefs.ts`, `brief/[id]/page.tsx`, and seeded by `scripts/seed.ts` (one rung-4 cell seeded at NACE 41 × Severozápad × S1).

**RUNTIME REQUIRED:** Confirm on a running instance that viewing a seeded below-floor cell's brief suppresses the ratio silently (no fallback number) and that the category-level empty-state fires if both ratios in a category are suppressed.

### V3 — No raw number without comparison (PRD §7.2)

**STATIC PASS (by construction).** Two mechanisms:
1. `BenchmarkSnippet` in [src/app/brief/[id]/page.tsx](../../src/app/brief/[id]/page.tsx) renders the quartile label + `{n}. percentil` together; the percentile integer cannot be rendered alone. Screen-reader label from design §6 (`"{quartileLabel}, {n}. percentil"`).
2. Below-floor rung 4 renders the frozen fallback copy *"Tento ukazatel zatím nemůžeme spolehlivě porovnat — k dispozici je málo srovnatelných firem v kohortě"* — no number, no label.

**RUNTIME REQUIRED:** Spot-check a rendered brief in the browser that every numeric element has a quartile companion.

### V4 — Privacy separation holds end-to-end (PRD §10, D-010)

**STATIC PASS.** Canonical lane identifiers (`brief` / `user_contributed` / `rm_visible` / `credit_risk`) appear in 16 files — migrations, RLS policies, db modules, route handlers. Two separate Postgres connections ([src/lib/db.ts](../../src/lib/db.ts) for `brief` lane, [src/lib/db-user.ts](../../src/lib/db-user.ts) for `user_contributed` lane), never merged. `data_lane` CHECK constraint and RLS policy in [src/supabase/migrations/0002_briefs.sql](../../src/supabase/migrations/0002_briefs.sql) and [0003_user_contributed.sql](../../src/supabase/migrations/0003_user_contributed.sql) enforce the boundary at the DB engine level per ADR-0002-C.

Migration smoke tests in [src/supabase/migrations/migrations.test.ts](../../src/supabase/migrations/migrations.test.ts) assert all enum values match between TypeScript and SQL.

**RUNTIME REQUIRED:** Run `npm test` to confirm the 10 migration tests pass. No RLS live-query test is provided at the trial branch.

### V5 — All three delivery formats render the same brief faithfully

**STATIC PASS with stubbed delivery.** Publish pipeline [src/lib/publish.ts](../../src/lib/publish.ts) L270 drives all three surfaces from one authored artifact:
- Web: `/brief/[id]` route
- PDF: [src/lib/pdf.ts](../../src/lib/pdf.ts) renders the `?format=pdf` variant via Puppeteer (local Chromium; cloud-Chromium deferred per OQ-010)
- Email: [src/lib/email.tsx](../../src/lib/email.tsx) renders condensed format per IA §3 Surface A; stubs to console.log if `RESEND_API_KEY` unset

Same `BriefContent` payload feeds all three. IA-declared deltas (email ≤400 words, PDF full-chrome absent) applied at render time.

**RUNTIME REQUIRED:** After `npm run seed`, publish the seeded brief via `/admin` and verify email console.log, `/brief/[id]` web render, and `/api/pdf/[briefId]?version=N` download all produce matching content.

### V6 — George Business embedding stub exercises the RM introduction flow (PRD §11)

**STATIC: STUB.** [src/lib/auth.ts](../../src/lib/auth.ts) L137 implements the `sr_george_token` cookie path from ADR-0001-E (JWT redirect stub). No `/fake-george` fixture page was found in the trial build, so the RM introduction flow has no mock entry point for end-to-end testing.

**GAP (minor):** a `/fake-george` seed page was mentioned in the feature-implementation brief but doesn't appear in src/app/. Not blocking the static check; flagged for user runtime.

**RUNTIME REQUIRED:** Manually hit `/onboarding?sr_george_token=<jwt>` with a valid signed token to exercise the RM path, or add a `/fake-george` seed page locally for convenience.

### V7 — Time-to-first-verdict < 60s on bank-referred path (PRD §6)

**RUNTIME REQUIRED.** This is a user-measurable check; no static surrogate. Run the bank-referred flow end-to-end (`sr_george_token` cookie set → `/consent` → first `/brief/[id]` load), stopwatch the elapsed time. Target < 60s per PRD §6.

Current implementation does not include artificial delays, and brief-render is a single server-component fetch against `briefs` + `cohort_stats` (neither over ~kB). Expected to pass comfortably.

### V8 — Revocation flow (D-007 single opt-in, D-008 + D-012 Option A stop-flow)

**STATIC PASS.** [src/app/settings/soukromi/page.tsx](../../src/app/settings/soukromi/page.tsx) + `SoukromiClient.tsx` implement the single-action revocation surface; [src/app/api/consent/revoke/route.ts](../../src/app/api/consent/revoke/route.ts) writes a `revoke` event via `src/lib/consent.ts`. Post-revocation confirmation at `/settings/soukromi/odvolano`. D-012 Option A: no row deletion; downstream filters check `latest_event_type` at read time.

**RUNTIME REQUIRED:** Click through `/settings/soukromi` → revoke → verify no further briefs deliver and the post-revocation screen renders.

---

## Known gaps and drift

| ID | Description | Severity | Owner follow-up |
|---|---|---|---|
| **EN-001** (now fixed) | `/api/consent/route.ts` previously passed `ip_address`/`user_agent` to `grantConsent`/`revokeConsent` — those parameters don't exist. Fixed in the bug-fix agent pass; derived `channel` from token presence, `surface` as `onboarding-screen`, `ip_prefix` from `x-forwarded-for`. | was BLOCKER — resolved | — |
| **EN-002** | `source` enum drift: data doc says `self_selected`, migration uses `user_entered`. Seed uses migration's value. Doc is out of date; migration is authoritative. | doc drift | data-engineer to reconcile `docs/data/sector-profile-configuration.md` |
| **EN-003** | Table naming drift: DE addendum named `user_db.sector_profile` (singular); migration uses `sector_profiles` (plural), no `user_db` schema prefix. Migration wins for runtime. | doc drift | data-engineer to reconcile |
| **EN-004** | Cookie-name consistency: revoke page reads `sr_user_id`; onboarding/consent pages set the cookie but the name match hasn't been verified end-to-end. | runtime risk | user to verify in browser or engineer to grep |
| **`tsx` devDependency** added in gap-filler pass for `npm run seed`. Dev-only, standard pattern. | de minimis | approved |
| **`/fake-george` seed page** not present; RM path has no mock entry for local testing. | minor | optional |
| **Cloud Chromium / Resend / React Email** packages are not in `package.json` — code paths stub gracefully when absent. | trial scope | add when wiring live delivery |
| **`npm install`, `npm run build`, `npm test`** not executed by subagents (Bash restricted). | unverified | user to run locally |

---

## What to run

```bash
cd src
npm install
cp .env.example .env.local
# set DATABASE_URL to your Supabase Postgres, ADMIN_PASSWORD_HASH=test, GEORGE_JWT_SECRET=<any>
npm run db:migrate
npm run seed    # creates 1 sample brief + 15 profiles + consent events
npm run dev
```

Then exercise:
- `/admin/login` (password `test`) → `/admin` → edit the seeded brief → publish
- `/onboarding` → `/consent` → `/brief/<seeded-id>`
- `/settings/soukromi` → revoke → confirm stop-flow

## Changelog
- 2026-04-20 — initial paper verification. EN-001 fixed; 4 doc-drift / runtime items open.
