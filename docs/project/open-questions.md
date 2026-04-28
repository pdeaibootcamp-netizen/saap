# Open Questions — Cross-Agent Escalations

*Owner: orchestrator. This file tracks questions raised by specialists mid-task that block them or require a cross-domain decision. For product-level open questions owned by the PRD, see [PRD/PRD.md](../../PRD/PRD.md) §13.*

Unified ID space: `OQ-NNN`. Specialists raise in their artifacts' local sections and orchestrator re-IDs here at the next gate.

---

## Blocks Phase 2 — requires user decision

| Date raised | ID | Question | Raised by | Blocking | Status |
|---|---|---|---|---|---|
| 2026-04-17 | OQ-001 | **Revocation downstream semantics under D-007 single opt-in.** Option A = stop future flow only (retain rows + aggregates). Option B (DE-recommended) = stop flow + delete user-contributed rows + retain already-published anonymized cohort aggregates. Option C = delete everything including historical aggregates. Legally load-bearing; not explicitly decided in D-007/D-008. | data-engineer, designer | `privacy-architecture.md` §5; `trust-and-consent-patterns.md` §6 post-revocation copy; any code path that handles `revoke`. | resolved — [D-012](decision-log.md) (Option A) |
| 2026-04-17 | OQ-002 | **Hosting + managed-Postgres provider for MVP trial.** Engineer-recommended: Vercel + Vercel Postgres (Neon). Alternatives: Azure + Azure DB (if ČS security policy requires ČS-hosted) or Supabase. Short trial window; pick simplest that will hold. | engineer | `adr-0001-tech-stack.md` §F; `adr-0002-brief-storage-and-delivery.md` §A. | resolved — [D-013](decision-log.md) (Supabase Postgres + Vercel hosting) |

---

## Legal review dependencies

Legal review is required before shipping the copy; not a decision the orchestrator or user can resolve by picking an option. Tracked here so the dependency is explicit in the build plan.

| Date raised | ID | Question | Raised by | Blocking | Status |
|---|---|---|---|---|---|
| 2026-04-17 | OQ-003 | Legal basis for the ČS pre-populated seed dataset (D-001) — does existing banking-relationship consent cover Strategy Radar ingestion + hand-assigned cohort membership, or is a new legal basis required? | data-engineer | Phase 2 `user_ingest_prepopulated` pipeline. | open — legal review |
| 2026-04-17 | OQ-004 | Legal adequacy of D-007 single-opt-in consent copy (the four-lane declaration text in `trust-and-consent-patterns.md` §4) under Czech/EU GDPR, including whether the RM-lane clause is broad enough to avoid a re-consent event when D-002 is reversed in Increment 2. | data-engineer, designer | Consent copy production readiness; Increment 2 RM lane activation. | open — legal review |
| 2026-04-17 | OQ-005 | Legal review of brief-surface and email Czech copy drafts (non-consent copy) for disclaimer completeness and accuracy-of-claim framing. | designer | Brief-surface production readiness. | open — legal review |
| 2026-04-17 | OQ-021 | **Retention window for `user_contributed` data independent of revocation.** Prior draft of `privacy-architecture.md` §2 mentioned "36 months rolling from last login." Removed during D-012 reconciliation because the "deletable on revocation" half of that cell no longer applied under Option A. The rolling-retention concept itself is unstated anywhere now. Does inactive-but-not-revoked user data age out at a fixed window, or does it persist indefinitely? GDPR requires a documented retention policy. | data-engineer (raised post-reconciliation) | `privacy-architecture.md` §2 retention cell for `user_contributed`; any user-contributed capture flow in Phase 2. At MVP the user-contributed lane is narrow (sector profile NACE + size + region only, no give-to-get capture per A-013) so this is not a near-term blocker. | open — legal review |

---

## ČS stakeholder dependencies

Not resolvable inside this repo; need ČS-side answers before the relevant artifact can ship.

