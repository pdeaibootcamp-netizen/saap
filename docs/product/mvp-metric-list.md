# MVP Metric List

*Owner: product-manager · Slug: mvp-metric-list · Last updated: 2026-04-17*

## Purpose

Freezes the eight (8) ratios that constitute the entire MVP metric surface, as decided in [D-003](../project/decision-log.md). These ratios are the only metrics that may be computed, benchmarked, or referenced inside MVP briefs or embedded snippets. Additions require a new decision-log entry.

This document is the canonical **product-side** definition: canonical name, plain-language meaning, owner-facing "why it matters", category grouping, and data-source dependency. The **math** (formulas, units, rounding, cohort aggregation, statistical-validity floor behavior) lives in [`docs/data/cohort-math.md`](../data/cohort-math.md) — authored in parallel by data-engineer — and is linked per metric below.

## Upstream links

- PRD sections:
  - [§4 Goals & Non-Goals](../../PRD/PRD.md#4-goals-and-non-goals) — "No operational metrics" non-goal; revenue per employee inclusion is an explicit user override (see D-003 rationale).
  - [§5 Metric Taxonomy](../../PRD/PRD.md#5-metric-taxonomy) — two top-level categories (financial, strategic); MVP coverage target 6–8 metrics spanning both.
  - [§6 Success Metrics](../../PRD/PRD.md#6-success-metrics) — cohort depth and statistical-validity floor constrain which of these ratios can be surfaced for which (NACE × size × region) cell.
  - [§7.2 Verdicts, not datasets](../../PRD/PRD.md#7-product-principles) — every ratio, when surfaced, must end in a conclusion (named quartile + plain-language interpretation).
  - [§7.3 Plain language](../../PRD/PRD.md#7-product-principles) — definitions below are the SME-owner-readable version; no statistical notation.
  - [§8.1 Sector Briefing Engine](../../PRD/PRD.md#81-sector-briefing-engine--what-this-means-for-you-primary-mvp) — the 2–4 observations per brief draw from this list.
  - [§9 Release Plan — Category-Based Layout](../../PRD/PRD.md#9-release-plan) — the four grouping categories below are the structure for embedded benchmark snippets.

- ČS business goals served:
  - **G1 Engagement** — these ratios are the substrate of every verdict a brief surfaces; they are how the owner recognizes their business in the brief.
  - **G2 Data depth + cadence** — the eight ratios define the minimum data shape any onboarded cohort cell must support; they set the floor for what counts as a "readable" user.

- Related decisions:
  - [D-003](../project/decision-log.md) — the eight-ratio list (this document freezes it).
  - [D-001](../project/decision-log.md) — cohorts hand-assigned on pre-populated data; constrains which cells have enough depth to benchmark any given ratio.
  - [D-004](../project/decision-log.md) — user-facing copy is Czech only; the Czech canonical name below is the name owners see.
  - [D-006](../project/decision-log.md) — personalization grain is NACE sector only at MVP; the embedded-snippet degradation behavior applies when sector × size × region drops below the statistical-validity floor.

## Confirmation against D-003

The eight MVP ratios are, in D-003 order:

1. Gross margin
2. EBITDA margin
3. Labor cost ratio
4. Working capital cycle
5. ROCE (Return on Capital Employed)
6. Revenue growth vs cohort median
7. Pricing power proxy
8. Revenue per employee

No additions. No substitutions. Any future change requires a new `D-NNN` decision-log row.

## Category grouping (four categories per §9 Category-Based Layout)

The four grouping categories below structure embedded benchmark snippets in the brief. Each of the eight ratios is assigned to exactly one category. Categories are the owner-legible **top-level sections** inside the brief's embedded-snippet block.

| # | Category (Czech — user-facing) | English (internal) | Ratios in this category |
|---|---|---|---|
| 1 | **Ziskovost** | Profitability | Gross margin; EBITDA margin |
| 2 | **Náklady a produktivita** | Cost structure & productivity | Labor cost ratio; Revenue per employee |
| 3 | **Efektivita kapitálu** | Capital efficiency | Working capital cycle; ROCE |
| 4 | **Růst a tržní pozice** | Growth & market position | Revenue growth vs cohort median; Pricing power proxy |

**Category design rationale.**
- Two ratios per category is intentional: enough to triangulate a verdict within the category without overloading a brief with raw percentiles (supports §7.2 "verdicts, not datasets" and §8.1 "2–4 observations per brief").
- Categories 1–3 map to PRD §5 "financial" metrics; category 4 maps to §5 "strategic" metrics. Every brief therefore spans both top-level taxonomy buckets, as §5 MVP coverage requires.
- Revenue per employee sits in **Cost & productivity** (category 2), not in a standalone "operational" bucket — consistent with D-003 rationale that the ratio is a revenue-denominated productivity proxy, not a general operational KPI, and therefore compatible with PRD §4's "no operational metrics" non-goal.

## The eight ratios

### 1. Hrubá marže *(Gross margin)*

- **Plain-language definition (owner-readable).** Share of revenue left after you pay for the goods and services you directly resell or transform.
- **Why it matters to the owner.** The single clearest signal of whether your pricing and supplier mix are holding up. Supports verdicts like "your pricing is ahead of peers" or "supplier cost is eroding your margin faster than the cohort."
- **Category.** 1 — Ziskovost (Profitability).
- **Computation sketch.** Formal formula, rounding, and cohort aggregation live in [`docs/data/cohort-math.md` — gross margin](../data/cohort-math.md). Product-side constraint: expressed as a percentage, compared to the cohort via named quartile + exact percentile per §7.2.
- **Data source needs.** Bank-sourced (P&L). No user-contributed data required at MVP under D-001 (hand-assigned cohorts on pre-populated data).

### 2. Marže EBITDA *(EBITDA margin)*

- **Plain-language definition.** Share of revenue left after all your running costs but before interest, tax, and depreciation — what the business earns from operating, stripped of financing and accounting choices.
- **Why it matters to the owner.** Lets the owner compare themselves to peers without being confused by different debt structures or depreciation policies. Supports verdicts about underlying operating health and is the ratio most frequently referenced in bank and investor conversations.
- **Category.** 1 — Ziskovost (Profitability).
- **Computation sketch.** See [`docs/data/cohort-math.md` — EBITDA margin](../data/cohort-math.md). Product-side: percentage, cohort-ranked via named quartile + exact percentile.
- **Data source needs.** Bank-sourced (P&L).

### 3. Podíl osobních nákladů *(Labor cost ratio)*

- **Plain-language definition.** Share of revenue that goes to wages, salaries, and related personnel costs.
- **Why it matters to the owner.** The fastest way to see whether the firm is over- or under-staffed relative to peers at the same revenue scale. Supports verdicts on hiring pace, wage pressure, and whether a margin squeeze is coming from the cost of people versus the cost of goods.
- **Category.** 2 — Náklady a produktivita (Cost structure & productivity).
- **Computation sketch.** See [`docs/data/cohort-math.md` — labor cost ratio](../data/cohort-math.md). Product-side: percentage, cohort-ranked.
- **Data source needs.** Bank-sourced (P&L personnel line).

### 4. Cyklus pracovního kapitálu *(Working capital cycle)*

- **Plain-language definition.** How many days of operating cash are tied up between paying suppliers, holding inventory, and collecting from customers.
- **Why it matters to the owner.** A long cycle means cash is stuck in the business instead of being available for opportunity or resilience. Supports verdicts like "you collect from customers faster than peers but pay suppliers slower — cash position is healthier than average."
- **Category.** 3 — Efektivita kapitálu (Capital efficiency).
- **Computation sketch.** See [`docs/data/cohort-math.md` — working capital cycle](../data/cohort-math.md). Product-side: expressed in days; cohort-ranked.
- **Data source needs.** Bank-sourced (balance sheet — receivables, payables, inventory — combined with P&L revenue and COGS).

### 5. ROCE — Návratnost vloženého kapitálu *(Return on Capital Employed)*

- **Plain-language definition.** How much operating profit the business earns for every koruna of capital it has tied up — own capital plus long-term debt.
- **Why it matters to the owner.** Tells the owner whether the money the business keeps inside itself is working hard or sitting still. Supports verdicts about whether reinvestment is paying off and whether the firm's capital productivity is competitive in its sector.
- **Category.** 3 — Efektivita kapitálu (Capital efficiency).
- **Computation sketch.** See [`docs/data/cohort-math.md` — ROCE](../data/cohort-math.md). Product-side: percentage, cohort-ranked.
- **Data source needs.** Bank-sourced (P&L operating profit + balance sheet capital employed).

### 6. Růst tržeb vs. medián kohorty *(Revenue growth vs cohort median)*

- **Plain-language definition.** How fast your revenue is growing this period compared to the middle firm in your peer group.
- **Why it matters to the owner.** Absolute growth numbers are easy to misread in a hot or cold market. Anchoring growth to the cohort median answers the only question that matters: "am I gaining or losing ground relative to the field?"
- **Category.** 4 — Růst a tržní pozice (Growth & market position).
- **Computation sketch.** See [`docs/data/cohort-math.md` — revenue growth vs cohort median](../data/cohort-math.md). Product-side: expressed as a signed spread (percentage points above/below cohort median growth); verdict is directional, not just quartile.
- **Data source needs.** Bank-sourced (P&L revenue across at least two comparable periods). Relies on cohort-cell depth being above the statistical-validity floor for the median to be credible.

### 7. Cenová síla *(Pricing power proxy)*

- **Plain-language definition.** How your margin trajectory is moving compared to the cohort's margin trajectory — a proxy for whether you can raise prices without losing customers.
- **Why it matters to the owner.** Pricing is the decision SME owners report making most anxiously and with the least external reference (PRD §2, H2). A verdict on pricing power tells the owner whether margin pressure is a *them* problem or a *market* problem — the single most valuable framing before a price conversation.
- **Category.** 4 — Růst a tržní pozice (Growth & market position).
- **Computation sketch.** See [`docs/data/cohort-math.md` — pricing power proxy](../data/cohort-math.md). Product-side: the ratio is a *derived* metric (margin trajectory vs cohort margin trajectory), not a snapshot ratio; the data-engineer artifact owns the formal definition of "trajectory" (window length, smoothing). Product-side constraint: the surfaced verdict must read in plain language (e.g., "your pricing is holding up while the cohort's is slipping"), never as a raw delta-of-deltas number (§7.2, §7.3).
- **Data source needs.** Bank-sourced (P&L across multiple periods for both the owner and the cohort). Most sensitive of the eight ratios to cohort-cell depth and period coverage.

### 8. Tržby na zaměstnance *(Revenue per employee)*

- **Plain-language definition.** Revenue divided by headcount — how much each person generates for the business on average.
- **Why it matters to the owner.** An owner-legible productivity signal that needs no interpretation. Supports verdicts on whether the team is carrying its weight relative to peers at the same scale, and pairs with the labor cost ratio to distinguish a wage-cost story from a productivity story.
- **Category.** 2 — Náklady a produktivita (Cost structure & productivity).
- **Computation sketch.** See [`docs/data/cohort-math.md` — revenue per employee](../data/cohort-math.md). Product-side: expressed in currency per head (CZK per FTE); cohort-ranked.
- **Data source needs.** Bank-sourced revenue (P&L) + headcount. Headcount is the one field that may not be present in every bank-sourced record; where it is missing for a given user at MVP, the ratio is simply not surfaced for that user (graceful degradation per §7.2). Data-engineer confirms the exact fallback rule in cohort-math.md. **No user-contributed data capture is added at MVP to close this gap** — give-to-get capture is Increment 3 per CLAUDE.md guardrail.

## Product-side constraints that apply to every ratio

These are the non-negotiables the data-engineer, designer, and engineer artifacts must honor when they operationalize any of the eight ratios:

1. **Verdict, never raw number alone** — every surfaced ratio carries a named quartile label (Czech: e.g., *horní čtvrtina*, *druhá čtvrtina*) plus the exact percentile. Percentile without a named quartile, or a named quartile without a plain-language interpretation, violates PRD §7.2.
2. **Plain Czech** — user-facing copy is Czech per D-004; the English name in this document is internal clarity only. No statistical notation (no σ, no "p-value", no "CI") in any user-facing string (§7.3).
3. **Graceful degradation below the statistical-validity floor** — when the owner's cohort cell for a given ratio is below the floor, the ratio is **suppressed from the embedded snippet**. The brief does not say "we don't have enough data"; it simply does not surface that ratio for that user. The exact floor and degradation behavior are owned by [`docs/data/cohort-math.md`](../data/cohort-math.md). This honors PRD §10 and the CLAUDE.md cold-start guardrail.
4. **Sector-grain personalization only** — per D-006, the owner's cohort for MVP personalization is NACE sector only. Any size or region slicing of these eight ratios exists only within the embedded benchmark snippet, and is subject to the floor rule in #3.
5. **No user-contributed capture at MVP** — none of the eight ratios is allowed to introduce a "please enter your headcount / margin / etc." flow at MVP. If the data is absent from the bank-sourced record, the ratio degrades per #3. Adding capture UX is give-to-get and requires orchestrator approval (CLAUDE.md guardrail; PRD §9 Increment 3).
6. **No RM-visible derivation at MVP** — per D-002, no ratio computed here is piped into an RM-facing surface at MVP. Any later surfacing requires new consent and new decision-log rows.

## Open questions

None blocking — all scope questions that touched this list closed in D-003, D-004, D-006. Two downstream dependencies are out-of-scope-for-PM and live in the data-engineer's lane:

- The exact definition of "trajectory" for ratio #7 (pricing power proxy) — window length, smoothing method. Data-engineer owns this in `docs/data/cohort-math.md`.
- The exact statistical-validity floor (participant count per NACE × size × region cell) below which a ratio is suppressed. Data-engineer owns this in `docs/data/cohort-math.md` and `docs/data/privacy-architecture.md`.

If either answer changes the product-visible behavior (e.g., a ratio becomes frequently suppressed for common cohorts), PM reopens this document via changelog entry.

## Downstream artifacts

- Data (math, cohort rules, floor behavior): [`docs/data/cohort-math.md`](../data/cohort-math.md) — authored in parallel by data-engineer.
- Data (consent, lane separation): `docs/data/privacy-architecture.md` — authored in parallel by data-engineer.
- Design (how the four-category layout renders inside a brief): `docs/design/information-architecture.md` — authored in parallel by designer.
- Product (feature PRDs that consume this list): Phase 2 features in [`build-plan.md` §5 Track B](../project/build-plan.md) — *not yet drafted* (Phase 2 deliverables): `percentile-position-calculation.md`, `quartile-position-display.md`, `category-based-layout.md`.
- Engineering: ADRs in `docs/engineering/` — *not yet drafted* (Phase 1 parallel delivery).

## Changelog

- 2026-04-17 — initial draft freezing D-003 as canonical MVP metric list; four categories defined; per-ratio product-side definitions and data-source dependencies recorded. — product-manager
