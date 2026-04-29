# Cohort Ingestion — v0.3

*Owner: data-engineer · Slug: cohort-ingestion · Last updated: 2026-04-29*

The pipeline that ingests an industry-data Excel into Supabase Postgres so the v0.3 percentile-compute path has real per-firm rows to compute against. The live v0.3 source is a single multi-NACE workbook (`Data MagnusWeb.xlsx`, see §1 / [D-031](../project/decision-log.md)) covering four divisions in scope: 10 (Pekárenství), 31 (Výroba nábytku), 46 (Velkoobchod s rudami & Výroba hliníku), and 49 (Nákladní doprava). The schema and ingestion script support multiple NACEs side-by-side without code changes.

This is the data shape and ingestion contract. Percentile computation against this data lives in [percentile-compute.md](percentile-compute.md). The synth-fallback for cells the Excel does not cover lives in [synthetic-quintile-policy.md](synthetic-quintile-policy.md).

---

## 1. Upstream links

- Build plan: [docs/project/build-plan.md](../project/build-plan.md) §11 (v0.3), §11.4 Phase 3.1 Track B
- PRD sections: §10 (data foundation, anonymized seed), §13.5 (cold-start)
- Decisions:
  - [D-001](../project/decision-log.md) — hand-assigned cohorts on pre-populated data
  - [D-006](../project/decision-log.md) — NACE × size × region segmentation
  - [D-010](../project/decision-log.md) — canonical lane identifiers
  - [D-013](../project/decision-log.md) — Supabase Postgres
  - [D-023](../project/decision-log.md) — IČO-driven demo owner switching
  - [D-024](../project/decision-log.md) — frozen 8 metrics (Net margin replaces ROCE)
  - [D-025](../project/decision-log.md) — synthetic per-NACE quintile fallback
  - [D-031](../project/decision-log.md) — single multi-NACE source workbook (`Data MagnusWeb.xlsx`)
  - [D-032](../project/decision-log.md) — pricing_power → ROE (8th metric swap)
- Source data: `PRD/industry-data/Data MagnusWeb.xlsx` — single sheet, 1 443 rows, 4 NACE divisions in scope (10, 31, 46, 49); held local-only per `.gitignore` because the repo is public. Replaces the prior NACE-specific files (`nace-4941-silnicni-nakladni-doprava-2026-02.xlsx` etc.), which are archived in `PRD/industry-data/_archive/`.
- Companions: [percentile-compute.md](percentile-compute.md), [synthetic-quintile-policy.md](synthetic-quintile-policy.md), [owner-metrics-schema.md](owner-metrics-schema.md), [cohort-math.md](cohort-math.md), [privacy-architecture.md](privacy-architecture.md).

---

## 2. Source-data shape (`Data MagnusWeb.xlsx` — multi-NACE)

The Excel has 1 443 firm rows on a single sheet, spanning four NACE divisions in scope (10, 31, 46, 49). Header row:

| Excel column | Type | Notes |
|---|---|---|
| `IČO` | string (8-digit) | Czech business registry ID. Primary key candidate. |
| `Název subjektu` | string | Trade name. **Do not persist** — not needed for cohort math, and persisting names invites confusion about whether this row is `brief` or `user_contributed` lane. |
| `Obrat` | numeric (CZK) | Annual revenue. Drives `net_margin` numerator and `revenue_per_employee`. |
| `Kategorie obratu` | string bucket | Bucketed revenue band (e.g. `25–50 mil. Kč`). Use as fallback when `Obrat` is null. |
| `Hospodářský výsledek za účetní období` | numeric (CZK) | Profit/loss after tax. Drives `net_margin` and (with `Vlastní kapitál`) `roe`. |
| `Vlastní kapitál` | numeric (CZK) | Book equity. Drives `roe` denominator (§4.4). |
| `Rok` | integer | Reporting year. Almost always 2024; a small tail of 2023 / 2022. |
| `Počet zaměstnanců` | numeric | Headcount. Often null (~ 30 % populated as exact integer). |
| `Kategorie počtu zaměstnanců CZ` | string bucket | E.g. `1-5`, `6-9`, `10-19`, `20-24`, `25-49`, `50-99`. Always populated when headcount is null. |
| `Hlavní NACE` | string (4-digit) | E.g. `49.41`. Drives `nace_class` and (via §4.1) `nace_division`. |

> **No city / Obec sídla / Město column.** The MagnusWeb workbook does **not** carry a city-of-registered-office column. Region coverage on ingest is therefore 0 %: `cohort_companies.cz_region` is NULL on every row ingested from this source. The §4.2 city → region lookup is **obsolete** for this file. Downstream consequence: percentile-compute rung 0 (NACE × size × region) and rung 2 (NACE × region) are structurally unreachable; rung 1 (NACE × size) is the lowest reached. Tracked as [OQ-080](../project/open-questions.md).