| Date raised | ID | Question | Raised by | Blocking | Status |
|---|---|---|---|---|---|
| 2026-04-17 | OQ-006 | Availability of ČS / George Business design-system component library (accordion, pill badge, sticky footer, destructive button, modal dialog) for Strategy Radar to consume. If unavailable, designer + engineer ship a local minimal kit. | designer | `information-architecture.md` §7; `trust-and-consent-patterns.md` §9; Phase 2 implementation. | open — ČS liaison |
| 2026-04-17 | OQ-007 | ČS support contact detail (email or URL) for the post-revocation screen body copy. | designer | `trust-and-consent-patterns.md` §6 post-revocation screen. | open — ČS liaison |
| 2026-04-17 | OQ-008 | Phase 2 iframe embedding plan with George Business (CSP headers, X-Frame-Options, SSO token handoff spec). MVP uses redirect-with-signed-JWT stub per ADR-0001-E; Phase 2 needs the full integration contract. | engineer, designer | Phase 2 George Business integration beyond the stub. | open — ČS liaison |
| 2026-04-17 | OQ-013 | Owner first-name availability at MVP from bank-sourced data — affects email greeting personalization. | designer | `information-architecture.md` §5 email opening-line copy. | open — requires ČS data-field confirmation |

---

## Downstream of OQ-001 (resolved when OQ-001 is decided)

| Date raised | ID | Question | Raised by | Blocking | Status |
|---|---|---|---|---|---|
| 2026-04-17 | OQ-009 | Under OQ-001 Option B, do we **hard-delete** `user_db` rows or **irreversibly anonymize** (strip `user_id`, retain row)? MVP assumed hard-delete in DE's draft. | data-engineer | `privacy-architecture.md` §5 implementation detail. | resolved — moot under [D-012](decision-log.md) Option A (no deletion occurs) |

---

## Specialist follow-ups — non-blocking for Phase 2

These can resolve during Phase 2 feature work by the owning specialist. Listed here for traceability.

| Date raised | ID | Question | Raised by | Specialist owns | Status |
|---|---|---|---|---|---|
| 2026-04-17 | OQ-010 | Does `@sparticuz/chromium` work in Vercel serverless for PDF generation? Fallback: `@react-pdf/renderer`. | engineer | engineer | open |
| 2026-04-17 | OQ-011 | Should the web view flag a version mismatch when a brief is edited after email/PDF delivery? | engineer | engineer | open |
| 2026-04-17 | OQ-012 | At what recipient-count threshold does synchronous Puppeteer PDF become unacceptable? Trial volume is low; not a near-term concern. | engineer | engineer | open |
| 2026-04-17 | OQ-014 | Atomic consent commit + navigation — a failed server call must not advance the user into the brief. Engineering detail. | designer, engineer | engineer | open |
| 2026-04-17 | OQ-015 | Full Settings screen structure not yet designed — Soukromí stub in `trust-and-consent-patterns.md` §6 needs a Phase 2 parent-screen design. | designer | designer | open — Phase 2 |
| 2026-04-17 | OQ-016 | Autofocus on consent-screen confirm button — engineering + accessibility review. | designer | designer, engineer | open |

---

## Deferred — Increment 2+ / post-trial

Not a blocker for MVP; tracked so the items don't get forgotten.

| Date raised | ID | Question | Raised by | Reopen trigger | Status |
|---|---|---|---|---|---|
| 2026-04-17 | OQ-017 | Differential-privacy ε budget per metric per user per month for Increment 2 FL/DP rollout. Not set at MVP (centralized batch; the validity floor does the privacy work). | data-engineer | Increment 2 planning. | deferred |
| 2026-04-17 | OQ-018 | Per-NACE-division (3-digit) overrides beyond the global 2-digit cohort rule — are there priority divisions whose variance warrants sub-division? | data-engineer | MVP priority-NACE list work (PM + analyst). | deferred |
| 2026-04-17 | OQ-019 | Per-metric statistical-validity floor re-tuning after 1–2 months of MVP trial (current: N≥30 global, N≥50 for working capital cycle + pricing power proxy). | data-engineer | Post-trial cohort-math revision. | deferred |
| 2026-04-17 | OQ-020 | Measured cell-clearance distribution once the D-001 pre-populated seed is actually joined into `user_db`. `cohort-math.md` §7.3 uses planning estimates; replace with measured numbers. | data-engineer | Phase 3 first-brief rehearsal sign-off. | deferred — Phase 3 |

---

