# Cohort Runtime — Engineering

*Owner: engineer · Slug: cohort-runtime · Last updated: 2026-04-29*

## 1. Upstream links

- Product: [docs/product/in-tile-prompts.md](../product/in-tile-prompts.md) §3 (tile state matrix)
- Design: [docs/design/dashboard-v0-2/tile-states.md](../design/dashboard-v0-2/tile-states.md) (v0.2 states, unchanged)
- Data: [docs/data/percentile-compute.md](../data/percentile-compute.md) — **the authoritative algorithm spec; this file does not restate it**
- Data: [docs/data/cohort-ingestion.md](../data/cohort-ingestion.md) — `cohort_companies` schema and ingestion contract
- Data: [docs/data/synthetic-quintile-policy.md](../data/synthetic-quintile-policy.md) — `cohort_aggregates` schema and synth values
- Decisions: [D-013](../project/decision-log.md) (Supabase Postgres), [D-024](../project/decision-log.md) (frozen 8 metrics), [D-025](../project/decision-log.md) (synth fallback), [D-032](../project/decision-log.md) (pricing_power → roe)

## 2. Architecture overview

```
src/lib/
  cohort-compute.ts   — pure functions (no DB calls); algorithm per percentile-compute.md
  cohort-data.ts      — DB-facing helpers: read cohort_companies + cohort_aggregates
  cohort.ts           — existing file; getBenchmarkSnapshot() refactored to call the
                        above two; fixture path kept as last-resort fallback

GET /api/owner/metrics
  → cohort-data.ts: getCohortFirmsForCell(...)  → cohort_companies rows
  → cohort-data.ts: getSyntheticQuintiles(...)  → cohort_aggregates rows
  → cohort-compute.ts: computePercentile(input) → PercentileResult
  → return MetricSnapshot[]
```

The dashboard page (server component) calls `GET /api/owner/metrics` (Track A) which internally calls the cohort runtime for each non-null owner metric. The cohort runtime is also called after a PATCH write so the returned `MetricSnapshot` includes the freshly computed percentile.

Privacy posture: `cohort-compute.ts` takes the owner's value as an argument — it never reads `owner_metrics` directly. The DB-facing `cohort-data.ts` reads only `cohort_companies` and `cohort_aggregates`, which are industry data tables, not consent-bound user tables. No row from either table carries a user identity.

## 3. ADRs

### ADR-CR-01 — `cohort-compute.ts` is a pure module with no DB imports

- **Date**: 2026-04-27
- **Context**: The percentile algorithm ([percentile-compute.md §3–§6](../data/percentile-compute.md)) is deterministic given inputs. Keeping DB access outside the compute module enables unit testing without a test database and makes the algorithm independently reviewable.
- **Decision**: `cohort-compute.ts` imports nothing from Supabase or any ORM. It receives pre-fetched arrays of values as arguments.
- **Consequences**: DB calls always happen in `cohort-data.ts` before calling `cohort-compute.ts`. A caller cannot accidentally skip the DB layer — the function signature requires the cohort values array.
- **Rejected alternatives**: Single module with DB reads inside the algorithm — rejected because it couples the math to the DB client and makes the algorithm untestable without a live DB.

### ADR-CR-02 — Per-request memoisation only; no cross-request cache

- **Date**: 2026-04-27
- **Context**: A dashboard page load calls `computePercentile` once per metric (up to 8 calls). Across calls within the same request, the same `(naceDivision, sizeBand, region, metricId)` tuple may be queried multiple times if the dashboard is extended. Options: (a) no cache, (b) per-request Map, (c) Redis or Vercel KV.
- **Decision**: Per-request memoisation via a `Map<string, CohortValues>` keyed by `${naceDivision}|${sizeBand}|${region}|${metricId}`, created fresh each request in `cohort-data.ts`.
- **Consequences**: Within one request, the `cohort_companies` query for a given cell fires at most once. Cross-request, the Excel data is re-read from Postgres on every page load. Acceptable for v0.3 PoC — the Excel does not change between requests and Postgres query times are low. A persistent cache (Redis / Vercel KV) is a new dependency and is deferred per escalation rules.
- **Rejected alternatives**: Vercel KV — new dependency; requires orchestrator approval. No memoisation — 8 identical DB queries per page load; not ideal but not a blocker at PoC scale.

### ADR-CR-03 — `USE_REAL_COHORT_DATA` feature flag controls the data source

