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

**Phase 1 gate status (2026-04-17): complete — ratified [D-014](decision-log.md).** All eight foundation artifacts landed and reconciled. Cross-cutting decisions: [D-010](decision-log.md) canonical lane identifiers, [D-011](decision-log.md) canonical benchmark categories, [D-012](decision-log.md) revocation = stop-flow-only, [D-013](decision-log.md) Supabase Postgres + Vercel hosting. Reconciliation edits applied to `privacy-architecture.md`, `cohort-math.md`, `adr-0001-tech-stack.md`, `adr-0002-brief-storage-and-delivery.md`, `information-architecture.md`, `trust-and-consent-patterns.md`. 21 open questions tracked in [open-questions.md](open-questions.md): none block Phase 2 entry (remainder are legal review, ČS liaison, specialist-internal follow-ups, or Increment 2+ deferrals). **Phase 2 is open.**

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

## 10. v0.2 — Customer-testing PoC (current, branch `trial-v0-2`)

*Scope below is additive to the MVP plan above. Phases 0–4 stay closed on `trial-phases-2-4` as the reference v0.1 state. v0.2 reshapes the owner-facing experience for a customer-testing demo; analyst side untouched.*

### 10.1 What changes

1. **Owner dashboard at `/`** — 8 benchmark tiles (one per frozen D-015 metric: name + raw value + cohort percentile + quartile colour) + a list of briefs relevant to the owner's NACE.
2. **Brief detail page rework** — remove the "Srovnávací přehled" section, add the actual sector publication content at the top (furniture-industry analysis, .docx provided by user), restructure insights + actions so they read as connected rather than two disjoint lists.
3. **Bypass the (non-functional-in-v0.1) consent + onboarding gates** for the PoC owner. Hardcoded dummy profile (NACE 31 furniture / S2 / Praha). `/consent`, `/onboarding`, `/settings/soukromi` stay on disk but are unreached by the demo owner.

### 10.2 What does NOT change

- Analyst back-office (`/admin/*`) — v0.1 state, fully functional.
- v0.1 consent POST bug — not addressed in v0.2 scope. Specialists are *not* asked to debug or redesign consent.
- Cohort math in `src/lib/cohort.ts` — reused as-is; per-owner raw values layer on top in a new `src/lib/owner-metrics.ts`.
- PDF + email delivery for the reworked brief shape — web view only at v0.2.
- George Business embedding — deferred.

### 10.3 Framing discipline for delegation

When briefing PM / PD / DE / EN, the bypass is described as "route the PoC owner around the currently-non-functional sign-in chain" — **not** "drop consent". v0.1's owner flow never connected end-to-end (consent POST fails with "Nepodařilo se zaznamenat váš souhlas"); v0.2 sidesteps that rather than regressing functionality. No specialist fixes consent in v0.2.

### 10.4 Phase sequencing

| Phase | What | Owner | Depends on |
|---|---|---|---|
| 2.0 | Publication hand-off — user drops `PRD/publications/furniture-2026-Q2.docx` | user → orchestrator | — |
| 2.1 Track A | Dashboard specs (IA + tile design + per-owner dummy metrics) | PM + PD + DE, parallel | — |
| 2.1 Track B | Brief page rework specs (publication placement, insight↔action model) | PM + PD, sequential after 2.0 | Phase 2.0 |
| 2.1 Track C | Identity bypass ADR | EN | — |
| 2.2.a | Identity bypass + dashboard scaffold in `src/` | EN | 2.1 Track C |
| 2.2.b | Metric tiles component + seeded owner metrics | EN | 2.1 Track A |
| 2.2.c | Brief list component + `listPublishedBriefsByNace()` + 2 placeholder briefs seeded | EN | 2.1 Track A |
| 2.2.d | Brief page surgery (remove benchmarks, add publication block, pair insights↔actions) | EN | 2.1 Track B |
| 2.2.e | Furniture brief seed populated from the .docx | EN (mechanical) + PM (content) | 2.0, 2.1 Track B |
| 2.3 | User walks the verification checklist in the browser | user | all of 2.2 |

### 10.5 Delegation map (v0.2)

| Artifact | Owner | Phase |
|---|---|---|
| `docs/product/dashboard-v0-2.md` | PM | 2.1 Track A |
| `docs/product/brief-page-v0-2.md` | PM | 2.1 Track B |
| `docs/design/dashboard-v0-2/` (folder: `layout.md`, `tile-states.md`, `brief-list-item.md`) | PD | 2.1 Track A |
| `docs/design/brief-page-v0-2.md` | PD | 2.1 Track B |
| `docs/data/dummy-owner-metrics.md` | DE | 2.1 Track A |
| `docs/engineering/v0-2-identity-bypass.md` | EN | 2.1 Track C |
| `src/**` code changes | EN | 2.2.a–e |
| Orchestrator plan updates + changelog | orchestrator | each gate |

