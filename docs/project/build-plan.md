# Build Plan — Strategy Radar MVP

*Owner: orchestrator. Status: draft. Created: 2026-04-17. Source: [PRD/PRD.md](../../PRD/PRD.md) §9 (Increment 1). Scope: MVP only; Increments 2–5 referenced but not sequenced here.*

This plan is the sequencing spine the orchestrator delegates from. It decomposes MVP into phased workstreams, names the owning specialist and exact artifact path for every deliverable, and flags the decision gates that block later phases. It does **not** contain the artifacts themselves — those live in specialist lanes per the [CLAUDE.md](../../CLAUDE.md) ownership table.

---

## 1. Goals & guardrails

**Three ČS business goals** (PRD §4). Every workstream below maps back to at least one:

- **G1 Engagement** — SME owners return monthly to read the brief.
- **G2 Data depth** — More client data, in more detail, more often.
- **G3 RM lead signals** — Opportunity-flavored signals relationship managers can act on. *Deferred to Increment 2 per [D-002](decision-log.md); MVP still designs for it downstream.*

**Product guardrails carried into every phase** (PRD §7, CLAUDE.md):

- Briefs are the atomic unit of value. Every MVP feature produces, enriches, or distributes a brief.
- Verdicts, not datasets. Plain language. No raw number without a comparison.
- Day-one proof of value — no configuration before first verdict.
- Privacy is a product feature. Brief / user-contributed / RM-visible / credit-risk data stay architecturally separate. Client data never enters base-model training.
- Bank-native distribution (George Business embed) is primary; direct sign-up secondary.
- Cohort math degrades gracefully below the statistical-validity floor; never show low-confidence numbers silently.
- No automated brief generation at MVP — ČS analysts author via back-end tooling.

---

## 2. Current state (2026-04-17)

- No `src/`. All `docs/{design,engineering,data}/` empty.
- `docs/product/` contains only [glossary.md](../product/glossary.md).
- [decision-log.md](decision-log.md): **D-001** hand-assigned cohorts on pre-populated data; **D-002** no RM lead signal at MVP.
- [open-questions.md](open-questions.md): empty.
- Starting point for this plan: Phase 0.

---

## 3. Phase 0 — Scope Lock (blocking; user-decided)

Every open question from PRD §13 goes to the user before feature work begins. No orchestrator or specialist resolves scope autonomously. Orchestrator's job: collect each question, attach a proposed default + trade-off analysis drafted by the relevant specialist, present via `AskUserQuestion`, log the user's decision.

| # | Question (PRD §13) | Draft-options owner | Outcome location |
|---|---|---|---|
| Q0.1 | Exact MVP metric list — which 6–8 financial + strategic ratios? | PM | `decision-log.md` as D-003 |
| Q0.2 | Revenue-per-employee inclusion as a financial ratio? | PM | D-004 |
| Q0.3 | Language scope — Czech only, or Czech + English at MVP? | PM | D-005 |
| Q0.4 | Brief cadence — monthly-only, or monthly + event-triggered ad-hoc? | PM | D-006 |
| Q0.5 | Brief personalization grain — sector-only, or sector × size/region? | PM + data-engineer jointly | D-007 |
| Q0.6 | Consent UX + revocation rules for RM data flow | designer + data-engineer jointly | D-008 |
| Q0.7 | Accountant/advisor shared access at MVP? | PM | D-009 |

**Phase 0 exit criteria:** every row above either logged as a decision or explicitly deferred in [open-questions.md](open-questions.md) with rationale. Phase 1 cannot start until the list is empty.

**Phase 0 status (2026-04-17): complete.** All seven questions resolved. Outcomes: Q0.1 + Q0.2 → [D-003](decision-log.md); Q0.3 → D-004; Q0.4 → D-005 (deferred to [B-001](backlog.md)); Q0.5 → D-006; Q0.6a → D-007; Q0.6b → D-008; Q0.7 → D-009 (deferred to [B-002](backlog.md)). One Phase 1 alignment task surfaces from D-008: designer + data-engineer must reconcile revocation semantics under the single opt-in consent model (D-007) when authoring `docs/data/privacy-architecture.md` and `docs/design/trust-and-consent-patterns.md`.

---

## 4. Phase 1 — Foundation (parallel delegation)

Orchestrator issues a single message with four parallel `Agent` calls. Each specialist produces the artifacts below. No feature work happens until the Phase 1 gate passes.

