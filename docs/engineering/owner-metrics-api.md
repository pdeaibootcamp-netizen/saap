# Owner Metrics API — Engineering

*Owner: engineer · Slug: owner-metrics-api · Last updated: 2026-04-27*

## 1. Upstream links

- Product: [docs/product/in-tile-prompts.md](../product/in-tile-prompts.md)
- Design: `docs/design/in-tile-prompts.md` (not yet drafted at spec time)
- Data: [docs/data/owner-metrics-schema.md](../data/owner-metrics-schema.md)
- Identity bypass carried forward: [docs/engineering/v0-2-identity-bypass.md](v0-2-identity-bypass.md)
- Decisions: [D-010](../project/decision-log.md) (lane identifiers), [D-013](../project/decision-log.md) (Supabase + Vercel), [D-023](../project/decision-log.md) (IČO switcher), [D-024](../project/decision-log.md) (frozen 8 metrics), [D-025](../project/decision-log.md) (synth fallback)

## 2. Architecture overview

```
Browser (owner dashboard)
  │
  ├─ GET /api/owner/metrics
  │    │  resolve sr_user_id cookie → demo_owner_id (v0-2-identity-bypass)
  │    │  SELECT owner_metrics WHERE user_id = $1 (all 8 rows, nullable)
  │    │  for each row: computePercentile(ownerValue, naceDivision, sizeBand, region)
  │    └─ return MetricSnapshot[]
  │
  ├─ PATCH /api/owner/metrics/[metric_id]
  │    │  body: { raw_value: number }
  │    │  validate metric_id ∈ frozen-8 → 404
  │    │  validate raw_value within PM plausibility bounds → 422 + Czech error
  │    │  resolve active consent_event_id for demo owner
  │    │  upsert owner_metrics (ON CONFLICT DO UPDATE, last-write-wins)
  │    └─ return updated MetricSnapshot row
  │
  ├─ POST /api/owner/demo/switch   [DEMO_MODE=true only]
  │    │  body: { ico: string }
  │    │  validate 8-digit IČO format → 422
  │    │  lookup cohort_companies WHERE ico = $1 → 404 if absent
  │    │  set sr_active_ico cookie (SameSite=Lax, Path=/)
  │    │  seed owner_metrics nulls for the new IČO if not already seeded
  │    └─ 200 { ico, naceDivision }
  │
  └─ POST /api/owner/demo/reset    [DEMO_MODE=true only]
       │  DELETE owner_metrics WHERE user_id = demo_owner_id
       └─ 200 { deleted: number }
```

Privacy boundary: all writes land in `user_contributed` lane only. No field from `owner_metrics` is written to `briefs`, `rm_lead_db`, or any other lane table by this API. Cross-lane flow to n8n is handled by `docs/data/analysis-pipeline-data.md` as an in-process payload, never via this API.

## 3. ADRs

### ADR-OM-01 — Demo owner writes to real DB rows (no special-case storage)

- **Date**: 2026-04-27
- **Context**: v0.2 used an in-memory fixture (`src/lib/owner-metrics.ts`). v0.3 introduces real DB storage. The question is whether the demo owner (`DEMO_OWNER_USER_ID`) gets real rows or a separate in-memory overlay.
- **Decision**: Demo owner writes to real `owner_metrics` rows, scoped by `user_id = DEMO_OWNER_USER_ID`, identical to any future real user.
- **Consequences**: The IČO switcher (D-023) shares one `user_id` across all firm contexts; per-firm scoping (`firm_ico` added to the PK) is a v0.4 concern (OQ-OM-03 in `owner-metrics-schema.md`). Reset endpoint is provided so moderators can clear state between sessions.
- **Rejected alternatives**: In-memory overlay keyed by IČO — rejected because it would require a parallel write path inconsistent with the privacy-lane enforcement in RLS.

### ADR-OM-02 — `sr_active_ico` cookie for IČO switcher; `sr_user_id` unchanged

- **Date**: 2026-04-27
- **Context**: D-023 requires the dashboard to switch which firm's data is displayed without changing the user identity. Two cookie options: (a) overwrite `sr_user_id` with a per-firm ID, (b) introduce a second cookie `sr_active_ico` that carries the selected IČO while `sr_user_id` stays fixed.
- **Decision**: Introduce `sr_active_ico` as a second cookie. `sr_user_id` is always `DEMO_OWNER_USER_ID`.
- **Consequences**: The cohort lookup and percentile compute use `sr_active_ico` to derive `naceDivision`, `sizeBand`, and `region` from `cohort_companies`. Owner metric reads and writes always use `sr_user_id` for the DB PK.
- **Rejected alternatives**: Overwriting `sr_user_id` — rejected because it would break `isDemoOwner()` identity checks throughout the codebase.

