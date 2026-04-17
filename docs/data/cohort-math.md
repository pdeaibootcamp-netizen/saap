# Cohort Math — Strategy Radar MVP

*Owner: data-engineer · Slug: cohort-math · Last updated: 2026-04-17*

Cohort segmentation, the 8 MVP ratios' computation, the minimum-cohort statistical-validity floor, the graceful-degradation rule, and how [D-001](../project/decision-log.md) (hand-assigned cohorts on pre-populated data) changes MVP vs. the long-run design.

A cold reader should be able to implement cohort computation, the floor check, and the degradation behavior from this document alone. Anywhere a value cannot be pinned without further input, an open question is named rather than guessed.

---

## 1. Upstream links

- Build plan: [docs/project/build-plan.md](../project/build-plan.md) §4 (Phase 1).
- Backlog: [docs/project/backlog.md](../project/backlog.md) B-001 (no user cadence commitment during MVP trial).
- Decisions:
  - [D-001](../project/decision-log.md) — hand-assigned cohorts on pre-populated data at MVP.
  - [D-003](../project/decision-log.md) — 8 MVP ratios: gross margin, EBITDA margin, labor cost ratio, working capital cycle, ROCE, revenue growth vs cohort median, pricing power proxy, revenue per employee.
  - [D-006](../project/decision-log.md) — brief personalization grain = NACE only; size / region surface **only** via embedded benchmark snippet, which degrades independently under the floor.
