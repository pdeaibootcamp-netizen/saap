# Multi-Format Delivery

*Owner: product-manager · Slug: multi-format-delivery · Last updated: 2026-04-20*

## 1. Summary

Multi-Format Delivery renders a published brief faithfully to three surfaces — email, in-app web view (George Business WebView primary; direct web secondary), and downloadable PDF — from a single authored artifact. It is the distribution leg of the MVP: once Monthly Briefing Generation emits a versioned brief, this feature is what gets that brief to the SME owner and to anyone the owner chooses to forward the PDF to. At MVP it is the **only** path from an authored brief to an owner's eyes, so it owns the delivery contract, the record of who received what version when, and the consent gate that blocks delivery to a revoked user.

## 2. Upstream links

- **PRD sections**:
  - [§9 Release Plan — Multi-Format Delivery](../../PRD/PRD.md#9-release-plan) — "[basic, pulled forward from Increment 3] — briefs delivered via email, in-app web view, and downloadable PDF." This feature's scope.
  - [§11 Go-to-Market](../../PRD/PRD.md#11-go-to-market) — bank-native distribution (George Business) is primary, direct sign-up secondary; shapes which surface is the default for the bank-referred persona.
  - [§8.1 Sector Briefing Engine](../../PRD/PRD.md#81-sector-briefing-engine--what-this-means-for-you-primary-mvp) — the brief is the atomic unit of value; delivery must preserve the six-component structure and the 2–3 page length spec on the PDF surface.
  - [§7.1–§7.3 Product Principles](../../PRD/PRD.md#7-product-principles) — briefs as atomic value, verdicts-not-datasets, plain language. Delivery must not mutate the authored content in a way that breaks these (e.g., email length budget cannot drop a verdict and leave a raw number behind).
  - [§7.5 Privacy as product](../../PRD/PRD.md#7-product-principles) and [§10 Data and Technical Foundation](../../PRD/PRD.md#10-data-and-technical-foundation) — delivery must stay within the `brief` lane; the consent gate is load-bearing.
  - [§6 Goal 1 Engagement metrics](../../PRD/PRD.md#6-success-metrics) — monthly brief open rate, time spent per brief, click-through are all instrumented at the delivery layer.

- **ČS business goals served**:
  - **G1 Engagement** — direct and primary. Delivery is the event against which G1's open rate, time-spent, and return-visit metrics are measured. Without faithful multi-format delivery, no G1 metric exists.
  - **G2 Data depth and cadence** — indirect. Delivery hands the owner the experience that earns the right to ask for data later (Increment 3); no give-to-get capture is built here (A-013).
  - **G3 RM lead generation** — not served at MVP (A-002 / D-002). Nothing in this feature emits RM-visible content.

- **Related decisions**:
  - [D-001](../project/decision-log.md) / [A-001](assumption-log.md) — hand-assigned cohorts on pre-populated data; a recipient is identified via that assignment, not via a live matcher.
  - [D-004](../project/decision-log.md) / [A-004](assumption-log.md) — all user-facing copy Czech only across every surface.
  - [D-005](../project/decision-log.md) / [A-005](assumption-log.md) / [B-001](../project/backlog.md) — no cadence promise in any surface ("next brief on X" copy is prohibited).
  - [D-006](../project/decision-log.md) / [A-006](assumption-log.md) — NACE-sector grain; delivery targets a recipient based on their assigned NACE cohort.
  - [D-007](../project/decision-log.md) / [A-007](assumption-log.md) — single opt-in; one consent event covers all three surfaces.
  - [D-008](../project/decision-log.md) / [A-008](assumption-log.md) — consent screen precedes first brief view in the WebView; revocation in Settings > Soukromí.
  - [D-009](../project/decision-log.md) / [A-009](assumption-log.md) / [B-002](../project/backlog.md) — no in-product sharing UI; owner-initiated PDF download is the manual-forward workaround.
  - [D-010](../project/decision-log.md) — every delivery artifact and record lives in the canonical `brief` data lane.
  - [D-011](../project/decision-log.md) — the four canonical benchmark categories are the only category structure rendered on any surface.
  - [D-012](../project/decision-log.md) — revocation semantics = stop-flow-only; delivery must stop for a user whose consent is revoked, but previously delivered artifacts are not retroactively unsent.
  - [D-013](../project/decision-log.md) — Supabase Postgres + Vercel; paired with [ADR-0001](../engineering/adr-0001-tech-stack.md) (Resend, Puppeteer, Next.js) and [ADR-0002 §E](../engineering/adr-0002-brief-storage-and-delivery.md) (synchronous delivery pipeline).
  - [A-010](assumption-log.md) — trial window < 1 month; volume is small, which is why the synchronous pipeline (ADR-0002-E) is acceptable and retry/queue orchestration is out of scope.
  - [A-012](assumption-log.md) — briefs are the atomic unit of value; no surface in this feature renders anything outside a brief.
  - [A-014](assumption-log.md) — George Business embedding primary, direct web secondary.
  - [A-015](assumption-log.md) / [A-017](assumption-log.md) — privacy and validity-floor suppression hold across every rendered surface.

## 3. User stories

### US-1 — Owner receives the monthly brief by email and can open it on any device
**As a** SME owner, **I want** to receive the monthly brief as an email I can read directly in my inbox, **so that** I get the verdict without needing to log in first.

- Acceptance criteria:
  - [ ] The email renders the condensed structure defined in [information-architecture.md §3 Surface A](../design/information-architecture.md): brief header, opening summary, single teaser observation, single teaser benchmark snippet (only when valid), primary CTA "Přečíst celý přehled", secondary link "Stáhnout PDF", unsubscribe + privacy footer.
  - [ ] Email content is byte-equivalent to the authored brief modulo the IA-declared email deltas: ≤ 400-word budget, single-observation selection, single-snippet selection, no closing actions list (routed to web view instead), no images beyond the ČS wordmark.
  - [ ] Email copy is Czech only (A-004); no English appears anywhere including technical footers.
  - [ ] Email omits the teaser benchmark snippet entirely if its `confidenceState !== 'valid'` ([information-architecture.md §4.3](../design/information-architecture.md)); the degraded-state copy never appears in email.
  - [ ] Email does not contain any "next brief on X" or recurring-cadence phrasing (A-005 / B-001).
  - [ ] Email is not sent to any recipient whose consent is not active at send time (§6 non-negotiable, D-012 stop-flow).

### US-2 — Owner reads the full brief in George Business WebView
**As a** SME owner referred by my RM, **I want** to open the brief inside George Business without logging in again, **so that** I can read the full brief in the context where my banking already lives.

- Acceptance criteria:
  - [ ] The web view renders the full six-component structure from [information-architecture.md §3 Surface B](../design/information-architecture.md): header, opening summary, observations (2–4), benchmark snippets (four D-011 categories in a collapsible accordion), closing actions (2–4), footer with PDF CTA and "Zpět do George".
  - [ ] Content across web view vs. email vs. PDF is identical modulo the IA-declared per-surface deltas; the authored text, the analyst-selected teasers, and the benchmark snippet verdicts are the same.
  - [ ] Identity comes from the George Business session-token handoff per [ADR-0001-E](../engineering/adr-0001-tech-stack.md); the stub at MVP is the redirect-with-signed-JWT mechanism and no separate login is shown to the owner.
  - [ ] First visit in the WebView shows the consent screen before any brief content loads, per [information-architecture.md §3 Surface B](../design/information-architecture.md) and [D-008](../project/decision-log.md).
  - [ ] A recipient with no active consent event receives no brief content from the web view endpoint — the route returns the consent screen (first visit) or the revoked-state surface (post-revocation); the brief body is never served. (D-012 stop-flow.)
  - [ ] Benchmark snippets below the validity floor render the degraded-state copy defined in [information-architecture.md §5](../design/information-architecture.md), not a low-confidence number (A-017).

### US-3 — Owner downloads the PDF and forwards it to their accountant manually
**As a** SME owner, **I want** to download the full brief as a PDF, **so that** I can keep my own copy and forward it to my accountant without any sharing feature inside the product.

- Acceptance criteria:
  - [ ] The PDF is triggered from the web view footer ("Stáhnout přehled jako PDF") or the email secondary link ("Stáhnout PDF"); both paths resolve to the same PDF artifact for a given brief version.
  - [ ] The PDF renders all six components fully expanded ([information-architecture.md §3 Surface C](../design/information-architecture.md)) — no accordion, no interactive elements — and fits the PRD §8.1 "2–3 page" spec.
  - [ ] The PDF page footer contains the confidentiality notice: "Důvěrné — jen pro interní potřebu firmy · Česká Spořitelna · {{měsíc}} {{rok}}" exactly as specified in [information-architecture.md §5](../design/information-architecture.md).
  - [ ] No in-product share-link, no "email to advisor" CTA, no guest-view provisioning is surfaced anywhere in the PDF download flow (D-009 / A-009 / B-002).
  - [ ] The download URL is signed with short TTL per [ADR-0002-F](../engineering/adr-0002-brief-storage-and-delivery.md); an unauthenticated request for the PDF is rejected.
  - [ ] The PDF download button transitions to its unavailable state ("PDF není momentálně k dispozici.") if the artifact is not yet generated or has been withdrawn; no retry loop, no error stack trace surfaced to the owner.
  - [ ] Download fidelity: the PDF matches the web view's content modulo the IA-declared PDF deltas (formal typography, all-expanded, confidentiality footer, no interactive elements).

### US-4 — Owner's consent revocation stops all future delivery
**As a** SME owner, **I want** revoking my consent in Settings > Soukromí to stop the product from sending me further briefs, **so that** I can trust that the revoke action actually ends the flow.

- Acceptance criteria:
  - [ ] After a `revoke` consent event (per [privacy-architecture.md §4](../data/privacy-architecture.md) and [D-012](../project/decision-log.md)), no new email is sent to that recipient for any brief published after the revoke timestamp.
  - [ ] After revocation, the web view endpoint no longer serves brief content to that recipient; the owner sees the post-revocation surface defined in [trust-and-consent-patterns.md §6](../design/trust-and-consent-patterns.md).
  - [ ] After revocation, the PDF download endpoint rejects new requests for briefs published after the revoke timestamp.
  - [ ] Previously-sent emails and previously-downloaded PDFs are not retracted (D-012 stop-flow, no retroactive deletion).
  - [ ] Every consent-based block is recorded as a suppressed-delivery event (see US-5 delivery records); the absence of a send is not an invisible non-event.

### US-5 — ČS operations can audit who received which brief version when
**As a** ČS operator (analyst or admin), **I want** a delivery record for each (brief, recipient, surface) tuple, **so that** we have a traceable answer to "did this owner receive this brief?"

- Acceptance criteria:
  - [ ] Every successful email send writes a delivery record with `brief_id`, `brief_version`, `recipient_id`, `format = email`, `delivered_at`, and `data_lane = brief` per [ADR-0002-B](../engineering/adr-0002-brief-storage-and-delivery.md).
  - [ ] Every successful web view page load writes a delivery record with `format = web` and the same keying.
  - [ ] Every PDF download writes a delivery record with `format = pdf`.
  - [ ] A consent-revocation-suppressed delivery attempt is recorded (reason: revoked) so operations can distinguish "never sent" from "sent and failed."
  - [ ] Delivery records live in the `brief` data lane only; no PII beyond the recipient identifier already in that lane is added (A-015, D-010).

### US-6 — ČS analyst sees all three surfaces render consistently from the same authored brief
**As a** ČS analyst, **I want** the three delivery surfaces to render the same brief I authored, differing only where the IA declares a per-surface delta, **so that** the owner sees a coherent product regardless of which surface they land on first.

- Acceptance criteria:
  - [ ] The three surfaces share a single source of truth — the authored brief record in `brief_db` per [ADR-0002-B](../engineering/adr-0002-brief-storage-and-delivery.md). None of the three surfaces re-authors copy or rewrites the opening summary.
  - [ ] Benchmark snippet values rendered across all three surfaces come from the `benchmark_snippet` jsonb captured at publish time per [ADR-0002-E](../engineering/adr-0002-brief-storage-and-delivery.md); no surface re-resolves cohort data at render time.
  - [ ] The declared IA deltas (email length budget, PDF formal variant, web accordion) are the only permitted content differences; any other divergence is a bug.
  - [ ] If the authored brief is edited and republished (version N+1), email and PDF remain point-in-time snapshots at version N per [ADR-0002-D](../engineering/adr-0002-brief-storage-and-delivery.md); the web view shows the latest version. This asymmetry is accepted for MVP; version-mismatch surfacing is deferred to Phase 2 work ([OQ-011](../project/open-questions.md)).

## 4. Scope

- **In scope (MVP):**
  - Publish-time synchronous render of the authored brief to all three surfaces (email, web view, PDF) per [ADR-0002-E](../engineering/adr-0002-brief-storage-and-delivery.md).
  - Identical brief content across surfaces modulo the IA-declared per-surface deltas ([information-architecture.md §3](../design/information-architecture.md)): email condensed-and-teasered, web-view full and interactive (accordion), PDF fully-expanded with formal footer.
  - Consent gating on every surface: no delivery to a recipient without an active consent event (D-007 / D-008 / D-012).
  - Delivery records per (brief, recipient, surface) tuple, including suppressed-by-revocation attempts.
  - Owner-initiated PDF download from the web view and from the email secondary link; short-TTL signed URL per [ADR-0002-F](../engineering/adr-0002-brief-storage-and-delivery.md).
  - George Business redirect-with-signed-JWT stub per [ADR-0001-E](../engineering/adr-0001-tech-stack.md) for the bank-referred primary path.
  - Suppression of benchmark snippets below the statistical-validity floor on every surface, per the rules in [information-architecture.md §4.3](../design/information-architecture.md) and [A-017](assumption-log.md) (email omits; web view and PDF render degraded-state copy).
  - Czech-only copy on every surface (A-004).

- **Out of scope (explicit markers):**
  - **In-product sharing UI.** No share-link generator, no "forward to advisor" button, no read-only guest view, no named advisor seat. Per [B-002](../project/backlog.md) / [D-009](../project/decision-log.md) / [A-009](assumption-log.md). Owner-initiated PDF download is the MVP workaround.
  - **Cadence scheduling or send-time optimization.** No "publish on X date" picker, no per-recipient send-time tuning, no subscription-settings UI. Per [B-001](../project/backlog.md) / [D-005](../project/decision-log.md) / [A-005](assumption-log.md).
  - **Delivery retry / queue orchestration for high volume.** The synchronous pipeline ([ADR-0002-E](../engineering/adr-0002-brief-storage-and-delivery.md)) is sufficient for the trial's small recipient counts per [A-010](assumption-log.md) and [OQ-012](../project/open-questions.md). Moving to a background queue is a post-trial decision.
  - **Separate editorial copy for email vs. web beyond IA deltas.** The analyst authors one brief; this feature does not introduce a "write a different email teaser body" workflow beyond the email-teaser selection already owned by [monthly-briefing-generation.md US-4](monthly-briefing-generation.md).
  - **Push notifications, SMS, in-app badges.** The three surfaces named in PRD §9 are the full delivery set at MVP.
  - **Version-mismatch surfacing.** If a brief is edited after email/PDF delivery and before a web view visit, the web view shows the later version; no "updated since we emailed you" notice is shown. Deferred per [OQ-011](../project/open-questions.md) and [ADR-0002-D](../engineering/adr-0002-brief-storage-and-delivery.md).
  - **Full iframe embedding in George Business.** MVP ships the redirect-with-signed-JWT stub per [ADR-0001-E](../engineering/adr-0001-tech-stack.md); full iframe integration (CSP, X-Frame-Options, SSO) is a Phase 2 ČS-liaison workstream per [OQ-008](../project/open-questions.md).
  - **Brief authoring, preview, and publish.** Owned by [monthly-briefing-generation.md](monthly-briefing-generation.md). This feature consumes a published artifact and does not modify it.
  - **Cohort math, percentile computation, quartile assignment.** Owned by Track B features and [cohort-math.md](../data/cohort-math.md). This feature renders the precomputed `benchmark_snippet` as captured at publish time.
  - **Onboarding (sector profile capture).** Owned by [sector-profile-configuration.md](sector-profile-configuration.md) (Track C sibling).
  - **Give-to-get capture.** Per [A-013](assumption-log.md) / CLAUDE.md.
  - **RM-visible delivery of any content.** Per [A-002](assumption-log.md) / [D-002](../project/decision-log.md).

- **Increment:** MVP (Increment 1) — pulled forward from Increment 3 per PRD §9.

## 5. Success metrics

Ties to PRD §6 Goal 1 (Engagement) primarily; delivery is where G1 is measured.

- **Monthly brief open rate** (PRD §6 Goal 1). Direction: up-and-right. *How measured:* Resend open-tracking pixel per [ADR-0001-B](../engineering/adr-0001-tech-stack.md) plus the email delivery record (US-5); denominator = emails sent (excluding revocation-suppressed).
- **Email click-through on "Přečíst celý přehled"** (proxy for the brief-reaches-web-view journey, maps to PRD §6 Goal 1 observation click-throughs). Direction: up. *How measured:* Resend click-tracking.
- **PDF download rate** (proxy for §6 "share-to-advisor/accountant rate" under A-009: the PDF is the only forwardable artifact). Direction: up, but no target set — the metric itself measures whether B-002 should reopen. *How measured:* count of `brief_deliveries` rows with `format = pdf`.
- **Web view time-spent per brief** (PRD §6 Goal 1). Direction: up. *How measured:* front-end session instrumentation on the web view surface.
- **Three-surface content fidelity** (operational, not user-facing). Directional target: zero unexplained divergences beyond IA deltas. *How measured:* integration test in [ADR-0002 test plan](../engineering/adr-0002-brief-storage-and-delivery.md) comparing authored content against each rendered surface.
- **Consent-gate correctness** (operational). Target: zero deliveries to recipients with a revoked consent event at send time. *How measured:* invariant check in the delivery pipeline and a reconciliation audit between `consent_events` and `brief_deliveries`.
- **Time-to-first-verdict ≤ 60 seconds** for the bank-referred path (PRD §6 cross-cutting activation). *How measured:* timestamp from "owner taps George card" to "web view brief-detail rendered." Contingent on the George redirect stub (ADR-0001-E) staying fast in the trial environment.

## 6. Non-negotiables

Principles from PRD §7 that bind implementation across all three surfaces:

- **§7.1 Briefs are the atomic unit of value.** No surface in this feature emits anything that is not part of a published brief. The email is a brief-teaser, not a newsletter. The web view is a brief-reader, not a benchmark-browser. The PDF is a brief-snapshot, not a report.
- **§7.2 Verdicts, not datasets.** All three surfaces must carry verdicts; the IA-declared deltas cannot strip a verdict and leave a raw number behind. The email omits the closing-actions list (routed to web view) but keeps the opening-summary verdict and the teaser observation's verdict intact.
- **§7.3 Plain language, no jargon.** Any rendering-layer copy owned by this feature (error states, unavailable states, unsubscribe text) is plain Czech. No statistical notation leaks into any surface via degraded-state messaging (A-017: suppressed snippets show user-friendly copy, never "n<30" or "p=").
- **§7.4 Proof of value before anything else.** The bank-referred flow from George tap → consent → first brief must meet the ≤ 60s time-to-first-verdict target (PRD §6). Delivery cannot introduce configuration screens, loading gates, or onboarding prompts between the consent event and the first brief render.
- **§7.5 Privacy as product.** Every delivery artifact and record lives in the `brief` data lane (D-010); the PDF storage keys never carry user PII; the web view endpoint enforces consent and lane via RLS per [ADR-0002-C](../engineering/adr-0002-brief-storage-and-delivery.md). No cross-lane data appears on any surface. No client-level financial data appears in any snippet — only cohort-aggregate verdicts (A-015).
- **§7.6 Opportunity-flavored, not risk-flavored.** This feature ships no RM-visible surface at MVP (A-002); when RM delivery eventually ships in a later increment, it inherits the framing principle — this feature's architectural posture does not prefigure a "risk flag" surface.
- **§7.7 Bank-native distribution.** The primary delivery surface is the George Business WebView via redirect-with-signed-JWT stub (A-014 / ADR-0001-E). Direct web is a secondary entry; email routes to the same web view regardless of entry path.
- **§7.8 Every interaction is a data-acquisition opportunity — in mind, not in build.** No give-to-get capture UI appears in any of the three surfaces at MVP (A-013). The surfaces are instrumented for engagement (opens, clicks, time-spent) as per §5; no data-collection prompt fires during delivery.

Additional non-negotiables specific to delivery mechanics:

- **Consent gate is delivery-blocking, not warning-only.** Revocation ([D-012](../project/decision-log.md)) stops future email send, blocks future web view content, and invalidates future PDF download; it does not produce a "your consent is revoked, confirm to continue" dialog. The revocation surface in [trust-and-consent-patterns.md §6](../design/trust-and-consent-patterns.md) is the user's only in-product touchpoint post-revocation.
- **Statistical-validity floor suppression is silent-to-user on every surface.** The email omits the snippet entirely; the web view and PDF render the degraded-state copy from [information-architecture.md §5](../design/information-architecture.md); no surface surfaces a raw percentile without its quartile-named verdict (A-017, [mvp-metric-list.md](mvp-metric-list.md) constraint #3).
- **Per-surface deltas are explicit and IA-owned.** Any new delta requires an update to [information-architecture.md §3](../design/information-architecture.md) and a corresponding PRD revision here; deltas cannot accrete in rendering code unreviewed.

## 7. Open questions

Numbered; all flagged in the return message for orchestrator transcription into `docs/project/open-questions.md`.

1. **Q-MFD-001 — Email delivery address source at MVP.** The `brief_deliveries.recipient_id` field per [ADR-0002-B](../engineering/adr-0002-brief-storage-and-delivery.md) identifies the recipient for delivery-record purposes, but the actual email address used for Resend send is not specified in current artifacts. Under [A-001](assumption-log.md) (hand-assigned cohorts on pre-populated data), is the email address supplied by ČS with the seed dataset, entered by the analyst at brief-publish time, or captured in sector-profile configuration? This question intersects with [sector-profile-configuration.md](sector-profile-configuration.md) (Track C sibling) and [OQ-013](../project/open-questions.md) (owner first-name availability). Flagged for orchestrator / Track C PM reconciliation.
2. **Q-MFD-002 — Unsubscribe link behavior and its relationship to consent revocation.** The email footer includes "Odhlásit se z přehledů" per [information-architecture.md §5](../design/information-architecture.md). Under [D-007](../project/decision-log.md) (single opt-in covering all lanes), is unsubscribe a full consent-revocation (equivalent to Settings > Soukromí revoke per D-012) or an email-channel-only suppression? A legal requirement for unsubscribe ([CAN-SPAM / eCommerce directive equivalents]) likely mandates email-only suppression, but this creates a second revocation primitive that is inconsistent with the single-opt-in model. Flagged for legal-review routing alongside [OQ-004](../project/open-questions.md).
3. **Q-MFD-003 — Direct-web secondary path identity and consent entry point.** PRD §11 names direct sign-up as the secondary channel; [A-014](assumption-log.md) reaffirms this. The George redirect-with-JWT stub ([ADR-0001-E](../engineering/adr-0001-tech-stack.md)) covers the bank-referred primary path, but the direct-web path's identity mechanism (is there a login? does the email link itself carry a token?) and consent entry point (does the consent screen show before the first direct-web brief view, as it does in the WebView?) are not specified. Flagged for cross-feature reconciliation with [sector-profile-configuration.md](sector-profile-configuration.md).
4. **Q-MFD-004 — Web view delivery-record write semantics.** US-5 and [ADR-0002-E](../engineering/adr-0002-brief-storage-and-delivery.md) write a `brief_delivery` row on web view GET. It is ambiguous whether every refresh writes a new row (N visits = N rows) or whether the first-per-recipient visit writes one and subsequent visits are idempotent. The engagement metric interpretation (return-visit rate vs. unique open rate in PRD §6) depends on this. Flagged for engineer's Phase 2 implementation notes.
5. **Q-MFD-005 — PDF link TTL expiry UX when a forwarded PDF is opened by a third party.** [ADR-0002-F](../engineering/adr-0002-brief-storage-and-delivery.md) signs PDF URLs with a short TTL (~1 hour). Under [A-009](assumption-log.md), the owner is expected to download the file and forward the bytes; the link itself is not the forwarding artifact. But if an owner shares the link rather than the file, the accountant sees a 403/expired response with no context. Is the MVP stance "the file is the artifact, never the link" (acceptable; needs framing in the PDF download CTA copy) or do we need an expired-link landing page? Flagged for designer review.
6. **New glossary term candidate — "Delivery record."** A (brief, brief_version, recipient, format) tuple with a timestamp, stored in `brief_deliveries` per ADR-0002-B. Distinct from "brief artifact" (the authored content) and "brief delivery" (the operational act). Not added to the glossary here per the orchestrator brief's constraint; flagged in the return message for orchestrator to batch.

## 8. Downstream artifacts

- **Design**: `docs/design/multi-format-delivery/` — *not yet drafted; may not be required.* The authoritative per-surface IA is [information-architecture.md](../design/information-architecture.md) §2–§5, which already covers every screen, component, state, and copy string this feature needs. A dedicated design directory is only needed if a new surface-specific screen state (e.g., expired-PDF-link landing page per Q-MFD-005, or an unsubscribe confirmation screen per Q-MFD-002) emerges during Phase 2. If none emerge, this feature consumes IA directly with no dedicated design artifact.
- **Data**: Not applicable — no new data model. This feature reads from `brief_db` (authored content and benchmark_snippet jsonb), writes to `brief_deliveries` (existing table per [ADR-0002-B](../engineering/adr-0002-brief-storage-and-delivery.md)), and reads the consent event log for gating (per [privacy-architecture.md §4](../data/privacy-architecture.md)). No addendum to `docs/data/` is required unless the consent-gate query pattern surfaces a cross-lane concern; in that case data-engineer will add one and link here.
- **Engineering**: `docs/engineering/multi-format-delivery.md` — not yet drafted. Will cover the per-surface rendering pipelines (React Email template for email, Next.js route for web view, Puppeteer-plus-signed-URL for PDF), the consent-gate check implementation, the delivery-record write pattern, the PDF storage key scheme, and the George redirect-with-JWT integration. Resolves [OQ-010](../project/open-questions.md) (`@sparticuz/chromium` compatibility), [OQ-011](../project/open-questions.md) (version-mismatch surfacing), [OQ-012](../project/open-questions.md) (synchronous-pipeline scale), and [OQ-014](../project/open-questions.md) (atomic consent commit + navigation) during Phase 2.

## Changelog

- 2026-04-20 — initial draft — product-manager
