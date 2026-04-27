# Action Specificity Framing

*Owner: product-manager · Slug: action-specificity-framing · Last updated: 2026-04-20*

## 1. Summary

Action Specificity Framing is the rule set that shapes the **2–4 closing actions** appearing at the end of every sector brief. Each action is a single, owner-legible instruction composed of an **action verb + context + time-horizon tag**, drawn from a fixed four-value time-horizon taxonomy. This feature closes the verdict loop — without it, briefs are sector commentary rather than a product the owner can act on this week.

## 2. Upstream links

- **PRD sections**:
  - [PRD §7.2 Verdicts, not datasets](../../PRD/PRD.md#7-product-principles) — actions are the terminal verdict of a brief; without an action the brief stops at commentary.
  - [PRD §7.3 Plain language, no jargon](../../PRD/PRD.md#7-product-principles) — actions must read like the owner's accountant speaking; no analyst vocabulary, no statistical notation.
  - [PRD §7.4 Proof of value before anything else](../../PRD/PRD.md#7-product-principles) — the first-session brief must end in actions that feel specific enough to execute on.
  - [PRD §8.1 Sector Briefing Engine](../../PRD/PRD.md#81-sector-briefing-engine--what-this-means-for-you-primary-mvp) — "2–4 specific, time-horizon-tagged actions" is the MVP contract for the closing section.
  - [PRD §9 Release Plan — Action Specificity Framing \[basic\]](../../PRD/PRD.md#9-release-plan) — named MVP feature; "action-verb + context + timeframe template per observation."
  - [PRD §13.1 Brief production scaling](../../PRD/PRD.md#13-risks-and-open-questions) — action schema must be tractable for human analysts authoring at scale across priority cohorts.
- **ČS business goals served**:
  - **G1 Engagement** — actions are the single most-measured engagement signal per PRD §6 Goal 1 ("click-throughs on the 2–4 closing actions; share-to-advisor/accountant rate"). If the closing section reads as generic commentary, the engagement KPI collapses.
  - **G2 Data depth and cadence** — indirect. Actions that read as specific-to-the-owner's-cohort reinforce the habit anchor that keeps owners returning; return visits are a prerequisite for later give-to-get data capture (A-013). No direct data-capture surface is introduced here (see §4 Out of scope).
  - **G3 RM lead generation** — not served at MVP. RM lead signals are deferred ([D-002](../project/decision-log.md), [A-002](assumption-log.md)); actions must not be framed as "share this with your RM" or otherwise pre-bake RM routing into copy.
- **Related decisions**:
  - [D-003 MVP metric list](../project/decision-log.md) — actions must be expressible using the eight ratios (plus qualitative sector observations); no action may require a metric outside this set.
  - [D-004 Czech only at MVP](../project/decision-log.md) — all action copy is Czech; time-horizon tag values are Czech strings (see §4.1).
  - [D-005 No cadence commitment to users](../project/decision-log.md) / [B-001](../project/backlog.md) — actions must not contain "next month we'll…" copy or any rhythm promise.
  - [D-006 Sector-only personalization grain](../project/decision-log.md) — actions are calibrated per NACE sector, not per owner. See §4 In/Out of scope.
  - [D-009 No advisor sharing infrastructure](../project/decision-log.md) / [B-002](backlog-ref) — actions must not instruct the owner to "share this with your accountant via the app"; manual PDF forwarding is the only sharing path.
- **Upstream assumptions the feature relies on**:
  - [A-003](assumption-log.md) — eight-ratio metric surface.
  - [A-005](assumption-log.md) — no cadence commitment; action copy must hold under this.
  - [A-006](assumption-log.md) — sector-grain personalization.
  - [A-011](assumption-log.md) — human-authored; action rules must be executable by an analyst without automation.
  - [A-013](assumption-log.md) — no give-to-get capture; actions may not request owner data inside the brief.

## 3. User stories

- As **The Exposed Owner**, I want each brief to end with a handful of concrete things I could do this month or this quarter, so that I can decide what (if anything) to change in my business without re-reading the whole document.
  - Acceptance criteria:
    - [ ] Every published brief ends with between 2 and 4 action items (inclusive, bounds enforced). A brief with 0, 1, 5, or more actions is rejected by the authoring back-end before publish.
    - [ ] Each action item contains exactly three parts, in this order: (1) an **action verb** (imperative), (2) a **context clause** (what to do it to / about), (3) a **time-horizon tag** (one of the four taxonomy values in §4.1).
    - [ ] No action uses statistical notation, percentile language, or analyst vocabulary. The `plain-language-translation` rule set (see [plain-language-translation.md](plain-language-translation.md) once landed) is applied to action copy.
    - [ ] No action contains numerical claims the brief has not supported in the Opening Summary or Observations sections (no new evidence introduced at the action stage).
    - [ ] Action copy is Czech ([D-004](../project/decision-log.md)); formal register, vykání.

- As **The Bank-Referred Passive Adopter**, I want actions that feel tied to the sector commentary I just read, so that the brief earns a second open next cycle.
  - Acceptance criteria:
    - [ ] Every action in a brief traces back to at least one Observation in the same brief. Orphan actions (actions without a linked observation) are rejected by the authoring back-end.
    - [ ] Action copy does not name the owner, the owner's company, or any owner-supplied detail. Personalization is at NACE sector grain only ([D-006](../project/decision-log.md), [A-006](assumption-log.md)).
    - [ ] The time-horizon mix across the 2–4 actions is not all "Více než rok" — at least one action carries a tag of "Okamžitě", "Do 3 měsíců", or "Do 12 měsíců". Rationale: actions that are all long-horizon read as commentary.

- As a **ČS analyst authoring briefs**, I want an explicit action schema and a rejection feedback loop, so that I can author a compliant closing section without guessing what "specific enough" means.
  - Acceptance criteria:
    - [ ] The analyst authoring back-end exposes four fields per action: `action_verb`, `context`, `time_horizon`, `linked_observation_id`. No free-text "action paragraph" field is provided.
    - [ ] `time_horizon` is a closed enum over the four values in §4.1; the authoring back-end rejects any other value.
    - [ ] Pre-publish validation runs all §6 Non-negotiable rules. Each violation surfaces a plain-language rejection message with the offending rule ID.

## 4. Scope

### In scope

- **Action schema.** Every action = `action_verb` + `context` + `time_horizon` + `linked_observation_id`. This is the structural contract between the analyst authoring back-end and every delivery surface (web view, PDF, email optional — see §4 out-of-scope note on email actions).
- **Time-horizon taxonomy.** Closed four-value enum, Czech user-facing strings:
  1. **Okamžitě** — this week to this month. Things the owner can start or decide before the next monthly cycle.
  2. **Do 3 měsíců** — within the current quarter.
  3. **Do 12 měsíců** — within the current year.
  4. **Více než rok** — multi-year / strategic horizon.
  (Rationale: these four values are already fixed in [information-architecture.md §2 and §4.2](../design/information-architecture.md) for the ObservationCard component. Reusing them keeps observations and actions on a single horizon vocabulary — an owner sees the same four tags throughout the brief.)
- **Number-of-actions bound.** 2 ≤ count ≤ 4 per brief. Enforced at author-time (authoring back-end rejects out-of-bounds publish) and at render-time (delivery surfaces refuse to render a brief whose actions count is out of bounds).
- **Action-to-observation linkage.** Each action must carry a `linked_observation_id` pointing to one of the 2–4 observations in the same brief. One observation may have multiple actions; an action may link to exactly one observation. Orphan actions are rejected.
- **Plain-language compliance.** The action text (verb + context) passes the `plain-language-translation` rule set: no statistical notation, no analyst vocabulary, no raw percentiles, no metric IDs. Written like the owner's accountant speaking.
- **Evidence-containment rule.** The action text does not introduce new numerical claims, sector data, or benchmark positions that the brief's Observations and Embedded benchmark snippets did not already carry. Actions synthesize — they do not source.
- **Time-horizon-mix rule.** At least one action in the 2–4 set carries a non-"Více než rok" tag. Rationale: all-long-horizon sets read as commentary, not product output.
- **Rejection messages.** The authoring back-end surfaces machine-checkable validation errors keyed to §6 non-negotiable rule IDs (AC-N1 through AC-N7). Each message is plain-language Czech for the analyst's surface.

### Out of scope

- **Personalized per-owner actions** — would require user-contributed data (income-statement detail, owner strategy preferences, etc.). Forbidden at MVP by [A-013](assumption-log.md) (no give-to-get capture); reopens in Increment 3 when the Additional Customer Information Gatherer ships (PRD §9).
- **Cross-brief action tracking, follow-through, or completion UI** — no "mark as done", no "actions from last month", no action history surface. Scheduled for Increment 2+ (PRD §9 Increment 2 — Continuous Monitoring features: Alert History Log, Historical Position Tracking). Re-reading old briefs remains possible via PDF archive (owner's own storage).
- **Action recommendations generated by a model** — A-011 forbids automated generation at MVP; actions are authored by ČS analysts. Templated scaffolding is allowed (e.g., an analyst-back-end library of verb + context stems per sector); generation is not.
- **Actions in the email surface.** Per [information-architecture.md §4.5 ActionItem](../design/information-architecture.md) the email surface omits closing actions to stay within the 400-word budget. Actions are rendered only in the web view and PDF surfaces. An email reader sees the single top-priority observation plus the CTA to "Přečíst celý přehled" — the full action set lives behind that CTA.
- **Actions that instruct the owner to share the brief, invite an advisor, or involve an RM.** D-002 defers RM surfaces; D-009 defers advisor sharing. Copy like "share this with your RM" or "invite your accountant in-app" is prohibited. Copy like "diskutujte s vaším účetním" (discuss with your accountant — as a manual next step, no in-product infrastructure) is permitted because it does not imply a product flow.
- **Actions that reference metrics outside the MVP eight** ([A-003](assumption-log.md)). The authoring back-end does not validate metric references inside free-text context clauses directly (see §7 open question Q-ASF-002), but editorial guidelines forbid naming ratios outside D-003.
- **Machine-readable action taxonomy** (e.g., "expansion / cost-cutting / risk-mitigation" category tags for analytics). Not part of MVP; may be added later for engagement-metric slicing.

### Increment

**MVP** (Increment 1 per PRD §9). Feature is a named MVP line item.

## 5. Success metrics

All metrics tie to [PRD §6](../../PRD/PRD.md#6-success-metrics); this feature's leading indicators are Goal 1 (Engagement).

| Metric | PRD §6 origin | Target direction | Measurement |
|---|---|---|---|
| **Closing-action click-through rate** | G1 "Observation engagement — click-throughs on the 2–4 closing actions" | Higher is better; no hard target at MVP (establishing baseline). Target: every published brief has at least one click-through observed during the trial window. | Web view instruments a click/tap event per ActionItem on first interaction; email analytics do not apply (actions not in email surface). |
| **Time-horizon-mix adherence** | Internal — operationalizes PRD §7.2 verdicts-over-commentary | 100% of published briefs satisfy §4 time-horizon-mix rule (at least one non-"Více než rok" tag). | Authoring back-end validation log; pre-publish reject rate > 0 acceptable, post-publish violations = 0. |
| **Action count adherence** | Internal — operationalizes PRD §8.1 "2–4 actions" | 100% of published briefs have 2 ≤ actions ≤ 4. | Authoring back-end enforcement; pre-publish rejection count is the only allowed error mode. |
| **Orphan-action rate** | Internal — operationalizes §4 action-to-observation linkage | 0% of published briefs contain an action without a linked observation. | Authoring back-end validation; structural constraint. |
| **Plain-language compliance on action copy** | G1 + PRD §7.3 | No published action contains statistical notation, raw percentiles, or analyst vocabulary. | Author-time check via `plain-language-translation` rule set; manual spot-check during Phase 3 rehearsal. |
| **Time-to-first-verdict contribution** | PRD §6 cross-cutting activation — <60s for bank-referred | Actions must render in the web view within the first brief view; no lazy-load or "see more actions" pattern. | Designer flow + engineer measurement in Phase 3. |

Proof-of-insight rate (PRD §6 cross-cutting) cannot be directly attributed to actions alone; measurement is brief-level.

## 6. Non-negotiables

Per [PRD §7](../../PRD/PRD.md#7-product-principles) principles. Each rule is author-time-enforceable and rejection-messaged. IDs are stable and referenced by the authoring back-end's validation layer.

| ID | Rule | Principle |
|---|---|---|
| **AC-N1** | Action count is in the closed interval [2, 4]. | §7.2 Verdicts, not datasets (zero or one action is not a verdict; five+ is a dataset). |
| **AC-N2** | Each action has a non-empty `action_verb`, a non-empty `context`, exactly one `time_horizon` enum value from §4.1, and a non-null `linked_observation_id` resolving within the same brief. | §7.2; §8.1 action-verb + context + time-horizon schema. |
| **AC-N3** | The `time_horizon` enum value is one of: `okamzite`, `do_3_mesicu`, `do_12_mesicu`, `vice_nez_rok`. The user-facing Czech string values are rendered per [information-architecture.md §4.2](../design/information-architecture.md). No other value accepted. | §8.1; reuses the already-locked taxonomy in the IA. |
| **AC-N4** | At least one action in the set has a `time_horizon` other than `vice_nez_rok`. | §7.2 — actions all-at-multi-year-horizon are commentary, not product output. |
| **AC-N5** | Action copy (verb + context concatenated) passes the `plain-language-translation` rule set when it lands: no statistical notation (e.g., "p < 0.05", "σ", "IQR"), no raw percentiles as numbers ("34. percentil"), no metric IDs, no analyst vocabulary. "Named quartile" references are permitted because they are already the verdict-form in the embedded benchmark snippets (see [glossary — Verdict](glossary.md)). | §7.3 Plain language. |
| **AC-N6** | Action copy does not introduce new numerical claims, sector data, or benchmark positions absent from the brief's Opening Summary, Observations, or Embedded benchmark snippets. | §7.2 — actions synthesize; they do not source. |
| **AC-N7** | Action copy does not name the owner, the owner's company, the RM, or any give-to-get data capture flow. Copy may reference the owner's accountant as an external human next step. Copy may not instruct the owner to use a ČS product other than what a brief already supports, and may not reference credit products in any way. | §7.5 privacy; §7.6 opportunity-flavored (no credit framing); [D-002](../project/decision-log.md), [D-009](../project/decision-log.md), [A-013](assumption-log.md), [A-016](assumption-log.md). |

**Enforcement layering** (who checks what):
- Authoring back-end (engineer's `docs/engineering/action-specificity-framing.md`) enforces AC-N1, AC-N2, AC-N3, AC-N4 structurally at publish time.
- The `plain-language-translation` rule set (parallel PM feature `plain-language-translation.md`, parallel engineering implementation) checks AC-N5 automatically where possible; the rest is analyst editorial self-check with spot review.
- AC-N6 and AC-N7 are primarily editorial — the authoring back-end cannot deterministically check "no new numerical claims" without semantic understanding; process-layer review in Phase 3 rehearsal. See §7 Q-ASF-002.

## 7. Open questions

Each question is logged in [`docs/project/open-questions.md`](../project/open-questions.md) under the same `OQ-` ID by the orchestrator at the next gate; the local `Q-ASF-NNN` IDs are placeholders until transcription.

1. **Q-ASF-001 — "Linked observation" cardinality and de-duplication.** Can two actions in the same brief share the same `linked_observation_id`? The schema in §4 allows it (one observation → many actions); editorial question: does having two actions off the same observation dilute the observation's weight, or is it a legitimate way to split an action across time horizons (e.g., "Okamžitě" plus "Do 3 měsíců" off the same observation)? Proposed default: allowed, but the 2–4-action bound still applies. *Blocking*: editorial guidance for analysts; not blocking for back-end schema design.

2. **Q-ASF-002 — AC-N6 semantic-check feasibility.** Can the authoring back-end deterministically detect "new numerical claim in action copy that is absent from Observations / Opening Summary"? Options: (a) defer to Phase 3 manual review; (b) engineer a naive numeric-regex check that rejects any numbers in action copy and force analysts to phrase actions qualitatively; (c) require actions to be composed only from a fixed verb + qualitative-context library per sector. Proposed default: (a) at MVP, with (b) as a lightweight guardrail. *Blocking*: engineer's validation scope in `docs/engineering/action-specificity-framing.md`.

3. **Q-ASF-003 — Observation→action coverage rule.** Must *every* observation be linked to at least one action, or may some observations exist without a corresponding action (i.e., the observation is informational-only)? Current §4 rule is one-way (each action must link to an observation; not every observation must have an action). PRD §8.1 is silent. Proposed default: one-way (current); this allows an analyst to include a "watch this" observation without forcing a paired action when nothing concrete follows. *Blocking*: editorial guidance; not blocking for back-end schema.

4. **Q-ASF-004 — Action copy character/word budget.** No length bound is specified. Overly long actions read like paragraphs; overly short ones lose the context clause. Candidate rule: action text (verb + context) is 6–24 words in Czech. Proposed default: soft guideline in editorial docs; no hard enforcement at MVP. *Blocking*: designer copy spec in `docs/design/action-specificity-framing/`.

5. **Q-ASF-005 — Telemetry event name + payload for click-through measurement.** PRD §6 G1 names "click-throughs on the 2–4 closing actions" as a KPI. Event schema (event name, payload fields, PII posture) is an engineering + designer concern. Proposed default: named event `brief.action.tap` with payload `{brief_id, action_index, time_horizon}` — no owner identifier, no action text. *Blocking*: engineering telemetry spec; not blocking for this PRD.

## 8. Downstream artifacts

- **Design**: `docs/design/action-specificity-framing/` — not yet drafted. Expected contents: closing-section layout in web view + PDF (already scaffolded in [information-architecture.md §3 Surface B, §4.5 ActionItem](../design/information-architecture.md)), analyst authoring-back-end UI for the four action fields + rejection messages, time-horizon pill styling (reused from Observations), empty/error states, accessibility checklist.
- **Data**: not applicable — this feature introduces no new metric, cohort computation, or data-lane flow. Actions are pure authored content inside the brief data lane ([A-015](assumption-log.md)). The `plain-language-translation` sibling PRD owns the translation rule set; this PRD consumes it.
- **Engineering**: `docs/engineering/action-specificity-framing.md` — not yet drafted. Expected contents: authoring-back-end schema (`action_verb: string`, `context: string`, `time_horizon: enum`, `linked_observation_id: FK`), publish-time validation layer enforcing AC-N1 through AC-N7, render-time bound recheck on web view + PDF, telemetry event spec per Q-ASF-005.
- **Sibling PRDs (authored in parallel, may not yet be visible)**:
  - `docs/product/observation-generation.md` — defines the Observations component that actions link to via `linked_observation_id`. Action schema here assumes each observation carries a stable ID within a brief; the observation-generation PRD owns the ID assignment contract. If the parallel PRD lands with a different contract, this PRD's §4 "action-to-observation linkage" rule and AC-N2 need a reconciliation pass.
  - `docs/product/plain-language-translation.md` — owns the rule set invoked by AC-N5. This PRD consumes; it does not duplicate.
  - `docs/product/monthly-briefing-generation.md` — owns the analyst authoring back-end surface. Action validation (§6 non-negotiables) is enforced inside that surface.

## Changelog

- 2026-04-20 — initial draft — product-manager