| Specialist | Artifact | Purpose |
|---|---|---|
| **data-engineer** | `docs/data/privacy-architecture.md` | Architectural separation of brief / user-contributed / RM-visible / credit-risk data; no-training-on-client-data commitment; federated-learning + differential-privacy sketch; consent model implementing Q0.6 outcome. PRD §10, §7. |
| **data-engineer** | `docs/data/cohort-math.md` | NACE × size band × region segmentation; minimum-cohort / statistical-validity floor; percentile + quartile computation; graceful-degradation rule. PRD §10. |
| **engineer** | `docs/engineering/adr-0001-tech-stack.md` | Web app stack, email + PDF pipeline, analyst authoring back-end, George Business embedding posture. |
| **engineer** | `docs/engineering/adr-0002-brief-storage-and-delivery.md` | How an authored brief is stored, versioned, and delivered across the three formats without data-lane leakage. |
| **pm** | `docs/product/mvp-metric-list.md` | Frozen 6–8 metrics from Q0.1/Q0.2, with category grouping for embedded snippets. |
| **pm** | `docs/product/assumption-log.md` | Seeded from Phase 0 outcomes — living record of what future PRDs may rely on. |
| **designer** | `docs/design/information-architecture.md` | IA for the three surfaces: brief email, brief web view, brief PDF. |
| **designer** | `docs/design/trust-and-consent-patterns.md` | Opportunity-only framing rules (never risk-flavored); consent disclosure + revocation patterns implementing Q0.6. |

**Phase 1 gate (orchestrator-run):** orchestrator reads all eight artifacts, records any cross-cutting decisions in `decision-log.md`, routes conflicts to the user, and only then opens Phase 2. Expected gate decisions: D-010 tech-stack ratification; D-011 privacy-architecture ratification.

---

## 5. Phase 2 — Feature workstreams

Nine MVP features (PRD §9 Increment 1) grouped into three parallel tracks. Tracks run independently; within a track, PM authorship is the bottleneck so features stage sequentially.

### Per-feature pipeline

For each feature the artifact sequence is:

1. **PM** → `docs/product/<feature-slug>.md` — feature PRD: user story, ACs, links up to PRD section, links down to design/data/eng artifacts once they land.
2. **Designer** → `docs/design/<feature-slug>/` — flow (mermaid), screen states, component spec, copy draft, accessibility checklist.
3. **Data engineer** → addendum in `docs/data/` where the feature touches data model, cohort math, or privacy (not every feature needs this).
4. **Engineer** → ADR if architectural; implementation notes + tests in `docs/engineering/`; code in `src/`.

A feature is "ready to build" when PM + designer + (where applicable) data-engineer artifacts exist and the engineer has an ADR or confirmation of "no new architecture needed."

### Track A — Brief authoring & content (PM-heavy)

| Feature (PRD §9) | PM artifact | Notes |
|---|---|---|
| Monthly Briefing Generation | `docs/product/monthly-briefing-generation.md` | Analyst authoring back-end is the engineering core of MVP. |
| Observation Generation | `docs/product/observation-generation.md` | 2–4 templated observations per brief. |
| Plain-Language Translation | `docs/product/plain-language-translation.md` | Principle-enforcing rules, not a feature UI. |
| Action Specificity Framing | `docs/product/action-specificity-framing.md` | Action-verb + context + time-horizon tag. |

### Track B — Embedded benchmark snippets (data-engineer-heavy)

| Feature (PRD §9) | PM artifact | Notes |
|---|---|---|
| Percentile Position Calculation | `docs/product/percentile-position-calculation.md` | Monthly batch over 6–8 metrics from D-003. |
| Quartile Position Display | `docs/product/quartile-position-display.md` | Named quartile + exact percentile, embedded in brief. |
| Category-Based Layout | `docs/product/category-based-layout.md` | Four grouping categories for snippets. |

### Track C — Onboarding & delivery (designer + engineer-heavy)

| Feature (PRD §9) | PM artifact | Notes |
|---|---|---|
| Sector Profile Configuration | `docs/product/sector-profile-configuration.md` | NACE + size + region capture; bank-referred and direct-signup paths. |
| Multi-Format Delivery | `docs/product/multi-format-delivery.md` | Email + in-app web view + PDF; same brief faithfully rendered. |