- **Date**: 2026-04-27
- **Context**: If `cohort_companies` is empty (e.g. ingest script has not run), the dashboard must not show broken tiles. The v0.2 in-memory fixture is the safe fallback.
- **Decision**: `getBenchmarkSnapshot()` checks `USE_REAL_COHORT_DATA` env var (default `true`). When `false`, it returns the existing NACE-keyed in-memory fixture unchanged. When `true`, it calls `cohort-data.ts + cohort-compute.ts`; if those return `confidenceState: "empty"` for every metric (indicating an empty DB), it falls back to the fixture for that NACE.
- **Consequences**: Build never fails due to an empty DB. The fixture is the last-resort fallback, not the default path post-Track-B.
- **Rejected alternatives**: Hard-delete the fixture on landing Track B — rejected because it makes the build fragile during the transition phase.

## 4. File specifications

### 4.1 `src/lib/cohort-compute.ts`

Re-exports the two TypeScript interfaces and the single pure function from `percentile-compute.md §2`:

```typescript
export interface PercentileInput {
  metricId: MetricId;          // union of 8 frozen metric_id strings
  ownerValue: number;          // in same unit as cohort_companies column
  naceDivision: string;        // 2-digit
  sizeBand: "S1" | "S2" | "S3";
  region: CzRegion | null;
}

export interface PercentileResult {
  percentile: number | null;
  quartileLabel: QuartileLabel | null;
  confidenceState: "valid" | "below-floor" | "empty";
  achievedRung: 0 | 1 | 2 | 3 | 4;
  nUsed: number | null;
  source: "real" | "synthetic" | "mixed";
  footnote: string | null;
}

// Pure function — no async, no DB. Takes pre-fetched cohort values as arguments.
export function computePercentile(
  input: PercentileInput,
  realValues: number[] | null,     // from cohort_companies for the winning rung; null if no real data
  synth: SynthQuintiles | null     // from cohort_aggregates; null if no synth row
): PercentileResult;

export interface SynthQuintiles {
  q1: number; q2: number; median: number; q3: number; q4: number;
  n_proxy: number;
}
```

Internal algorithm (implemented in this file, not restated here): Hyndman & Fan type 4 mid-rank percentile; 1st/99th winsorization on real values; four-rung degradation ladder; piecewise-linear interpolation on synth quintiles; quartile label assignment; footnote selection. Full spec: [percentile-compute.md §3–§6](../data/percentile-compute.md).

### 4.2 `src/lib/cohort-data.ts`

```typescript
// Returns numeric values from cohort_companies for the given cell and metric.
// Applies the four-rung degradation ladder from cohort-math.md §4.1.
// Returns { values: number[], rung: 0|1|2|3, n: number } for the first rung
// that clears the floor, or null if all rungs fail.
export async function getCohortFirmsForCell(
  naceDivision: string,
  sizeBand: "S1" | "S2" | "S3",
  region: CzRegion | null,
  metricId: MetricId
): Promise<{ values: number[]; rung: 0 | 1 | 2 | 3; n: number } | null>;

// Returns the synth quintiles row from cohort_aggregates for (naceDivision, metricId).
// Returns null if no row with source = 'synthetic' exists.
export async function getSyntheticQuintiles(
  naceDivision: string,
  metricId: MetricId
): Promise<SynthQuintiles | null>;
```

The four-rung ladder is implemented inside `getCohortFirmsForCell` — it fires up to four SQL queries in sequence, stopping at the first rung that clears the floor. Per-request memoisation via a `Map` (see ADR-CR-02) prevents duplicate queries within the same request context.

The metric-to-column mapping for `cohort_companies`:

| `metricId` | `cohort_companies` column | Notes |
|---|---|---|
| `net_margin` | `net_margin` | Present in all ingested Excels. |
| `revenue_per_employee` | `revenue_per_employee` | Present in all ingested Excels. |
| `ebitda_margin` | `ebitda_margin` | Present only where source Excel carries P&L detail (NACE 31; NULL for NACE 49). |
| `working_capital_cycle` | `working_capital_cycle` | Present only where source Excel carries BS detail (NACE 31). |
| `roe` | `roe` | Added in migration 0012 (D-032). Computed at ingest from HV za účetní období / Vlastní kapitál × 100. |
| All other 3 metrics | No column — real path returns `null`; synth path used. | `gross_margin`, `labor_cost_ratio`, `revenue_growth`. |

Floor note: `working_capital_cycle` uses a strict floor of N ≥ 50 (`STRICT_FLOOR_METRIC_IDS`). All other metrics — including `roe` — use the global floor of N ≥ 30 (`GLOBAL_FLOOR`). The strict floor applies only to `working_capital_cycle` (heavy-tail distribution; see `cohort-compute.ts` `STRICT_FLOOR_METRIC_IDS`).

### 4.3 `src/lib/cohort.ts` — refactored `getBenchmarkSnapshot()`

