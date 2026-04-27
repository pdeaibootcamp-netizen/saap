# Observation Generation

*Owner: product-manager · Slug: observation-generation · Last updated: 2026-04-20*

## 1. Summary

Observation Generation is the templated mechanism by which each MVP brief carries **2–4 observations** that tie a sector-cohort finding to an owner-actionable frame. Each observation is a single, plain-language verdict authored by a ČS analyst inside a constrained template, drawing on the eight MVP ratios (A-003) and any embedded benchmark snippet the analyst chose to anchor it to. It is the "What does this mean for me?" engine that sits between a sector trend and the closing actions — without it, a brief is a newsletter, not an intervention.

## 2. Upstream links

- **PRD sections:**
  - [§8.1 Sector Briefing Engine + What-This-Means-For-You](../../PRD/PRD.md#81-sector-briefing-engine--what-this-means-for-you-primary-mvp) — establishes the 2–4 observations contract per brief and the "2–3 page sector briefs" form factor this feature lives inside.
  - [§7.2 Verdicts, not datasets](../../PRD/PRD.md#7-product-principles) — every observation ends in a conclusion, never a raw number.
  - [§7.3 Plain language, no jargon](../../PRD/PRD.md#7-product-principles) — observation body copy reads like the owner's accountant would say it.
  - [§7.4 Proof of value before anything else](../../PRD/PRD.md#7-product-principles) — the first brief's first observation is the owner's first "I didn't know that" moment.
  - [§9 Release Plan — Observation Generation [basic]](../../PRD/PRD.md#9-release-plan) — MVP feature; LLM narrative, shift-triggered, and multi-year variants are later-increment scope per §9 Increments 2 and 4.
  - [§13.1 Brief production scaling risk](../../PRD/PRD.md#13-risks-and-open-questions) — templated-by-default keeps analyst authoring tractable.
- **ČS business goals served:**
  - **G1 Engagement** — observations are the "why should I care" payload that makes an owner finish the brief rather than skim. §6 Goal 1 engagement metrics (open rate, time-spent, observation click-throughs to closing actions) are the direct signal.
  - **G2 Data depth + cadence** — not directly. No observation at MVP captures owner data (A-013). The feature is structured so Increment 3 give-to-get capture can hang off an observation without rework.
- **Related decisions:**
  - [D-003](../project/decision-log.md) — the eight MVP ratios bound what a cohort-grounded observation can reference.
  - [D-006](../project/decision-log.md) — brief personalization grain = NACE only; observations are written for a sector, not for an individual owner.
  - [D-011](../project/decision-log.md) — canonical four benchmark categories; observations that cite a snippet must reference the snippet's category name as frozen there.
  - [D-002](../project/decision-log.md) — no RM lane at MVP; no observation derives or hints at an RM-surface output.
- **Upstream assumptions (must hold):** [A-003](assumption-log.md) (the eight MVP ratios), [A-006](assumption-log.md) (NACE-only grain), [A-011](assumption-log.md) (human-authored briefs), [A-012](assumption-log.md) (briefs are the atomic unit; no standalone dashboard), [A-013](assumption-log.md) (no give-to-get capture), [A-017](assumption-log.md) (statistical-validity floor suppression is silent-to-user).

## 3. User stories

### US-1 — Analyst-authored observation set per brief

- **As a** ČS analyst authoring a monthly brief,
- **I want** a constrained template that lets me enter 2, 3, or 4 observations (no fewer, no more), each with a headline verdict, 1–2 sentence body, and a time-horizon tag,
- **so that** every brief I publish carries the same shape of "what this means for the owner" payload, and no brief ships with fewer than 2 or more than 4 observations.

  **Acceptance criteria:**
  - [ ] The authoring back-end rejects a brief with fewer than 2 observations. Error surfaces in the authoring UI with plain-language reason, not a stack trace.
  - [ ] The authoring back-end rejects a brief with more than 4 observations. Same surfacing requirement.
  - [ ] Each observation requires all three fields (`headline`, `body`, `timeHorizon`) to be non-empty before the brief can be marked "ready to deliver."
  - [ ] `timeHorizon` is one of the four values defined in the Information Architecture (Okamžitě, Do 3 měsíců, Do 12 měsíců, Více než rok) per [information-architecture.md §2](../design/information-architecture.md). Any other value is rejected.
  - [ ] Body length is bounded: 1–2 sentences, target ≤ 45 words per observation body. Exceeding the bound produces a soft-warning to the analyst (not a hard block; analyst judgment overrides).
  - [ ] Saving a draft with 0 or 1 observation is allowed (work-in-progress); publishing is gated on the 2–4 count.

### US-2 — Verdict-first observation headline

- **As a** Czech SME owner reading my sector brief,
- **I want** each observation to open with a plain-language conclusion before any context,
- **so that** I can extract the point in under five seconds per observation and decide whether to read the body.

  **Acceptance criteria:**
  - [ ] Every observation headline is a single sentence expressing a conclusion, not a question, not a topic.
  - [ ] No headline contains a bare number without a comparative frame (§7.2). Example blocked by review: "Marže ve vašem sektoru činí 14 %." Example allowed: "Marže ve vašem sektoru jsou letos pod průměrem vaší kohorty."
  - [ ] No headline uses statistical notation or analyst jargon — no σ, no "p-value", no "percentile", no "coefficient." "Čtvrtina", "polovina", "horní čtvrtina" are allowed (plain-language equivalents of quartile).
  - [ ] Headline copy is Czech (A-004 / D-004). English headlines are rejected.

### US-3 — Observation anchors to one of the eight MVP ratios or to a sector-trend narrative

- **As a** ČS analyst,
- **I want** each observation to be tagged as either *ratio-anchored* (ties to one of the eight MVP ratios and optionally to an embedded benchmark snippet in the same brief) or *narrative-anchored* (ties to a sector-level trend the analyst is introducing),
- **so that** the product has a traceable link from observation to the finding it rests on, and downstream design can decorate ratio-anchored observations with the right snippet link.

  **Acceptance criteria:**
  - [ ] Each observation carries an `anchor` field with exactly one of two values: `ratio` or `narrative`.
  - [ ] If `anchor = ratio`, the observation must reference exactly one of the eight ratios in [mvp-metric-list.md](mvp-metric-list.md) by its canonical name. A free-text "other ratio" is rejected.
  - [ ] If `anchor = ratio` and the referenced ratio has an embedded snippet in the same brief whose `confidenceState` is `low-confidence` or `empty` (see [information-architecture.md §4.3](../design/information-architecture.md)), the authoring back-end surfaces a soft warning: the observation will read as a verdict to the owner but the supporting snippet will be suppressed or degraded. Analyst judgment overrides (this is the silent-suppression rule per A-017; the warning is for authoring awareness, not blocking).
  - [ ] If `anchor = narrative`, no ratio reference is required; the observation stands on the analyst's sector-level narrative.
  - [ ] A brief's 2–4 observations may mix anchor types freely (all ratio, all narrative, or any combination).

### US-4 — Time-horizon tag drives closing-action pairing

- **As a** Czech SME owner reading the brief,
- **I want** each observation's time horizon to match at least one closing action's time horizon,
- **so that** I never encounter an observation whose payoff is nowhere in the action list.

  **Acceptance criteria:**
  - [ ] For every observation in the brief, at least one closing action (per the Action Specificity Framing feature) carries the same `timeHorizon` value. If an observation's time-horizon has no matching action, publishing is soft-blocked with an analyst-resolvable warning.
  - [ ] This check runs at publish time, not edit time — the analyst may author observations and actions in any order.
  - [ ] The check is one-way: an action may exist without a matching observation (the brief may recommend an action beyond what the observations flagged). An observation without a matching action is the failure case.

### US-5 — Observation is silent when its anchor ratio is below the statistical-validity floor — but only if the observation depends on the owner's own position

- **As a** ČS analyst,
- **I want** guidance on whether a ratio-anchored observation is safe to publish when the owner's cohort cell is below the statistical-validity floor for that ratio,
- **so that** I do not ship an observation that implies a cohort comparison the embedded snippet silently refuses to render.

  **Acceptance criteria:**
  - [ ] When `anchor = ratio`, the authoring back-end exposes the current floor-status for that ratio for each priority cohort the brief will be delivered to (from [cohort-math.md](../data/cohort-math.md) floor data).
  - [ ] The analyst may still publish a ratio-anchored observation for a cohort whose cell is below the floor, provided the observation's headline and body are framed at the **sector** level (cohort-agnostic) rather than at the owner-vs-cohort level. This is a judgment flag, not a hard block.
  - [ ] An observation that surfaces an owner-relative verdict (e.g., "You sit in the bottom quartile for X") cannot be published for a cohort below the floor for that ratio. Hard-blocked at publish time. Plain-language analyst-facing error copy required.
  - [ ] The distinction — sector-level vs. owner-relative — is captured in a required `framing` sub-field when `anchor = ratio`. Values: `sector` | `owner_relative`. The combination `owner_relative + below-floor` is the blocked case.

## 4. Scope

- **In scope (MVP):**
  - Templated observation data model: `headline`, `body`, `timeHorizon`, `anchor`, `framing` (when ratio-anchored), `ratioRef` (when ratio-anchored).
  - Analyst authoring UI affordances that enforce the 2–4 count, field validation, soft warnings, and hard blocks above. (UI layout owned by designer; this feature PRD owns the rules the UI must enforce.)
  - Observation-to-action time-horizon pairing check at publish time.
  - Floor-awareness check for ratio-anchored, owner-relative observations.
  - Plain-language rule enforcement hooks (specific rules are owned by the Plain-Language Translation feature PRD; Observation Generation consumes those rules at publish time).
- **Out of scope (explicit, with reason):**
  - **LLM-authored observation narratives** — Increment 4 per PRD §9 ("LLM-generated brief narratives"). MVP is analyst-typed. (A-011.)
  - **Shift-detection-triggered observations** — Increment 2 per PRD §9 (Shift Detection and Alert System). MVP observations are pulled by the analyst from their sector read, not pushed by an alerting engine.
  - **Multi-year historical observations** — Increment 4 per PRD §9 ("multi-year historical view with event annotations"). MVP observations reference the current brief period only; no year-over-year or multi-period trend authoring affordance is built.
  - **RM-visible derivations** — [D-002](../project/decision-log.md) defers the RM lane; no observation feeds an RM output at MVP.
  - **Owner-contributed inputs into observation authoring** — [A-013](assumption-log.md) / CLAUDE.md give-to-get guardrail. No give-to-get capture UX hangs off an observation at MVP.
  - **Per-observation personalization per owner** — [D-006](../project/decision-log.md) / [A-006](assumption-log.md). An observation is authored for a sector (NACE); every owner in that sector sees the same observations.
  - **Observation library / reuse across briefs** — out of scope at MVP (nice-to-have for PRD §13.1 mitigation but not required). If Increment 2 brings this forward, this PRD is re-opened.
  - **Localization (Czech + English)** — [D-004](../project/decision-log.md) / [A-004](assumption-log.md). Czech only.
- **Increment:** MVP (Increment 1).

## 5. Success metrics

Tied to PRD §6 where possible; all metrics are observation-attributable even though the brief is the unit of delivery.

- **Every published brief contains 2–4 observations.** Target: 100%. Measured as: count of briefs published in which the observation count is in [2, 4]. This is a structural integrity metric — any miss indicates a failed publish-time validation.
- **Observation click-through rate (web view).** PRD §6 Goal 1 "Observation engagement." Target direction: up. Measured as: share of web-view brief sessions in which at least one observation is interacted with (click on a linked benchmark snippet or scroll-past dwell ≥ 3 seconds, exact threshold owned by designer + engineer).
- **Time-horizon-paired closing-action rate.** Target: 100% of published briefs satisfy US-4 (every observation has at least one matching-horizon action). Structural integrity metric.
- **Soft-warning override rate in authoring.** Target direction: trending toward 0 over successive authoring cycles. Measured as: share of published briefs in which an analyst overrode a word-count or framing soft warning. A rising rate is a signal that the template's soft-warning thresholds are miscalibrated and should be revisited.
- **Owner "proof-of-insight" rate on the first brief's first observation.** PRD §6 cross-cutting metric. Measured post-MVP via owner-rated "surprising and actionable" signal if/when that capture ships (out of scope at MVP per A-013 — recorded here so a future give-to-get capture can anchor on this observation).

## 6. Non-negotiables

Which PRD §7 principles apply and how they constrain this feature:

- **§7.1 Briefs are the atomic unit of value.** Observations live inside a brief; they do not appear on a standalone page, in a push notification, in a dashboard tile, or in an email separately from the brief. Any future surface that extracts observations outside the brief is a scope expansion requiring a new decision-log entry.
- **§7.2 Verdicts, not datasets.** Every observation headline ends in a conclusion. Every observation body either (a) supports that conclusion with plain-language context or (b) cites exactly one ratio by canonical name. Neither may contain a bare number without a comparative frame (US-2, AC).
- **§7.3 Plain language.** Observation copy is written at accountant-to-owner register. No statistical notation. The Plain-Language Translation feature PRD owns the specific lexicon; this feature enforces that PLT's rules run at publish time.
- **§7.4 Proof of value before anything else.** The first observation in a brief's sequence is the owner's first verdict. Analysts should treat observation #1 as the proof-of-insight payload, not as throat-clearing. (This is authoring guidance, not a structural check.)
- **§7.5 Privacy as product.** Observations never reference owner-supplied data (A-013) and never cross the lane boundary into credit-risk or RM-visible data (A-015 / [D-010](../project/decision-log.md)). Observations are authored off the brief lane only.
- **§7.6 Opportunity-flavored framing.** Even though no RM surface exists at MVP (D-002), observation headlines must not read as bank-watching-me. Example blocked: "Váš sektor vykazuje známky zhoršujícího se úvěrového profilu." Example allowed: "Pracovní kapitál ve vašem sektoru se prodlužuje — prostor pro jednání o platebních podmínkách."
- **§7.8 Every interaction is a data acquisition opportunity — in mind, not in build.** The observation data model includes the `anchor` and `ratioRef` fields so an Increment 3 give-to-get capture (e.g., "your headcount would sharpen this verdict") can hang off an observation without re-authoring. Not built at MVP.
- **Statistical-validity floor silence (A-017).** An observation whose anchor ratio is below the floor for the target cohort must either (a) be framed at sector level, or (b) be blocked from publishing. Silent delivery of an owner-relative verdict without its supporting snippet is the exact failure mode this feature prevents.

## 7. Open questions

Numbered locally; orchestrator re-IDs into [docs/project/open-questions.md](../project/open-questions.md) at the next gate.

1. **OG-Q-01 — Priority-cohort list for floor-status surfacing in authoring.** US-5 asks the authoring back-end to surface per-ratio floor-status "for each priority cohort the brief will be delivered to." The priority-cohort list is referenced in [cohort-math.md §2.4](../data/cohort-math.md) as "~10 priority NACE divisions" but not yet frozen. PM + analyst + data-engineer must align on the list before the authoring UI can render the check. Does not block PM PRD authoring; does block engineer implementation.
2. **OG-Q-02 — Observation-to-action pairing: is "matching time horizon" strict equality, or is "nearer-than" allowed?** US-4 currently says strict equality on the four `timeHorizon` enum values. Edge case: an observation tagged "Do 12 měsíců" with an action tagged "Do 3 měsíců" is arguably paired (the action is a subset). Strict equality may force analyst workarounds. Needs designer + analyst gut check before Phase 2 design.
3. **OG-Q-03 — Observation ordering semantics.** PRD §7.4 implies observation #1 is the proof-of-insight slot. Is order authored by the analyst (explicit drag-to-reorder), or inferred from some rule (e.g., by time-horizon ascending)? Needs designer decision; the data model currently assumes analyst-authored order.
4. **OG-Q-04 — Cross-feature boundary with Plain-Language Translation.** This feature enforces "PLT rules run at publish time" (Non-negotiable §7.3). The exact rules are owned by [`docs/product/plain-language-translation.md`](plain-language-translation.md) (not yet drafted — Track A sibling). If PLT ships stricter rules than this feature's ACs assume (e.g., forbids the word "kvartil" entirely), AC-2 of US-2 must be revised. Resolved when PLT PRD lands.
5. **OG-Q-05 — Soft-warning thresholds (word count, override rate).** The 45-word body target and the target-direction "trending toward 0" on soft-warning override rate are reasoned-but-not-validated defaults. Revisit after first authoring cycle.

## 8. Downstream artifacts

- **Design:** `docs/design/observation-generation/` — not yet drafted. Owns: analyst authoring UI layout, in-brief rendering of the `ObservationCard` component (already scaffolded in [information-architecture.md §4.2](../design/information-architecture.md)), soft-warning + hard-block copy, floor-status affordance in the authoring surface.
- **Data:** No dedicated data-engineer addendum expected; this feature consumes the existing cohort-math floor outputs and the 8-ratio list. If the priority-cohort list (OG-Q-01) requires a data model change, a data-engineer note may be added.
- **Engineering:** `docs/engineering/observation-generation.md` — not yet drafted. Owns: the authoring back-end validation rules (2–4 count, enum checks, field requirement enforcement, time-horizon pairing at publish time, floor-status lookup for US-5), the stored observation record shape in the brief storage model (extends [adr-0002-brief-storage-and-delivery.md](../engineering/adr-0002-brief-storage-and-delivery.md)), and the integration point with Plain-Language Translation rule execution.

## Changelog

- 2026-04-20 — initial draft — product-manager
