# Owner-Metrics Schema — v0.3

*Owner: data-engineer · Slug: owner-metrics-schema · Last updated: 2026-04-29*

The new `owner_metrics` table in the `user_contributed` lane. Replaces the v0.2 in-memory fixture in `src/lib/owner-metrics.ts` (see [dummy-owner-metrics.md](dummy-owner-metrics.md)) with a real, RLS-scoped, consent-trace-carrying row store that holds the eight frozen v0.3 metrics per `user_id`.

This spec is the data shape only — the PATCH/GET API surface and the in-tile UX live in [docs/engineering/owner-metrics-api.md](../engineering/owner-metrics-api.md) and [docs/product/in-tile-prompts.md](../product/in-tile-prompts.md) respectively.

---

## 1. Upstream links

- Product: [docs/product/in-tile-prompts.md](../product/in-tile-prompts.md) (PM Track A — landed 2026-04-27)
- Build plan: [docs/project/build-plan.md](../project/build-plan.md) §11 (v0.3), §11.4 Phase 3.1 Track A
- PRD sections: §7.5 (privacy as product), §10 (data foundation), §7.8 (give-to-get in mind, not in build — bounded capture surface)
- Decisions:
  - [D-007](../project/decision-log.md) — single opt-in covering all lanes
  - [D-010](../project/decision-log.md) — canonical lane identifiers
  - [D-012](../project/decision-log.md) — revocation = stop future flow only
  - [D-013](../project/decision-log.md) — Supabase Postgres + RLS
  - [D-023](../project/decision-log.md) — real-firm demo owner via IČO switcher
  - [D-024](../project/decision-log.md) — frozen 8-metric set: ROCE → Net margin
  - [D-032](../project/decision-log.md) — pricing_power → ROE (8th metric swap, v0.3)
- Companions: [privacy-architecture.md](privacy-architecture.md) §2 four lanes; [cohort-math.md](cohort-math.md) §5 the 8 ratios; [percentile-compute.md](percentile-compute.md) (sibling); [analysis-pipeline-data.md](analysis-pipeline-data.md) (sibling)
- Replaces: v0.2 in-memory fixture posture in [dummy-owner-metrics.md](dummy-owner-metrics.md) §6 Option (a)

---

## 2. Table — `owner_metrics`

```sql
CREATE TABLE IF NOT EXISTS owner_metrics (
  user_id            UUID         NOT NULL,
  metric_id          TEXT         NOT NULL,

  -- Lane enforcement (ADR-0002-C / D-010). Always 'user_contributed'.
  data_lane          data_lane    NOT NULL DEFAULT 'user_contributed'
                                  CHECK (data_lane = 'user_contributed'),

  -- Numeric raw value. Ratios stored as percent points (e.g. 23.4 for 23,4 %),
  -- monetary values as CZK (revenue_per_employee in thousands of CZK per §3),
  -- working_capital_cycle in days, revenue_growth + roe in % (per §3).
  -- Nullable: a row with raw_value IS NULL means "owner has not yet supplied
  -- this metric" — drives the in-tile 'ask' state.
  raw_value          NUMERIC(14,4),

  -- Czech-locale display string (decimal comma, thin-space U+202F thousands,
  -- non-breaking space U+00A0 before unit suffix). Engineer formats on write.
  raw_value_display  TEXT,

  -- 'user_entered'      — owner typed via in-tile prompt
  -- 'prepopulated_excel'— ingested from cohort_companies row at activation
  -- 'demo_seed'         — moderator-side fixture for first-paint demo firms
  source             TEXT         NOT NULL
                                  CHECK (source IN ('user_entered',
                                                    'prepopulated_excel',
                                                    'demo_seed')),

  captured_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),

  -- Privacy-architecture §4.2: every user_contributed row MUST reference a
  -- non-revoked grant event. NOT NULL enforced.
  consent_event_id   UUID         NOT NULL
                                  REFERENCES consent_events(consent_event_id)
                                  ON DELETE RESTRICT,

  PRIMARY KEY (user_id, metric_id),

  -- Domain check on metric_id matching the v0.3 frozen 8 (D-024 + D-032 swap).
  -- Migration 0013 swaps 'pricing_power' → 'roe' on this CHECK and DELETEs any
  -- pre-existing pricing_power rows from owner_metrics + cohort_aggregates.
  CHECK (metric_id IN (
    'gross_margin', 'ebitda_margin', 'labor_cost_ratio',
    'revenue_per_employee', 'working_capital_cycle',
    'net_margin', 'revenue_growth', 'roe'
  ))
);

CREATE INDEX IF NOT EXISTS idx_owner_metrics_user_id
  ON owner_metrics (user_id);
```