## Phase 2 specialist OQs — indexed by feature artifact

Phase 2 (2026-04-20) produced 67 new specialist-level open questions across 9 PM PRDs and 9 designer files. Rather than transcribe each here, this section indexes them by source; full text + context lives in each artifact's own Open Questions section. Cross-cutting items that need orchestrator or user action are promoted to the **Phase 2 cross-cutting OQs** table below; the remainder are specialist-internal follow-ups that will resolve during Phase 3 implementation or remain non-blocking.

| Feature | PM OQs (`docs/product/<slug>.md`) | Designer OQs (`docs/design/<slug>.md`) |
|---|---|---|
| monthly-briefing-generation | Q-MBG-001..005 | Q-PD-MBG-001..007 |
| observation-generation | OG-Q-01..05 | Q-PD-OG-001..005 |
| plain-language-translation | — | Q-PD-PLT-001..002 |
| action-specificity-framing | Q-ASF-001..005 | Q-PD-ASF-001..005 |
| percentile-position-calculation | — (references OQ-018/019/020) | Q-PD-PPC-001..003 |
| quartile-position-display | OQ-QPD-001..004 | Q-PD-QPD-001..005 |
| category-based-layout | — | Q-PD-CBL-001..002 |
| sector-profile-configuration | — (references OQ-003/013/018/021) | Q-PD-SPC-001..010 |
| multi-format-delivery | Q-MFD-001..005 | Q-PD-MFD-001..004 |

### Phase 2 cross-cutting OQs — promoted for orchestrator tracking

| ID | Question | Source | Blocking |
|---|---|---|---|
| OQ-045 | PRD §8.6 and §8.7 referenced in original orchestrator briefs do not exist — PRD §8 is §8.1..§8.5. Agents correctly re-anchored to §8.1 + §9. No content gap; flag for PRD index/header cleanup in a future PRD revision. | Q-MBG-001, Q-MFD-001 note, quartile-position PRD note | cosmetic / traceability |
| OQ-046 | **PDF confidentiality notice**: system-wide constant or per-brief analyst-editable? Affects `monthly-briefing-generation` authoring UI and `multi-format-delivery` PDF footer. PM + legal cross-feature. | Q-MBG-005, Q-PD-MBG-005 | Phase 3 authoring UI completeness |
| OQ-047 | **Priority-NACE cohort list** (referenced by cohort-math §2.4 as "~10 priority NACE divisions" but not frozen). Needed to render FloorStatusIndicator (Q-PD-OG-002) and to populate the below-floor-hard-block on authoring. Needs PM + analyst + data-engineer alignment. | OG-Q-01, Q-PD-OG-002 | Phase 3 authoring UI + cohort compute completeness |
| OQ-048 | **Email unsubscribe-vs-revocation semantics**. D-007 locks single opt-in; email unsubscribe link would create a second revocation primitive. Two designer-drafted email footer variants are both blocked pending this decision. Legal + PM cross-feature; likely routes to existing OQ-004. | Q-MFD-002, Q-PD-MFD-001 | Phase 3 email footer copy |
| OQ-049 | **Fail-closed consent-status check on network error** in Multi-Format Delivery — when the consent lookup fails transiently, do we fail-closed (block delivery) or fail-open (deliver)? Load-bearing trust constraint; engineer detail with PM + data-engineer implications. | Q-PD-MFD-004 | Phase 3 delivery pipeline |
| OQ-050 | **Direct-sign-up auth hand-off** (secondary per A-014). ADR-0001-E covered only bank-referred (JWT redirect stub); direct-sign-up identity + consent entry path is unspecified. Blocks engineer ADR. | Q-PD-SPC-001 | Phase 3 engineer ADR addendum |
| OQ-051 | **"Kohorta" in owner-facing copy** — term used in category-based-layout empty-state and quartile-position below-floor fallback; may not be owner-legible. Candidate substitution: "ve vašem oboru a velikostní kategorii." Requires PLT frozen-terms-list review. | Q-PD-CBL-001 | Phase 3 copy review |
| OQ-052 | **`confidenceState` enum alias**: designer uses `below-floor` for precision; IA originally uses `low-confidence`. Engineer to treat as an alias/rename during implementation. Not a product decision. | Q-PD-QPD-004 | Phase 3 engineer implementation (naming detail) |
| OQ-053 | **Action click-through telemetry on non-interactive ActionItem** — owner-side ActionItems are read-only at MVP ("no mark as done" = Inc 2+). KPI in PRD §6 G1 needs a non-click telemetry approach (e.g., scroll-into-view, time-on-section). Engineer telemetry scope. | Q-PD-ASF-001 | Phase 3 engineering; KPI measurability |