**Phase 2 exit criteria:** all nine feature directories populated through engineer artifacts; orchestrator confirms each maps to at least one of G1/G2/G3.

---

## 6. Phase 3 — Integration & first-brief rehearsal

| Owner | Action |
|---|---|
| engineer | Stand up end-to-end pipeline: analyst back-end → authored brief → email + web + PDF. |
| data-engineer | Validate cohort math on pre-populated data ([D-001](decision-log.md)); verify minimum-cohort floor blocks low-confidence outputs. |
| designer | Trust/consent review against Phase 1 patterns; check every user-facing surface for "verdict, not dataset" compliance. |
| pm | Run acceptance-criteria sweep: does a ČS analyst author a brief that clears plain-language, verdict-first, opportunity-flavored framing? |
| orchestrator | Consolidate findings; route blockers to user; record Phase 3 decisions (e.g., D-012 first-brief sign-off criteria). |

---

## 7. Phase 4 — Verification

Concrete, executable checks for MVP "done":

- **Time-to-first-verdict < 60s** for bank-referred path (PRD §6).
- **Every brief contains 2–4 time-horizon-tagged actions** (PRD §7, §8.1).
- **No user-facing output** surfaces a raw number without a comparison (PRD §7).
- **Privacy separation holds end-to-end** — no client-data path into model training; lane boundaries traceable in code and data pipeline (PRD §10).
- **All three delivery formats** render the same brief faithfully.
- **George Business embedding stub** exercises the RM introduction flow (PRD §11).
- **Statistical-validity floor enforced** — cohort math refuses to emit a percentile below the minimum-cohort size (PRD §10, §13.5).

Any check that fails returns the relevant feature to its owning specialist via a fresh PDR/ADR — never patched silently in `src/`.

---

## 8. Delegation map (appendix)

| Phase | Specialist | Artifacts (paths) |
|---|---|---|
| 0 | pm, designer, data-engineer | Draft-options for Q0.1–Q0.7; orchestrator presents to user. |
| 1 | data-engineer | `docs/data/privacy-architecture.md`, `docs/data/cohort-math.md` |
| 1 | engineer | `docs/engineering/adr-0001-tech-stack.md`, `docs/engineering/adr-0002-brief-storage-and-delivery.md` |
| 1 | pm | `docs/product/mvp-metric-list.md`, `docs/product/assumption-log.md` |
| 1 | designer | `docs/design/information-architecture.md`, `docs/design/trust-and-consent-patterns.md` |
| 2 Track A | pm → designer → engineer | `docs/product/monthly-briefing-generation.md` et al., matching `docs/design/<slug>/`, engineering notes + `src/` |
| 2 Track B | pm → data-engineer → engineer | `docs/product/percentile-position-calculation.md` et al., with data-engineer addenda |
| 2 Track C | pm → designer → engineer | `docs/product/sector-profile-configuration.md`, `docs/product/multi-format-delivery.md` |
| 3 | all | Integration + rehearsal; orchestrator consolidates |
| 4 | orchestrator | Verification sweep against §7 checks |

---

## 9. Risks & watch-list

Lifted from PRD §13; orchestrator monitors during build.

1. **Cohort cold-start** (§13.5) — minimum-cohort floor may block launch in small (NACE × size × region) cells. Mitigation: staging rollout by cohort-readiness, not calendar.
2. **Brief production scaling** (§13.1) — analyst authoring does not scale with sector × size × region combinations. Mitigation: priority-cohort-first; templated observation library.
3. **RM enablement** (§13.7) — MVP defers RM lead signal (D-002) but bank-native distribution still depends on RM introduction. Mitigation: Phase 3 rehearsal includes RM-flow stub.
4. **Consent framing collapse** (§13.3) — any RM-visible output that reads as credit-risk surveillance kills adoption. Mitigation: designer + data-engineer co-own the consent pattern in Phase 1; Phase 3 trust review is a gate, not a checkbox.
5. **Statistical-validity floor enforcement** (§13.5) — a silent low-confidence number ships once and trust is gone. Mitigation: verification check in Phase 4 is mandatory.

---

## 10. Changelog

- 2026-04-17 — created by orchestrator; MVP-only scope; Phase 0 user-decided per explicit instruction.
- 2026-04-17 — Phase 0 closed: D-003 through D-009 logged; B-001, B-002 added to backlog. Phase 1 unblocked.