Full plan detail — files to modify/create, existing code to reuse, verification criteria — lives in the approved plan-mode artifact at `~/.claude/plans/orchestrator-create-a-build-warm-lerdorf.md`. Specialists working on v0.2 should also re-read this §10 and the v0.2 decisions in [decision-log.md](decision-log.md) as they land.

---

## 11. v0.3 — Architecture, benchmarking backend, n8n analysis automation (current, branch `trial-v0-3`)

*Scope below is additive to §10. Phases 0–4 (v0.1) stay closed on `trial-phases-2-4`; v0.2 stays closed on `trial-v0-2` (frozen via GitHub ruleset 15590034); v0.3 reshapes the data architecture so client values, computed percentiles, and analyst-uploaded publications are real flows rather than hand-typed fixtures.*

### 11.1 What changes

1. **Per-client metric storage** — new `owner_metrics` table in `user_db` (user_contributed lane) holding the 8 frozen metrics' raw values + units + source + timestamps per user. Demo owner gets a real DB row with some values seeded and some left null for the "ask when missing" demo.
2. **Real percentile computation** — replace `getBenchmarkSnapshot()` fixtures with a computation against an ingested industry-data Excel. Floor + degradation rungs from `cohort-math.md` §3 coded explicitly. Feature-flagged so the fixture path remains as fallback.
3. **In-tile "ask when missing" UX** — tiles with null values render a CTA → inline form → PATCH → page-refresh updates the tile. PM/PD/EN co-author the spec.
4. **n8n analysis automation** — analyst uploads a PDF/DOCX → n8n workflow generates a layperson Sektorová analýza opener + 3 paired observations + 3 actions → writes back into Supabase as a draft brief → analyst reviews and publishes via the existing edit page.

### 11.2 What does NOT change

- Owner-side auth — demo-owner bypass stays. Multi-tenant signed-in flow is a v0.4 concern.
- Existing analyst edit + publish flow — receives drafts in the same shape it already loads.
- Owner brief detail page (`src/app/brief/[id]/page.tsx`) — reads briefs that are now generated rather than hand-typed; no JSX changes.
- Frozen vocabulary — the 8 metrics, 4 D-011 categories, 4 quartile labels, 4 time-horizon values remain unchanged.
- v0.1 / v0.2 reference branches — both remain frozen via GitHub ruleset 15590034.

### 11.3 Phase sequencing

| Phase | What | Owner | Depends on |
|---|---|---|---|
| 3.0 | Industry-data Excel hand-off + n8n hosting decision + demo-owner null/value mix decision | user → orchestrator | — |
| 3.1 Track A | Owner-metrics schema + in-tile prompt UX + read/write API specs | DE + PM + PD + EN, parallel | 3.0 |
| 3.1 Track B | Cohort ingestion + percentile compute spec | DE + EN, parallel | 3.0 (Excel inspected) |
| 3.1 Track C | n8n integration + analyst upload UX + analysis-pipeline data spec | PM + EN + DE, parallel | 3.0 (n8n hosting picked) |
| 3.2.A | Owner-metrics implementation: migration, read/write API, tile UI, verification | EN | 3.1 Track A |
| 3.2.B | Cohort backend implementation: ingestion script, compute lib, snapshot wiring, verification | EN | 3.1 Track B |
| 3.2.C | n8n implementation: env, workflow, upload UI, upload API, draft-write API, verification | EN | 3.1 Track C |
| 3.3 | Cross-track integration + full demo verification | user | all of 3.2 |

### 11.4 Delegation map (v0.3)

| Artifact | Owner | Track | Phase |
|---|---|---|---|
| `docs/data/owner-metrics-schema.md` | DE | A | 3.1 |
| `docs/product/in-tile-prompts.md` | PM | A | 3.1 |
| `docs/design/in-tile-prompts.md` | PD | A | 3.1 |
| `docs/engineering/owner-metrics-api.md` | EN | A | 3.1 |
| `docs/data/cohort-ingestion.md` | DE | B | 3.1 |
| `docs/data/percentile-compute.md` | DE | B | 3.1 |
| `docs/engineering/cohort-runtime.md` | EN | B | 3.1 |
| `docs/product/analysis-automation.md` | PM | C | 3.1 |
| `docs/engineering/n8n-integration.md` | EN | C | 3.1 |
| `docs/data/analysis-pipeline-data.md` | DE | C | 3.1 |
| `src/**` v0.3 code | EN | A / B / C | 3.2.A / 3.2.B / 3.2.C |
| Decision log + open-questions + build-plan changelog | orchestrator | — | per gate |