- PRD sections: §5 (metric taxonomy), §8.2 (peer position engine — minimal at MVP), §10 (data and technical foundation), §13.5 (cold-start constraint).
- Companion: [docs/data/privacy-architecture.md](privacy-architecture.md) — lane separation, consent, FL/DP posture (§8 there explains why MVP is centralized-batch, not federated).
- Glossary: [Cohort](../product/glossary.md#cohort-nace--size--region), [Statistical-validity floor](../product/glossary.md#statistical-validity-floor).

---

## 2. Cohort grain and partition

Per [D-006](../project/decision-log.md), the **brief** is calibrated at NACE only. Size band and region appear only through the **embedded benchmark snippet**, which can degrade independently. The cohort grain for percentile computation is therefore NACE × size band × Czech region, matching PRD §10 — but the brief is still selectable and deliverable on NACE alone when the finer cell fails the floor (§4).

### 2.1 NACE (primary dimension)

MVP uses NACE at the **division level** (2-digit, e.g., `10` = Manufacture of food products, `46` = Wholesale trade). 2-digit is the right grain for MVP because:
- 4-digit NACE fragments the Czech SME population into cells that rarely clear the floor.
- ČS analyst authoring per D-001 is cohort-priority-first (PRD §13.1 mitigation); 2-digit already stresses authoring capacity.
- Coarser (1-digit / section A–S) loses the sector-specific signal that is the product's value.

[Q-006](../project/open-questions.md) — if a specific NACE division is itself fragmented enough to benefit from 3-digit subdivision (e.g., manufacturing sub-industries with divergent margin structures), that is a per-division override handled in the cohort-membership table, not a global rule change. Flagged for PM + analyst input.

### 2.2 Size bands (recommended)

Three bands, aligned to the PRD §3 persona (10–100 employees) and the Czech SME definition space:

| Band | Employee range | Rationale |
|---|---|---|
| S1 | 10–24 | Owner-operator with minimal middle management. |
| S2 | 25–49 | Structural shift — first functional heads appear. |
| S3 | 50–100 | Multi-layer org; owner less operational. |

Firms <10 employees and >100 employees are out of persona scope (PRD §3). If a pre-populated seed record falls outside [10, 100], it is excluded from cohort computation at MVP.

Revenue-based banding as an alternative is **not** recommended for MVP: revenue distributions are right-skewed within a NACE division, and employee headcount is both more stable and easier to hand-assign from ČS pre-populated records.

### 2.3 Region partition (recommended)

Czech `NUTS 2` regions (8 regions) as the MVP partition:

- Praha
- Střední Čechy
- Jihozápad (Plzeňský + Jihočeský)
- Severozápad (Karlovarský + Ústecký)
- Severovýchod (Liberecký + Královéhradecký + Pardubický)
- Jihovýchod (Jihomoravský + Vysočina)
- Střední Morava (Olomoucký + Zlínský)
- Moravskoslezsko

Finer (NUTS 3 = 14 kraje) multiplies cells by ~1.75× and pushes more into sub-floor territory. Coarser (Bohemia / Moravia-Silesia) loses meaningful regional economic difference.

### 2.4 Cell arithmetic

Nominal cell count = NACE divisions in scope × 3 size bands × 8 regions. If MVP targets ~10 priority NACE divisions (analyst-authoring-feasible), that is **240 nominal cells**. The statistical-validity floor (§3) will filter this heavily; see §6.4 for the expected clearing rate on the D-001 pre-populated seed.

---

## 3. Statistical-validity floor

PRD §10 and §13.5 require a minimum-cohort participant count below which percentiles **must not** surface silently.

### 3.1 Recommendation: N ≥ 30 per cell

**Minimum participants per (NACE × size × region) cell = 30.**

Rationale:
- Below N=30, sample percentile estimates are widely unstable for the ratio families we use (particularly working capital cycle and pricing power proxy, which have heavy tails). Sampling-distribution theory and prior Czech-SME benchmarking practice both treat ~30 as the conventional small-sample boundary.
- Above N=30, quartile boundaries stabilize enough that a named quartile verdict (PRD Principle 7.2 — verdicts, not datasets) does not flip on the addition of one more firm.
- N=30 is the floor at which anonymization-by-aggregation holds: a cohort percentile published over ≥30 firms is not practically re-identifying, which is what [privacy-architecture.md](privacy-architecture.md) §5 (revocation Option B) relies on for retaining published aggregates.
- Raising the floor (e.g., N=50 or N=100) improves stability further but would block MVP shipping in almost every cell given the D-001 seed scale (§6). N=30 is the minimum defensible floor; it is not "safe" — it is "the lowest we can credibly ship with."

### 3.2 Stricter floor for specific metrics?

Two of the eight ratios have heavier-tailed distributions in Czech SME populations: **working capital cycle** (days; large outliers common) and **pricing power proxy** (ratio of ratios; compounding variance). For these, a stricter **per-metric floor of N ≥ 50** is recommended.

If a cell passes the global floor (N≥30) but not the metric-specific floor (N≥50) for these two metrics, the six other metric snippets surface and those two are suppressed (graceful degradation per §4.1 — metric-level). This is preferable to suppressing the whole snippet block.

[Q-007](../project/open-questions.md) flags per-metric floors for empirical re-tuning once 1–2 months of MVP trial data exist.

### 3.3 Enforcement point

The floor is enforced in the **cohort-compute pipeline** (`cohort_compute_batch`, see [privacy-architecture.md](privacy-architecture.md) §3), not in the consumer. Below-floor cells emit a `degradation_signal` instead of a percentile — the consumer cannot accidentally read a missing percentile as zero.

---

## 4. Graceful-degradation rule

**Never a silent low-confidence percentile.** CLAUDE.md cold-start guardrail + PRD §13.5 + glossary "Statistical-validity floor."

### 4.1 Degradation ladder

When a cell (NACE `n` × size `s` × region `r`) is below the floor for a metric, the pipeline applies this ladder in order and uses the first rung that clears the floor for that metric:

| Rung | What it computes | What the user sees |
|---|---|---|
| 0 (ideal) | Percentile within (n, s, r) | Full snippet: "Your gross margin places you in the **third quartile** of food-manufacturing firms of your size in Jihovýchod (68th percentile)." |
| 1 — drop region | Percentile within (n, s) — all regions pooled | Snippet phrased without region: "…third quartile of food-manufacturing firms of your size (68th percentile)." A one-line footnote indicates cohort is Czech-wide at your size, not regional. |
| 2 — drop size | Percentile within (n, r) — all sizes pooled within region | "…third quartile of food-manufacturing firms in Jihovýchod." Footnote: cohort spans sizes. |
| 3 — drop both | Percentile within (n) — sector-wide | "…third quartile of food-manufacturing firms in Czechia." Plain, no size/region qualifier. |
| 4 — suppress | None — metric snippet omitted | Snippet is replaced by a short plain-language line: "This figure needs more peers before we can compare — we'll include it next time the cohort is ready." No number shown. Other metrics whose cells clear the floor still surface. |

The brief itself (which is NACE-only per D-006) still delivers regardless — the brief never enters rung 4. Only the embedded benchmark snippet inside the brief degrades.

**Design contract for the brief template ([trust-and-consent-patterns.md](../design/trust-and-consent-patterns.md) + [information-architecture.md](../design/information-architecture.md))**: the snippet layout must accept each rung's output without breaking the brief's readability. The 4-category layout per PRD §9 (Category-Based Layout feature) holds — metrics drop out of their category slot if they hit rung 4.

### 4.2 Per-metric independence

Each of the 8 metrics runs the ladder independently. A brief can surface 6 metrics at rung 0, 1 metric at rung 2, and 1 metric at rung 4 — this is expected, not a failure.

### 4.3 Signal to the UX layer

Below-floor cells emit `degradation_signal` payloads shaped as:

```
{ metric: "gross_margin",
  achieved_rung: 3,
  achieved_cohort: { nace: "10" },
  n_used: 142,
  percentile: 0.68,
  quartile: "Q3" }
```

Or for full suppression:

```
{ metric: "working_capital_cycle",
  achieved_rung: 4,
  reason: "below_floor_all_rungs",
  max_n_seen: 17 }
```

The UX layer maps `achieved_rung` to the corresponding copy pattern.

---

## 5. Metric computation — the 8 MVP ratios

Per [D-003](../project/decision-log.md). Each row gives the formula and the data fields required. All input fields live in the **`user_contributed` lane** (stored in `user_db`) per [privacy-architecture.md](privacy-architecture.md) §2; pre-populated seed values come through `user_ingest_prepopulated` under D-001.

| # | Metric | Formula | Required fields |
|---|---|---|---|
| 1 | **Gross margin** | (Revenue − COGS) / Revenue | `revenue`, `cogs` |
| 2 | **EBITDA margin** | EBITDA / Revenue, where EBITDA = Operating profit + Depreciation + Amortization | `revenue`, `operating_profit`, `depreciation`, `amortization` |
| 3 | **Labor cost ratio** | Total labor cost / Revenue | `revenue`, `labor_cost_total` (wages + mandatory social + benefits) |
| 4 | **Working capital cycle** (days) | DSO + DIO − DPO, where DSO = (Accounts receivable / Revenue) × 365, DIO = (Inventory / COGS) × 365, DPO = (Accounts payable / COGS) × 365 | `accounts_receivable`, `accounts_payable`, `inventory`, `revenue`, `cogs` |
| 5 | **ROCE** | EBIT / (Total assets − Current liabilities) | `ebit`, `total_assets`, `current_liabilities` |
| 6 | **Revenue growth vs cohort median** | (Revenue_t − Revenue_{t-1}) / Revenue_{t-1}, then subtract the cohort-median of that same growth ratio | `revenue` (current and prior period) |
| 7 | **Pricing power proxy** | (Gross margin_t − Gross margin_{t-1}) − cohort-median of same delta | `revenue`, `cogs` (current and prior period) |
| 8 | **Revenue per employee** | Revenue / Employee headcount | `revenue`, `employee_count` |

### 5.1 Period, units, sign conventions

- **Period**: fiscal year; annual values only at MVP. Rolling quarterly appears at Increment 2 (PRD §9).
- **Units**: CZK for monetary amounts; headcount as integer FTE equivalent; working capital cycle in days.
- **Missing fields**: if any required field for a metric is missing on a firm, that firm is excluded from that metric's cohort (and from the firm's own snippet for that metric). Firm remains in other metrics' cohorts.
- **Sign of working capital cycle**: larger = longer cycle = generally worse. Quartile mapping is therefore inverted for this metric in the verdict copy (Q1 = best, not worst). Handled in the snippet-copy layer, not in the computation.