The MagnusWeb workbook supplies enough P&L + equity to derive **three of the eight frozen metrics** directly:

- `revenue_per_employee` — `Obrat / Počet zaměstnanců` where both present.
- `net_margin` — `Hospodářský výsledek za účetní období / Obrat × 100` where both present.
- `roe` — `Hospodářský výsledek za účetní období / Vlastní kapitál × 100` (§4.4) — observed coverage 71–95 % per NACE in the live ingest. Added per [D-032](../project/decision-log.md).

The other five metrics fall to the synthetic fallback in [synthetic-quintile-policy.md](synthetic-quintile-policy.md) per [D-025](../project/decision-log.md).

---

## 3. Target schema — `cohort_companies`

Per-firm rows; one row per `(ico, year)`. Lives in `user_db` infrastructure namespace, but the data is **anonymized industry data ingested under existing ČS or public-registry agreements** rather than user-contributed in the consent-bound sense — this is the same posture as `user_ingest_prepopulated` in [privacy-architecture.md](privacy-architecture.md) §3 ([OQ-003](../project/open-questions.md) tracks the legal basis).

```sql
CREATE TABLE IF NOT EXISTS cohort_companies (
  ico                       TEXT         NOT NULL
                                         CHECK (ico ~ '^\d{8}$'),
  year                      INTEGER      NOT NULL
                                         CHECK (year BETWEEN 2015 AND 2030),

  -- NACE — both grains stored to avoid recomputing on read.
  nace_class                TEXT         NOT NULL    -- 4-digit, e.g. '4941'
                                         CHECK (nace_class ~ '^\d{4}$'),
  nace_division             TEXT         NOT NULL    -- 2-digit, e.g. '49'
                                         CHECK (nace_division ~ '^\d{2}$'),

  -- Region (NUTS 2) derived from city. NULL when city is missing or unmapped.
  cz_region                 cz_region,

  -- Size band — bucketed per §4.3 translation. Always populated.
  size_band                 size_band    NOT NULL,

  -- Raw firm-level inputs (CZK / count). All nullable — coverage gaps are common.
  revenue_czk               NUMERIC(18,2),
  profit_czk                NUMERIC(18,2),
  equity_czk                NUMERIC(18,2),                  -- "Vlastní kapitál"; ROE denominator (§4.4)
  employee_count            INTEGER,

  -- Derived per-firm metric values. Computed at ingest, NULL when inputs missing
  -- or value falls outside the per-metric plausibility envelope (§5.2).
  -- Stored as percent points (e.g. 7.4 means 7,4 %) and thousands of CZK
  -- (matching owner_metrics units in owner-metrics-schema.md §3).
  net_margin                NUMERIC(8,4),
  revenue_per_employee      NUMERIC(12,2),
  roe                       NUMERIC(8,4),                   -- migration 0012; partial index below

  -- Provenance.
  source_file               TEXT         NOT NULL,
  ingested_at               TIMESTAMPTZ  NOT NULL DEFAULT now(),

  PRIMARY KEY (ico, year)
);

CREATE INDEX IF NOT EXISTS idx_cohort_companies_cell
  ON cohort_companies (nace_division, size_band, cz_region);

CREATE INDEX IF NOT EXISTS idx_cohort_companies_division_year
  ON cohort_companies (nace_division, year);

-- Lookup index for the IČO switcher (in-tile-prompts.md §8).
CREATE INDEX IF NOT EXISTS idx_cohort_companies_ico
  ON cohort_companies (ico);

-- Partial index for ROE percentile lookup (migration 0012, D-032).
CREATE INDEX IF NOT EXISTS idx_cohort_companies_roe
  ON cohort_companies (nace_division, size_band, roe)
  WHERE roe IS NOT NULL;
```

**Why `(ico, year)` as PK.** A firm may appear in multiple yearly snapshots in future ingests; the demo IČO switcher resolves to the latest year present for that IČO. Re-ingesting the same `(ico, year)` is idempotent (§6.2).

**Why store both `nace_class` and `nace_division`.** Cohort math runs at division grain ([cohort-math.md](cohort-math.md) §2.1); future per-class drill-downs ([Q-006](../project/open-questions.md)) need the 4-digit code without re-lookup.