### ADR-OM-03 — Dev-only endpoints gated by `DEMO_MODE` env var, not by route group

- **Date**: 2026-04-27
- **Context**: `POST /api/owner/demo/switch` and `POST /api/owner/demo/reset` must not exist in production. Options: separate Next.js route group with build-time exclusion, or runtime env var guard.
- **Decision**: Runtime guard: both handlers return 404 when `process.env.DEMO_MODE !== 'true'`. No route group change.
- **Consequences**: The routes exist in the production bundle but are inert. Dead routes are preferable to a build-time exclusion that could accidentally omit non-demo code in a bad refactor.
- **Rejected alternatives**: Separate `src/app/api/dev/` route group excluded in `next.config.js` — rejected as over-engineered for a PoC; adds build complexity without meaningful security benefit when the backend is not public-facing at v0.3.

## 4. Data contracts

Full table shape, RLS posture, and upsert semantics: [docs/data/owner-metrics-schema.md](../data/owner-metrics-schema.md).

Summary of what this API layer adds:

| Contract point | Detail |
|---|---|
| `metric_id` domain check | Validated in API handler before DB write. Frozen 8: `gross_margin`, `ebitda_margin`, `labor_cost_ratio`, `revenue_per_employee`, `working_capital_cycle`, `net_margin`, `revenue_growth`, `pricing_power`. |
| Plausibility bounds | Per-metric min/max/decimal-places from [in-tile-prompts.md §5](../product/in-tile-prompts.md). PM owns the values; API enforces them server-side. |
| Czech locale normalisation | PATCH body `raw_value` arrives as a number (client normalises comma→period before POSTing). Server additionally strips any residual thousands separators and validates NUMERIC(14,4) fits. |
| `raw_value_display` | Formatted server-side on write per `owner-metrics-schema.md §3` display rules; stored in the row; returned verbatim in GET responses. |
| `consent_event_id` | Resolved per request: latest `grant` event for `DEMO_OWNER_USER_ID`. The API **does not mint** a consent event if none exists — it returns 409 with a structured error. At v0.3 the demo grant is seeded at app boot by the seed script. |
| `source` value on PATCH | Always `'user_entered'` when the write comes from the in-tile prompt. `'prepopulated_excel'` and `'demo_seed'` are set only by the ingestion/seed scripts. |

## 5. Endpoint signatures (TypeScript)

```typescript
// GET /api/owner/metrics
// Response 200:
interface MetricSnapshot {
  metric_id: string;
  raw_value: number | null;           // null = owner has not entered; "ask" state
  raw_value_display: string | null;
  percentile: number | null;          // from cohort-compute; null when below-floor
  quartile_label: QuartileLabel | null;
  confidence_state: "valid" | "below-floor" | "empty";
  source: "real" | "synthetic";
  footnote: string | null;
}

// PATCH /api/owner/metrics/[metric_id]
// Request body:
interface MetricPatchBody {
  raw_value: number;  // client has normalised comma→period; must be finite
}
// Response 200: MetricSnapshot (updated row with freshly computed percentile)
// Response 404: { error: "Metrika nenalezena." }
// Response 409: { error: "Souhlas nebyl zaznamenán." }
// Response 422: { error: string }  // per-metric Czech copy from in-tile-prompts.md §5

// POST /api/owner/demo/switch  [DEMO_MODE only]
interface DemoSwitchBody { ico: string; }
// Response 200: { ico: string; naceDivision: string; }
// Response 404: { error: "Tuto firmu v datech nemáme. Zkuste prosím jiné IČO." }
// Response 422: { error: "IČO má 8 číslic. Zkontrolujte prosím zadání." }

// POST /api/owner/demo/reset  [DEMO_MODE only]
// Response 200: { deleted: number }
```

## 5a. Example curl calls

```bash
# Fetch all 8 metric snapshots for the active demo owner
curl -s http://localhost:3000/api/owner/metrics \
  -H "Cookie: sr_user_id=00000000-5eed-0000-0000-000000000001"

# Write a value for gross_margin
curl -s -X PATCH http://localhost:3000/api/owner/metrics/gross_margin \
  -H "Content-Type: application/json" \
  -H "Cookie: sr_user_id=00000000-5eed-0000-0000-000000000001" \
  -d '{"raw_value": 23.4}'

# Switch active demo firm
curl -s -X POST http://localhost:3000/api/owner/demo/switch \
  -H "Content-Type: application/json" \
  -H "Cookie: sr_user_id=00000000-5eed-0000-0000-000000000001" \
  -d '{"ico": "12345678"}'

# Reset demo owner's entered values
curl -s -X POST http://localhost:3000/api/owner/demo/reset \
  -H "Cookie: sr_user_id=00000000-5eed-0000-0000-000000000001"
```