### 5.2 Outlier handling

Per-metric winsorization at the 1st and 99th percentiles **within each cohort cell** before percentile computation. This suppresses data-entry errors without distorting the interior of the distribution. Winsorization happens before the floor check (so winsorized firms still count toward N).

---

## 6. Percentile and quartile computation

### 6.1 Method

For each (metric × cell):

1. Collect all firm values in the cell.
2. Winsorize at 1st / 99th percentile (§5.2).
3. Check N against the floor (§3).
   - If N < floor → emit `degradation_signal` with the appropriate rung via the ladder (§4.1).
   - If N ≥ floor → proceed.
4. Compute the firm's percentile rank using the **"average rank" convention for ties** (see §6.2).
5. Map percentile → quartile:
   - 0 – 25 → Q1
   - 25 – 50 → Q2
   - 50 – 75 → Q3
   - 75 – 100 → Q4
6. Publish `{ metric, cell, percentile (0–100, one decimal), quartile, n_used, method: "centralized-batch-v1", epsilon: null }` as a row in the cohort-stats snapshot.

Per-brief render: the firm's own percentile is surfaced alongside the named quartile (PRD §9 Quartile Position Display). Quartile name is the verdict; percentile is supporting context.

### 6.2 Tied values

Use the **average-rank** method (also known as "midrank" or "fractional rank"): all firms with the same value receive the average of the ranks they would span. Example: if three firms tie at the 10th position in a 20-firm cell, they all receive rank (10 + 11 + 12) / 3 = 11, and the percentile is `(11 − 0.5) / 20 × 100 = 52.5`.