**RLS posture.** No row-level identification of any single user — this table contains industry-wide firm rows. Read access is granted to the same `user_contributed_lane_role` (which performs cohort lookups for the active demo user) and to the analyst aggregate role. No write access except the migration / ingestion script. **No `consent_event_id` FK** — these rows are not user-contributed in the consent sense; they are industry data ingested under existing legal basis ([OQ-003](../project/open-questions.md) tracks).

---

## 4. Normalisation rules (Excel → row)

The ingestion script is a one-shot Node TypeScript file in `src/scripts/ingest-cohort-excel.ts` (engineer's lane). Below is the data contract the script must implement; mapping logic lives in three lookup tables shipped alongside the script.

### 4.1 NACE: 4-digit class → 2-digit division

```
nace_class = strip non-digits, pad to 4
nace_division = first 2 chars of nace_class
```

E.g. `49.41` → `nace_class = '4941'`, `nace_division = '49'`. If the Excel value is malformed (fewer than 2 digits after stripping), the row is skipped and logged.

**`NACE_LABEL_TO_CLASS` (label → 4-digit class).** When the workbook carries a Czech label rather than a numeric NACE, `src/scripts/ingest-industry-data.ts` resolves it via a fixed lookup. v0.3 entries covering the four scoped divisions:

| Label (lowercased) | `nace_class` | `nace_division` |
|---|---|---|
| `silniční nákladní doprava` | `4941` | `49` |
| `výroba nábytku` | `3100` | `31` |
| `pekárenství` | `1071` | `10` |
| `nákladní doprava` | `4941` | `49` |
| `velkoobchod s rudami & výroba hliníku` | `4672` | `46` |

The bottom three rows are the v0.3 additions for the MagnusWeb workbook ([D-031](../project/decision-log.md), [D-032](../project/decision-log.md)).

The 46 row is a **mixed group** — the underlying firms span NACE 46.72 (wholesale of metal ores) and NACE 24.42 (aluminium production). Per [D-031](../project/decision-log.md) we treat the whole group as division 46 (acceptable noise for the v0.3 PoC); cleanup is tracked as [OQ-081](../project/open-questions.md).

### 4.2 City → `cz_region`

> **Obsolete for the live v0.3 source.** The MagnusWeb workbook ([D-031](../project/decision-log.md)) has no city / Obec sídla / Město column, so this lookup never runs against it: every ingested row has `cohort_companies.cz_region = NULL`. The lookup remains in the codebase for future workbooks that do carry a city column. See [OQ-080](../project/open-questions.md). The text below is preserved for that future case.

A JSON lookup file at `src/lib/cz-city-region-map.json` maps lowercased Czech city names (with diacritics preserved) to the 8 NUTS-2 region values from [cohort-math.md](cohort-math.md) §2.3. Orchestrator agreed to help fill this; engineer ships the file with at minimum the 50 largest Czech cities pre-populated. Any city not in the map produces `cz_region = NULL` (the row still ingests; it simply does not enter region-scoped cohort cells until the map is extended).

```jsonc
// src/lib/cz-city-region-map.json — partial example
{
  "praha": "Praha",
  "brno": "Jihovýchod",
  "ostrava": "Moravskoslezsko",
  "plzeň": "Jihozápad",
  "liberec": "Severovýchod",
  // … 50+ entries
  "_meta": { "version": "1.0", "last_updated": "2026-04-27" }
}
```

Lookup is case-insensitive (`String.prototype.toLowerCase()` in JS handles Czech diacritics correctly). Trailing district suffixes (`Praha 1`, `Praha 4`) collapse to the base city name via a regex in the script. Unmapped cities are emitted to a `cz-city-region-map.unmapped.log` artifact at ingest end so the orchestrator can extend the map iteratively.

### 4.3 Employee count → `size_band`

Two paths: exact integer `Počet zaměstnanců` is preferred; the Excel's `Kategorie počtu zaměstnanců CZ` bucket is the fallback. Both flow through the same translation table (per orchestrator brief):

| Excel input | Mapped `size_band` | Notes |
|---|---|---|
| Exact int 1-5 | S1 | |
| Exact int 6-9 | S1 | |
| Exact int 10-19 | S1 | |
| Exact int 20-24 | S1 | |
| Exact int 25-49 | S2 | |
| Exact int 50-99 | S3 | |
| Exact int ≥ 100 | S3 | persona ceiling (PRD §3) is 100; ≥100 stays S3 but flagged. |
| Bucket `1-5` / `6-9` / `10-19` / `20-24` | S1 | |
| Bucket `25-49` | S2 | |
| Bucket `50-99` / `100+` | S3 | |
| Both null | row skipped, logged | |

This **diverges** from [cohort-math.md](cohort-math.md) §2.2's "10–24 / 25–49 / 50–100" because the v0.3 source data carries 1-5 / 6-9 firms that we want included in the cohort even though they are below the persona size minimum. Per orchestrator brief: collapse 1-24 into S1 for v0.3 ingestion. Logged as [OQ-CI-01](#7-open-questions) — when MVP-style strict persona-bound enforcement returns, the script gains a `--exclude-below-10` flag.

### 4.4 Per-firm metric derivation

Computed at ingest time, stored on the row:

```
net_margin           = (profit_czk / revenue_czk) * 100      -- if both not null
                       and abs(revenue_czk) > 1000           -- skip near-zero divisor
                       and result in [-50, 60]               -- plausibility (§5.2)

revenue_per_employee = (revenue_czk / employee_count) / 1000 -- in thousand CZK per FTE
                       if both not null
                       and employee_count > 0
                       and result in [100, 100000]           -- plausibility

roe                  = (profit_czk / equity_czk) * 100       -- D-032; profit_czk =
                       -- "Hospodářský výsledek za účetní období",
                       -- equity_czk = "Vlastní kapitál"
                       if both not null
                       and equity_czk > 1000                 -- avoid astronomic %
                                                             --  on near-zero equity
                       and result in [-100, 200]             -- plausibility envelope
                                                             --  (1 decimal place stored)
                       -- Floor: GLOBAL_FLOOR = 30 (normal-distribution metric;
                       -- not on the strict-50 list — see percentile-compute.md §3.2).
```

Out-of-envelope values are stored as NULL on the derived column, **not** dropped from the row — the underlying `revenue_czk` / `equity_czk` / `employee_count` may still feed other future metrics. The plausibility bounds match PM's owner-side bounds ([owner-metrics-schema.md §3](owner-metrics-schema.md)) for symmetry: industry data and owner-supplied data live in the same envelope.

The other five frozen metrics (`gross_margin`, `ebitda_margin`, `labor_cost_ratio`, `working_capital_cycle`, `revenue_growth`) are **not derivable from this Excel** and are not added as columns on `cohort_companies` at v0.3 — they live exclusively in the `cohort_aggregates` synth table per [synthetic-quintile-policy.md](synthetic-quintile-policy.md). When richer Excel data lands, the script ALTERs `cohort_companies` to add the missing columns; the schema is intentionally extensible.

---

## 5. Ingestion script — behaviour

`src/scripts/ingest-cohort-excel.ts`. Engineer owns the implementation; this section is the contract.

### 5.1 Invocation

```
npm run ingest:industry -- \
  --file PRD/industry-data/Data\ MagnusWeb.xlsx \
  --year 2024
```

The MagnusWeb workbook is multi-NACE; `--nace-division` is no longer a sanity-check switch (the script resolves division per row from `Hlavní NACE` and the §4.1 label map). `--year` overrides any per-row `Rok` value when present (defends against minor inconsistencies in the source file). For backwards compatibility the script still accepts `--nace-division` against single-NACE archived files.

### 5.2 Idempotency

Per-`(ico, year)` upsert via `ON CONFLICT (ico, year) DO UPDATE`. Re-running the same file on the same DB is a no-op apart from `ingested_at` and `source_file` refresh. Re-running with a different `source_file` (e.g. monthly refresh) overwrites — the design assumption is that the latest file is the latest truth for that `(ico, year)` snapshot.

### 5.3 Error handling

- Malformed `IČO` (non-8-digit): skip, log to `ingest.errors.log`.
- Missing both `Počet zaměstnanců` and `Kategorie počtu zaměstnanců CZ`: skip, log.
- City unmapped: row still ingests with `cz_region = NULL`; logged to `cz-city-region-map.unmapped.log` (§4.2). Inactive against MagnusWeb because the workbook has no city column ([OQ-080](../project/open-questions.md)).
- Plausibility-envelope violation on a derived metric: derived column stored NULL, raw inputs preserved.
- Anything else: abort the whole ingest, surface error, no partial commit (transactional).

### 5.4 Reporting

End-of-run summary (stdout):

```
Ingested ~1 400 rows out of 1 443 source rows (Data MagnusWeb.xlsx).
Skipped: small tail (malformed IČO, missing both employee fields).
Coverage (live v0.3, per NACE):
  net_margin           computed for ~60 % of rows
  revenue_per_employee computed for ~20–30 % of rows
  roe                  computed for 71–95 % of rows (per-NACE, see D-032)
Region coverage: 0 rows mapped — MagnusWeb has no city column (OQ-080).
Size-band distribution: dominated by S1 (consistent with Czech SME shape).
```

The percentages tell PM/orchestrator at a glance whether a NACE is "ready" for real-data percentile compute or stays on synth fallback.

---

## 6. Coverage gap handling — which metrics fall to synth

Per [D-025](../project/decision-log.md), every (NACE division, metric) cell that lacks real-data coverage is filled from `cohort_aggregates` with `source = 'synthetic'`. For the four NACEs in scope (10 / 31 / 46 / 49) from the MagnusWeb workbook:

| Metric | Coverage path at v0.3 | Source |
|---|---|---|
| `gross_margin` | Synth — Excel has no COGS line. | `cohort_aggregates`, `source = 'synthetic'` |
| `ebitda_margin` | Synth — no operating profit / depreciation lines. | `cohort_aggregates`, `source = 'synthetic'` |
| `labor_cost_ratio` | Synth — no labor cost line. | `cohort_aggregates`, `source = 'synthetic'` |
| `revenue_per_employee` | **Real** — derived per-firm from `revenue_czk / employee_count`. | `cohort_companies` |
| `working_capital_cycle` | Synth — no AR / AP / inventory. | `cohort_aggregates`, `source = 'synthetic'` |
| `net_margin` | **Real** — derived per-firm from `profit_czk / revenue_czk`. | `cohort_companies` |
| `revenue_growth` | Synth — single-snapshot, no prior-year revenue. | `cohort_aggregates`, `source = 'synthetic'` |
| `roe` | **Real** — derived per-firm from `profit_czk / equity_czk` ([D-032](../project/decision-log.md)). Live coverage 71–95 % per NACE. | `cohort_companies` |

The runtime percentile compute treats both sources uniformly ([percentile-compute.md](percentile-compute.md) §6); the source is logged for audit and surfaced in any analyst debug view but never in owner-facing copy.

---

## 7. Open questions

| ID | Question | Assumed-for-now | Blocks |
|---|---|---|---|
| OQ-CI-01 | Should sub-10-employee firms be included in the cohort, given persona §3 ceiling/floor of 10–100? | Include at v0.3 (collapse 1-24 into S1). MVP-strict mode is a future flag. | Persona-strict cohort recompute when MVP rules return. |
| OQ-CI-02 | Are there NACE divisions with industry-specific revenue / employee distributions that warrant per-NACE plausibility envelopes (rather than the global PM bounds reused here)? | Reuse owner-side bounds globally at v0.3. | Future Excel ingests where envelope mismatch silently nulls too many derived metrics. |
| OQ-CI-03 | The `cz-city-region-map.json` file ships partial; orchestrator agreed to help fill it. What is the ownership for ongoing extension (DE, EN, or shared)? | DE owns the schema; orchestrator + EN co-maintain entries based on `unmapped.log`. | Long-tail city coverage. |

---

## Changelog

- 2026-04-27 — initial draft for v0.3. Defines `cohort_companies(ico, year, nace_class, nace_division, cz_region, size_band, revenue_czk, profit_czk, employee_count, net_margin, revenue_per_employee, source_file, ingested_at)` with `(ico, year)` PK for per-snapshot upsert; NACE 4-digit → 2-digit derivation; city → NUTS-2 lookup via `src/lib/cz-city-region-map.json`; size-band translation collapsing 1-24 into S1 per orchestrator brief; per-firm `net_margin` and `revenue_per_employee` derivation with plausibility envelopes matching owner-side bounds; idempotent `(ico, year)` upsert; explicit coverage table flagging six metrics as falling to D-025 synth. — data-engineer
- 2026-04-29 — v0.3 D-031 + D-032 update. §1 source: now `Data MagnusWeb.xlsx`, 1 443 rows, 4 NACE divisions in scope (10, 31, 46, 49); prior NACE-specific files archived under `PRD/industry-data/_archive/`. §2 column table: dropped `Obec sídla` (the new workbook has no city column → `cz_region` NULL on every row, [OQ-080](../project/open-questions.md)); added `Vlastní kapitál` for the ROE denominator. §3 schema: added `equity_czk` and `roe NUMERIC(8,4)` columns plus partial index `(nace_division, size_band, roe) WHERE roe IS NOT NULL` (migration 0012). §4.1: added the `NACE_LABEL_TO_CLASS` table including the three new MagnusWeb entries; flagged the NACE 46 mixed-group caveat ([OQ-081](../project/open-questions.md)). §4.2 marked obsolete for MagnusWeb. §4.4: added the `roe = (profit_czk / equity_czk) * 100` derivation with the equity > 1000 CZK guard, [-100, 200] envelope, and GLOBAL_FLOOR=30. §6 coverage table: dropped `pricing_power` row, added `roe` row. — data-engineer
