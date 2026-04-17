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

## Changelog
- 2026-04-17 — initial population after Phase 1 gate. 20 open questions transcribed from engineer, data-engineer, designer artifacts; 2 resolved at gate (D-010, D-011).
- 2026-04-17 — user decisions on OQ-001 and OQ-002 resolved to D-012 and D-013. OQ-009 moot under D-012. OQ-021 added (retention window) post-reconciliation from data-engineer.
