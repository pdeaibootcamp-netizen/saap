# Assumption Log

*Owner: product-manager · Last updated: 2026-04-17*

## Purpose

Living record of load-bearing assumptions that downstream PRDs, designs, data models, and engineering artifacts rely on. If an assumption is later invalidated, every artifact that relied on it must be revisited — this log is the index for that sweep.

**How to use.**
- Append only. Never edit the meaning of a past row; if reality changes, add a new row or mark the old one `invalidated` with a date and a pointer to the replacement.
- Every assumption names: ID, one-sentence statement, source (decision-log ID, backlog ID, PRD section, or CLAUDE.md guardrail), impact-if-wrong, status.
- Specialists: before you author a PRD, design, data model, or ADR, read this log. If your artifact relies on an assumption below, link to its `A-NNN` ID. If your artifact depends on an assumption **not yet in this log**, add it here first.
- If you believe an assumption is wrong, do not silently work around it — raise an entry in [`docs/project/open-questions.md`](../project/open-questions.md) and stop.

## Active assumptions

### A-001 — Cohorts are hand-assigned on pre-populated data at MVP
- **Assumption.** MVP cohort membership is assigned by hand to each owner on top of a pre-populated dataset; there is no live cohort-segmentation matcher and no owner-data-ingestion pipeline.
- **Source.** [D-001](../project/decision-log.md); PRD [§9 MVP scope gap resolution](../../PRD/PRD.md#9-release-plan).
- **Impact if wrong.** Every feature that references cohort membership must be revisited: percentile position calculation, quartile display, category-based layout, embedded snippet degradation logic, and the brief authoring workflow. Cohort segmentation matching and bank data pre-processing features (PRD §9 Increment 3) would need to be pulled forward.
- **Status.** active.

### A-002 — RM Lead Signal Surface is not built at MVP
- **Assumption.** No RM-facing surface, no opportunity-signal feed, no RM export, no RM view is built at MVP. Goal G3 (RM lead generation) is deferred by one increment.
- **Source.** [D-002](../project/decision-log.md); PRD [§8.3](../../PRD/PRD.md#83-rm-lead-signal-surface-mvp-scope-tbd-likely-post-mvp), [§9 open MVP question](../../PRD/PRD.md#9-release-plan).
- **Impact if wrong.** Consent UX (D-007/D-008), privacy architecture (data-engineer Phase 1 artifact), and the separation between brief / RM-visible / credit-risk data lanes must all be revisited under load — a single-opt-in model may need to be replaced with a per-lane structure, and downstream design/data work rebased.
- **Status.** active.

### A-003 — The MVP metric list is the eight ratios in `mvp-metric-list.md`
- **Assumption.** The MVP metric surface is exactly the eight ratios frozen in [`mvp-metric-list.md`](mvp-metric-list.md): gross margin, EBITDA margin, labor cost ratio, working capital cycle, ROCE, revenue growth vs cohort median, pricing power proxy, revenue per employee. No other ratio may be computed, benchmarked, or referenced in an MVP brief.
- **Source.** [D-003](../project/decision-log.md); PRD [§5 Metric Taxonomy](../../PRD/PRD.md#5-metric-taxonomy).
- **Impact if wrong.** Cohort math scope (data-engineer), brief authoring templates (PM Phase 2), and embedded-snippet layout (designer Phase 1 IA + Phase 2 category-based layout feature) all change. Any addition or substitution requires a new `D-NNN` decision-log row before downstream changes.
- **Status.** active.

### A-004 — All user-facing copy is Czech only at MVP
- **Assumption.** Every string an owner sees — in email, web view, PDF, and any consent or onboarding surface — is in Czech. English appears only in internal artifacts.
- **Source.** [D-004](../project/decision-log.md); PRD [§3 Target Users](../../PRD/PRD.md#3-target-users), [§11 Go-to-Market](../../PRD/PRD.md#11-go-to-market).
- **Impact if wrong.** Analyst brief authoring effort roughly doubles (PRD §13.1 risk); designer copy decks, email templates, PDF template, consent screen, and any UI copy must ship in two languages; engineering adds i18n plumbing to MVP scope.
- **Status.** active.

### A-005 — No brief cadence commitment is made to users during the trial
- **Assumption.** MVP does not promise users a monthly cadence, a "next brief on X" date, or any recurring-delivery expectation. Briefs are delivered ad hoc during the trial window; copy does not imply rhythm.
- **Source.** [D-005](../project/decision-log.md); [B-001](../project/backlog.md).
- **Impact if wrong.** Any subscription UI, cadence-promising copy, or habit-anchor messaging requires a new decision. Retention metrics (PRD §6 — month-3, month-12 retention) and engagement framing (habit anchor for Bank-Referred Passive Adopter per §3) would need to be reframed for the MVP timeframe.
- **Status.** active.

### A-006 — Briefs are personalized at NACE sector grain only
- **Assumption.** An owner's brief is selected by NACE sector alone. Size band and region slicing surface only via the embedded benchmark snippet, and only when the (NACE × size × region) cell is above the statistical-validity floor.
- **Source.** [D-006](../project/decision-log.md); PRD [§10 Cohort segmentation](../../PRD/PRD.md#10-data-and-technical-foundation), [§13.5 cold-start risk](../../PRD/PRD.md#13-risks-and-open-questions).
- **Impact if wrong.** Brief authoring workload multiplies per additional grain dimension (sector × size → 2–3×; sector × size × region → substantially more); cohort depth per cell drops and statistical-validity floor suppressions increase; embedded-snippet coverage shrinks. Would require revisiting PRD §13.1 (brief production scaling) mitigation.
- **Status.** active.

### A-007 — Consent is a single opt-in covering all data lanes
- **Assumption.** At MVP the consent data-primitive is a single opt-in that covers the brief lane, the user-contributed lane, the (deferred) RM-visible lane, and the hard boundary against the credit-risk lane. There are no per-lane toggles.
- **Source.** [D-007](../project/decision-log.md); PRD [§7.5 Privacy as product](../../PRD/PRD.md#7-product-principles), [§13.3 lead-generation vs trust-barrier risk](../../PRD/PRD.md#13-risks-and-open-questions).
- **Impact if wrong.** When the RM lane activates post-MVP (A-002 reversed), the single opt-in likely requires a re-consent event — a trust-sensitive moment that must be pre-designed. Any mid-MVP decision to introduce per-lane toggles rebases the designer's consent pattern (D-008) and the data-engineer's consent ledger schema.
- **Status.** active.

### A-008 — Consent UX is a single-screen declaration before first brief view, with revocation in Settings > Soukromí
- **Assumption.** The user sees consent once — as a plain-language four-lane declaration shown before the first brief view — and can revoke at any time in Settings > Soukromí. The four-lane structure is **educational** (what the bank does and does not do with data), not a set of per-lane toggles (see A-007).
- **Source.** [D-008](../project/decision-log.md).
- **Impact if wrong.** Designer (`docs/design/trust-and-consent-patterns.md`) and data-engineer (`docs/data/privacy-architecture.md`) revocation semantics must realign. Inline per-touchpoint consent badges or progressive per-increment prompts would replace the single-screen pattern and propagate through every onboarding and brief-delivery surface. Legal-review dependency (flagged in D-008) is blocking in either model.
- **Status.** active.

### A-009 — No in-product accountant / advisor sharing infrastructure at MVP
- **Assumption.** MVP does not ship an in-product share-with-advisor link, a read-only guest view, or a named advisor seat. Owners may forward the downloadable PDF manually if they wish; no in-product sharing UX exists.
- **Source.** [D-009](../project/decision-log.md); [B-002](../project/backlog.md).
- **Impact if wrong.** The "share-to-advisor/accountant rate" engagement metric (PRD §6 Goal 1) cannot be measured at MVP — if measurement becomes required, share-link infrastructure must be built and rebased against the consent model (A-007) and the lane-separation architecture.
- **Status.** active.

### A-010 — MVP is a time-boxed trial of less than one month
- **Assumption.** The MVP is a short-duration trial — under one month end-to-end. Features are not required to be designed for longevity, scale, or multi-cycle operation beyond the trial window.
- **Source.** User constraint recorded in [B-001](../project/backlog.md) and [B-002](../project/backlog.md); reflected across D-005 and D-009 rationale.
- **Impact if wrong.** If the MVP extends, cadence commitments (A-005), sharing infrastructure (A-009), retention measurement (PRD §6 month-3 / month-12), and brief authoring scale (PRD §13.1) all reopen. Several design and engineering shortcuts that are acceptable for a <1-month trial would become technical debt requiring rework.
- **Status.** active.

### A-011 — All MVP briefs are human-authored; no automated brief generation
- **Assumption.** Every brief shipped at MVP is authored by a ČS analyst via back-end tooling. No LLM-generated narrative, no templated auto-fill beyond the structured observation scaffolding, and no scheduled automated production.
- **Source.** [CLAUDE.md "No automated brief generation at MVP" guardrail](../../CLAUDE.md); PRD [§4 Non-Goals](../../PRD/PRD.md#4-goals-and-non-goals), [§8.1](../../PRD/PRD.md#81-sector-briefing-engine--what-this-means-for-you-primary-mvp), [§9 Release Plan — Monthly Briefing Generation](../../PRD/PRD.md#9-release-plan).
- **Impact if wrong.** The engineering stack (analyst back-end vs. generation pipeline), the brief storage/versioning model, the plain-language translation guarantee (§7.3), and the brief authoring workstream's capacity planning (§13.1) all change shape. Automation is a later-increment scope item per §9; pulling it forward requires a new decision-log entry.
- **Status.** active.

### A-012 — Briefs are the atomic unit of value; benchmarks are embedded snippets, not a standalone surface
- **Assumption.** At MVP there is no standalone benchmark dashboard, no persistent percentile view, no metric-browser UI. Every numerical benchmark surfaces only inside a brief, as a comparative snippet supporting an observation.
- **Source.** [CLAUDE.md product guardrails](../../CLAUDE.md); PRD [§1 Summary](../../PRD/PRD.md#1-summary), [§4 Non-Goals](../../PRD/PRD.md#4-goals-and-non-goals) ("No benchmark dashboard as a standalone product at MVP"), [§7.1](../../PRD/PRD.md#7-product-principles), [§8.2 Peer Position Engine](../../PRD/PRD.md#82-peer-position-engine-minimal-mvp).
- **Impact if wrong.** If a standalone benchmark view enters MVP scope, the designer IA, the engineer's storage/delivery model, and the PM feature set all rebase — this is a significant scope expansion and would require a new decision-log row.
- **Status.** active.

### A-013 — No give-to-get capture UX is built at MVP
- **Assumption.** No MVP feature introduces a data-capture flow in exchange for a richer output (the give-to-get loop is a design posture, not a built feature set). The Additional Customer Information Gatherer and adjacent capture UX are Increment 3.
- **Source.** [CLAUDE.md "Give-to-get in mind, not in build" guardrail](../../CLAUDE.md); PRD [§7.8](../../PRD/PRD.md#7-product-principles), [§9 Increment 3](../../PRD/PRD.md#9-release-plan).
- **Impact if wrong.** Any MVP capture UX requires orchestrator approval. Introducing one changes the consent scope (A-007), the lane-separation architecture (A-002 still applies), and the PM feature backlog — and opens the door to capturing missing fields (e.g., headcount for revenue-per-employee, A-003 ratio #8) rather than degrading gracefully per the mvp-metric-list constraint.
- **Status.** active.

### A-014 — Bank-native distribution (George Business embedding) is the primary channel; direct sign-up is secondary
- **Assumption.** The primary distribution path is RM introduction plus George Business embedding; direct sign-up exists but is the secondary path. Onboarding, trust signals, and consent UX are designed for the bank-native path first.
- **Source.** [CLAUDE.md bank-native distribution guardrail](../../CLAUDE.md); PRD [§7.7](../../PRD/PRD.md#7-product-principles), [§11 Go-to-Market](../../PRD/PRD.md#11-go-to-market).
- **Impact if wrong.** If direct sign-up becomes primary, the time-to-first-verdict target shifts (from <60s bank-referred to <15min direct per PRD §6), the consent screen context changes (no RM pre-framing), and the sector-profile configuration feature's default data posture flips from "pre-populated" to "user-entered."
- **Status.** active.

### A-015 — Client data never enters base-model training; the four data lanes are architecturally separate
- **Assumption.** Client data (brief lane, user-contributed lane, RM-visible lane, credit-risk lane) never enters base-model training, and the four lanes are architecturally separate — not merely access-controlled. This is a marketed product feature, not a compliance footnote.
- **Source.** [CLAUDE.md privacy guardrail](../../CLAUDE.md); PRD [§7.5](../../PRD/PRD.md#7-product-principles), [§10 Data and Technical Foundation](../../PRD/PRD.md#10-data-and-technical-foundation), [§13.3](../../PRD/PRD.md#13-risks-and-open-questions).
- **Impact if wrong.** The #1 trust barrier identified in research collapses (PRD §3, §13.3). Every trust-and-consent design artifact, every privacy-architecture decision, and the product's market positioning (PRD §12) are built on this assumption. Invalidation is a project-level event, not a feature-level one.
- **Status.** active.

### A-016 — RM-visible signals are opportunity-flavored, never risk-flavored
- **Assumption.** Any signal that ever reaches an RM is framed as a conversational opportunity (expansion, treasury, cross-border, etc.), never as a credit-risk flag. This holds even though the RM surface itself is deferred (A-002) — the framing principle binds any future surface.
- **Source.** [CLAUDE.md lead-signal guardrail](../../CLAUDE.md); PRD [§4 Non-Goals](../../PRD/PRD.md#4-goals-and-non-goals) ("No credit-risk signaling to RMs"), [§7.6](../../PRD/PRD.md#7-product-principles), [§10 RM lead signal architecture](../../PRD/PRD.md#10-data-and-technical-foundation).
- **Impact if wrong.** Trust-barrier collapse (PRD §13.3). Every consent decision (D-007, D-008) and the entire RM-program design rebases. Invalidation is a non-goal breach — requires escalation, not a normal decision-log row.
- **Status.** active.

### A-017 — Statistical-validity floor suppression is silent-to-the-user, not silent-to-the-system
- **Assumption.** When a (NACE × size × region) cell is below the statistical-validity floor for a given ratio, the ratio is suppressed from the user's embedded snippet (the brief does not surface it at all). The system still records the suppression event — it is never silently emitted as a low-confidence number.
- **Source.** [CLAUDE.md cold-start guardrail](../../CLAUDE.md); PRD [§10 Cohort segmentation minimum cohort size flag](../../PRD/PRD.md#10-data-and-technical-foundation), [§13.5](../../PRD/PRD.md#13-risks-and-open-questions); [mvp-metric-list.md constraint #3](mvp-metric-list.md).
- **Impact if wrong.** If suppression becomes visible to the user (e.g., "we don't have enough data for your cohort"), the brief's verdict-first promise (§7.2, §7.4) weakens and the cold-start risk (§13.5) materializes as a UX problem. If suppression becomes non-silent-to-the-system, the cohort depth success metric (§6 Goal 2) loses its instrumentation.
- **Status.** active.

## Invalidated assumptions

*(none yet)*

## Changelog

- 2026-04-17 — initial seed from Phase 0 decisions (D-001 through D-009), backlog items (B-001, B-002), and CLAUDE.md product guardrails. A-001 through A-017 logged. — product-manager