```typescript
// Refactored signature — naceSector is now naceDivision (2-digit string).
// ownerValues: map of metric_id → raw_value (null where owner has not entered).
// Called once per dashboard page load, returns all 8 MetricSnapshot entries.
export async function getBenchmarkSnapshot(
  naceDivision: string,
  sizeBand: "S1" | "S2" | "S3",
  region: CzRegion | null,
  ownerValues: Map<MetricId, number | null>
): Promise<MetricSnapshot[]>;
```

Internal flow:

1. If `USE_REAL_COHORT_DATA !== 'true'`: return the in-memory fixture (existing branch, unchanged).
2. For each of the 8 frozen metrics:
   a. If `ownerValues.get(metricId) === null`: return `{ ..., raw_value: null, confidenceState: 'empty', … }` — tile will be in "ask" state; skip percentile compute.
   b. Call `getCohortFirmsForCell(naceDivision, sizeBand, region, metricId)` → `realData`.
   c. Call `getSyntheticQuintiles(naceDivision, metricId)` → `synth`.
   d. Call `computePercentile(input, realData?.values ?? null, synth)` → `PercentileResult`.
   e. If both `realData` and `synth` are null → `confidenceState: 'empty'` and fall through to fixture for this metric only.
3. Return the 8-row array.

The fixture path (step 1 / step 2e) is the last-resort fallback, not removed.

## 5. Test plan

### Unit tests — `src/lib/__tests__/cohort-compute.test.ts`

All tests against `cohort-compute.ts` directly — no DB, no mocking needed.

- **Real path, rung 0 — basic percentile**: 100 values (uniform distribution), owner at 50th value → expect `percentile ≈ 50`, `quartileLabel: "druhá čtvrtina"`.
- **Mid-rank tie handling**: 10 identical values, owner at the same value → percentile = 50, confirming `0.5 * n_tied / n * 100`.
- **Winsorization**: insert two extreme outliers (1 below 1st pct, 1 above 99th); confirm owner at 50th real value is not displaced by more than 1/n.
- **Floor enforcement**: array of 29 values (< global floor 30) → `achievedRung: 4`, `confidenceState: "below-floor"`.
- **Synth interpolation — below q1**: owner value < q1 → percentile clamped to [0, 20].
- **Synth interpolation — mid-segment**: owner value between q2 and median → linear interpolation confirmed.
- **Synth interpolation — above q4**: percentile clamped to [80, 100].
- **Quartile boundary — exact 25**: percentile = 25.0 → `"druhá čtvrtina"` (boundary rule from `percentile-compute.md §3.5`).
- **Quartile boundary — exact 75**: → `"horní čtvrtina"`.
- **Real-supersedes-synth**: when `realValues` is a valid array (n ≥ 30), synth argument is ignored.
- **Empty state**: both `realValues: null` and `synth: null` → `confidenceState: "empty"`, `achievedRung: 4`.

### Unit tests — `src/lib/__tests__/cohort-data.test.ts`

With the Supabase client mocked (vitest mock of `@supabase/supabase-js`):

- `getCohortFirmsForCell` calls the correct column name for `net_margin`, `revenue_per_employee`, `ebitda_margin`, `working_capital_cycle`, and `roe`.
- `getCohortFirmsForCell` for `gross_margin` returns `null` (no column on `cohort_companies`).
- `getCohortFirmsForCell` for `roe` queries the `roe` column added in migration 0012 (D-032).
- Memoisation: calling `getCohortFirmsForCell` twice with the same arguments within one request fires the DB mock only once.

### Integration tests (require Supabase local stack)

- Seed 35 `cohort_companies` rows for `nace_division='49'`, `size_band='S2'`, `cz_region='Praha'` with known `net_margin` values. Call `getCohortFirmsForCell('49', 'S2', 'Praha', 'net_margin')` and confirm `rung=0`, `n=35`.
- Seed 0 real rows for `gross_margin`. Call `getSyntheticQuintiles('49', 'gross_margin')` and confirm it returns the seeded synth row from `cohort_aggregates`.
- Full pipeline: seed synth aggregates for NACE 49 per `synthetic-quintile-policy.md §5.1`. Call `getBenchmarkSnapshot('49', 'S2', 'Praha', ownerValues)` with known owner values. Confirm 8 `MetricSnapshot` entries: `net_margin` and `revenue_per_employee` on real path (if seeded), remainder on synth path with `source: "synthetic"`.

### Privacy invariant tests

- `cohort-data.ts` has no import from `owner_metrics` table — enforced by an AST-level check in the test file (search the compiled output for the table name string; assert not present).
- `computePercentile` function signature does not accept a `userId` or any user-identifying field — confirmed by the TypeScript type check (`tsc --noEmit`).

### Migration test — `src/supabase/migrations/0007_cohort_tables.test.ts`

