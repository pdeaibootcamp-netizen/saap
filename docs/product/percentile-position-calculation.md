# Percentile Position Calculation

*Owner: product-manager · Slug: percentile-position-calculation · Last updated: 2026-04-20*

## 1. Summary

Percentile Position Calculation is the monthly batch compute job that produces — for each of the eight MVP ratios and each (NACE × size band × region) cohort cell — a per-firm percentile + named quartile snapshot that an analyst-authored brief can embed as a comparative snippet. This feature owns the **product contract** of what a published snippet carries: per-metric value, cohort-cell context, a floor-status flag, and a snapshot timestamp. It does not author briefs, it does not render UI, and at MVP it does not surface a standalone dashboard — it produces the numerical substrate the Category-Based Layout and Quartile Position Display features consume inside a brief.

## 2. Upstream links

- PRD sections:
  - [§8.2 Peer Position Engine (minimal, MVP)](../../PRD/PRD.md#82-peer-position-engine-minimal-mvp) — this feature is the compute half of the Peer Position Engine; output is embedded in briefs, not standalone.
  - [§9 Release Plan — Percentile Position Calculation [basic]](../../PRD/PRD.md#9-release-plan) — "monthly batch, 6–8 core financial/strategic ratios; output consumed inside briefs, not displayed as a standalone dashboard."
  - [§10 Data and Technical Foundation](../../PRD/PRD.md#10-data-and-technical-foundation) — cohort segmentation grain (NACE × size × region), statistical-validity floor, and the graceful-degradation commitment.
  - [§13.5 cold-start risk](../../PRD/PRD.md#13-risks-and-open-questions) — the floor is a launch-phase mitigation; this feature's floor-status flag is how the product honors it downstream.
  - [§7.2 Verdicts, not datasets](../../PRD/PRD.md#7-product-principles) — the compute output carries both percentile **and** named quartile so downstream surfaces never render a raw number alone.
  - [§7.5 Privacy as product](../../PRD/PRD.md#7-product-principles) — cohort-level aggregates only; the snapshot never carries per-firm rows across a lane boundary (see [privacy-architecture.md §3](../data/privacy-architecture.md)).
- ČS business goals served:
  - **G1 Engagement** — every brief's in-context verdict ("your labor cost ratio sits in the second quartile of your sector") depends on this feature running. Without it, the brief is sector-narrative only and the owner-recognition moment collapses.
  - **G2 Data depth + cadence** — the monthly snapshot cadence is the instrument by which cohort depth becomes visible over time; the floor-status flag is the measurement hook for §6 cohort-depth success metric.
  - G3 (RM lead generation) — not served at MVP. Per [A-002](assumption-log.md) / [D-002](../project/decision-log.md) the RM lane is dormant; this feature's snapshot schema is design-forward compatible ([privacy-architecture.md §8.3](../data/privacy-architecture.md), [cohort-math.md §8](../data/cohort-math.md)), but no RM-visible output is produced.
- Related decisions:
  - [D-001](../project/decision-log.md) — hand-assigned cohorts on pre-populated data; defines who enters the compute set at MVP.
  - [D-003](../project/decision-log.md) — the eight ratios the compute job covers.
  - [D-006](../project/decision-log.md) — NACE-only brief personalization grain; size/region surface **only** via this feature's snippet output, with independent floor degradation.
  - [D-007](../project/decision-log.md), [D-012](../project/decision-log.md) — single opt-in + revocation Option A: the compute job filters on `consent_event_id` at read time.
  - [D-010](../project/decision-log.md) — canonical lane identifiers; inputs are in `user_contributed`, output is a cohort-level snapshot treated as `brief`-lane for distribution.

## 3. User stories

- **As an ČS analyst authoring a monthly brief**, I want the eight per-firm percentile + named-quartile values for every owner in a priority cohort to be available as a published snapshot before I start authoring, so that I can embed concrete peer comparisons inside the brief without chasing a data-engineer for a one-off pull.
  - Acceptance criteria:
    - [ ] For every owner present in the `user_contributed` lane whose consent is currently granted (per [D-012](../project/decision-log.md)), the latest published snapshot contains a row per (owner, metric) that either carries a percentile + named quartile or a floor-status flag indicating graceful-degradation rung (per [cohort-math.md §4.1](../data/cohort-math.md)).
    - [ ] The snapshot is timestamped and versioned; an analyst can tell which monthly snapshot a brief was authored against.
    - [ ] No snapshot row surfaces a percentile for a (metric, cell) whose cohort fails the statistical-validity floor — below-floor cells emit the floor-status flag only (see §6 non-negotiables).
    - [ ] The analyst back-end surfaces the eight ratios grouped by the four canonical categories ([mvp-metric-list.md §Category grouping](mvp-metric-list.md), [D-011](../project/decision-log.md)).

- **As an SME owner receiving an authored brief** (the downstream consumer of this feature's output, via [Category-Based Layout](../../PRD/PRD.md#9-release-plan) and [Quartile Position Display](../../PRD/PRD.md#9-release-plan)), I want each comparative snippet inside my brief to carry both a named quartile and an exact percentile that reflect a peer group large enough to be trustworthy, so that the verdict is defensible and I never see a number that turns out to have been computed on too few firms.
  - Acceptance criteria:
    - [ ] Every snippet the owner sees inside a brief carries both a named quartile (e.g., *horní čtvrtina*) and the exact percentile, derived from the same snapshot row (verdicts not datasets, [§7.2](../../PRD/PRD.md#7-product-principles)).
    - [ ] If a metric's cohort cell fails the floor for the owner, the snippet for that metric is not rendered — the brief is silent on that metric for that owner (per [A-017](assumption-log.md); never a "insufficient data" string surfaced to the user).
    - [ ] The cohort-cell context (which NACE × size × region the percentile was computed against, after any degradation-rung pooling per [cohort-math.md §4.1](../data/cohort-math.md)) is carried on the snapshot row and available to the snippet-copy layer so the footnote ("cohort pooled across regions") can be rendered when required.

- **As the ČS data steward**, I want every percentile published by this feature to be reproducible from a single snapshot manifest, so that a later revocation, legal-review query, or cohort-depth audit can be traced to the exact inputs that produced each number.
  - Acceptance criteria:
    - [ ] Each snapshot row carries: `snapshot_timestamp`, `metric`, `cohort_cell_context` (NACE / size / region after degradation pooling), `achieved_rung`, `n_used`, `method` (`centralized-batch-v1` at MVP), `epsilon` (null at MVP), and the list of `consent_event_id`s that contributed (consent-ledger link per [privacy-architecture.md §4.2](../data/privacy-architecture.md)).
    - [ ] Re-running the batch against the same input set and the same consent-ledger state reproduces the same snapshot bit-for-bit (modulo timestamp).
    - [ ] No snapshot row crosses a lane boundary — output is cohort-level only; no per-firm `user_contributed` row leaves the pipeline ([privacy-architecture.md §3](../data/privacy-architecture.md) `cohort_compute_batch`).

## 4. Scope

- **In scope:**
  - Monthly batch compute job over the eight ratios frozen in [D-003](../project/decision-log.md) / [mvp-metric-list.md](mvp-metric-list.md), for each (NACE × size × region) cell with members in the `user_contributed` lane under granted consent.
  - The **published-snapshot product contract**: per-metric percentile value, named quartile label, cohort-cell context (post-degradation), floor-status flag (`achieved_rung` + `n_used`), snapshot timestamp, and reproducibility fields (`method`, `epsilon`, contributing `consent_event_id`s).
  - Floor-status propagation: a below-floor (metric × cell) emits a floor-status flag that the consuming surfaces (Category-Based Layout, Quartile Position Display, Monthly Briefing Generation) use to **silently suppress** the metric's snippet for that owner ([A-017](assumption-log.md)).
  - Consent gating at snapshot read time: owners with a revoked consent event ([D-012](../project/decision-log.md)) do not appear in the next snapshot's contributing set and do not receive personalized snippets from the next snapshot forward.
  - Snapshot versioning: every run produces a new immutable snapshot; an authored brief can be pinned to a snapshot id for auditability.

- **Out of scope** (with reason):
  - Weekly / continuous recompute — deferred to **Increment 2** per [PRD §9](../../PRD/PRD.md#9-release-plan) (*Percentile Position Calculation [advanced] — weekly cadence, 12–15 metrics*). MVP is monthly batch by construction.
  - Predictive percentile projection ("where your gross margin will land next quarter") — **North Star** per [PRD §9](../../PRD/PRD.md#9-release-plan); no trajectory model at MVP.
  - Federated learning and differential privacy — **Increment 2** per [PRD §10](../../PRD/PRD.md#10-data-and-technical-foundation) and [privacy-architecture.md §8](../data/privacy-architecture.md). MVP is centralized batch with `method="centralized-batch-v1"`, `epsilon=null`; the schema reserves these fields so Increment 2 is additive, not a retrofit.
  - Cohort segmentation matching (a live matcher that assigns owners to cells from user-entered profile data) — **Increment 3** per [PRD §9](../../PRD/PRD.md#9-release-plan). MVP uses hand-assigned cohorts on pre-populated data ([D-001](../project/decision-log.md) / [A-001](assumption-log.md)); this feature consumes the hand-assigned `cohort_membership` table and does not build the matcher.
  - Bank Data Pre-Processing (normalizing raw bank records into the eight-ratio input fields) — **Increment 3** per [PRD §9](../../PRD/PRD.md#9-release-plan). The pre-populated seed under D-001 is assumed to arrive with the fields listed in [cohort-math.md §5](../data/cohort-math.md) already prepared.
  - Standalone percentile-browsing UI / dashboard — **post-MVP** per [PRD §4 Non-Goals](../../PRD/PRD.md#4-goals-and-non-goals) and [A-012](assumption-log.md). Output of this feature is consumed inside briefs only.
  - Math implementation details (winsorization thresholds, tie-handling convention, per-metric floor thresholds, degradation-ladder rung definitions) — owned by [`docs/data/cohort-math.md`](../data/cohort-math.md). This PRD defines the product contract; the data artifact defines the math.
  - Per-lane consent toggles and any RM-visible derivation — out of MVP per [D-007](../project/decision-log.md) and [D-002](../project/decision-log.md).

- **Increment:** MVP (Increment 1).

## 5. Success metrics

Tied to [PRD §6](../../PRD/PRD.md#6-success-metrics). Feature-level instrumentation serves the cross-cutting goal metrics, not a standalone feature KPI.

- **Cohort depth** (PRD §6 Goal 2) — median `n_used` per (NACE × size × region × metric) across snapshots. Target direction: non-decreasing month-over-month. Measured from the snapshot `n_used` field; the floor-status flag distribution is the direct instrumentation of whether cohort depth is improving.
- **Floor-clearance ratio** — share of (owner × metric) pairs in a snapshot that achieve `achieved_rung = 0` (full NACE × size × region cell) vs. degrade to rungs 1–3 vs. suppress at rung 4. Target direction: rung-0 share non-decreasing month-over-month; rung-4 share trending toward zero. Measured from the snapshot; instruments [PRD §13.5](../../PRD/PRD.md#13-risks-and-open-questions) cold-start risk.
- **Snapshot freshness** — age of the most recent published snapshot at the moment an analyst opens an authoring session. Target: ≤ the monthly cadence window (no stale-snapshot authoring). Measured from `snapshot_timestamp`.
- **Verdict coverage per brief** (feeds PRD §6 Goal 1 engagement metrics indirectly) — mean number of the eight ratios that surface (not suppressed) in a given owner's brief. Target direction: non-decreasing. Low verdict coverage is a symptom that the floor is biting and briefs are thin.
- **Reproducibility audit pass-rate** — share of snapshots for which re-running the batch against the same inputs reproduces the published output. Target: 100%. Measured by a data-engineer verification step during Phase 3 rehearsal ([build-plan.md §6](../project/build-plan.md)).

No revenue or conversion metric at v1 — monetization is deferred per [PRD §11](../../PRD/PRD.md#11-go-to-market).

## 6. Non-negotiables

The PRD §7 principles that this feature must honor, with the specific behavior each induces:

1. **Verdicts, not datasets ([§7.2](../../PRD/PRD.md#7-product-principles)).** Every snapshot row that will feed a user-facing surface must carry **both** an exact percentile **and** a named quartile label. Downstream surfaces must never be able to render one without the other — the schema enforces this by co-locating the two fields and refusing to emit one without the other.

2. **Plain language ([§7.3](../../PRD/PRD.md#7-product-principles)).** No statistical notation (no σ, no CI, no "p-value") anywhere in a field that downstream copy can touch. Internal-audit fields (`n_used`, `method`, `epsilon`) are not rendered to owners; they live on the snapshot for reproducibility and instrumentation only.

3. **Privacy as product ([§7.5](../../PRD/PRD.md#7-product-principles)), architecturally separate lanes ([A-015](assumption-log.md)).** The output of this feature is a cohort-level snapshot only. No per-firm row from `user_contributed` crosses a lane boundary. The egress filter in [privacy-architecture.md §2.1](../data/privacy-architecture.md) must continue to hold: this feature reads from `user_contributed` into the compute pipeline and writes only cohort-level aggregates to the snapshot. The snapshot is treated as `brief`-lane for distribution (per [privacy-architecture.md §3](../data/privacy-architecture.md) `cohort_compute_batch`). Base-model training never reads from this snapshot's `user_contributed` source — the allow-list in [privacy-architecture.md §3](../data/privacy-architecture.md) already excludes it.

4. **Statistical-validity floor — silent-to-user, silent-to-system-egress, instrumented-to-system-audit ([A-017](assumption-log.md), [§10](../../PRD/PRD.md#10-data-and-technical-foundation), [§13.5](../../PRD/PRD.md#13-risks-and-open-questions)).** When a (metric × cell) fails the floor at every rung of the degradation ladder, the output for that (owner × metric) is a floor-status flag only — **never a percentile**. Downstream renderers suppress the snippet for that owner-metric pair (the brief is silent on the metric for that owner). The suppression event is recorded on the snapshot for cohort-depth instrumentation. No user-facing copy says "insufficient data for your cohort" — the brief is simply silent on that metric.

5. **Graceful degradation across the cohort-cell ladder ([cohort-math.md §4.1](../data/cohort-math.md)).** The feature honors the five-rung ladder (NACE × size × region → NACE × size → NACE × region → NACE → suppress) and carries the `achieved_rung` + post-degradation `cohort_cell_context` on every snapshot row, so the downstream snippet-copy layer can render the correct footnote ("cohort pooled across regions", etc.) or suppress entirely.

6. **Consent gating at read time ([D-012](../project/decision-log.md), [privacy-architecture.md §5](../data/privacy-architecture.md)).** Each snapshot run resolves every candidate owner's latest consent event before including them in any cohort; revoked owners are excluded from both the cohort-membership denominator and their own snippet-recipient set. Already-published snapshots are not rewritten on revocation (Option A stop-future-flow-only).

7. **Design-forward for Increment 2 ([cohort-math.md §8](../data/cohort-math.md), [privacy-architecture.md §8.3](../data/privacy-architecture.md)).** The snapshot schema carries `method` and `epsilon` at MVP with placeholder values (`centralized-batch-v1`, `null`); Increment 2's federated / DP producers populate them without a schema migration. The 8-metric schema matches the [mvp-metric-list.md](mvp-metric-list.md) four categories ([D-011](../project/decision-log.md)) and has space for Increment 2's additional metrics.

8. **No standalone benchmark surface ([A-012](assumption-log.md), [§4 Non-Goals](../../PRD/PRD.md#4-goals-and-non-goals)).** This feature's output is consumed by brief-embedding features only. Any proposal to build a user-facing percentile-browser / dashboard at MVP is out of scope and requires a new decision-log entry.

9. **No give-to-get capture to patch missing ratio inputs ([A-013](assumption-log.md)).** If a pre-populated record is missing a required field (e.g., headcount for revenue per employee), the ratio is degraded per the ladder for that owner — the feature does not trigger an owner-facing "please enter your headcount" prompt at MVP.

## 7. Open questions

None blocking this PRD. Three data-engineer-owned open questions logged in [`docs/project/open-questions.md`](../project/open-questions.md) are acknowledged and inherited; resolution does not require a PM decision or a rewrite of this document. For PM-visible traceability, those three are:

- **OQ-018** — Per-NACE-division 3-digit overrides (PM + analyst input required to name priority divisions). Deferred per [open-questions.md](../project/open-questions.md); the monthly batch proceeds with the global 2-digit rule per [cohort-math.md §2.1](../data/cohort-math.md) until priority divisions are named.
- **OQ-019** — Per-metric floor re-tuning after 1–2 months of trial. Deferred; MVP proceeds with N≥30 global / N≥50 for working capital cycle and pricing power proxy per [cohort-math.md §3](../data/cohort-math.md).
- **OQ-020** — Measured cell-clearance distribution once the D-001 seed is joined. Deferred to Phase 3 rehearsal; MVP authoring plans against the conservative planning estimates in [cohort-math.md §7.3](../data/cohort-math.md).

If the OQ-018 priority-division list changes the compute scope before Phase 3, the changelog on this PRD is updated and the scope section §4 is revisited.

## 8. Downstream artifacts

- Design: `docs/design/percentile-position-calculation/` — *not yet drafted*. Owns how below-floor cells are surfaced (i.e., the silent-suppression rendering contract inside the brief, and the footnote copy for rung-1/2/3 pooled-cohort disclosures). The design artifact consumes this PRD's §6 non-negotiable #4 and §6 non-negotiable #5 as hard constraints.
- Data: [`docs/data/cohort-math.md`](../data/cohort-math.md) — **already authored**. Owns all math: segmentation partitions, formulas for the eight ratios, winsorization, tie-handling, the statistical-validity floor thresholds, and the degradation ladder. This PRD does not duplicate any of it.
- Data (privacy): [`docs/data/privacy-architecture.md`](../data/privacy-architecture.md) — **already authored**. Owns the `cohort_compute_batch` pipeline's lane boundaries, the consent-ledger read-time gating, the egress filter against base-model training, and the dormant-RM-lane retrofit-free design.
- Engineering: `docs/engineering/percentile-position-calculation.md` — *not yet drafted*. Owns the batch-job implementation (scheduling, idempotency, failure modes, alerting), the snapshot-store schema (sitting on the Supabase Postgres per [D-013](../project/decision-log.md)), and the analyst-back-end read path that surfaces the latest snapshot to authoring.
- Product (consuming PRDs in Phase 2 Track B): `docs/product/quartile-position-display.md` (consumes the percentile + quartile snippet output), `docs/product/category-based-layout.md` (consumes the four-category grouping). Both *not yet drafted*.

## Changelog

- 2026-04-20 — initial draft — product-manager.
