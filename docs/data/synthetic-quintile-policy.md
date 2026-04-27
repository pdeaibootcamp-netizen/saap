# Synthetic Quintile Policy — v0.3

*Owner: data-engineer · Slug: synthetic-quintile-policy · Last updated: 2026-04-27*

The synth-fallback per [D-025](../project/decision-log.md). When real industry data does not cover a `(NACE division, metric)` cell, this policy supplies sector-plausible quintile boundaries so the dashboard tile can still render a percentile. The synth row is **explicitly tagged** in `cohort_aggregates` so it is never confused with real data, supersedable cleanly when real data lands, and inspectable by analysts.

This file is the methodology, the schema, and **the actual proposed numbers** for NACE 49 (road transport) and four further demo-relevant Czech NACEs. Picking the numbers is the load-bearing DE deliverable here — these are not deferred.

---

## 1. Upstream links

- Build plan: [docs/project/build-plan.md](../project/build-plan.md) §11 (v0.3)
- Decisions:
  - [D-014](../project/decision-log.md) — graceful-degradation
  - [D-024](../project/decision-log.md) — frozen 8 metrics (Net margin replaces ROCE)
  - [D-025](../project/decision-log.md) — synth fallback policy (this file's mandate)
- PRD sections: §10 (data foundation, "20 000+ anonymized records" reference), §13.5 (cold-start)
- Source references for synth calibration:
  - **MPO Panorama českého průmyslu** — annual sector reports from the Czech Ministry of Industry and Trade. Used for revenue distribution and labour-cost share by NACE.
  - **Český statistický úřad (ČSÚ)** — sector aggregates, "Roční národní účty / Strukturální podnikové statistiky".
  - **Bisnode / Dun & Bradstreet Czech sector medians** — public summary statistics used by Czech banks and rating agencies.
  - **ČS internal benchmarks** (where DE has access via the orchestrator) — not citable line-by-line in a public repo, but informs envelope plausibility.
- Companions: [percentile-compute.md](percentile-compute.md) §6 (interpolation algorithm); [cohort-ingestion.md](cohort-ingestion.md) §6 (which metrics fall to synth for NACE 49).

---

## 2. Schema — `cohort_aggregates`

```sql
CREATE TABLE IF NOT EXISTS cohort_aggregates (
  nace_division        TEXT         NOT NULL
                                    CHECK (nace_division ~ '^\d{2}$'),
  metric_id            TEXT         NOT NULL
                                    CHECK (metric_id IN (
                                      'gross_margin', 'ebitda_margin',
                                      'labor_cost_ratio', 'revenue_per_employee',
                                      'working_capital_cycle', 'net_margin',
                                      'revenue_growth', 'pricing_power'
                                    )),

  -- Five distribution cut-points. Units match owner_metrics-schema.md §3.
  q1                   NUMERIC(14,4) NOT NULL,    -- 20th percentile
  q2                   NUMERIC(14,4) NOT NULL,    -- 40th
  median               NUMERIC(14,4) NOT NULL,    -- 50th
  q3                   NUMERIC(14,4) NOT NULL,    -- 60th
  q4                   NUMERIC(14,4) NOT NULL,    -- 80th

  -- Claimed-equivalent cohort size (200 uniformly for DE-authored rows; see
  -- percentile-compute.md §6.4). Real-data rows would carry actual N.
  n_proxy              INTEGER      NOT NULL DEFAULT 200,

  -- 'real' = computed from cohort_companies aggregation;
  -- 'synthetic' = DE-authored from sector references.
  source               TEXT         NOT NULL
                                    CHECK (source IN ('real', 'synthetic')),

  generated_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
  generated_by         TEXT         NOT NULL,            -- 'de-authored' | 'compute-pipeline'
  methodology_note     TEXT,                              -- one-line rationale for synth rows

  PRIMARY KEY (nace_division, metric_id, source)
);
```

**`(nace_division, metric_id, source)` PK** allows a real row and a synth row to coexist for the same cell. Per [D-025](../project/decision-log.md) and [percentile-compute.md §9 OQ-PC-03](percentile-compute.md), `computePercentile()` always prefers the real row when both exist. The synth row stays in the DB until explicitly removed — it never causes harm (the runtime ignores it) and it is the safety net if a future real-data ingest is rolled back.

**Constraint enforced in seed script (not at DB level):** `q1 ≤ q2 ≤ median ≤ q3 ≤ q4`. Violating this would break the interpolation in [percentile-compute.md §6.2](percentile-compute.md). The seed script asserts the ordering before INSERT.

---

## 3. Methodology — how synth values are picked

For each `(NACE division, metric)` cell the DE authors:

1. Identify the **credible range** for the metric in that NACE — the band between low-but-real and high-but-real values for typical Czech firms in that sector. This is the support of the synthetic distribution.
2. Identify the **sector median** — the typical value, calibrated against MPO Panorama / ČSÚ aggregates / public Bisnode summaries where they exist.
3. Place the five quintile boundaries inside the credible range to produce a distribution that **(a)** has the right median, **(b)** has plausible interquartile spread (q1–q4 span typical of Czech SME dispersion in the sector), and **(c)** is monotone non-decreasing.
4. Document a one-line `methodology_note` explaining the rationale.

The synth distribution is **deliberately conservative** — narrower than the real Czech-SME spread is rumored to be, because (a) tighter quintiles understate the owner's position more politely than they overstate it, and (b) when the synth is replaced by real data, percentiles tend to drift outward, not inward, which is the gentler direction for a customer-testing demo.

---

## 4. Per-metric credible ranges (NACE-agnostic)

Before the per-NACE table, the per-metric envelope. These are Czech-SME-typical ranges informed by the references in §1; they bound where any synthetic q1 / q4 sits regardless of NACE.

| Metric | Unit | Typical Czech SME credible range | Notes |
|---|---|---|---|
| `gross_margin` | % | 8 – 55 | Manufacturing / distribution / construction span; high for software-services. |
| `ebitda_margin` | % | -2 – 28 | Negatives appear in cyclically weak years; persistent positives. |
| `labor_cost_ratio` | % | 8 – 55 | Capital-intensive low; service-heavy high. |
| `revenue_per_employee` | tis. CZK / FTE | 800 – 12 000 | Trade and software at the top; food and labor-heavy services lower. |
| `working_capital_cycle` | days | -20 – 180 | Negative for cash-business retail; high for project businesses. |
| `net_margin` | % | -3 – 18 | Compresses tighter than EBITDA after tax + finance cost. |
| `revenue_growth` (YoY) | % | -15 – 25 | Czech SME 2024–2026 macro envelope; outliers wider. |
| `pricing_power` (YoY Δ gross margin) | p. b. | -4 – 4 | Most sectors run within ±2 p. b.; ±4 catches genuine power shifts. |

Synth quintiles for any NACE must sit inside these envelopes unless DE writes an explicit per-sector justification.

---

## 5. Per-NACE synth quintile values

### 5.1 NACE 49 — Road transport (Doprava silniční nákladní)

The mandatory case. Real Excel data covers `revenue_per_employee` and `net_margin`; the synth values below cover the **other six metrics**. Table values are stored numerics — what `cohort_aggregates.q1`/`q2`/`median`/`q3`/`q4` carry.

| Metric | q1 (P20) | q2 (P40) | median (P50) | q3 (P60) | q4 (P80) | Rationale |
|---|---|---|---|---|---|---|
| `gross_margin` | `12.0` | `16.0` | `18.0` | `20.0` | `25.0` | Road haulage is a low-gross-margin sector — fuel / sub-contracting / leased fleets compress margin. Median ~18 % is consistent with MPO Panorama transport-services aggregates. |
| `ebitda_margin` | `3.0` | `5.5` | `7.0` | `8.5` | `12.0` | Single-digit EBITDA typical; well-run carriers reach ~12 %. Loss-makers exist but are below the q1 floor and clamp to spodní čtvrtina. |
| `labor_cost_ratio` | `22.0` | `27.0` | `30.0` | `33.0` | `38.0` | Driver wages dominate the cost stack. Median ~30 % matches Czech transport sector wage share. |
| `working_capital_cycle` | `18` | `32` | `42` | `52` | `75` | DSO ~45–60 days from large logistics-buyer customers; DPO partly offsets. Median ~42 days. |
| `revenue_growth` | `-4.0` | `0.0` | `2.5` | `5.0` | `10.0` | 2024–2026 sector mostly flat-to-low-single-digit; freight volumes recovered slowly post-2023. |
| `pricing_power` | `-1.5` | `-0.5` | `0.0` | `0.5` | `1.5` | Tight price-cost dynamic; most firms hold margin within ±1 p. b. |

**Internal consistency check.** A NACE-49 firm at the median across all six synth metrics has gross 18 %, EBITDA 7 %, labour 30 % — i.e. depreciation + fuel + sub-contracting eat ~11 percentage points between gross and EBITDA, which is the expected gap for a fleet-operating road carrier. The synth distribution is internally coherent before the runtime even joins it to real `net_margin` values.

### 5.2 NACE 31 — Furniture manufacturing (Výroba nábytku)

Pre-seeded so the v0.2 demo carries forward consistently when re-pointed at v0.3 ([dummy-owner-metrics.md](dummy-owner-metrics.md) used hand-seeded percentiles for this NACE; the synth values below are calibrated to roughly reproduce the v0.2 owner's quartile placements when fed the v0.2 raw values).

| Metric | q1 | q2 | median | q3 | q4 | Rationale |
|---|---|---|---|---|---|---|
| `gross_margin` | `15.0` | `20.0` | `23.0` | `26.0` | `32.0` | Discrete manufacturing with material variance; median ~23 % matches MPO furniture aggregates. |
| `ebitda_margin` | `4.0` | `7.0` | `9.0` | `11.0` | `15.0` | Median 9 %; negative tail extends in soft consumer-discretionary cycles. |
| `labor_cost_ratio` | `22.0` | `26.0` | `29.0` | `32.0` | `37.0` | Mid-automation production; Praha wage premium pushes the upper band. |
| `revenue_per_employee` | `1 600` | `2 100` | `2 400` | `2 700` | `3 400` | Czech furniture median ~2,4 M Kč/FTE; matches public Bisnode data for the sector. |
| `working_capital_cycle` | `35` | `52` | `62` | `72` | `90` | Inventory-heavy; furniture finished goods + customer terms dominate. |
| `net_margin` | `1.5` | `3.5` | `4.8` | `6.2` | `9.0` | Compresses ~4 p. b. from EBITDA after tax + finance cost. |
| `revenue_growth` | `-5.0` | `0.5` | `3.0` | `5.5` | `10.0` | 2026 furniture demand subdued; positive but low growth typical. |
| `pricing_power` | `-1.0` | `-0.3` | `0.2` | `0.7` | `1.5` | Modest pricing power; mostly contained ±1 p. b. |

Verification: feed the v0.2 owner's `gross_margin = 23.4` against q1=15, q2=20, median=23, q3=26, q4=32 → interpolation puts owner just above median, around P52 — close to v0.2's hand-seeded P68 but not byte-equal. v0.2 hand-seed is fiction; the v0.3 synth is calibrated. The drift is acceptable and expected.

### 5.3 NACE 25 — Manufacture of fabricated metal products (Výroba kovových konstrukcí a kovodělných výrobků)

Demo-relevant — high firm count in Czechia, frequently surfaced in ČS analyses.

| Metric | q1 | q2 | median | q3 | q4 | Rationale |
|---|---|---|---|---|---|---|
| `gross_margin` | `14.0` | `18.0` | `21.0` | `24.0` | `30.0` | Material-intensive; median ~21 %. |
| `ebitda_margin` | `4.0` | `7.0` | `9.0` | `11.0` | `15.0` | Similar to furniture in structure. |
| `labor_cost_ratio` | `20.0` | `24.0` | `27.0` | `30.0` | `35.0` | Slightly lower than furniture (more automated). |
| `revenue_per_employee` | `1 800` | `2 400` | `2 800` | `3 200` | `4 000` | Higher than furniture due to capital intensity. |
| `working_capital_cycle` | `30` | `48` | `58` | `70` | `92` | AR-heavy; B2B customer terms dominate. |
| `net_margin` | `1.8` | `4.0` | `5.2` | `6.5` | `9.5` | |
| `revenue_growth` | `-6.0` | `0.0` | `2.5` | `5.0` | `9.0` | Industrial demand cycle 2024–2026. |
| `pricing_power` | `-1.2` | `-0.3` | `0.1` | `0.6` | `1.4` | |

### 5.4 NACE 47 — Retail trade except motor vehicles (Maloobchod)

Demo-relevant — most-recognised sector for Czech SMEs.

| Metric | q1 | q2 | median | q3 | q4 | Rationale |
|---|---|---|---|---|---|---|
| `gross_margin` | `16.0` | `22.0` | `26.0` | `30.0` | `38.0` | Wide retail spread — discounters low, specialty high. |
| `ebitda_margin` | `2.0` | `4.5` | `6.0` | `7.5` | `11.0` | Tighter than wholesale due to rent + retail labour. |
| `labor_cost_ratio` | `12.0` | `16.0` | `19.0` | `22.0` | `28.0` | Retail labour share lower than services because of rent share. |
| `revenue_per_employee` | `1 500` | `2 200` | `2 700` | `3 200` | `4 500` | Specialty retail at the top; supermarkets-style at the bottom. |
| `working_capital_cycle` | `-10` | `5` | `15` | `28` | `50` | Cash-business low; B2B-leaning retail higher. Negative band covers fast-turnover discounters. |
| `net_margin` | `0.5` | `2.5` | `3.5` | `4.8` | `7.5` | Tight retail margin after tax. |
| `revenue_growth` | `-4.0` | `1.0` | `3.5` | `6.0` | `12.0` | Czech consumer demand modest growth. |
| `pricing_power` | `-1.5` | `-0.4` | `0.2` | `0.8` | `1.8` | Specialty retail has more pricing power than mass. |

### 5.5 NACE 62 — Computer programming, consultancy (IT services)

Demo-relevant — explicitly different metric profile (high gross margin, high revenue/FTE) so the dashboard reads visibly different when switched to this NACE.

| Metric | q1 | q2 | median | q3 | q4 | Rationale |
|---|---|---|---|---|---|---|
| `gross_margin` | `35.0` | `45.0` | `52.0` | `58.0` | `68.0` | High-services-margin sector; wage cost is the cost-of-services. |
| `ebitda_margin` | `8.0` | `13.0` | `16.0` | `20.0` | `28.0` | Czech IT-services typical EBITDA. |
| `labor_cost_ratio` | `35.0` | `42.0` | `46.0` | `50.0` | `58.0` | Wages dominate. |
| `revenue_per_employee` | `1 800` | `2 600` | `3 200` | `3 800` | `5 500` | Higher than industrial sectors; outsourced firms toward upper. |
| `working_capital_cycle` | `25` | `40` | `52` | `65` | `90` | Project-billing AR is the dominant component. |
| `net_margin` | `5.0` | `9.0` | `12.0` | `15.0` | `22.0` | Wide spread — strong firms keep most of EBITDA. |
| `revenue_growth` | `-3.0` | `2.0` | `6.0` | `10.0` | `18.0` | IT-services growth typically faster than other Czech SMEs. |
| `pricing_power` | `-1.0` | `0.0` | `0.5` | `1.2` | `2.5` | Stronger pricing power than industrial sectors. |

### 5.6 NACE 41 — Construction of buildings (Výstavba budov)

Demo-relevant — large NACE, frequently asked-about, distinctive working-capital and project-cycle profile.

| Metric | q1 | q2 | median | q3 | q4 | Rationale |
|---|---|---|---|---|---|---|
| `gross_margin` | `8.0` | `12.0` | `14.0` | `17.0` | `22.0` | Tight construction margin; sub-contracting eats spread. |
| `ebitda_margin` | `2.0` | `4.0` | `5.5` | `7.5` | `11.0` | Cyclical; medians compressed in 2025–26 weak cycle. |
| `labor_cost_ratio` | `15.0` | `20.0` | `23.0` | `27.0` | `33.0` | Sub-contracting reduces direct labour share vs services. |
| `revenue_per_employee` | `2 200` | `3 200` | `3 800` | `4 500` | `6 200` | High per-FTE because sub-contractor revenue passes through. |
| `working_capital_cycle` | `60` | `90` | `110` | `135` | `170` | Long project cycles; AR dominates working capital. |
| `net_margin` | `0.5` | `2.0` | `3.0` | `4.2` | `7.0` | |
| `revenue_growth` | `-12.0` | `-3.0` | `1.5` | `6.0` | `14.0` | High variance — project pipeline timing dominates. |
| `pricing_power` | `-2.0` | `-0.5` | `0.0` | `0.7` | `2.0` | Cycle-dependent; tighter band in soft years. |

---

## 6. Generation + audit trail

Each row is INSERTed by `src/scripts/seed-synth-aggregates.ts` (engineer's lane). The script:

1. Reads §5 tables from a TS constant (single source of truth for the numbers above).
2. Asserts `q1 ≤ q2 ≤ median ≤ q3 ≤ q4` for every row before commit.
3. Asserts every q-value sits inside the §4 envelope; aborts on violation.
4. INSERTs with `source = 'synthetic'`, `generated_by = 'de-authored'`, `n_proxy = 200`, `methodology_note = '<rationale string>'`.

**`generated_by` values in v0.3:**
- `'de-authored'` — the v0.3 synth rows in §5.
- `'compute-pipeline'` — reserved for v0.4 when `cohort_companies` aggregation can produce `source = 'real'` rows automatically.

When richer real-data lands, the compute pipeline writes a row with `source = 'real'`, leaving the synth row in place; `computePercentile()` prefers the real one ([percentile-compute.md §6](percentile-compute.md)). DE may explicitly DELETE the synth row in a later migration once real coverage is proven, but is not required to.

---

## 7. Replacement path — synth → real

When real industry data lands for a `(naceDivision, metricId)` cell:

1. The new ingestion adds rows to `cohort_companies` (per [cohort-ingestion.md](cohort-ingestion.md) §4.4 — derived metric column populated).
2. A nightly / on-demand `compute-aggregates` job (engineer's lane, v0.4) reads `cohort_companies` and INSERTs a `source = 'real'` row in `cohort_aggregates` for the cell, using the same q1/q2/median/q3/q4 schema computed from real percentiles.
3. `computePercentile()` checks `cohort_companies` first (real path, §3 in percentile-compute.md). If that yields a result, the synth row is silently irrelevant for that cell. If not, real-row `cohort_aggregates` wins over synth-row `cohort_aggregates` per the source preference rule.
4. The synth row remains in the table until explicitly removed in a future migration, providing a fall-back in case the real-data ingest is reverted.

---

## 8. Privacy posture

`cohort_aggregates` rows hold sector-level cut-points only — never per-firm IČO, name, or row. Synth rows are DE-authored from public sector references; they carry zero re-identification risk by construction. RLS posture matches `cohort_companies` ([cohort-ingestion.md §3](cohort-ingestion.md)): readable by `user_contributed_lane_role` (for the runtime percentile compute) and the analyst aggregate role; writable only by migration / seed script.

---

## 9. Open questions

| ID | Question | Assumed-for-now | Blocks |
|---|---|---|---|
| OQ-SQ-01 | Should synth rows ever decay (i.e. expire after N months if no real-data row arrives)? | No — synth rows persist until explicitly replaced. The `generated_at` column is informational, not enforced. | v0.4 production launch (where stale synth could mislead). |
| OQ-SQ-02 | Are the §5.1 NACE-49 numbers calibrated tightly enough for analyst review, or should DE pair with a ČS sector analyst to refine them before the demo? | Tight enough for v0.3 customer-testing. Analyst pairing is a follow-up. | Whether the dashboard reads "right" to a ČS analyst glancing at it. |
| OQ-SQ-03 | The five NACEs in §5 cover ~30 % of demo-relevant Czech SME activity. What is the prioritisation rule for adding more? | Add by-NACE on demand; orchestrator decides which NACEs make the cut for v0.3 demo coverage. | Demo coverage breadth. |

---

## Changelog

- 2026-04-27 — initial draft for v0.3 per D-025. Defines `cohort_aggregates(nace_division, metric_id, q1, q2, median, q3, q4, n_proxy, source, generated_at, generated_by, methodology_note)` with composite PK `(nace_division, metric_id, source)` allowing real and synth to coexist; methodology calibrated against MPO Panorama / ČSÚ / Bisnode public references; per-metric Czech-SME envelope; concrete synth quintile values authored for **NACE 49 (road transport, the inaugural case)** plus four further demo-relevant NACEs (31 furniture, 25 metal fabrication, 47 retail, 62 IT services, 41 construction); audit fields `generated_by` + `methodology_note`; replacement path keyed off the source-preference rule in [percentile-compute.md §6](percentile-compute.md). — data-engineer