## 6. MetricTile integration

The `MetricTile` component (`src/components/dashboard/MetricTile.tsx`) gains a fourth `confidenceState` value: `"ask"` (new at v0.3). The `MetricTileProps` interface must add:

```typescript
// New optional props for "ask" state
askPromptLabel?: string;   // from in-tile-prompts.md §4 — e.g. "Hrubá marže"
askHelpText?: string;      // e.g. "Uveďte prosím vaši hrubou marži…"
askUnitSuffix?: string;    // e.g. "%"
```

When `confidenceState === "ask"`, the tile renders the prompt + inline numeric input + "Uložit" button instead of the raw value + quartile row. The form POSTs to `PATCH /api/owner/metrics/[metric_id]` and triggers a full-page reload on success (`router.refresh()` or native form submit).

The existing valid / below-floor / loading states are unchanged.

## 7. Test plan

### Unit tests — `src/app/api/owner/__tests__/`

- `plausibility.test.ts` — for each of the 8 metric IDs: boundary value at min, max, min-1, max+1, non-numeric string, empty string. Asserts 200 vs 422 and correct Czech error copy. No DB — mock the upsert.
- `metric-id-validation.test.ts` — unknown `metric_id` in PATCH returns 404. `roce` (removed per D-024) returns 404.
- `demo-mode-guard.test.ts` — with `DEMO_MODE` unset or `'false'`, POST `/api/owner/demo/switch` and `/reset` return 404.
- `ico-format.test.ts` — `switch` rejects 7-digit, 9-digit, non-numeric IČO with 422.

### Integration tests (require Supabase local stack)

- PATCH → GET round-trip: write a value, read it back, confirm `raw_value` matches, `confidence_state` is `"valid"` for metrics with synth fallback.
- Consent gate: with no `consent_events` row for `DEMO_OWNER_USER_ID`, PATCH returns 409.
- IČO switcher: POST switch to a seeded IČO → subsequent GET returns metrics composed from that firm's `cohort_companies` row.
- Reset: after PATCH writes a value, POST reset clears it; subsequent GET returns `raw_value: null`.

### Privacy invariant tests

- Assert `owner_metrics.data_lane = 'user_contributed'` on every row written by PATCH — via a post-write SELECT.
- Assert PATCH handler never writes to `briefs`, `sector_profiles`, or any table not in `user_contributed` lane — enforced by RLS (no grants to other tables) and verified via a RLS-rejection test: attempt a cross-table write using `user_contributed_lane_role` and confirm PostgreSQL raises a permission error.

## 8. Deployment + rollback

- **Deploy**: new Supabase migration `0006_owner_metrics.sql` (Track A migration). Adds `owner_metrics` table, RLS policies, and indexes from `owner-metrics-schema.md §2 + §4`. Migration test pattern from `src/supabase/migrations/migrations.test.ts` applied: a `0006_owner_metrics.test.ts` enumerates the new `source` CHECK values and `metric_id` CHECK values as TS constants and asserts they match.
- **Env vars**: none new for Track A. `DEMO_MODE=true` required for switch/reset endpoints to be active.
- **Rollback**: drop `owner_metrics` table (no FK references from other tables at v0.3). Dashboard falls back to the v0.2 in-memory fixture path if the `USE_REAL_OWNER_METRICS` feature flag (default true) is set to false.
- **Feature flag**: `USE_REAL_OWNER_METRICS` (env var, default `true`). When false, `getOwnerMetrics()` in `src/lib/owner-metrics.ts` returns the v0.2 in-memory fixture. This flag exists only during transition; it is removed once Track A is confirmed working in the demo environment.

## 9. Open questions

| ID | Question | Assumed-for-now | Escalate to |
|---|---|---|---|
| OQ-EN-A01 | `raw_value_display` formatting of `revenue_per_employee` uses thin-space U+202F thousands separator. Confirm the Next.js font (Inter Variable) renders U+202F correctly in all tile widths without overflow. | Assumed OK; verify in browser during 3.3 walkthrough. | Designer if overflow observed. |
| OQ-EN-A02 | The IČO switcher seeds `owner_metrics` nulls for the new firm on switch. If two demo sessions run concurrently (unlikely but possible), the second switch overwrites the first session's entered values. | Accepted for v0.3 single-tester demo. `firm_ico` PK column deferred to v0.4 per OQ-OM-03. | Orchestrator before multi-tester use. |

## Changelog

- 2026-04-27 — initial draft — engineer. Covers Track A API surface: GET snapshot, PATCH single metric, demo switch/reset, MetricTile "ask" state extension, migration and rollback plan.