Remaining specialist-internal items (design-system confirmations chained on OQ-006, icon-library choices, validation-error-copy nuances, etc.) are left in their feature artifacts and resolve naturally during Phase 3 implementation. Any that block Phase 3 will surface to the orchestrator at that gate.

---

## Resolved at Phase 1 gate (2026-04-17)

| ID | Resolution |
|---|---|
| Q-005 (engineer) + engineer/data-engineer lane-naming drift | [D-010](decision-log.md) — canonical lane identifiers = `brief` / `user_contributed` / `rm_visible` / `credit_risk`. |
| Q-001 (designer) — category-name drift between PM and designer IA | [D-011](decision-log.md) — PM's categories and ratio assignments from [mvp-metric-list.md](../product/mvp-metric-list.md) are canonical. Designer IA to be updated to match. |

---

## How specialists add an entry

- Raise inside your own artifact's **Open Questions** section with a local label (e.g., "Q-N"). Do not write to this file directly — the orchestrator transcribes and re-IDs here at the next gate (the write-lane hook enforces this).
- **Blocking**: the specific artifact or task that cannot complete without resolution.
- **Status**: `open` when transcribed; orchestrator updates to `resolved — see D-NNN`, `open — legal review`, `open — ČS liaison`, `deferred — <reason>`, or similar.

## How the orchestrator resolves

1. Read the blocked artifact and the upstream PRD / decision context.
2. Either (a) resolve directly and add a row to [decision-log.md](decision-log.md) with the matching `D-NNN`, or (b) escalate to the human via `AskUserQuestion`.
3. Update the `Status` column in this file. Never delete rows — resolved questions stay as an audit trail.

## v0.2 Track A spec gate (2026-04-21)

All raised on branch `trial-v0-2` during Phase 2.1 Track A + Track C spec-writing. Minor accessibility / implementation nits that the engineer + designer can reconcile during Phase 2.2.b–c stay inside the artifact files themselves; only items needing user or cross-lane decision are promoted here.

| Date | ID | Question | Raised by | Blocking | Status |
|---|---|---|---|---|---|
| 2026-04-21 | OQ-054 | **`pricing_power` metric floor violation for the demo owner.** DE's NACE 31 / S2 / Praha cohort stub uses n_firms=34, which clears the global N≥30 floor but violates the stricter N≥50 floor declared for `pricing_power` in the Phase 1 cohort math. Shipping the tile as `valid` contradicts the stricter policy; marking it `below-floor` reduces the demo's readout count. Recommendation: accept the looser floor for the PoC only; harden in v0.3. | data-engineer | `docs/data/dummy-owner-metrics.md` §4.1, any v0.3 tightening of per-metric floors. | open — PoC-accept, harden at v0.3 |
| 2026-04-21 | OQ-055 | **"Přehled" naming collision on the dashboard page.** Glossary defines "Přehled" = a single brief document; PM spec reuses "Přehledy" as the plural list header on the dashboard. Three resolutions offered in `dashboard-v0-2.md` §12 OQ-DV02-01. PM preference: keep-as-specced. | product-manager | Dashboard copy production (affects PD copy pickup + EN implementation). | resolved — [D-019](decision-log.md) (list renamed "Analýzy") |
| 2026-04-21 | OQ-056 | **ČS wordmark on the dashboard header band.** Brief page renders "Česká Spořitelna · Strategy Radar"; dashboard PD spec omits ČS wordmark (just "Strategy Radar"). Consistency preference vs. PoC minimalism. | designer | `src/app/page.tsx` header implementation in Phase 2.2.a. | resolved — [D-018](decision-log.md) (ČS · Strategy Radar kept) |
| 2026-04-21 | OQ-057 | **Desktop max-width container strategy.** PD proposes 960 px for the dashboard (fits 4 tile columns). Brief page uses 680 px (single column). If a shared layout container is introduced, one of the two page widths loses. | designer → engineer | Phase 2.2.a scaffold. | open — engineer to decide container strategy during 2.2.a |
| 2026-04-21 | OQ-058 | **Below-floor tile copy — short vs. full form.** PD proposes short "Zatím nedostatek dat pro srovnání" to fit a tile; the frozen full string lives in `quartile-position-display.md` §5.5. PM to confirm short form is acceptable for the tile context. | designer → product-manager | Tile below-floor state rendering. | resolved — PM confirmed short form in `brief-page-v0-2.md` §9; full form remains the reference string for wider contexts. |