Rationale:
- Stable: adding or removing a single non-tied firm doesn't flip the quartile call on the tied firms.
- Symmetric: percentiles are fair whether a firm is "first" or "last" among tied peers.
- The `(rank − 0.5) / N` offset avoids both 0 and 100 percentiles, which would be misleading in copy ("you are the literal top").

### 6.3 Small-sample correction

At N = 30 (the floor), percentile resolution is intrinsically ~3.3 points. The product surfaces percentile to **one decimal place** regardless of N — but the copy layer rounds to nearest integer when rendering ("68th percentile"), and the quartile verdict is the primary signal. This keeps the data artifact accurate while the user-facing string stays plain-language per Principle 7.3.

### 6.4 Revocation recompute (crosslink)

Per [privacy-architecture.md](privacy-architecture.md) §5 ([D-012](../project/decision-log.md) Option A): a user revocation does **not** remove the user's rows from `user_db`; it stops future flow only. Already-published snapshots remain intact (they always did — D-012 did not change that). **Future** cohort-compute runs exclude the revoked user by filtering on `consent_event_id` at read time. If a revocation brings a cell below the floor at the next run, that cell drops to rung 1+ per §4.1 on the next published snapshot. This is expected behavior, not a bug.

---

## 7. D-001 — hand-assigned cohorts on pre-populated data: what changes at MVP

[D-001](../project/decision-log.md) resolves the MVP scope gap from PRD §9: percentile calculation needs cohort-matching and owner data ingestion, both scheduled for Increment 3. D-001 ships MVP with **hand-assigned cohorts on pre-populated data** so embedded benchmarks exist in MVP briefs without building full onboarding + ingestion.

### 7.1 What "pre-populated" means concretely at MVP

- The seed dataset is a ČS-provided extract of anonymized financial records for SME clients in the PRD §3 persona range (10–100 employees), already held by ČS under pre-existing client agreements. PRD §10 names the 20,000+ anonymized-record asset; the MVP seed is a curated subset of this asset, scoped to the priority NACE divisions selected for MVP authoring.
- For each pre-populated record, the cohort membership (NACE division × size band × region) is **hand-assigned** by a data-engineer + analyst pair using the seed record's already-known ČS-side attributes (registered NACE code, FTE count, registered address). Hand-assignment produces a row in a `cohort_membership` table keyed by pseudonymous `user_id`.
- There is **no MVP onboarding flow** that asks an end-user for their NACE / size / region. End-users in MVP are either (a) already represented in the pre-populated seed (RM-referred), or (b) shown sector-level (NACE-only, rung 3) briefs without a personalized snippet.

### 7.2 Who is in the pre-populated set

- **Included**: ČS SME clients in the persona range whose NACE division is one of the MVP priority divisions and whose financial records have the fields required for the 8 ratios (§5). The MVP priority divisions are PM + analyst-selected; see build-plan.md §5 Track A.
- **Excluded**: firms outside [10, 100] employees; firms whose NACE division is outside the MVP priority set; firms with insufficient financial data for the 8 ratios.
- **Not in the set**: direct-signup users (PRD §11 secondary channel) — they get NACE-only sector-level briefs with rung 3 or rung 4 snippets until Increment 3's full onboarding + ingestion lands.

Legal basis for the seed extract falls under existing ČS banking-relationship agreements. This is flagged as [Q-002 in open-questions.md](../project/open-questions.md) (raised in [privacy-architecture.md](privacy-architecture.md) §11) — the cohort-math work assumes Q-002 resolves in favor of the seed's existing legal basis.

### 7.3 What fraction of cells clear the floor — expected at MVP

