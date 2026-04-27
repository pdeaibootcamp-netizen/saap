# Monthly Briefing Generation

*Owner: product-manager · Slug: monthly-briefing-generation · Last updated: 2026-04-20*

## 1. Summary

Monthly Briefing Generation is the ČS-analyst authoring and publish workflow — a back-end tool that lets an analyst compose, preview, review, and publish one sector brief per NACE sector per cycle, ready for downstream delivery. It is the engineering core of MVP: every user-facing brief originates here, and every MVP feature downstream (observation templates, embedded snippets, multi-format delivery) consumes the artifact this workflow emits. At MVP the analyst is the primary user; the SME owner is the eventual recipient but does not interact with this surface.

## 2. Upstream links

- **PRD sections**:
  - [§8.1 Sector Briefing Engine](../../PRD/PRD.md#81-sector-briefing-engine--what-this-means-for-you-primary-mvp) — defines the brief as the primary surface and names the authoring back-end as its MVP mode.
  - [§8.6 — not applicable](../../PRD/PRD.md) — the PRD has no §8.6; the orchestrator brief cited §8.6 as context but §8 ends at §8.5. Treating the intended reference as §8.1 (Sector Briefing Engine) plus §9 (Release Plan) which together fully cover the authoring-back-end scope. Flagged in §7.
  - [§9 Release Plan — Monthly Briefing Generation](../../PRD/PRD.md#9-release-plan) — pulled forward from Increment 3 to MVP; explicitly "a back-end authoring surface at MVP" with automation out of scope.
  - [§4 Non-Goals](../../PRD/PRD.md#4-goals-and-non-goals) — "No automated brief generation at MVP."
  - [§7.2 Verdicts, not datasets](../../PRD/PRD.md#7-product-principles) / [§7.3 Plain language](../../PRD/PRD.md#7-product-principles) — every brief emitted by this workflow must clear both.
  - [§13.1 Brief production doesn't scale](../../PRD/PRD.md#13-risks-and-open-questions) — the authoring UX exists in part to make analyst workload tractable.

- **ČS business goals served**:
  - **G1 Engagement** — direct. This feature produces the atomic unit of value; without published briefs there is no engagement to measure.
  - **G2 Data depth and cadence** — indirect. Each published brief is the reason owners return, which is the precondition for any future data contribution. No direct data-capture at MVP (A-013).
  - **G3 RM lead generation** — not served at MVP (deferred per D-002 / A-002); the authoring surface does not emit RM-visible content.

- **Related decisions**:
  - [D-001](../project/decision-log.md) — hand-assigned cohorts on pre-populated data; the analyst selects a target cohort from this pre-populated seed, does not build one.
  - [D-002](../project/decision-log.md) / [A-002](assumption-log.md) — no RM-visible content authored here.
  - [D-003](../project/decision-log.md) / [A-003](assumption-log.md) — the eight MVP ratios are the only ratios referenceable inside a brief authored through this workflow.
  - [D-004](../project/decision-log.md) / [A-004](assumption-log.md) — all authored user-facing copy is Czech only.
  - [D-005](../project/decision-log.md) / [A-005](assumption-log.md) / [B-001](../project/backlog.md) — no cadence commitment to users; the authoring surface must not expose "next brief on X" copy fields or schedule-publish UI that implies cadence.
  - [D-006](../project/decision-log.md) / [A-006](assumption-log.md) — personalization grain is NACE sector only; a brief is keyed to one NACE sector, never to a size/region tuple.
  - [D-007](../project/decision-log.md) / [D-008](../project/decision-log.md) — authored brief content flows only to consented users; consent gating lives downstream in delivery, but the authoring surface must not embed any per-user data that would bypass the consent event.
  - [D-011](../project/decision-log.md) — canonical four benchmark categories are the only structure the authoring tool exposes for embedded snippets.
  - [D-013](../project/decision-log.md) — Supabase Postgres / Vercel hosting; storage and versioning are owned by [ADR-0002](../engineering/adr-0002-brief-storage-and-delivery.md) downstream.
  - [A-011](assumption-log.md) — no LLM-generated narrative at MVP; all prose is analyst-typed.
  - [A-012](assumption-log.md) — briefs are the atomic unit of value; no content authored here renders outside a brief.

## 3. User stories

### US-1 — Analyst authors a brief against a chosen NACE sector
**As a** ČS analyst, **I want** to open a new brief for a specific NACE sector, **so that** I can produce the monthly sector brief for owners in that cohort.

- Acceptance criteria:
  - [ ] The authoring surface requires the analyst to pick one NACE sector before any content can be drafted; picking a cohort cell narrower than sector (e.g., size band or region) is not offered (D-006 / A-006).
  - [ ] The picker only exposes NACE sectors for which a seed cohort exists in the pre-populated dataset (D-001 / A-001). Sectors without seed data are absent from the list, not visible-but-disabled, so there is no implicit backlog prompt.
  - [ ] A brief once created is immutably keyed to its NACE sector; the sector cannot be changed after creation (changing sector = creating a new brief).

### US-2 — Analyst composes the six-component brief structure
**As a** ČS analyst, **I want** a structured editor that enforces the six-component brief layout, **so that** every brief I publish matches the content contract the three delivery surfaces expect.

- Acceptance criteria:
  - [ ] The editor provides one slot per component from [information-architecture.md §2](../design/information-architecture.md) Common brief content model: Záhlaví, Úvodní přehled, Pozorování (2–4), Srovnávací přehled (four-category structure), Doporučené kroky (2–4), Zápatí.
  - [ ] Pozorování count is constrained to 2–4; below 2 or above 4 blocks publish (PRD §8.1).
  - [ ] Doporučené kroky count is constrained to 2–4; below 2 or above 4 blocks publish (PRD §8.1, §9 Action Specificity Framing).
  - [ ] Every Pozorování and every Doporučený krok carries a time-horizon tag from the canonical set (Okamžitě / Do 3 měsíců / Do 12 měsíců / Více než rok); saving without a tag is blocked.
  - [ ] The Srovnávací přehled block exposes exactly the four canonical D-011 categories — Ziskovost, Náklady a produktivita, Efektivita kapitálu, Růst a tržní pozice — in that order; the analyst cannot add or rename categories from within this tool.
  - [ ] Within each category, only the ratios assigned to it by [mvp-metric-list.md §Category grouping](mvp-metric-list.md) are selectable for snippet authoring (A-003). Any other ratio is not offered.
  - [ ] All authored copy fields accept Czech only; the tool does not expose a language switcher (A-004 / D-004).

### US-3 — Analyst previews the brief in all three delivery surfaces before publishing
**As a** ČS analyst, **I want** to preview the brief as the owner will see it in email, web view, and PDF, **so that** I catch layout, length, and plain-language issues before publication.

- Acceptance criteria:
  - [ ] Preview offers three views matching the three delivery surfaces per [information-architecture.md §3](../design/information-architecture.md): email (≤ 400-word condensed), web view (full six components), PDF (2–3 A4 pages, fully expanded).
  - [ ] The email preview shows the single observation and single snippet selection the analyst made (US-4).
  - [ ] The PDF preview renders the A-4 page footer confidentiality notice and month/year stamp (per information-architecture.md §3 Surface C).
  - [ ] Preview does not hit production delivery infrastructure; no email is sent, no PDF is persisted outside the preview buffer.

### US-4 — Analyst selects the email-teaser observation and benchmark snippet
**As a** ČS analyst, **I want** to nominate which single observation and which single benchmark snippet appears in the condensed email body, **so that** the email teaser reflects editorial judgement about the most salient verdict for that month.

- Acceptance criteria:
  - [ ] The authoring tool requires exactly one Pozorování to be flagged as the email-teaser observation before publish.
  - [ ] The authoring tool allows zero or one BenchmarkSnippet to be flagged as the email-teaser snippet. If zero are flagged, the email omits the teaser snippet (consistent with BenchmarkSnippet `confidenceState !== 'valid'` rule in information-architecture.md §4.3).
  - [ ] The email-teaser snippet flag is rejected at publish time if its `confidenceState !== 'valid'` per the downstream cohort computation (cohort-math.md owns the floor check).

### US-5 — Analyst reviews plain-language and verdict-first compliance before publishing
**As a** ČS analyst, **I want** a publish-time checklist that flags plain-language and verdict-first violations, **so that** no brief leaves the authoring surface in violation of §7.2 and §7.3.

- Acceptance criteria:
  - [ ] Publish is gated behind a checklist the analyst affirms: (a) every observation ends in a verdict, not a raw number, (b) every closing action names a verb + context + time-horizon, (c) no statistical notation appears anywhere in user-facing copy (no σ, no "p-value", no percentile written as "p=").
  - [ ] The checklist is a human affirmation, not an automated scan — the plain-language guarantee at MVP is enforced by the analyst, consistent with Plain-Language Translation being a [basic] MVP feature (§9) and A-011 (no LLM validation).
  - [ ] Publishing records the affirming analyst identity, the checklist version, and the timestamp in the brief's publish metadata (storage model owned by [ADR-0002](../engineering/adr-0002-brief-storage-and-delivery.md)).

### US-6 — Analyst publishes a brief and it becomes available to downstream delivery
**As a** ČS analyst, **I want** a single publish action that hands the finished brief to the downstream delivery pipeline, **so that** the brief can be rendered to owners via email, web, and PDF without any further editorial step.

- Acceptance criteria:
  - [ ] Publish emits a single versioned brief artifact (the storage model and versioning are owned by [ADR-0002](../engineering/adr-0002-brief-storage-and-delivery.md)).
  - [ ] Publish does not itself send email, render PDF, or notify owners; it only marks the brief available. Distribution is the Multi-Format Delivery feature's concern (Track C — `multi-format-delivery`).
  - [ ] Publishing is not scheduled; there is no future-dated publish time picker in the authoring tool (B-001 / A-005). Publishing is "now or not yet."
  - [ ] A published brief can be superseded by a new version authored through the same workflow; supersession is a new publish event against the same (NACE sector, cycle) key. Prior versions are retained per [ADR-0002](../engineering/adr-0002-brief-storage-and-delivery.md) — retention is storage's concern, not product's.

### US-7 — Analyst saves a draft and returns to it later
**As a** ČS analyst, **I want** to save a brief-in-progress and resume editing later, **so that** I can spread authoring across sessions without losing work.

- Acceptance criteria:
  - [ ] Draft saves are manual (explicit save action) plus auto-save on a sensible interval; the interval specification is an engineering detail.
  - [ ] A draft is visible only to the analyst who created it (or to an authorized analyst role — role model owned by engineering); it is never visible on any owner-facing surface.
  - [ ] A draft that has not been published has no downstream effect: no row lands in the brief delivery pipeline, no cohort flags, no email queue entry.

## 4. Scope

- **In scope (MVP):**
  - A ČS-analyst-facing authoring back-end for composing sector briefs, keyed one-per-NACE-sector.
  - Enforcement of the six-component structure, 2–4 observation count, 2–4 closing action count, the four canonical D-011 benchmark categories, and the eight D-003 ratios.
  - Three-surface preview (email / web / PDF).
  - Email-teaser selection (one observation, optional one snippet).
  - Publish-time plain-language / verdict-first affirmation checklist.
  - Single-action publish handing a versioned artifact to downstream delivery.
  - Draft save / resume for work-in-progress briefs.

- **Out of scope (explicit markers):**
  - **Automated brief generation.** No LLM-generated narrative, no templated auto-fill beyond the structural scaffolding (component slots, category list, time-horizon tag enum). Per [CLAUDE.md "No automated brief generation at MVP" guardrail](../../CLAUDE.md) and [A-011](assumption-log.md). LLM-generated briefs are an Increment 4 scope item per PRD §9.
  - **Cadence UI or scheduling.** No "publish on X date" picker, no recurring-schedule configuration, no cadence promise copy fields exposed in the editor. Per [B-001](../project/backlog.md) / [A-005](assumption-log.md) / [D-005](../project/decision-log.md). The authoring tool is ad-hoc-publish-only.
  - **Accountant / advisor sharing.** No share-link generator, no guest-view provisioning, no advisor seat assignment from within the authoring tool. Per [B-002](../project/backlog.md) / [D-009](../project/decision-log.md) / [A-009](assumption-log.md). Owners may manually forward the PDF.
  - **LLM-generated content anywhere in the authoring surface.** Including assistive drafting, suggestion popups, or "improve this sentence" features. Per [A-011](assumption-log.md) and PRD §9 (Increment 4 scope).
  - **Multi-format rendering and delivery.** Email send, PDF generation, web view rendering. These are the separate Track C feature — see [build-plan.md §5 Track C](../project/build-plan.md) and the (forthcoming) `multi-format-delivery` feature PRD. The authoring feature stops at "publish the artifact."
  - **Give-to-get capture.** No data-collection UI for owners, no missing-field prompts triggered from the authoring flow. Per [A-013](assumption-log.md) / CLAUDE.md guardrail.
  - **RM-visible content.** No surface here emits rm_visible-lane content; per [D-002](../project/decision-log.md) / [A-002](assumption-log.md).
  - **Cohort math.** Percentile computation, quartile assignment, statistical-validity floor enforcement are the Track B features (`percentile-position-calculation`, `quartile-position-display`, `category-based-layout`) and are owned upstream by [docs/data/cohort-math.md](../data/cohort-math.md). The authoring tool reads precomputed quartile / verdict values for the ratios it exposes; it does not compute them.
  - **Non-NACE-sector brief keys.** No per-size-band brief, no per-region brief, no cross-sector brief at MVP. Per [D-006](../project/decision-log.md) / [A-006](assumption-log.md).
  - **English-language authoring.** Per [D-004](../project/decision-log.md) / [A-004](assumption-log.md).

- **Increment:** MVP (Increment 1) — pulled forward from Increment 3 per PRD §9.

## 5. Success metrics

Ties to PRD §6 and the three ČS business goals. Because this feature is the analyst's workflow (not the owner's), direct product metrics are upstream-enabling: if this workflow does not produce publishable briefs, the entire G1 engagement metric family cannot be measured.

- **Publish success rate (authoring-side)** — share of brief authoring sessions that reach publish vs. abandoned drafts. Direction: up-and-right within a reasonable range. *How measured:* internal instrumentation on the authoring back-end; count publish events vs. draft creations per analyst per cycle.
- **Time-to-publish per brief (authoring-side)** — median analyst minutes from "new brief" to "published," per NACE sector. Direction: down over time as the workflow matures, but no target set for MVP trial (<1 month window per [A-010](assumption-log.md)). *How measured:* internal instrumentation.
- **Enables PRD §6 Goal 1 metrics downstream** — monthly brief open rate, time spent per brief, observation click-through, MAU, return-visit rate. These are not measured in this feature but are unmeasurable in its absence. The direct linkage is: no publish → no delivery → no open → no engagement metric.
- **Analyst-authored publish-checklist affirmation rate** — share of publishes where every checklist item was affirmed (expected: 100%, since publish is blocked otherwise). A monitoring signal rather than a target; a drop below 100% would indicate the checklist gating is broken.
- **Zero automated-generation escapes** — monitoring-only; alert if any publish event carries a generation-source flag other than "analyst-typed." Protects [A-011](assumption-log.md) at runtime.

## 6. Non-negotiables

Principles from PRD §7 that bind every implementation decision downstream:

- **§7.1 Briefs are the atomic unit of value.** This feature's sole output is the brief artifact; it does not emit benchmark standalones, dashboards, or partial renderings. Every acceptance criterion in §3 converges on "a publish produces a brief, nothing else."
- **§7.2 Verdicts, not datasets.** Enforced via the publish-time checklist (US-5). The authoring surface never asks the analyst to enter a raw percentile without an accompanying verdict; BenchmarkSnippet props per [information-architecture.md §4.3](../design/information-architecture.md) require `quartileLabel` and `verdictText` together or `confidenceState !== 'valid'`.
- **§7.3 Plain language, no jargon.** The checklist affirms absence of statistical notation. At MVP there is no automated plain-language validator (A-011); the analyst owns the plain-language guarantee at authoring time.
- **§7.4 Proof of value before anything else.** The authoring tool must not introduce a configuration step that prevents a first brief from being published; e.g., no global "set up your cohort dictionary" wizard before brief-1 can be drafted. The cohort list is pre-populated (D-001).
- **§7.5 Privacy as product.** The authoring surface lives in the `brief` lane only (per [privacy-architecture.md §2](../data/privacy-architecture.md)). It reads cohort-level precomputed values for embedded snippets (via `cohort_stats` treated as brief-lane-distributable, per privacy-architecture.md §3), never per-user rows. It never embeds a per-user identifier in a brief artifact.
- **§7.6 Opportunity-flavored, not risk-flavored.** Even though no RM surface is emitted at MVP, the authoring tool must not expose a "risk flag" / "credit concern" / "watchlist" field for future RM piping. A future RM surface (Increment 2+) requires new consent and a new decision (per [A-016](assumption-log.md)); this feature does not prefigure it.
- **§7.7 Bank-native distribution.** Authoring runs behind ČS-analyst auth (owned by engineering); the authored artifact must be structured for George Business WebView as primary delivery (per [information-architecture.md §2b](../design/information-architecture.md)).
- **§7.8 Every interaction is a data-acquisition opportunity — in mind, not in build.** The authoring surface itself is analyst-facing and does not gather owner data. No give-to-get field ever appears in an authored brief at MVP (A-013).

## 7. Open questions

Numbered; all also flagged in the return message for orchestrator transcription into `docs/project/open-questions.md`.

1. **Q-MBG-001 — Intended PRD reference for §8.6.** The orchestrator brief cites PRD §8.1 and §8.6 as upstream sections; the PRD's §8 enumerates only §8.1 through §8.5. Either §8.6 is a typo for §8.1 (already cited and sufficient), or a future PRD revision will add §8.6 specifically for the analyst authoring back-end. Flagged for orchestrator to confirm.
2. **Q-MBG-002 — Analyst role model and multi-analyst collaboration semantics.** This PRD assumes a single-analyst-per-brief editing model. Whether MVP needs concurrent multi-analyst editing, an editor / reviewer split, or a simple last-writer-wins rule is not decided. Downstream to engineer's authoring back-end ADR.
3. **Q-MBG-003 — Supersession and rollback UX for a published brief.** US-6 allows re-publishing a new version against the same (NACE sector, cycle) key, but does not specify the UX for rollback (revert to prior published version) or the rules for superseding an already-delivered email. This likely interacts with multi-format-delivery Track C and storage ADR-0002; flagged for cross-feature reconciliation.
4. **Q-MBG-004 — Canonical "cycle" key under B-001 (no cadence commitment).** A brief is one-per-NACE-sector-per-cycle, but MVP explicitly makes no cadence promise to users. The "cycle" concept is needed internally for versioning / supersession, but must not surface as user-visible cadence copy. Confirming whether "cycle" is a month-label (editorial convention) or an internal counter is an engineering / editorial concern, flagged for ADR-0002 alignment.
5. **Q-MBG-005 — Confidentiality notice text ownership.** The PDF footer confidentiality notice in information-architecture.md §3 Surface C is part of the authored brief artifact; whether the analyst can edit this text per brief, or whether it is a system-level constant, is undecided. Likely a system constant (legal consistency), but needs designer + legal alignment.
6. **New glossary term candidate — "Brief artifact."** A brief as a versioned, published, delivery-ready object (distinct from "sector brief" the user-facing concept). Not added to the glossary here per the orchestrator brief's constraint (concurrent PM writers); flagged in the return message for orchestrator to batch.

## 8. Downstream artifacts

- **Design**: `docs/design/monthly-briefing-generation/` — not yet drafted. Will cover the analyst-facing authoring UX (editor layout, preview toggle, publish checklist screen, draft list view). The owner-facing rendering is already covered by [docs/design/information-architecture.md](../design/information-architecture.md) and is not in this feature's design scope.
- **Data**: Not applicable — no new data model. This feature reads from `brief_db` (authored content) and reads cohort-level precomputed values from `cohort_stats` per [privacy-architecture.md §3](../data/privacy-architecture.md). Existing lane boundaries and the consent ledger are sufficient; no addendum to `docs/data/` is required. If engineering discovers a storage-schema need beyond [ADR-0002](../engineering/adr-0002-brief-storage-and-delivery.md), data-engineer will add an addendum and link here.
- **Engineering**: `docs/engineering/monthly-briefing-generation.md` — not yet drafted. Will cover the authoring-back-end implementation (storage schema extensions if any beyond ADR-0002, analyst auth, draft / publish state machine, preview rendering pipeline, auto-save cadence, checklist enforcement).

## Changelog

- 2026-04-20 — initial draft — product-manager
