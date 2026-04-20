# Sector Profile Configuration

*Owner: product-manager · Slug: sector-profile-configuration · Last updated: 2026-04-20*

## 1. Summary

Sector Profile Configuration is the onboarding capture of the three fields that make an owner legible to the product: **NACE sector**, **employee size band**, and **Czech region**. For the bank-referred path these fields arrive pre-populated from George Business and the owner only confirms; for the secondary direct sign-up path the owner selects them. The completed profile (a) fixes the owner's cohort membership under [D-001](../project/decision-log.md) hand-assignment and (b) selects which sector brief (NACE-only grain per [D-006](../project/decision-log.md)) the owner receives. No other profile data is captured at MVP.

## 2. Upstream links

- PRD sections:
  - [§3 Target Users](../../PRD/PRD.md#3-target-users) — both personas (Exposed Owner, Bank-Referred Passive Adopter) are served; the 14-day proof-of-insight window for the Exposed Owner begins when the profile is settled.
  - [§9 Release Plan — Sector Profile Configuration [basic]](../../PRD/PRD.md#9-release-plan) — this feature is the named MVP entry; Bank Data Pre-Processing and Additional Customer Information Gatherer are explicitly Increment 3 and out of scope here.
  - [§10 Cohort segmentation](../../PRD/PRD.md#10-data-and-technical-foundation) — NACE / size band / Czech region are the three partition dimensions this feature captures.
  - [§11 Go-to-Market](../../PRD/PRD.md#11-go-to-market) — bank-referred is primary (George Business embedding, RM introduction); direct sign-up is secondary.
  - [§7.4 Proof of value before anything else](../../PRD/PRD.md#7-product-principles) — no configuration gate beyond these three fields before first brief.
  - [§7.5 Privacy as product](../../PRD/PRD.md#7-product-principles) — the captured fields enter the `user_contributed` lane only; consent gate precedes capture-to-storage.

- ČS business goals served:
  - **G1 Engagement** — a settled profile is what makes the first brief land as "my sector, my size, my region" rather than generic content; it is the precondition for a brief to trigger proof-of-insight in the 14-day window ([PRD §3](../../PRD/PRD.md#3-target-users), [§6 cross-cutting activation](../../PRD/PRD.md#6-success-metrics)).
  - **G2 Data depth and cadence** — the three fields are the minimum "legible-user" data shape; without them the owner cannot be placed in a cohort cell ([assumption A-003](assumption-log.md); [cohort-math.md §2](../data/cohort-math.md)). Captured in the `user_contributed` lane per [privacy-architecture.md §2](../data/privacy-architecture.md).
  - **G3 RM lead generation** — not served at MVP ([D-002](../project/decision-log.md), [assumption A-002](assumption-log.md)). The profile fields will be upstream of future opportunity-flavored signals in Increment 2+, but no RM-visible derivation occurs at MVP.

- Related decisions:
  - [D-001](../project/decision-log.md) — cohort assignment is hand-done on the pre-populated seed; this feature's **confirmation** step is what activates that hand-assignment for the bank-referred owner, and its **selection** step is what creates it for the direct sign-up.
  - [D-002](../project/decision-log.md) — no RM lane at MVP; nothing captured here is routed to RMs.
  - [D-004](../project/decision-log.md) — all user-facing copy is Czech only.
  - [D-006](../project/decision-log.md) — briefs are personalized at NACE grain only; size and region bind the embedded-snippet cohort cell but do not branch the brief.
  - [D-007](../project/decision-log.md) / [D-008](../project/decision-log.md) — single opt-in via the single-screen consent declaration. Consent precedes the first brief view; profile confirmation/selection happens alongside, per the flow in §3.
  - [D-010](../project/decision-log.md) — canonical lane identifier for the three captured fields is `user_contributed`.
  - [D-012](../project/decision-log.md) — revocation is stop-future-flow only; profile rows persist post-revocation.
  - [D-013](../project/decision-log.md) — Supabase Postgres is the `user_db` substrate.

## 3. User stories

### US-1 — Bank-referred owner confirms a pre-populated profile

As a Bank-Referred Passive Adopter arriving from George Business, I want to see my sector, size, and region already filled in and only confirm (or correct) them, so that I reach my first brief in under 60 seconds without configuration work.

Acceptance criteria:
- [ ] On first entry from George Business, the three fields (NACE sector, employee size band, Czech region) are pre-populated from the `user_ingest_prepopulated` source ([privacy-architecture.md §3](../data/privacy-architecture.md)) and each is shown with its current value.
- [ ] The owner can proceed with a single primary action ("confirm and continue" — exact Czech copy owned by designer) without editing any field.
- [ ] If any of the three fields is missing from the pre-populated record for this owner, the flow falls through to the direct-sign-up selection UI for the missing field(s) only; pre-populated fields are not re-asked.
- [ ] The owner may correct any field before confirming. Correction replaces the value in the `user_contributed` lane; the original pre-populated value is not retained as a shadow field at MVP.
- [ ] Confirmation is recorded as a single event — no multi-step wizard. The owner cannot reach the brief with any of the three fields unset.
- [ ] Time from George card tap to first brief view is ≤ 60 seconds for a pre-populated owner who accepts defaults (PRD §6 cross-cutting activation). Measurement owned by engineer; product-side acceptance is that the flow contains no blocking step beyond the consent screen ([D-008](../project/decision-log.md)) and this confirm.
- [ ] No additional fields (headcount, revenue, financial figures, owner name, company name, etc.) are asked at MVP. Attempts to add a field require a new decision-log row ([assumption A-013](assumption-log.md)).

### US-2 — Direct sign-up owner selects sector, size, and region

As an Exposed Owner arriving via direct sign-up, I want to select my NACE sector, employee size band, and Czech region in a single short form, so that I can see my first relevant brief within my 14-day evaluation window without being asked for financial or operational data.

Acceptance criteria:
- [ ] The form presents exactly three selection controls: NACE sector, employee size band, Czech region. No other fields.
- [ ] NACE selection surfaces 2-digit divisions as the default grain ([cohort-math.md §2.1](../data/cohort-math.md)). Any 3-digit override for specific divisions (see [OQ-018](../project/open-questions.md) — deferred) appears as a secondary refinement inside the same control; at MVP the override set is empty and the secondary refinement is not shown.
- [ ] Size band options are the three bands from [cohort-math.md §2.2](../data/cohort-math.md): 10–24, 25–49, 50–100 employees. Firms outside 10–100 are out of persona scope; the UI informs the owner in plain Czech that Strategy Radar currently serves firms in this size range and does not advance them into the product. Exact copy owned by designer.
- [ ] Region options are the eight NUTS 2 regions from [cohort-math.md §2.3](../data/cohort-math.md), in Czech.
- [ ] All three fields are required; the primary action is disabled until all three are selected.
- [ ] Submission writes one row per field to the `user_contributed` lane, gated by the consent event captured on the preceding consent screen ([privacy-architecture.md §4](../data/privacy-architecture.md)).
- [ ] Time to first verdict target is <15 minutes end-to-end for direct sign-up (PRD §6); product-side acceptance is that the selection form alone contains no step that takes a median owner more than 2 minutes to complete.
- [ ] No financial, operational, or identity data is requested at any point in MVP onboarding. The form never grows, and degrading ratios (e.g., revenue per employee when headcount is missing) are handled by suppression in the brief, not by adding capture here ([mvp-metric-list.md constraint #5](mvp-metric-list.md)).

### US-3 — Owner with below-floor cohort cell still receives a brief

As any owner whose (NACE × size × region) cell falls below the statistical-validity floor, I want to still receive my sector brief with embedded snippets suppressed for the affected metrics, so that the product never gates my first verdict on cohort depth I cannot influence.

Acceptance criteria:
- [ ] Brief selection uses NACE only ([D-006](../project/decision-log.md)); the brief is delivered regardless of whether the finer (NACE × size × region) cell clears the floor.
- [ ] Size and region are nonetheless captured and stored — they bind the embedded-snippet cohort cell even when the cell is currently below the floor, so that the cell can later clear the floor without re-asking the owner ([cohort-math.md §3](../data/cohort-math.md)).
- [ ] Below-floor suppression is silent-to-the-user per [assumption A-017](assumption-log.md) and the [glossary definition](glossary.md#statistical-validity-floor-suppression-silent-to-user); this feature does not surface any "we need more peers in your cell" message during onboarding.
- [ ] Size and region are never used to refuse the owner access to the product; out-of-persona (outside 10–100 employees) is the only exclusion, and it is handled in US-2 AC-3.

### US-4 — Owner changes their mind on a profile field after first brief

As any onboarded owner, I want to correct a profile field (e.g., I picked the wrong NACE division) after seeing my first brief, so that my next brief is calibrated correctly without re-onboarding.

Acceptance criteria:
- [ ] A profile-edit surface exists (Settings; exact placement owned by designer and dependent on the Settings screen structure — [OQ-015](../project/open-questions.md)) that allows the owner to edit any of the three fields.
- [ ] Edits write a new row to the `user_contributed` lane per the existing consent event; no re-consent is triggered by a profile edit under the single-opt-in model ([D-007](../project/decision-log.md), [assumption A-007](assumption-log.md)).
- [ ] Edits take effect for the next brief selection and the next cohort-compute batch. Already-delivered briefs are not retroactively changed (consistent with [D-012](../project/decision-log.md) stop-flow-only semantics for revocation; the same append-only posture applies to profile edits).
- [ ] Profile edits are not a give-to-get surface — no new fields may be introduced here without a new decision-log row ([assumption A-013](assumption-log.md)).

## 4. Scope

- **In scope**:
  - NACE sector selection at 2-digit division grain, with the structural hook for per-division 3-digit override (override set is empty at MVP).
  - Employee size band selection from the three bands S1/S2/S3 defined in [cohort-math.md §2.2](../data/cohort-math.md).
  - Czech region selection from the eight NUTS 2 regions defined in [cohort-math.md §2.3](../data/cohort-math.md).
  - Two entry paths: **bank-referred** (pre-populated + confirm) and **direct sign-up** (select).
  - Hand-off to the consent gate owned by [`trust-and-consent-patterns.md`](../design/trust-and-consent-patterns.md) — this PRD links to the gate but does not redefine it.
  - Profile edit after onboarding (US-4).
  - Storage of the three fields in the `user_contributed` lane, gated by the consent event.

- **Out of scope**:
  - Any user-contributed data beyond sector / size / region (give-to-get — [assumption A-013](assumption-log.md); Increment 3 per [PRD §9](../../PRD/PRD.md#9-release-plan)).
  - Bank data ingestion — the `user_ingest_prepopulated` pipeline is the data-engineer's lane ([privacy-architecture.md §3](../data/privacy-architecture.md)); "Bank Data Pre-Processing [basic + advanced]" is explicitly Increment 3 ([PRD §9](../../PRD/PRD.md#9-release-plan)).
  - Account creation UI for bank-referred owners — George Business provides the authenticated session ([information-architecture.md §2b](../design/information-architecture.md)); Strategy Radar does not render a login or account-creation screen on that path.
  - Account creation UI for direct sign-up beyond what is minimally required to receive an email brief — email + password (or equivalent) is an engineer ADR decision, not a PM product decision; this feature does not add identity fields beyond that.
  - Advisor / accountant seat ([B-002](../project/backlog.md); [D-009](../project/decision-log.md)).
  - RM-visible derivation of the profile fields ([D-002](../project/decision-log.md)).
  - Consent UX itself — owned by [`trust-and-consent-patterns.md`](../design/trust-and-consent-patterns.md). This PRD names only the hand-off.
  - Onboarding personalization content (welcome messages, sector-specific tutorials, etc.) — briefs are the first content the owner sees ([PRD §7.1](../../PRD/PRD.md#7-product-principles), [assumption A-012](assumption-log.md)).
  - First-name capture for email greeting personalization — [OQ-013](../project/open-questions.md) tracks whether first name arrives in the pre-populated seed for bank-referred owners; this feature does not add a separate capture step for it.

- **Increment**: MVP ([PRD §9](../../PRD/PRD.md#9-release-plan) — "Sector Profile Configuration [basic]").

## 5. Success metrics

Tied to [PRD §6](../../PRD/PRD.md#6-success-metrics) and the cross-cutting activation metrics. This feature does not introduce new success KPIs; it is the prerequisite that lets existing KPIs fire.

| Metric | Direction | Measurement source |
|---|---|---|
| Time to first verdict — bank-referred path | ≤ 60 seconds (PRD §6) | Engineer instrumentation: timestamp from George-card tap to first brief render. Product-side acceptance is the flow-shape check in US-1 AC-6. |
| Time to first verdict — direct sign-up path | < 15 minutes (PRD §6) | Engineer instrumentation: timestamp from sign-up form load to first brief render. Product-side acceptance is the no-step-over-2-minutes check in US-2 AC-7. |
| Onboarding data completion | 100% of onboarded users have all three fields set | By construction — the flow does not permit reaching a brief with any field unset (US-1 AC-5, US-2 AC-5). Proxy for PRD §6 Goal 2 "onboarding data completion." Note: at MVP the bar is trivially met because the field set is minimum-viable; the metric becomes meaningful from Increment 3 when give-to-get capture expands the field set. |
| Profile-edit rate | Directionally informative; no target | Count of US-4 edits per onboarded owner per brief cycle. High rates suggest the pre-populated seed is miscoded or NACE selection UX is confusing; feeds into [OQ-018](../project/open-questions.md) (3-digit override list) and cohort-math §6.4. |
| Cohort-cell clearance rate per onboarded owner | Instrumented, not gated | Data-engineer-owned via [cohort-math.md §7.3](../data/cohort-math.md) (planning) / [OQ-020](../project/open-questions.md) (measured). This feature supplies the inputs; the floor math is owned downstream. |

## 6. Non-negotiables

Principles from [PRD §7](../../PRD/PRD.md#7-product-principles) that bind this feature:

1. **§7.4 Proof of value before anything else.** The onboarding flow must contain no configuration step beyond (consent gate) + (sector / size / region). Any proposed addition — even a toggle, even a "help us personalize" question — violates this principle and requires orchestrator approval and a new decision-log row. Concretely: no welcome survey, no brief-preference selector, no notification-channel picker, no metric-priority ordering, no tutorial modal ahead of the first brief.

2. **§7.5 Privacy as product.** The three captured fields enter the `user_contributed` lane and no other. The consent event ([D-007](../project/decision-log.md)) must be recorded before any of the three fields is written to storage — the storage write is downstream of the consent write in the same session. This is a pipeline ordering constraint, not a UX constraint, and is owned by engineer / data-engineer to implement; this PRD names it as a requirement ([privacy-architecture.md §3–§4](../data/privacy-architecture.md)).

3. **§7.8 Every interaction is a data acquisition opportunity — in mind, not in build.** This feature designs with the give-to-get loop in mind — the `user_contributed` lane is already the storage target, the consent model already covers future fields, and the profile-edit surface (US-4) is the natural future home for give-to-get prompts. But at MVP, none of those affordances ships with a capture UI beyond the three core fields ([assumption A-013](assumption-log.md)).

4. **§7.6 Lead signals are opportunity-flavored, not risk-flavored — binding even though dormant.** The captured fields are not routed to any RM surface at MVP ([D-002](../project/decision-log.md)). When Increment 2+ activates the RM lane, any derived signal must honor §7.6; nothing in this feature's data shape precludes that, but nothing in this feature's MVP scope builds toward it either.

5. **Verdicts, not datasets — applied to the selection experience itself.** Selection controls do not expose raw statistics (e.g., "your cohort has N peers"). Cohort depth is a system-internal fact ([assumption A-017](assumption-log.md)); the owner sees only the fields and the primary action.

## 7. Open questions

None net-new from this PRD. The feature depends on these already-tracked items:

1. **OQ-013** — Owner first-name availability at MVP from the pre-populated seed (raised by designer for email greeting personalization). This feature does not add a separate first-name capture; if the field is not in the seed, the email greeting stays generic per [information-architecture.md §5](../design/information-architecture.md).
2. **OQ-015** — Settings screen structure for US-4 profile edit. Designer owns; this PRD assumes the edit surface lives under Settings alongside the Soukromí sub-screen.
3. **OQ-018** — Per-NACE-division 3-digit overrides (deferred). US-2 AC-2 leaves the structural hook in place with an empty override set at MVP.
4. **OQ-003** — Legal basis for the pre-populated seed. This is upstream of US-1 AC-1; if legal review determines existing banking-relationship consent does not cover Strategy Radar ingestion, the bank-referred path's pre-population changes shape (owner may have to enter the three fields even on the bank-referred path, falling through to the US-2 flow).
5. **OQ-021** — Retention window for `user_contributed` data independent of revocation. Directly relevant to the three profile fields, which are the narrowest `user_contributed` lane content at MVP. Legal-review dependency; not blocking for MVP trial build.

All items are already logged in [`docs/project/open-questions.md`](../project/open-questions.md); no new entries added by this PRD.

## 8. Downstream artifacts

- Design: [`docs/design/sector-profile-configuration/`](../design/sector-profile-configuration/) — *not yet drafted* (Phase 2 Track C, designer). Must cover: bank-referred confirm screen, bank-referred partial-fallback screen (US-1 AC-3), direct-sign-up selection form, out-of-persona exclusion screen (US-2 AC-3), profile-edit screen (US-4), error states for each. Consent-gate hand-off links to [`docs/design/trust-and-consent-patterns.md`](../design/trust-and-consent-patterns.md) §3.
- Data: [`docs/data/sector-profile-configuration.md`](../data/sector-profile-configuration.md) — *not yet drafted* (Phase 2 Track C, data-engineer addendum). Must cover: the three fields' exact type / enum definitions consistent with [cohort-math.md §2](../data/cohort-math.md), their lane (`user_contributed` per [D-010](../project/decision-log.md)), their consent-event binding (`consent_event_id` FK per [privacy-architecture.md §4](../data/privacy-architecture.md)), append-only edit history (US-4), and the fall-through behavior when the pre-populated seed has partial fields (US-1 AC-3).
- Engineering: [`docs/engineering/sector-profile-configuration.md`](../engineering/sector-profile-configuration.md) — *not yet drafted* (Phase 2 Track C, engineer). Must cover: George Business SSO token handoff for pre-populated lookup (cross-references [OQ-008](../project/open-questions.md) and [ADR-0001-E](../engineering/adr-0001-tech-stack.md)); write-ordering guarantee that the consent event is committed before any profile row is written; the out-of-persona exclusion flow as a non-advance rather than a soft warning.

## Changelog

- 2026-04-20 — initial draft — product-manager