An order-of-magnitude estimate, to scope the degradation-rung mix the designer and PM should plan for:

- If the MVP seed is ~5,000 firms spread across ~10 priority NACE divisions (500 avg per division), 3 size bands, and 8 regions (nominal 240 cells for the scoped slice):
  - **Rung 0 (N ≥ 30 at the full cell)**: roughly **15–25%** of cells in priority NACE divisions. The high-volume divisions (wholesale trade, food manufacturing, construction) will clear; the long tail will not.
  - **Rung 1 (drop region, N ≥ 30 at NACE × size)**: an additional **30–40%** of cells clear once region is pooled.
  - **Rung 2 / Rung 3 (pool further)**: almost all priority NACE divisions clear at NACE-only (rung 3) given ~500 firms per division.
  - **Rung 4 (full suppression)**: should be rare for the 6 general metrics; more common for the two heavier-tail metrics (working capital cycle, pricing power proxy) where the per-metric floor is N ≥ 50 (§3.2).

These are **planning numbers**, not measured. They are deliberately conservative. Once the seed extract is actually joined and counted, the real distribution replaces this section. This is flagged as [Q-008](../project/open-questions.md) (Phase 2 data ingestion will produce measured numbers).

### 7.4 What this means for design and PM

- The brief itself (NACE-only, D-006) is always deliverable to a pre-populated user. The personalization grain does not depend on the floor.
- The embedded snippet — the comparative verdict inside the brief — will mix rungs across the 8 metrics. The design of the snippet layout must handle this gracefully (§4.1 design contract).
- For direct-signup (non-pre-populated) users at MVP, snippets are at rung 3 (NACE sector-wide) or rung 4 (suppressed) by construction; this is a known, documented MVP limitation, not a bug.

---

## 8. What design-forward infrastructure MVP preserves (non-retrofit guarantee)

So Increment 2 (continuous monitoring, weekly cadence, 12–15 metrics) and Increment 3 (full onboarding + ingestion) do not require rework:

- Cohort-stats snapshots carry `method` and `epsilon` from MVP (`centralized-batch-v1`, `null`). Swapping to `federated-dp-v1` with a real ε is an additive change.
- `cohort_membership` is keyed by `user_id`, not by "hand-assigned or self-assigned" origin. Increment 3's self-assigned memberships populate the same table.
- The degradation ladder (§4.1) is the same for hand-assigned and self-assigned cells — the floor does not know how a firm got into its cell.
- The 8-metric schema matches PRD §5 categories, with slots for Increment 2's additional metrics without requiring schema migration.

---

## 9. Open questions

Cross-referenced with [docs/project/open-questions.md](../project/open-questions.md).

| ID | Question | Assumed-for-now | Blocks |
|---|---|---|---|
| Q-006 | Per-NACE-division override: are there priority divisions that warrant 3-digit NACE subdivision at MVP? | No — 2-digit globally. | MVP priority-NACE list (PM + analyst). |
| Q-007 | Per-metric floor re-tuning after 1–2 months of trial. | N ≥ 30 global; N ≥ 50 for working capital cycle and pricing power proxy. | Post-trial cohort-math revision. |
| Q-008 | Measured cell-clearance distribution once the D-001 seed extract is actually joined. | Planning estimates per §7.3. | Phase 2 data ingestion — will replace §7.3 numbers with measured. |

---

## Changelog

- 2026-04-17 — initial draft — data-engineer. Sets 2-digit NACE, 3 employee-size bands (10–24 / 25–49 / 50–100), NUTS 2 region partition (8 regions), statistical-validity floor N≥30 global with N≥50 for working capital cycle and pricing power proxy, a 5-rung graceful-degradation ladder that never silently surfaces a low-confidence number, formulas + required fields for the 8 D-003 ratios, percentile computation via average-rank tie handling with `(rank−0.5)/N` offset, and §7 pre-populated-seed plan under D-001 with conservative cell-clearance estimates flagged as Q-008 for measured replacement.
- 2026-04-17 — applied [D-010](../project/decision-log.md) canonical lane identifier to §5 intro (changed "user lane" → "`user_contributed` lane"; `user_db` retained as infrastructure namespace per D-010). Also updated §6.4 revocation-recompute crosslink to track [D-012](../project/decision-log.md) Option A (no deletion; read-time `consent_event_id` filtering) — the prior text described Option B "removes the user from `user_db`", which no longer holds. — data-engineer