Following the pattern in `src/supabase/migrations/migrations.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { METRIC_IDS, SOURCE_VALUES } from "../../types/cohort-constants";

describe("cohort_aggregates enum invariants", () => {
  it("METRIC_IDS matches the frozen 8 per D-024, D-032", () => {
    expect(METRIC_IDS.sort()).toEqual([
      "ebitda_margin", "gross_margin", "labor_cost_ratio",
      "net_margin", "revenue_growth",
      "revenue_per_employee", "roe", "working_capital_cycle",
    ]);
    // pricing_power was removed in D-032 (2026-04-29); roe replaces it.
  });
  it("SOURCE_VALUES contains real and synthetic only", () => {
    expect(SOURCE_VALUES.sort()).toEqual(["real", "synthetic"]);
  });
});
```

## 6. Deployment + rollback

- **Deploy**: Supabase migration `0007_cohort_tables.sql` — creates `cohort_companies` and `cohort_aggregates` tables with the schema from `cohort-ingestion.md §3` and `synthetic-quintile-policy.md §2`. RLS grants matching `cohort-ingestion.md §3` RLS posture.
- **Ingest**: run `npm run ingest-cohort -- --file ... --year 2024 --nace-division 49` after migration. Run `npm run seed-synth-aggregates` to populate `cohort_aggregates` with the DE-authored synth rows from `synthetic-quintile-policy.md §5`.
- **Feature flag**: `USE_REAL_COHORT_DATA=true` (default). Set to `false` to restore the v0.2 fixture path without a code change.
- **Rollback**: set `USE_REAL_COHORT_DATA=false` — restores fixture path immediately. Then drop `cohort_companies` and `cohort_aggregates` tables in a follow-up migration if needed.

## 7. Open questions

| ID | Question | Assumed-for-now | Escalate to |
|---|---|---|---|
| OQ-EN-B01 | `getBenchmarkSnapshot()` currently takes `naceSector` (string). The refactored signature takes `naceDivision` (2-digit). Callers in `src/app/page.tsx` and `src/app/api/owner/metrics/route.ts` must be updated. Confirm no other callers exist. | Only the two known callers. Audit with `grep -r getBenchmarkSnapshot src/` at implementation time. | No escalation needed — mechanical change. |
| OQ-EN-B02 | `cz-city-region-map.json` ownership for ongoing extension is flagged as OQ-CI-03 in `cohort-ingestion.md`. The engineer ships the file with 50 largest cities pre-populated; further extension is orchestrator + DE-guided. | Ship with 50 cities. | Orchestrator for extension prioritisation. |
| OQ-PC-01 | Percentile-rank algebra reconciliation between `cohort-math.md §6.2` (average-rank) and this implementation (Hyndman & Fan type 4 mid-rank). Both agree to within 1/n at n≥30. | Type-4 used at v0.3. | No action unless cohort-math.md is updated in a future session. |

## Changelog

- 2026-04-27 — initial draft — engineer. Covers Track B: `cohort-compute.ts` pure function spec, `cohort-data.ts` DB helper signatures, `getBenchmarkSnapshot()` refactor plan, per-request memoisation, `USE_REAL_COHORT_DATA` feature flag, full test plan including privacy invariant and migration tests.
- 2026-04-27 — B1–B4 implementation complete — engineer. All files written, tsc clean, 171 tests passing (33 new in cohort-compute.test.ts, 14 in 0007_cohort_data.test.ts). OQ-EN-B01 resolved: getBenchmarkSnapshotAsync() added as new async function; getBenchmarkSnapshot() kept sync for publish.ts compat — no callers broken. OQ-EN-B02 resolved: cz-city-region-map.json shipped with 150+ city entries (see §deviation notes). Track A compat overload added to computePercentile() so owner-metrics.ts dynamic-import compiles cleanly. xlsx added as production dependency (new dep — see note §escalations-deferred). Spec deviation: getBenchmarkSnapshot() remains sync and routes to fixture only; the real async path is getBenchmarkSnapshotAsync() — separation is cleaner than overloading the sync callers. Commits: dbd51d6 (B1), 21cecd5 (B2), 9fef536 (B3), d2056eb (B4).
- 2026-04-29 — D-032 ROE swap — engineer. `pricing_power` removed; `roe` added to `METRIC_TO_COLUMN` (maps `roe → roe`, migration 0012). ROE uses `GLOBAL_FLOOR=30` (not strict-50; `STRICT_FLOOR_METRIC_IDS` remains `working_capital_cycle` only). §4.2 metric-to-column table expanded to reflect all 5 real-derivable columns. Migration test METRIC_IDS updated (`pricing_power` → `roe`). `getCohortFirmsForCell` mock coverage updated to include `roe`.