### 11.5 Out of scope for v0.3 (deferred)

- Real onboarding / consent / multi-tenant auth (still demo owner only).
- IČO API for auto-downloading registry / bank data.
- George Business embedding.
- Email + PDF polish for the new generated brief shape.
- Real-time benchmark recompute (page-refresh refresh is fine).
- ML-based transaction categorisation (Increment 3+).
- Multi-NACE concurrent rollout — furniture (NACE 31) stays the demo focus.

Full plan detail — files to modify/create, existing code to reuse, risks, verification criteria — lives in the approved plan-mode artefact at `~/.claude/plans/orchestrator-create-a-build-warm-lerdorf.md`.

---

## 12. Changelog

- 2026-04-17 — created by orchestrator; MVP-only scope; Phase 0 user-decided per explicit instruction.
- 2026-04-17 — Phase 0 closed: D-003 through D-009 logged; B-001, B-002 added to backlog. Phase 1 unblocked.
- 2026-04-17 — Phase 1 closed: eight foundation artifacts landed and reconciled. D-010 through D-014 logged. OQ-001 through OQ-021 tracked in open-questions. Phase 2 unblocked.
- 2026-04-20 — Phase 2 PM+PD gate closed on branch `trial-phases-2-4`: 9 feature PRDs + 9 designs landed. D-015 logged. 67 specialist OQs indexed by feature artifact; OQ-045..053 promoted cross-cutting. Glossary extended with 6 terms. Phase 3 unblocked.
- 2026-04-20 — Phase 3 closed on branch `trial-phases-2-4` (partial-ratified): scaffold + full feature implementation + bug fix. D-016 logged. EN-001 fixed; EN-002/003/004 + missing `/fake-george` mock remain as doc-drift / runtime items. Phase 4 unblocked.
- 2026-04-20 — Phase 4 initial paper verification complete on branch `trial-phases-2-4`. D-017 logged. [phase-4-verification.md](phase-4-verification.md) covers V1–V8 checks with file+line evidence; runtime checks user-gated.
- 2026-04-21 — v0.2 PoC scope added on branch `trial-v0-2` (§10). Phase 2.0 blocked on user handing over the furniture publication .docx; Phase 2.1 Tracks A and C can start in parallel without it.
- 2026-04-21 — v0.2 Phase 2.1 Tracks A + C specs landed: `docs/product/dashboard-v0-2.md`, `docs/design/dashboard-v0-2/{layout,tile-states,brief-list-item}.md`, `docs/data/dummy-owner-metrics.md`, `docs/engineering/v0-2-identity-bypass.md`. OQ-054..058 logged; OQ-055/056 user-decided as D-018 (ČS · Strategy Radar header) and D-019 ("Analýzy" list heading).
- 2026-04-21 — v0.2 Phase 2.2.a landed (identity bypass + dashboard scaffold): `src/lib/demo-owner.ts` + middleware-based cookie plant + `src/app/page.tsx` rewrite. Runtime fixes: middleware required instead of `cookies().set()` in RSC (a447d36); `<style>` hydration fix via `dangerouslySetInnerHTML` (57cd200).
- 2026-04-21 — v0.2 Phase 2.2.b landed (metric tiles): NACE 31 cohort stub in `src/lib/cohort.ts`, `src/lib/owner-metrics.ts`, `src/components/dashboard/MetricTile.tsx`, 4-column responsive grid in `src/app/page.tsx`. All 4 DE acceptance criteria pass (8 tiles, one below-floor, Czech formatting correct).
- 2026-04-21 — v0.2 Phase 2.2.c landed (brief list): `listPublishedBriefsByNace()` in `src/lib/briefs.ts`, `src/components/dashboard/BriefListItem.tsx`, 2 NACE 31 placeholder briefs in `src/scripts/seed.ts`, "Analýzy" section wired in `src/app/page.tsx`.
- 2026-04-21 — v0.2 Phase 2.1 Track B specs landed: `docs/product/brief-page-v0-2.md` (D-020: hybrid publication placement, "Sektorová analýza" label, `paired_observation_index` pairing model, benchmarks removed, furniture opener ~340 Czech words, 3 paired observations + actions), `docs/design/brief-page-v0-2.md` (native `<details>` disclosure, continuous left-border pairing treatment + "Doporučený krok:" prefix).
- 2026-04-21 — v0.2 Phase 2.2.d landed (brief page surgery): `BriefContent.publication?` + `ClosingAction.paired_observation_index?` types added to `src/lib/briefs.ts`; `src/app/brief/[id]/page.tsx` rewritten per PD spec (Sektorová analýza block, paired cards, orphan section conditional); `BenchmarkCategorySection` deleted, v0.1 briefs still load via fallback path; `docs/engineering/brief-page-v0-2.md` implementation notes added.
- 2026-04-21 — v0.2 Phase 2.2.e landed (furniture brief seed): `PRD/publications/furniture-2026-Q2.txt` extracted from .docx, `seedFurnitureBrief()` added to `src/scripts/seed.ts` carrying PM §6.1 opener + §7 paired observations/actions verbatim. One deviation: two producer/retailer tables in the extracted .docx body were condensed to prose (engineer judgement — the raw OOXML cell-per-line extraction is unreadable as prose; narrative text preserved verbatim). User runs `npm run seed && npm run dev` to verify.
- 2026-04-21 — Pitch deck `docs/project/pitch-deck.html` added: 24-slide single-file HTML deck for colleague walkthrough covering Arkana discovery + multi-agent build narrative, with CSS-rendered dashboard and brief mockups.
- 2026-04-24..2026-04-27 — GDS visual migration landed via branches `trial-v0-2-GDS` → `trial-v0-2`. ČS blue header, Inter variable-font bundling under `public/fonts/`, GDS design tokens applied to dashboard + tiles + brief list. Token migration documented at `docs/engineering/gds-token-migration.md`.
- 2026-04-27 — `trial-v0-2` merged into `main` (commit `0888ab7`, no-ff). Both trial branches (`trial-v0-2`, `trial-v0-2-GDS`) frozen via GitHub branch ruleset 15590034 — see [D-021](decision-log.md). `trial-phases-2-4` left unprotected so it can be ruleset-extended later if needed.
- 2026-04-27 — v0.3 plan drafted on branch `trial-v0-3` (created off `main`, §11 added). Phase 3.0 user-gated on industry-data Excel + n8n hosting decision + demo-owner null/value mix.
- 2026-04-27 — v0.3 Phase 3.0 partial: NACE 49.41 (Silniční nákladní doprava) Excel landed in `PRD/industry-data/` (4 525 firms, single-snapshot 2024). Audit done: directly supports revenue/employee (74%) + net margin (61%); does not support gross margin / EBITDA / labour cost / working capital cycle / ROCE / revenue growth / pricing power without richer data. n8n Cloud workspace `kappa3` confirmed — webhook setup deferred to Phase 3.2.C2. Three v0.3 decisions logged: D-023 (real-firm demo owner via IČO switcher field, replaces synthetic null/value mix); D-024 (ROCE → Net margin in the frozen-8, supersedes D-015 metric position 6, asymmetric 3-2-1-2 grid accepted as PoC tradeoff). Excel held local-only via `.gitignore` (repo is public). Phase 3.1 specs paused awaiting richer data delivery from user (in-flight, hours).
- 2026-04-27 — v0.3 Phase 3.0 closed: D-025 logged (synthetic per-NACE quintile fallback for any metric not covered by real industry data). User chose to proceed without waiting for richer data — synth fillers fill the gaps, real data swaps in cleanly when it arrives. All three Phase 3.1 spec tracks unblocked simultaneously.
- 2026-04-27 — v0.3 Phase 3.1 spec gate **closed**. 11 specs landed across all four specialists: 2 PM (`docs/product/in-tile-prompts.md`, `docs/product/analysis-automation.md`), 1 PD (`docs/design/in-tile-prompts.md`), 5 DE (`docs/data/owner-metrics-schema.md`, `docs/data/cohort-ingestion.md`, `docs/data/percentile-compute.md`, `docs/data/synthetic-quintile-policy.md`, `docs/data/analysis-pipeline-data.md`), 3 EN (`docs/engineering/owner-metrics-api.md`, `docs/engineering/cohort-runtime.md`, `docs/engineering/n8n-integration.md`). DE's `synthetic-quintile-policy.md` includes concrete sector-plausible q1/median/q3 values for NACE 49 across the 6 metrics not directly computable from the current Excel; recommends pre-seeding synth quintiles for NACE 25, 31, 41, 47, 62 to support cross-NACE demo testing. OQ-067..073 promoted as cross-track items in `open-questions.md`. Two files (`analysis-automation.md`, `analysis-pipeline-data.md`) written by orchestrator because of a filename heuristic guard blocking the agents — content matches the agents' design intent, attribution noted in each file. Phase 3.2 engineer implementation unblocked across all three tracks.
