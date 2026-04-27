# Category-Based Layout

*Owner: product-manager · Slug: category-based-layout · Last updated: 2026-04-20*

## 1. Summary

Category-Based Layout is the four-category grouping contract that organizes the embedded benchmark snippets inside every MVP brief. It guarantees that every brief — web view, email teaser context, and PDF — groups the eight frozen MVP ratios ([D-003](../project/decision-log.md)) into four fixed, owner-legible Czech categories in a stable, non-negotiated order. It owns the grouping contract (names, membership, ordering, empty/degraded state), not the visual rendering (designer) or the cohort math (data-engineer).

## 2. Upstream links

- PRD sections:
  - [§7.1 Briefs are the atomic unit of value](../../PRD/PRD.md#7-product-principles) — categories exist only inside briefs; there is no standalone category view.
  - [§7.2 Verdicts, not datasets](../../PRD/PRD.md#7-product-principles) — each category surfaces grouped verdicts, never a grid of numbers; category-level empty-state must itself read as a plain-language verdict about the state of the comparison, not a technical message.
  - [§7.3 Plain language](../../PRD/PRD.md#7-product-principles) — category names are owner-legible Czech nouns, no statistical framing.
  - [§8.1 Sector Briefing Engine](../../PRD/PRD.md#81-sector-briefing-engine--what-this-means-for-you-primary-mvp) — categories structure the embedded snippet block that sits inside the brief.
  - [§8.2 Peer Position Engine](../../PRD/PRD.md#82-peer-position-engine-minimal-mvp) — categories are how the minimal percentile output is grouped for the owner; no standalone dashboard.
  - [§9 Release Plan — Category-Based Layout [basic]](../../PRD/PRD.md#9-release-plan) — this feature is explicitly in MVP Increment 1.
  - [§13.5 Cold-start risk](../../PRD/PRD.md#13-risks-and-open-questions) — category empty-state is a load-bearing part of how the product degrades gracefully when a cohort cell is below floor.
- ČS business goals served:
  - **G1 Engagement** — categories are how the owner recognizes the shape of their business in the brief; a consistent four-section structure is the scannability contract that makes briefs feel like a repeatable monthly instrument.
  - **G2 Data depth + cadence** — the four categories declare the minimum data-shape the benchmarking surface promises; they anchor future increments where cohort depth grows.
  - G3 RM lead generation — not served at MVP ([D-002](../project/decision-log.md), [A-002](assumption-log.md)).
- Related decisions:
  - [D-003](../project/decision-log.md) — the eight MVP ratios.
  - [D-006](../project/decision-log.md) — brief personalization grain = NACE sector only; size/region appear only inside the embedded snippet and degrade independently.
  - [D-011](../project/decision-log.md) — canonical category names and ratio assignments (this PRD consumes that decision; it does not re-open it).
  - [D-004](../project/decision-log.md) — Czech-only user-facing copy.
  - [D-001](../project/decision-log.md) — cohorts hand-assigned on pre-populated data, which constrains which cells have depth above the statistical-validity floor.
- Related assumptions:
  - [A-003](assumption-log.md) — the eight MVP ratios are fixed.
  - [A-012](assumption-log.md) — benchmarks are embedded snippets, not a standalone surface.
  - [A-017](assumption-log.md) — below-floor suppression is silent-to-the-user for a single ratio; this PRD extends the principle to the category-level degraded state, which is **visible** (named empty-state copy), not silent-to-the-user.

## 3. User stories

- **As an SME owner-operator**, I want the benchmark portion of my brief grouped into a small number of named, recognizable business areas, so that I can scan the comparison in seconds and know where my business stands across the dimensions that matter — profitability, cost and productivity, capital efficiency, and growth and market position.
  - Acceptance criteria:
    - [ ] The brief web view renders exactly four category sections in the order 1 → 2 → 3 → 4: **Ziskovost**, **Náklady a produktivita**, **Efektivita kapitálu**, **Růst a tržní pozice** (per [D-011](../project/decision-log.md)).
    - [ ] The PDF renders the same four categories in the same order, all fully expanded (no interactive disclosure in print).
    - [ ] The category order does not vary between briefs, between owners, or between months.
    - [ ] Category names appear verbatim as listed above — no synonyms, no abbreviations, no reordering of words.
    - [ ] Each category header is an owner-legible Czech noun phrase (no statistical notation, no English).

- **As an SME owner-operator whose cohort cell has thin data for some ratios**, I want the brief to still show me the full four-category structure so that I understand the shape of the comparison is consistent month to month, even when some cells temporarily can't surface a verdict.
  - Acceptance criteria:
    - [ ] All four categories render in every brief, regardless of how many individual ratios inside them are suppressed.
    - [ ] If every ratio inside a category is suppressed (below statistical-validity floor or missing source data), the category renders a named category-level empty/degraded state — **not** silent omission ([A-017](assumption-log.md) extended; see §6).
    - [ ] The category-level empty-state copy is a single plain-language sentence that reads as a verdict about the availability of the comparison, not a technical error (e.g., "Srovnání v této oblasti tento měsíc nepřinášíme — počet firem v kohortě je nedostatečný.").
    - [ ] The email surface does **not** render the four-category structure (email only teases at most one snippet, per designer IA §3 Surface A); this AC applies to the web view and PDF.

- **As a ČS analyst authoring briefs**, I want the category contract fixed so that I can focus observation and action writing on what changes month to month, without renegotiating the brief's skeleton each cycle.
  - Acceptance criteria:
    - [ ] The authoring back-end exposes the four categories as fixed scaffolding; analysts cannot add, remove, rename, or reorder categories in an individual brief.
    - [ ] Ratio-to-category membership is fixed per [D-011](../project/decision-log.md) and is not an analyst-editable choice.
    - [ ] If a ratio is suppressed for a given owner, the category that contains it still renders; the analyst does not need to author per-owner category fallback copy.

## 4. Scope

- **In scope**:
  - The grouping contract: the four category names, their order, their ratio membership (all frozen per [D-011](../project/decision-log.md)).
  - Category-level rendering rules: all four categories always render; fixed order; stable across briefs/owners/months.
  - Category-level empty/degraded state: when every ratio in a category is suppressed, the category renders a named empty-state with plain-language copy (see §6 and designer artifact for the Czech string).
  - The contract the authoring back-end and the three delivery surfaces (web view, PDF — and the email teaser insofar as it picks from a category) must honor.
- **Out of scope** (explicit, with reasons):
  - **Metric selection and prioritization UI** — Increment 3 per [PRD §9](../../PRD/PRD.md#9-release-plan); owners cannot choose which ratios appear inside a category at MVP.
  - **Per-owner category ordering or "most interesting first"** — Increment 3 ("Metric Selection and Prioritization"); reordering by surprise, confidence, or magnitude is explicitly excluded at MVP. Order is fixed for predictability and analyst-authoring simplicity (reinforces PRD §13.1 mitigation).
  - **Category add/remove or user customization** — all four categories always render; owners cannot hide a category, add a fifth, or split an existing one. A future increment may revisit; MVP is rigid.
  - **Individual ratio rendering** — owned by `docs/product/quartile-position-display.md` (Track B sibling PRD). This PRD stops at the category boundary; ratio-level quartile/percentile copy is out of scope here.
  - **Cohort math, floor threshold, suppression trigger** — owned by `docs/data/cohort-math.md`. This PRD consumes "is this ratio suppressed?" as a boolean; it does not define the threshold.
  - **Visual rendering (accordion behavior, collapse defaults, typography, PDF layout)** — owned by designer (`docs/design/information-architecture.md` §4.4 and `docs/design/category-based-layout/`). This PRD specifies the contract, not the pixels.
  - **RM-visible derivations of the category structure** — [D-002](../project/decision-log.md), [A-002](assumption-log.md); no RM surface at MVP.
  - **Standalone category / benchmark dashboard** — [A-012](assumption-log.md); benchmarks exist only inside briefs at MVP.
- **Increment**: MVP

## 5. Success metrics

Tied to PRD §6 where direct. Category-Based Layout is a structural feature; it is not measured by its own KPI but contributes to the brief's overall engagement metrics.

| Metric (PRD §6) | Target direction | How measured |
|---|---|---|
| **Monthly brief open rate** (G1) | Up | Email open + web view arrival telemetry; categories contribute by making the brief scannable. |
| **Time spent per brief** (G1) | Up, within a plausible read window (not so high it implies confusion) | Web-view session duration; category accordion expand events (per designer IA §4.4) are a secondary signal. |
| **Proof-of-insight rate** (activation) | Up | Owner-reported surprise + actionability on the first brief. A stable four-section structure supports repeatable scanning — degradation of this rate after MVP is a signal the layout is not landing. |
| **Suppressed-category frequency** (instrumentation, not user-facing) | Monitored; no target at MVP | System-side counter of how often a full category renders the empty-state. Informs cohort-readiness rollout ([D-001](../project/decision-log.md), PRD §13.5); owned by data-engineer instrumentation. If a single category is persistently empty for a large share of owners, that is a scope signal, not a layout bug. |

No category-level metric is user-facing. No "was this useful?" prompt per category at MVP (would be give-to-get capture, [A-013](assumption-log.md)).

## 6. Non-negotiables

Which PRD §7 principles apply, and how they constrain this feature:

1. **§7.1 Briefs are the atomic unit of value** — the four categories exist only inside a brief. No standalone "categories" screen, no category-level landing page, no category-as-navigation concept. [A-012](assumption-log.md).
2. **§7.2 Verdicts, not datasets** — every category header must be a plain-language label, never a statistical bucket name ("Profitability ratios" ✗ — "Ziskovost" ✓, already locked in D-011). The category-level empty-state copy must read as a verdict about the state of the comparison ("we aren't bringing you this comparison this month — the cohort is too thin"), never as a technical message ("null dataset" ✗).
3. **§7.3 Plain language** — category names are the Czech nouns frozen in [D-011](../project/decision-log.md); no synonyms, no English in user-facing surfaces, no parenthetical English translations in the brief (per [A-004](assumption-log.md)). English mappings in this document are internal.
4. **§7.4 Proof of value before anything else** — the first brief a bank-referred owner sees must render all four categories without configuration. No "choose your categories" step, no "tell us what matters" gate. [D-001](../project/decision-log.md) (hand-assigned cohorts on pre-populated data) is the mechanism that makes this possible at MVP.
5. **§7.5 Privacy as product** — category grouping logic runs over the brief data lane only ([D-010](../project/decision-log.md) canonical lane identifiers). No category-level derivation leaks into RM-visible or credit-risk lanes. Category rendering never references user-contributed capture ([A-013](assumption-log.md)).
6. **Cold-start guardrail** (PRD §13.5, CLAUDE.md) — below-floor behavior for an individual ratio is silent-to-the-user (suppressed from the snippet list, per [A-017](assumption-log.md)). Below-floor behavior for an **entire category** (all contained ratios suppressed) is **visible-to-the-user** via the category empty-state: the category header renders, and the body is a single plain-language sentence. The category is never silently omitted. Rationale: silent omission of a category would make the brief's structure feel inconsistent month to month and violate §7.2 by letting a thin cohort read as "nothing worth saying"; the named empty-state carries the verdict that the comparison itself is unavailable. Designer owns the exact Czech string in `docs/design/information-architecture.md` §5 / `docs/design/category-based-layout/` — product-side constraint: one sentence, verdict-framed, no technical terminology, no false cadence promise (no "check back next month", per [A-005](assumption-log.md) and [B-001](../project/backlog.md)).

## 7. Open questions

None blocking. The following downstream dependencies are out-of-scope-for-PM and tracked in the owning specialist's lane:

1. **Exact Czech string for the category-level empty-state copy.** Constraint in §6 item 6 above; designer owns the string in `docs/design/category-based-layout/` + `docs/design/information-architecture.md` §5. If the string cannot satisfy the constraint in one sentence (verdict-framed, no technical terminology, no cadence promise), the designer raises this in their artifact's open-questions section and the orchestrator re-IDs into `docs/project/open-questions.md`.
2. **Trigger rule: "all ratios in a category are suppressed."** The boolean "is ratio X suppressed for this owner?" is owned by `docs/data/cohort-math.md`; this PRD consumes it. If the data-engineer's suppression rule has per-ratio variance that affects how often a full category collapses, that is an instrumentation concern, not a category-contract concern.

No PM-owned open questions require escalation to `docs/project/open-questions.md` at the time of this draft.

## 8. Downstream artifacts

- Design: `docs/design/category-based-layout/` — not yet drafted (Phase 2 Track B designer deliverable).
- Data: `docs/data/cohort-math.md` — already landed (Phase 1); owns the suppression boolean this PRD consumes. No new addendum expected unless the category-level empty-state trigger rule requires one.
- Engineering: `docs/engineering/category-based-layout.md` — not yet drafted (Phase 2 Track B engineer deliverable).

## Changelog

- 2026-04-20 — initial draft — product-manager