`(user_id, metric_id)` as the composite primary key gives **idempotent upsert** semantics: PATCH writes use `ON CONFLICT (user_id, metric_id) DO UPDATE`, last-write-wins. History is not retained at v0.3 — production multi-tenant would add an `owner_metrics_history` audit table; deferred to v0.4 ([OQ-OM-02](#7-open-questions)).

---

## 3. Frozen `metric_id` domain — units, bounds, formatting

The eight IDs below are frozen for v0.3 per [D-024](../project/decision-log.md). Order matches PM's recommended ask order ([in-tile-prompts.md](../product/in-tile-prompts.md) §7). **Plausibility bounds are PM's** — server-side validation enforces these byte-for-byte; do not widen here ([in-tile-prompts.md §5](../product/in-tile-prompts.md)).

| # | `metric_id` | Czech label | Stored unit | `raw_value` semantics | PM bounds (min / max / dp) | Display rule |
|---|---|---|---|---|---|---|
| 1 | `gross_margin` | Hrubá marže | percent | `23.4` means `23,4 %` | -50 / 100 / 1 | `<n>,<dp1> %` (decimal comma, NBSP before %) |
| 2 | `ebitda_margin` | Marže EBITDA | percent | as above | -50 / 60 / 1 | as above |
| 3 | `labor_cost_ratio` | Podíl osobních nákladů | percent | `29.8` means `29,8 %` | 0 / 90 / 1 | as above |
| 4 | `revenue_per_employee` | Tržby na zaměstnance | thousand CZK / FTE / yr | `2450` means `2 450 tis. Kč` | 100 / 100 000 / 0 | thin-space U+202F thousands, NBSP, suffix `tis. Kč` |
| 5 | `working_capital_cycle` | Cyklus pracovního kapitálu | days | `62` means `62 dní` | -90 / 365 / 0 | NBSP before `dní` |
| 6 | `net_margin` | Čistá marže | percent | `5.1` means `5,1 %` | -50 / 60 / 1 | percent rule |
| 7 | `revenue_growth` | Růst tržeb | percent (YoY) | `3.1` means `+3,1 %` (sign required) | -80 / 200 / 1 | sign-prefixed percent |
| 8 | `roe` | ROE | percent | `12.4` means `12,4 %` | -100 / 200 / 1 | `<n>,<dp1> %` (decimal comma, NBSP before %); negatives use U+2212 minus; **no `+` prefix on positives** (matches `formatDisplay` 'roe' case in `src/lib/owner-metrics.ts`). |

**Stored vs. displayed.** `raw_value` stores the human-meaningful number, not a 0–1 decimal. `gross_margin = 23.4`, never `0.234`. This intentionally diverges from the v0.2 fixture ([dummy-owner-metrics.md §4](dummy-owner-metrics.md)) which stored `0.234` — the change makes Excel ingestion (where percent values arrive as e.g. `23.4`) and PATCH writes (where the owner types `23,4`) both straightforward. Engineer's normaliser strips Czech comma → period and any thousands separators on write.

**Czech locale formatting (frozen across the codebase):**

- Decimal separator: comma `,`.
- Thousands separator: thin space U+202F.
- Unit/suffix preceded by a non-breaking space U+00A0.
- Sign prefix required on `revenue_growth` (positive → `+`, negative → `−` (U+2212)). `roe` uses U+2212 for negatives but **no `+` prefix on positives** per [D-032](../project/decision-log.md).

`raw_value_display` is pre-formatted on write. Read paths render the display string verbatim — there is no client-side Intl formatting in tile components.

---

## 4. RLS posture

The table is in the `user_contributed` lane ([D-010](../project/decision-log.md)). Three roles touch it; one cannot.

| Role | SELECT | INSERT | UPDATE | DELETE | Notes |
|---|---|---|---|---|---|
| `user_contributed_lane_role` | own rows only (`user_id = current_setting('app.current_user_id')::uuid`) | own rows | own rows | — | The runtime app-server role for owner-facing PATCH and GET. |
| `analyst_aggregate_role` | aggregates only (via a `SECURITY DEFINER` function that returns counts / cohort percentiles, never raw rows) | — | — | — | Admin / analyst surface. **Cannot read raw `(user_id, metric_id, raw_value)` tuples.** Implemented as a function `read_owner_metric_aggregates(nace text)` that joins to `sector_profiles` and `cohort_companies` and emits cohort-level rollups. |
| `brief_lane_role` | — | — | — | — | **No grants.** The brief-render path performs NACE-only personalization (D-006); per-owner metric values reach the brief generator only via the analysis pipeline ([analysis-pipeline-data.md](analysis-pipeline-data.md)) as an in-process payload, never via direct SELECT. |
| Service-role / migration | full | full | full | full | Standard Supabase service-role for migrations and the seed script. |

```sql
ALTER TABLE owner_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_contributed_lane_role_select ON owner_metrics
  FOR SELECT TO user_contributed_lane_role
  USING (
    data_lane = 'user_contributed'
    AND user_id = current_setting('app.current_user_id', true)::uuid
  );

CREATE POLICY user_contributed_lane_role_insert ON owner_metrics
  FOR INSERT TO user_contributed_lane_role
  WITH CHECK (
    data_lane = 'user_contributed'
    AND user_id = current_setting('app.current_user_id', true)::uuid
  );

CREATE POLICY user_contributed_lane_role_update ON owner_metrics
  FOR UPDATE TO user_contributed_lane_role
  USING (
    data_lane = 'user_contributed'
    AND user_id = current_setting('app.current_user_id', true)::uuid
  )
  WITH CHECK (
    data_lane = 'user_contributed'
    AND user_id = current_setting('app.current_user_id', true)::uuid
  );

GRANT SELECT, INSERT, UPDATE ON owner_metrics TO user_contributed_lane_role;
-- No GRANT to brief_lane_role. No GRANT to analyst_aggregate_role on the
-- raw table — analyst access goes through SECURITY DEFINER functions only.
```

The `app.current_user_id` GUC is the same mechanism used by `sector_profiles` RLS in `0003_user_contributed.sql` — set per-request by the app-server middleware after resolving the demo-owner cookie / future auth subject.

**Demo posture (v0.3 only).** The demo-owner bypass ([engineering/v0-2-identity-bypass.md](../engineering/v0-2-identity-bypass.md)) plants a fixed UUID cookie at the app-server boundary. RLS still enforces ownership — the demo user can only read its own rows. The IČO switcher ([in-tile-prompts.md §8](../product/in-tile-prompts.md)) does not change the `user_id`; it switches the **active firm context** in `cohort_companies` for the same demo user. Per-firm scoping is a v0.4 concern.

---

## 5. Audit + idempotency

### 5.1 `consent_event_id` FK

Every row carries a `consent_event_id` resolvable to a `grant` event that is the latest event for that `user_id` at write time. The PATCH endpoint resolves it once per request before the upsert — see [owner-metrics-api.md](../engineering/owner-metrics-api.md). On revoke ([D-012](../project/decision-log.md) Option A), existing rows are retained; future PATCH writes are blocked at the API layer (the latest event is `revoke`), and the cohort-compute pipeline filters at read time per `cohort-math.md` §6.4.

### 5.2 `captured_at`, `updated_at`

- `captured_at` set on insert; **not** modified on update. It is the timestamp of first capture for this `(user_id, metric_id)` pair.
- `updated_at` set on insert and on every update (via the `set_updated_at()` trigger introduced in `0003_user_contributed.sql`).

### 5.3 Upsert contract (last-write-wins)

```sql
INSERT INTO owner_metrics
  (user_id, metric_id, raw_value, raw_value_display, source, consent_event_id)
VALUES ($1, $2, $3, $4, $5, $6)
ON CONFLICT (user_id, metric_id) DO UPDATE SET
  raw_value         = EXCLUDED.raw_value,
  raw_value_display = EXCLUDED.raw_value_display,
  source            = EXCLUDED.source,
  consent_event_id  = EXCLUDED.consent_event_id,
  updated_at        = now();
-- captured_at intentionally NOT updated — first-capture stamp is preserved.
```

Idempotency guarantee: re-submitting the same value is a no-op apart from `updated_at` and `consent_event_id` refresh. The PATCH endpoint may short-circuit identical writes; not required.

### 5.4 What is NOT stored at v0.3

- **No history table.** Last-write-wins. v0.4 production must add `owner_metrics_history` (append-only, every prior value retained with its `consent_event_id` and superseding event ID). Logged as [OQ-OM-02](#7-open-questions).
- **No `period`/`reporting_year` column.** All values implicitly refer to "poslední uzavřený rok" per PM ([in-tile-prompts.md §4 OQ-IT-01](../product/in-tile-prompts.md)). When an explicit period selector lands, this becomes a non-additive change and gets its own decision-log entry.
- **No `raw_value` integrity check** beyond NUMERIC bounds. PM's plausibility bounds (§3) are enforced at the API layer; storing the same constraints at the DB level would couple the schema to PM bounds and require migrations on every PM re-spec. Declined.

---

## 6. Privacy posture

| Concern | Posture |
|---|---|
| **Lane** | `user_contributed` only. Default-no on training; not RM-visible at v0.3. |
| **May enter base-model training?** | No. Pipeline allow-list ([privacy-architecture.md §3](privacy-architecture.md)) excludes `user_contributed` as a source for any training sink. |
| **RM-visible?** | No. `rm_lead_db` is dormant ([D-002](../project/decision-log.md)); no row from `owner_metrics` is read into `rm_lead_db` at v0.3. |
| **Crosses to brief lane?** | Only as an in-process payload to the n8n analysis call ([analysis-pipeline-data.md](analysis-pipeline-data.md)) — never as a persisted brief field. |
| **Retention** | Indefinite for the trial duration; on revoke, retained per [D-012](../project/decision-log.md) Option A (no deletion). GDPR Art. 17 erasure is a separate Settings action when load-bearing ([OQ-004](../project/open-questions.md)). |
| **Consent dependency** | Every row's existence is gated by a non-revoked `grant` event; FK is NOT NULL. |

**Demo-owner caveat.** The demo owner's `consent_event_id` is the `grant` event minted at app-server boot for the bypassed identity (engineer's responsibility — see [v0-2-identity-bypass.md](../engineering/v0-2-identity-bypass.md)). Real onboarding consent capture is a v0.4 concern. The PATCH endpoint must NOT silently mint a consent event on behalf of an owner it has not seen consent for.

---

## 7. Open questions

| ID | Question | Assumed-for-now | Blocks |
|---|---|---|---|
| OQ-OM-01 | Should `revenue_per_employee` store CZK or thousands of CZK? PM spec says input is in `tis. Kč`; storing thousands keeps NUMERIC(14,4) headroom and matches the input unit. | Store thousands. `2 450` means 2,45 M CZK / FTE. | EN PATCH normaliser. |
| OQ-OM-02 | History table for production multi-tenant. | Deferred to v0.4. Last-write-wins at v0.3. | v0.4 production launch (audit log requirement). |
| OQ-OM-03 | Cross-firm scoping when the IČO switcher changes the active firm. The demo user's `owner_metrics` rows are keyed by `user_id`, not by IČO; switching firms re-seeds `owner_metrics` from `cohort_companies` for the new IČO, overwriting any prior PATCH for the demo user. | Acceptable for v0.3 (single-tester demo). v0.4 multi-tenant adds `firm_ico` to the PK. | v0.4 multi-tenant rollout. |

---

## Changelog

- 2026-04-27 — initial draft for v0.3. Defines `owner_metrics(user_id, metric_id, …)` in `user_contributed` lane with composite PK for idempotent upsert, frozen 8 metric IDs per D-024, RLS row-scoping to `current_user_id`, `consent_event_id` NOT NULL FK, last-write-wins update semantics, `prepopulated_excel`/`user_entered`/`demo_seed` source enum, and a default-no posture on training and RM visibility. Three OQs logged. — data-engineer
- 2026-04-29 — v0.3 D-032 swap: replaced `pricing_power` with `roe` in the metric_id CHECK constraint (migration 0013) and in the §3 frozen-8 metric table. `roe` stored as percent (`12.4` → `12,4 %`), bounds -100 / 200 / 1 dp; display rule uses U+2212 for negatives and **no `+` prefix on positives** to match `formatDisplay` in `src/lib/owner-metrics.ts`. — data-engineer