Non-promoted: 6 further specialist-internal items flagged in the PD spec files (tile interactivity, category-badge placement, badge contrast nudge 3.54 → 5.74 at #666, `aria-label` double-announce on quartile pill and "Nový" badge, NACE code display-name resolution, brief-list pagination at v0.3+). These stay inside the PD spec where they were raised and are resolved during Phase 2.2 implementation with engineer + PD in thread. Do not re-promote unless a blocker surfaces.

---

## v0.3 Phase 3.1 spec gate (2026-04-27)

11 specs landed across PM (2), PD (1), DE (5), EN (3) on branch `trial-v0-3`. Specialists raised ~50 spec-internal items in their own artifact §-Open-questions sections. Promoted here only the items that need cross-track or cross-lane resolution before Phase 3.2 implementation lands.

| Date | ID | Question | Raised by | Blocking | Status |
|---|---|---|---|---|---|
| 2026-04-27 | OQ-067 | **Cenová síla measurement simplification.** PM `in-tile-prompts.md` proposes asking owners for year-over-year margin point change as the input. DE's `percentile-compute.md` must reconstruct trajectory-vs-cohort-trajectory from this simpler input. Either reconciles or surfaces a load-bearing change to D-015 metric definitions. | product-manager → data-engineer | Track A engineering (3.2.A) wiring the input field to compute. | open — DE to confirm reconciliation in Phase 3.1.B |
| 2026-04-27 | OQ-068 | **Source-attribution default string for n8n-generated drafts.** PM proposes `Ekonomické a strategické analýzy České spořitelny — {title}, {month year}`. EN must confirm the n8n callback payload includes a `title` field that maps cleanly; otherwise fallback to filename-stem. | product-manager → engineer | Phase 3.2.C5 (draft-write callback). | open — EN to confirm during 3.2.C2 prompt design |
| 2026-04-27 | OQ-069 | **Hyndman & Fan type 4 vs. average-rank percentile algorithm.** DE `percentile-compute.md` specifies Type 4. `cohort-math.md` §6.2 (Phase 1) cited average-rank. Discrepancy is documentation-level — Type 4 is correct for the intended interpretation; cohort-math.md should be updated to match. Not a behaviour change. | data-engineer | Documentation consistency only. | open — DE to update cohort-math.md before 3.2.B compute lands |
| 2026-04-27 | OQ-070 | **Privacy-architecture allow-list addition for `analyse_publication_n8n`.** First external-processor pipeline (n8n Cloud `kappa3`). DE `analysis-pipeline-data.md` §8 flags `privacy-architecture.md` should be extended with a new pipeline entry before any v0.4 customer-real-data work. PoC-acceptable as is; pre-launch must close. | data-engineer | v0.4 launch gate. | open — DE to extend `privacy-architecture.md` before v0.4 |
| 2026-04-27 | OQ-071 | **n8n Cloud data-residency posture vs. ČS policy.** Workspace `kappa3` runs in EU but underlying compute placement is provider-controlled. Acceptable for PoC; ČS legal review required before any real-customer payload. | data-engineer → user (eventually ČS legal) | v0.4 launch gate. | open — escalate to ČS legal pre-v0.4 |
| 2026-04-27 | OQ-072 | **DEMO-badge contrast at 10 px bold.** PD `in-tile-prompts.md` flags borderline AA at the small bold size. Trivially fixed by darkening to `#BF360C`. Engineer to apply during Phase 3.2.A4. | designer → engineer | Tile UI implementation. | open — EN to apply in 3.2.A4 |
| 2026-04-27 | OQ-073 | **`?saved=<metricId>` pulse mechanism vs. Server Actions.** PD-proposed feedback uses a query param to trigger a one-shot tile pulse after save. Engineer needs to confirm this works with Next.js Server Actions which may not change the URL. Alternate: short-lived cookie or in-memory client-side flag on the redirect. | designer → engineer | Tile UI feedback in 3.2.A4. | open — EN call during 3.2.A4 |
| 2026-04-28 | OQ-074 | **Per-NACE insight rules for the Claude Code orchestration skill.** What rule-set does each NACE sub-agent apply to generate insights from a publication body? Source documents (sector reports, industry analyst notes), style guide (Czech-aware, ~3 insights, owner-relative when client data available), how rules differ between NACE 31 (furniture, downstream consumer demand exposure) vs NACE 49 (road freight, fuel + driver-cost sensitivity) — all TBD. Skeleton placeholders in the orchestration skill are non-deterministic and will produce generic output until rules land. | user → product-manager | Phase TC-B (orchestration skill spec). Skill ships with placeholders; refinement is its own iteration. | open — user to schedule rule-design session |
| 2026-04-28 | OQ-075 | **Client data injection into action steps.** PM `analysis-automation.md` and DE `analysis-pipeline-data.md` specify `ownerMetricSnapshot` (8-entry array of `{metric_id, percentile, quartile_label}`, no raw values) flowing from app to LLM context. Under D-026's MCP architecture, Claude Code is the LLM and would need a way to fetch the snapshot — either a second MCP tool (`get_owner_metric_snapshot(ico)`) the sub-agents call, or analyst manually pastes the snapshot into the orchestration prompt. Decision deferred until per-NACE rules (OQ-074) are designed since rule structure determines whether owner-relative framing is even used. | engineer → user | Phase TC-E expansion (out-of-scope for first PoC cut). | open — revisit after OQ-074 |
| 2026-04-28 | OQ-076 | **Industry-data Excels for NACE 10/11 (food) and NACE 46.74 (aluminium wholesale).** Per D-027 the Track C PoC ships with 2 NACEs (31 + 49); adding the other 2 unblocks the full 4-NACE parallel demo. When does the user expect to deliver these Excels? Once delivered, ingest script handles them without code changes (`npm run ingest:industry -- --file <path> --nace-division <NN>`). | user | Phase TC-E expansion. Two-phase rollout planned. | open — user to schedule data delivery |


Self-monitoring (kept in artifacts, not promoted): the remaining ~40 spec-internal questions across the 11 files. Mostly minor copy / styling / parameter calibration items resolvable in-thread during Phase 3.2 engineering.

---

## Changelog
- 2026-04-17 — initial population after Phase 1 gate. 20 open questions transcribed from engineer, data-engineer, designer artifacts; 2 resolved at gate (D-010, D-011).
- 2026-04-17 — user decisions on OQ-001 and OQ-002 resolved to D-012 and D-013. OQ-009 moot under D-012. OQ-021 added (retention window) post-reconciliation from data-engineer.
- 2026-04-20 — Phase 2 PM + PD gate: 67 specialist OQs indexed by feature-artifact (not individually transcribed to keep register readable); 9 cross-cutting items promoted as OQ-045..053.
- 2026-04-21 — v0.2 Track A + Track C spec gate on branch `trial-v0-2`: OQ-054..058 transcribed (1 DE, 1 PM, 3 PD). 6 specialist-internal items left in-artifact per triage. OQ-055, OQ-056 are user-gated; OQ-054 is PoC-accepted; OQ-057 is engineer-gated; OQ-058 is PM-gated and will close when `brief-page-v0-2.md` is written.
- 2026-04-27 — v0.3 Phase 3.1 spec gate on branch `trial-v0-3`: 11 specs landed (2 PM + 1 PD + 5 DE + 3 EN). OQ-067..073 transcribed (3 cross-track; 4 v0.4-or-later forward-pointers). Two PM/DE files written by orchestrator on agents' behalf because of a filename heuristic guard — no content change, attribution noted in those files' changelogs.
