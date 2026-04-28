# Pulz oboru

*Owner: product-manager · Slug: pulz-oboru · Last updated: 2026-04-28*

## 0. Scope note and framing discipline

This spec governs the **owner-facing Pulz oboru section** that lives on the v0.3 dashboard at `/`, between Section 1 (cohort tile grid per [dashboard-v0-2.md](dashboard-v0-2.md)) and Section 2 (Analýzy briefs list, [D-019](../project/decision-log.md)). Pulz oboru is **a brief surface in its own right** — it surfaces the most recent published ČS sector analysis for the owner's NACE division as a synthesis of three analyst-selected chart tiles, a 3–6-sentence summary, an optional deep-dive PDF link, and 1–3 time-horizon-tagged actions. It is **not** a separate top-level route, **not** a tab, **not** a peer-comparison surface, and **not** the long-form publication itself.

The design spec at [docs/design/pulz-oboru.md](../design/pulz-oboru.md) is upstream of this PM doc — it was commissioned directly by the orchestrator before this product doc existed. This file backfills the PM lane: it confirms the de-facto data contract the design implies, locks user stories and acceptance criteria, takes a position on four of the design's nine open questions, defers the other five with explicit reasons, and makes the Czech copy decisions canonical.

**Out of lane for this spec.** Visual styling (tokens, spacing, hex values, typography, breakpoints, focus-ring details) is the designer's lane. Static-image render mechanics, CDN routing, image storage, alt-text input form mechanics, the analyst upload flow, and the database schema for analysis content are engineering / data-engineering lanes. The **admin-side upload flow** is an explicit follow-up — see §4 dependencies.

## 1. Summary

Pulz oboru is a new section on the v0.3 dashboard that surfaces the most recent ČS sector analysis for the owner's NACE division as a 30-second-readable synthesis. Three analyst-selected chart tiles each lead with a one-sentence verdict; a short summary text block follows; an optional PDF link offers the full publication as a deep-dive; an action box closes with 1–3 time-horizon-tagged steps. For the owner, the section answers a different question than the cohort tiles above it: **the tiles tell you where you stand; Pulz oboru tells you what the ground in your sector is doing and what to do about it.**

Pulz oboru is the v0.3 dashboard's day-one proof that Strategy Radar carries sector intelligence, not just peer ratios — without making the owner click into a brief detail page first.

## 2. Upstream links

- **PRD sections:**
  - [§1 Summary](../../PRD/PRD.md#1-summary) — briefs are the atomic unit of value at MVP. Pulz oboru is a brief surface (synthesis-with-actions), not a peer-comparison tile.
  - [§7.1 Day-one proof of value](../../PRD/PRD.md#7-product-principles) — the section renders without configuration; the verdict-bearing tiles are above the fold once the owner scrolls past the cohort tile grid.
  - [§7.2 Verdicts, not datasets](../../PRD/PRD.md#7-product-principles) — every chart tile leads with a verdict sentence; the chart image is the proof, never the headline.
  - [§7.3 Plain language](../../PRD/PRD.md#7-product-principles) — formal vykání, no statistical notation, no analyst-register prose at the section level (the optional PDF carries the analyst register).
  - [§7.4 Proof of value before anything else](../../PRD/PRD.md#7-product-principles) — Pulz oboru is the day-one demonstration that the product reads the owner's sector, not just their ratios.
  - [§7.5 Privacy as product](../../PRD/PRD.md#7-product-principles) — the section reads from the `brief` lane only ([D-010](../project/decision-log.md)). No `user_contributed`, `rm_visible`, or `credit_risk` lane is touched. Charts may use ČS-aggregate transaction data, never per-owner data (see §7 below).
  - [§7.6 Opportunity-flavored, not risk-flavored](../../PRD/PRD.md#7-product-principles) — the action box uses opportunity verbs ("zkontrolujte", "zmapujte", "zvažte") only. Risk-framed actions are an authoring failure.
  - [§7.7 Bank-native distribution](../../PRD/PRD.md#7-product-principles) — the PDF link cites Ekonomické a strategické analýzy České spořitelny, reinforcing the bank-native source the trust-transfer relies on.
  - [§7.8 Give-to-get in mind, not in build](../../PRD/PRD.md#7-product-principles) — the empty-state has no "notify me" capture; the section deliberately omits any data-capture field.
  - [§8.1 Sector Briefing Engine](../../PRD/PRD.md#81-sector-briefing-engine--what-this-means-for-you-primary-mvp) — Pulz oboru is a synthesis surface inside §8.1's scope, not a new product surface. Analyst-authored, human-curated, no automated generation at MVP.
  - [§9 Release plan](../../PRD/PRD.md#9-release-plan) — Increment 1 (MVP) compatible. Carries forward unchanged: Plain-Language Translation, Action Specificity Framing, Multi-Format Delivery (web view branch only at v0.3).

- **ČS business goals served:**
  - **G1 Engagement** — Pulz oboru is the primary monthly-return reason on the dashboard. A new sector analysis ships → the section updates → the owner has a fresh reason to re-engage. The chart tiles + verdicts read in well under a minute, satisfying the §6 "time spent per brief" engagement signal at the section grain.
  - **G2 Data depth and cadence** — Indirect at MVP. An owner reading a sector finding ("e-commerce roste o 18 %") is the owner most likely to want their own channel-mix data updated when the give-to-get loop ships in Increment 3. Pulz oboru is designed *with* this in mind but does **not** build the capture — see §6 non-negotiables.
  - **G3 RM lead generation** — Not served at MVP. The section emits no RM-visible signal ([D-002](../project/decision-log.md)). Future increments may treat owner engagement with a Pulz oboru action as an opportunity-flavored intent signal, but no such routing exists at v0.3.

- **Related decisions:**
  - [D-001](../project/decision-log.md) — hand-assigned cohorts on pre-populated data. Pulz oboru is hand-published per (NACE × period) by analysts; the same pattern.
  - [D-002](../project/decision-log.md) — no RM Lead Signal Surface at MVP. Inherited.
  - [D-010](../project/decision-log.md) — canonical lane identifiers. Pulz oboru reads `brief` only.
  - [D-018](../project/decision-log.md) — header wordmark "Česká Spořitelna · Strategy Radar". Section sits below it, unchanged.
  - [D-019](../project/decision-log.md) — "Analýzy" is the dashboard list heading for the briefs list (Section 3). Pulz oboru is **Section 2**, separate from Analýzy. The naming family ([brief-page-v0-2.md](brief-page-v0-2.md) §10) gains no new term — Pulz oboru is the **section name**, not a content-unit term.
  - [D-020](../project/decision-log.md) — hybrid publication placement on the brief detail page; "Sektorová analýza" label. Pulz oboru is an **embedded** brief surface; the long-form analyst publication remains on the brief detail page. Pulz oboru's PDF link is the *deep-dive escape hatch*, not the headline.
  - [D-023](../project/decision-log.md) — v0.3 demo owner = real Czech firm by IČO. Pulz oboru inherits the active demo owner's NACE division for the analysis lookup.
  - [D-026](../project/decision-log.md), [D-027](../project/decision-log.md) — Track C analysis automation; NACE 31 (furniture) + NACE 49 (road freight) at first PoC cut. Pulz oboru renders for either active demo NACE; analyses for both NACEs must exist before the section is end-to-end demoable.

- **Build plan:** v0.3 ([build-plan.md §11](../project/build-plan.md)). Branch `trial-v0-3-analyzy`. Pulz oboru is part of Track C's owner-facing surface for the n8n / Claude-Code-orchestrated analysis pipeline.

- **Sibling product specs:** [dashboard-v0-2.md](dashboard-v0-2.md) (Section 1 cohort tile grid + Section 3 Analýzy list — both stay in force; this spec adds Section 2 between them); [brief-page-v0-2.md](brief-page-v0-2.md) (the brief detail page; the PDF link from Pulz oboru opens a downloadable file, **not** a brief page route).

## 3. User stories

### US-1 — Owner orients on the sector in under 30 seconds

- **As a** Czech SME owner-operator landing on `/` (active demo IČO maps to a NACE division covered by a published analysis),
- **I want** to see what is happening in my sector right now, distilled to three verdict-led tiles and a short summary,
- **so that** I can absorb the sector picture without opening a PDF or a brief detail page.
- **Acceptance criteria:**
  - [ ] Pulz oboru renders as the third section of `/`, between cohort tiles (Section 1) and Analýzy list (Section 3), in that fixed order.
  - [ ] The section renders without any configuration step, modal, or expand-to-load click.
  - [ ] Each chart tile leads with a one-sentence verdict in plain Czech, above the chart image.
  - [ ] The summary text block is 3–6 sentences, formal vykání, no statistical notation.
  - [ ] The owner can read all three verdicts and the summary inside the testing-observation window (~30 seconds, as a moderator-observable heuristic).

### US-2 — Owner takes the deep dive

- **As an** owner who finds the section relevant and wants to verify the source,
- **I want** to download the full ČS publication as a PDF,
- **so that** I can read the analyst-register original and confirm the synthesis is grounded.
- **Acceptance criteria:**
  - [ ] If the analyst attached a PDF, a single PDF link renders below the summary text, labelled "Stáhnout celou analýzu (PDF)" with a source/period subline.
  - [ ] The link uses `<a download>`; no new tab, no clipboard, no in-browser viewer modal at v0.3.
  - [ ] If the analyst did **not** attach a PDF, the link block is omitted silently — no "PDF not available" placeholder. The rest of the section renders unchanged. (Per §4 below: PDF is **optional** at MVP.)
  - [ ] The PDF link is visually secondary to the verdict tiles and the action box — it is a deep-dive support, not the headline.

### US-3 — Owner notes 1–3 actions

- **As an** owner who has read the verdicts and summary,
- **I want** 1–3 concrete, time-horizon-tagged actions framed as opportunities, not warnings,
- **so that** I leave the section with at least one specific next step in mind.
- **Acceptance criteria:**
  - [ ] The action box renders below the PDF link (or below the summary, if no PDF), under an `<h3>Doporučené kroky</h3>` heading.
  - [ ] Each action carries a time-horizon pill drawn from the frozen enum (Okamžitě / Do 3 měsíců / Do 12 měsíců / Více než rok — same enum as [action-specificity-framing.md](action-specificity-framing.md)).
  - [ ] Actions read as opportunity-flavored ("zkontrolujte", "zmapujte", "zvažte"); no action reads as a credit-risk warning or as bank surveillance.
  - [ ] Action count is between 1 and 3 inclusive. Zero actions = the action box is omitted entirely (no `<h3>`, no empty state). Four+ actions is an authoring error blocked by the admin upload form (admin-flow scope, not this spec).

### US-4 — Owner whose NACE has no published analysis (empty state)

- **As an** owner whose active NACE division has no Pulz oboru publication yet (e.g., a NACE outside the Track C PoC scope of 31 + 49 per [D-027](../project/decision-log.md)),
- **I want** the section to tell me plainly that an analysis is being prepared,
- **so that** I do not interpret the gap as a product error or as something I need to fix.
- **Acceptance criteria:**
  - [ ] An EmptyStateCard renders in place of the four content blocks, with the section heading and date subline omitted (no fake metadata).
  - [ ] Copy: heading "Analýza pro váš obor se připravuje", body "Jakmile analytici České spořitelny vydají přehled pro váš sektor, zobrazí se zde."
  - [ ] **No "Notify me" CTA, no email capture, no any-data-input field.** Per [PRD §9 Increment 3](../../PRD/PRD.md#9-release-plan) and CLAUDE.md guardrails, give-to-get capture is not built at MVP.
  - [ ] The Section 1 cohort tile grid above and the Section 3 Analýzy list below render normally; only Section 2 is in the empty state.

### US-5 — Owner whose published analysis is older than one quarter (stale state)

- **As an** owner whose NACE has a published analysis but `published_at` is more than ~91 days ago,
- **I want** the section to surface the staleness clearly without hiding the content,
- **so that** I calibrate my trust in the verdicts to their age.
- **Acceptance criteria:**
  - [ ] All four content blocks (tiles, summary, PDF link, actions) render exactly as in the default state.
  - [ ] A StaleWarningBadge renders between the section heading and the publication-date subline, copy: "Tato analýza pochází z {month_year}. Aktuálnější data zatím nejsou k dispozici." (`{month_year}` is Czech-formatted, lower-case, genitive — e.g., "ledna 2026").
  - [ ] The badge carries a warning-triangle character (⚠) and the text — color is not the only signal.
  - [ ] **Stale threshold = 91 days from `published_at`** (see §4 below for cadence rationale).

### US-6 — Owner encounters a transient fetch error

- **As an** owner whose dashboard load partially fails for the Pulz oboru section (e.g., Supabase REST timeout on the analysis lookup),
- **I want** an error card with a retry option scoped to this section only,
- **so that** I can recover without losing the cohort tiles or briefs list above and below.
- **Acceptance criteria:**
  - [ ] An ErrorCard renders in place of the four content blocks with copy "Informace o vašem oboru se nepodařilo načíst." and a "Zkusit znovu" link.
  - [ ] The retry refreshes only Pulz oboru — the cohort tile grid and Analýzy list above and below remain rendered.
  - [ ] The ErrorCard is visually distinguishable from the EmptyStateCard (designer's lane: solid border vs. dashed). PM only asserts the distinction must exist — the user must not confuse "no analysis yet" with "load failure".

## 4. Scope and content data contract

### 4.1 In scope

- The Pulz oboru section's information architecture inside the dashboard at `/`: heading, optional stale badge, publication-date subline, three chart tiles, summary text block, optional PDF link, action box.
- The **content data contract** between analyst-uploaded analysis content and the rendering layer (§4.3 below).
- All user-facing Czech copy on the Pulz oboru section (§5 below).
- Acceptance criteria for the section's screen states: default, stale, empty, error (US-1 through US-6).
- Resolutions to the design's open questions for which a PM call is appropriate: Q-PO-001 (data contract), Q-PO-004 (source attribution), Q-PO-005 (PDF mandatory), Q-PO-008 (stale threshold).
- Czech copy confirmation on heading "Pulz oboru", section copy, action labels, microcopy (§5 confirms the design draft).

### 4.2 Out of scope

- Visual design (tile sizing, grid breakpoints, color hex values, typography, focus ring details, mobile collapse rules). Owned by [docs/design/pulz-oboru.md](../design/pulz-oboru.md).
- Static-image rendering / hosting / CDN choice. Owned by engineer.
- Alt-text input mechanics on the admin upload form. Owned by admin-flow design (deferred — see §4.5).
- Database schema for the `analyses` table or the JSONB shape that holds chart-tile records. Owned by data-engineer (deferred — see §4.5).
- The admin-side upload flow itself: how an analyst picks 3 charts, writes verdicts, attaches a PDF, assigns NACE + period, and publishes. **Explicitly deferred to a separate spec.** Blocks engineering implementation start; does not block this PM doc or the design spec.
- A "notify me when an analysis is ready" CTA in the empty state. **Explicitly out of MVP** per CLAUDE.md guardrail (give-to-get is Increment 3+).
- Multi-NACE owner profiles (an owner with multiple NACE divisions). Inherits single-NACE constraint from [D-023](../project/decision-log.md) demo owner; deferred to post-MVP.
- Email or PDF delivery surfaces. The Pulz oboru section is **web-view-only at v0.3**; the PDF link inside the section delivers the full ČS publication PDF to the owner's device, but Pulz oboru as a section is not packaged into a delivered email or generated PDF.
- George Business embedding posture (CSP, X-Frame-Options, SSO handoff). Inherits from [OQ-008](../project/open-questions.md); v0.3 demo runs in a standalone web view.
- Any RM-visible output from owner engagement with the section.

### 4.3 Content data contract — canonical fields per published analysis

A Pulz oboru publication is uniquely identified by **(NACE division, publication period)**. The analyst supplies the following fields at upload time. **Confirms the de-facto contract implied by the design spec** (Q-PO-001 resolved; see §7 below) with two clarifications: PDF is optional (§4.4 Q-PO-005), source attribution per chart is required when the chart uses ČS internal data (§7 Q-PO-004).

| Field | Type | Required? | Notes |
|---|---|---|---|
| `nace_division` | string (CZ-NACE 2-digit) | required | E.g., "31" (furniture) or "49" (road freight). Must match the active demo owner's NACE for the section to render with this analysis. |
| `nace_label_czech` | string | required | Czech division name, e.g., "Výroba nábytku". Source: existing NACE division dictionary. |
| `publication_period` | string (Czech-formatted period label) | required | E.g., "2. čtvrtletí 2026". Free-form analyst-authored; rendered verbatim in the publication-date subline and the PDF link subline. The cadence the analyst publishes at (quarterly assumed at v0.3 — see §4.4 Q-PO-008) is encoded here. |
| `published_at` | timestamp | required | The moment the analysis went live. Drives the stale-threshold check (§4.4 Q-PO-008) and the Czech-month-name formatting in the StaleWarningBadge. |
| `chart_tiles` | array of exactly 3 `ChartTile` records | required | Below-three is **not** a valid published state — the analyst upload form must enforce this, otherwise the section degrades visually. Above-three is also blocked at the upload form (the section renders three only). Admin-flow scope. |
| `chart_tiles[i].image_url` | URL | required | Static `<img>` source. PNG or SVG. Engineer's lane: storage, CDN, signed-URL refresh. |
| `chart_tiles[i].alt_text` | string | required | Substantive description for screen readers. **Mandatory at the upload form** (Q-PO-003 design-spec scope) — without it accessibility certification fails. PM does not propose a length floor here; designer / accessibility checklist enforces "substantive, not generic". |
| `chart_tiles[i].verdict` | string (one sentence, plain Czech) | required | The verdict-leading sentence rendered above the chart image in the tile. Hard one-sentence constraint enforced at the upload form. Plain-language rules from [plain-language-translation.md](plain-language-translation.md) §6 apply. |
| `chart_tiles[i].caption` | string | optional | One-line caption / source attribution rendered below the chart image. **Required when the chart uses ČS internal data** — see Q-PO-004 in §7. Otherwise optional. |
| `summary_text` | string (3–6 sentences, plain Czech) | required | The summary block. Formal vykání. Soft cap of 6 sentences enforced at upload time (admin-flow scope); hard cap of 10 sentences if a fallback is needed. |
| `pdf_url` | URL | **optional** (Q-PO-005 resolved) | If present, the PDF link block renders. If absent, the link block is omitted silently. See §4.4 below. |
| `pdf_source_label` | string | required when `pdf_url` is present | E.g., "Ekonomické a strategické analýzy České spořitelny". Renders in the PDF link subline. Free-form; analyst-authored. Defaults to a constant if the analyst leaves it blank — admin-flow scope. |
| `actions` | array of 1–3 `Action` records | required | Same shape as the brief detail page's `ClosingAction` (per [brief-page-v0-2.md](brief-page-v0-2.md) §5.2 minus `paired_observation_index` — Pulz oboru actions are always orphans). Zero actions = the action box is omitted; zero is not the default. |
| `actions[i].action_text` | string (plain Czech) | required | The action body. Plain-language and action-specificity-framing rules apply. |
| `actions[i].time_horizon` | enum | required | One of: `Okamžitě`, `Do 3 měsíců`, `Do 12 měsíců`, `Více než rok`. Frozen per [D-015](../project/decision-log.md) and [action-specificity-framing.md](action-specificity-framing.md). |

**Pairing note.** Pulz oboru actions are not paired with chart tiles in the data model. The brief detail page's `paired_observation_index` mechanism (per [brief-page-v0-2.md](brief-page-v0-2.md) §5.1) is **not** carried into Pulz oboru. The section is structurally simpler: three tiles communicate the picture; a summary text knits them; the action box is a single orphan-actions block, rendered as the orphan-action card pattern from [brief-page-v0-2.md](brief-page-v0-2.md) §5.1 (verbatim, designer-confirmed). If a future Pulz oboru iteration needs per-tile actions, that is a v0.4+ change — not built today.

**Below-floor / data-confidence.** Chart tiles in Pulz oboru render sector-aggregate data (MPO panorama, Asociace českých nábytkářů, ČS card-transaction aggregates, etc.). These are macro-level data, **not** per-owner cohort percentiles. The cohort-math statistical-validity floor (per [cohort-math.md](../data/cohort-math.md)) **does not apply** to Pulz oboru chart tiles — they are not derived from the owner's cohort. Confirms design spec §4.2.

### 4.4 PDF mandatory vs. optional — Q-PO-005 position

**PM position: PDF is optional at MVP.** The PdfLink block omits silently when `pdf_url` is absent.

Rationale:
- The Pulz oboru section's value is the synthesis (tiles + summary + actions). The PDF is a deep-dive trust-transfer (§7.7), not the headline.
- Some published analyses may lack an external-distribution-approved PDF (e.g., a publication from an analyst's working draft with no formal publication wrapper). Forcing a PDF gates publishing on an artifact that may not exist for every NACE × period.
- The Track C automation pipeline (per [D-026](../project/decision-log.md), [D-027](../project/decision-log.md)) ingests publications from analyst PDFs/DOCXs; whether the resulting Pulz oboru also re-attaches the original publication PDF is a content / rights decision. Optional at MVP keeps the data flow simple.
- Owners with a published-but-no-PDF analysis still see the verdict tiles, summary, and actions. They lose only the deep-dive escape hatch, which is acceptable.

**Trade-off accepted.** A Pulz oboru section without a PDF link reduces the bank-native trust-transfer surface ([§7.7](../../PRD/PRD.md#7-product-principles)) for that publication. Mitigation: every analysis ingested from a ČS publication should attach the original PDF when available; only synthesis-only publications skip the link. This is an authoring policy, not a technical constraint.

### 4.5 Stale threshold — Q-PO-008 position

**PM position: 91 days (one quarter) from `published_at`.** Confirms the design spec's proposal verbatim.

Rationale:
- v0.3 sector publication cadence is **quarterly per NACE** at MVP. The example file `furniture-2026-Q2` is the canonical naming pattern. Quarterly cadence aligns with the ČS Ekonomické a strategické analýzy team's actual publication frequency for sector reports.
- One full missed publication cycle (~91 days) is the right "trust calibration" point. Below 91 days, the analysis is current within the cadence band — no badge. At 91+ days, the analyst has either skipped a cycle or the NACE is on a longer-than-quarterly cadence; in either case, the owner deserves to know.
- The threshold is **not** per-NACE configurable at v0.3. If post-PoC data shows certain NACEs publish less frequently (e.g., niche divisions on a semi-annual cadence), v0.4 may introduce a per-NACE threshold field on the analysis record. Logged as self-monitoring trigger, not an open question.
- If cadence shifts to monthly post-MVP, the threshold tightens to ~5 weeks. This is a future-decision flag, not a v0.3 question.

**Trade-off accepted.** A NACE genuinely published at a non-quarterly cadence (rare at v0.3) will trigger the stale badge inappropriately. Mitigation: at v0.3, only NACE 31 + 49 are in scope per [D-027](../project/decision-log.md), both quarterly. Cross-NACE cadence variation is post-MVP.

### 4.6 Source attribution for ČS internal-data charts — Q-PO-004 position

**PM position: required when the chart uses ČS internal data; the analyst provides the caption text at upload time.** Mandatory at the upload form when the chart's data source is "ČS card transactions" or any other ČS-aggregate source. Rationale and full text in §7 (non-negotiables).

### 4.7 Increment

**v0.3 customer-testing PoC and MVP-compatible.** Pulz oboru is structurally an MVP-grade brief surface — analyst-authored, verdict-led, opportunity-flavored, plain-Czech, no automated generation, no give-to-get capture. It does not require any post-MVP capability to ship. The v0.3 dependency is the admin-side upload flow (see §4.8 below) and the existence of at least one published analysis per NACE in scope. Once those land, Pulz oboru is MVP-ready.

### 4.8 Dependencies

- **Admin upload flow (blocking for engineering implementation).** Without it, no Pulz oboru content reaches the database. PM commissions a separate spec; orchestrator routes to PD for the upload-page design and to EN for the upload pipeline. Tracked as Q-PO-002 (deferred from design spec — see §7).
- **Database schema for analyses** (data-engineer lane). The `analyses` table or equivalent JSONB structure on `briefs` — TBD by data-engineer. Schema must accommodate the data contract in §4.3.
- **At least one published analysis per in-scope NACE.** v0.3 PoC requires analyses for NACE 31 + 49 (per [D-027](../project/decision-log.md)). If the Track C automation pipeline ([D-026](../project/decision-log.md)) publishes drafts that an analyst then promotes to Pulz oboru, the upload flow may be a "promote draft" surface rather than a "fresh upload" surface. Decision deferred to admin-flow spec.
- **NACE-division dictionary** for the publication-date subline (`{nace_label_czech}`). Already exists in seed data per [dashboard-v0-2.md](dashboard-v0-2.md) §5.3; reused.

## 5. Czech copy — confirmation of design draft

Confirms all Czech copy from [docs/design/pulz-oboru.md](../design/pulz-oboru.md) §5 verbatim. The copy is plain Czech, formal vykání, frozen-term-compliant, and does not introduce any new user-facing term beyond the section name "Pulz oboru" itself.

### 5.1 Section heading and metadata — confirmed

| Element | String | Status |
|---|---|---|
| Section heading (`<h2>`) | `Pulz oboru` | **Confirmed.** Plain noun phrase. Intentionally understated — the verdicts carry the weight, not the label. Pulz oboru is the **section name**, not a content-unit term — it does not enter the glossary as a peer of "Přehled" / "Analýzy" / "Sektorová analýza". |
| Publication-date subline | `Analýza pro {nace_label_czech} · {publication_period}` | **Confirmed.** Example: "Analýza pro Výrobu nábytku · 2. čtvrtletí 2026". |

### 5.2 Stale warning — confirmed

| Element | String | Status |
|---|---|---|
| StaleWarningBadge body | `Tato analýza pochází z {month_year}. Aktuálnější data zatím nejsou k dispozici.` | **Confirmed.** `{month_year}` Czech-formatted, lower-case, genitive — e.g., "ledna 2026". |

### 5.3 Chart tile fields — confirmed

| Element | Status |
|---|---|
| Tile verdict string | **Confirmed.** Analyst-authored per publication. Hard one-sentence constraint. Furniture examples in design spec §5.3 are illustrative; the analyst supplies the actual strings per publication. |
| Tile caption / source attribution | **Confirmed.** Analyst-authored. Required when chart uses ČS internal data (Q-PO-004 §7); otherwise optional. |

### 5.4 Summary block — confirmed

The 4-sentence furniture example in design spec §5.4 is **confirmed as illustrative**. The analyst authors the actual summary per publication. Soft cap 6 sentences enforced at upload form (admin-flow scope).

### 5.5 PDF link — confirmed

| Element | String | Status |
|---|---|---|
| PDF link label | `Stáhnout celou analýzu (PDF)` | **Confirmed.** |
| Source/period subline | `{pdf_source_label} · {publication_period}` | **Confirmed.** Example: "Ekonomické a strategické analýzy České spořitelny · 2. čtvrtletí 2026". |
| ARIA label | `Stáhnout celou analýzu ve formátu PDF` | **Confirmed.** Designer's accessibility-spec call. |

### 5.6 Action box — confirmed

| Element | String | Status |
|---|---|---|
| Action box heading (`<h3>`) | `Doporučené kroky` | **Confirmed.** Reuses the brief-detail-page orphan-action pattern (per [brief-page-v0-2.md](brief-page-v0-2.md) §5.1). |
| Action time-horizon enum | `Okamžitě` / `Do 3 měsíců` / `Do 12 měsíců` / `Více než rok` | **Confirmed.** Frozen per [D-015](../project/decision-log.md) and [action-specificity-framing.md](action-specificity-framing.md). No substitutions. |

### 5.7 Empty state — confirmed

| Element | String | Status |
|---|---|---|
| EmptyStateCard heading | `Analýza pro váš obor se připravuje` | **Confirmed.** |
| EmptyStateCard body | `Jakmile analytici České spořitelny vydají přehled pro váš sektor, zobrazí se zde.` | **Confirmed.** No "notify me" CTA — see §6 non-negotiables and §7 Q-PO-006. |

### 5.8 Error state — confirmed

| Element | String | Status |
|---|---|---|
| ErrorCard body | `Informace o vašem oboru se nepodařilo načíst.` | **Confirmed.** |
| ErrorCard action | `Zkusit znovu` | **Confirmed.** Scope of retry: Pulz oboru section only, not full page reload. |

### 5.9 No new glossary term

Pulz oboru is a **section name**, not a content-unit. The glossary family from [brief-page-v0-2.md §10](brief-page-v0-2.md) (Přehled / Analýzy / Sektorová analýza) is **unchanged**. No glossary edit required for this spec to land.

## 6. Non-negotiables (PRD §7 principles applied)

- **§7.1 Day-one proof of value** — Pulz oboru must render without configuration. No login wall (the v0.3 demo bypass already removes consent / onboarding for the demo owner per [build-plan §10.3](../project/build-plan.md)). No "click to load" gate. The three verdict-led tiles + summary are the day-one demonstration that the product reads sector intelligence, not just owner ratios.
- **§7.2 Verdicts, not datasets** — every chart tile leads with a verdict sentence above the image. A chart with no verdict, or with the verdict beneath/inside the image, is a spec violation. The summary text resolves into plain-language conclusions sentence by sentence — no raw numbers without context. The action box closes with action verbs, not data points.
- **§7.3 Plain language** — formal vykání, no σ, no "p<0.05", no "kohorta", no "percentile" in any user-facing string in this section. The only context where analyst-register prose is acceptable is **inside the linked PDF**, which the owner explicitly opts into. The section heading "Pulz oboru" is a plain Czech noun phrase; "Doporučené kroky" is the action heading; nothing else carries a brand-name burden.
- **§7.5 Privacy as product** — the section reads from `brief` lane only ([D-010](../project/decision-log.md)). No `user_contributed`, `rm_visible`, or `credit_risk` lane is touched. Charts may use ČS-aggregate transaction data (per Q-PO-004 §7), never per-owner cohort data or per-firm transaction data. The PDF link delivers a publication asset, not a per-owner artifact.
- **§7.6 Opportunity-flavored, not risk-flavored** — every action verb is opportunity-framed: "zkontrolujte", "zmapujte", "zvažte", "prověřte", "srovnejte". No action reads as a credit-risk warning ("pokud nesnížíte..." / "abyste neztratili..." / "při zhoršení..."). Risk-framed actions are an authoring failure that the upload form must visually flag (admin-flow scope) and that the analyst-review process catches.
- **§7.7 Bank-native distribution** — the PDF link, when present, cites Ekonomické a strategické analýzy České spořitelny in the source subline. This is the bank-native trust-transfer at the section level. The section heading itself does not duplicate the bank wordmark — that is already on the page header per [D-018](../project/decision-log.md).
- **§7.8 Give-to-get in mind, not in build** — the empty state has **no** "Notify me" CTA, **no** email capture, **no** "tell us about your business" prompt. An owner whose NACE has no publication sees the EmptyStateCard and that is the complete user surface. This is non-negotiable per CLAUDE.md guardrail (Increment 3+).
- **No automated brief generation** — the analysis is human-authored by ČS analysts. The Track C pipeline ([D-026](../project/decision-log.md)) automates *draft generation* into the analyst's review queue; the analyst reviews and publishes. Pulz oboru never renders an unreviewed draft.
- **No cohort statistical-validity-floor surfacing** — Pulz oboru charts are sector-aggregate data, not per-owner cohort percentiles. The floor never applies to this section. The dashboard's Section 1 cohort tiles (governed separately per [dashboard-v0-2.md](dashboard-v0-2.md)) handle the floor in their own scope; Pulz oboru does not.

## 7. Open-question resolutions (design spec §8)

The design spec raised nine open questions (Q-TBD-PO-001 through Q-TBD-PO-009). PM resolutions, deferrals, and ownership routing below.

### 7.1 Resolved by this spec

- **Q-PO-001 — PM product doc and data contract.** **Resolved by this document.** §4.3 above defines the canonical content data contract; §3 defines acceptance criteria; §6 defines non-negotiables. The de-facto contract the design spec implied is **confirmed verbatim** with two clarifications: PDF is optional (Q-PO-005) and ČS-internal-data charts require a source caption (Q-PO-004).

- **Q-PO-004 — Source attribution for ČS-internal-data charts.** **Resolved: required.** When a chart on Pulz oboru is derived from ČS internal data (e.g., card-transaction aggregates as in the furniture example tile 2: POS vs. e-commerce), the analyst **must** populate the `chart_tiles[i].caption` field with the source attribution. Default form: `Zdroj: data České spořitelny; vlastní zpracování` (matches the ČS publication's own attribution). Other ČS-internal sources (e.g., MPO panorama via ČS, sector-pricing aggregates) carry their own analyst-authored attribution. Required at the admin upload form. Rationale: (a) §7.5 privacy-as-product — the owner deserves to know when they are looking at ČS-aggregate data; (b) ČS legal posture — surfacing aggregate transaction data without attribution is a brand and compliance risk; (c) trust-transfer (§7.7) — the data is more credible when its source is named. Charts based on **non-ČS public sources** (MPO panorama from public publications, AČN, etc.) also carry a caption when one is available, but the requirement is softer there — the public source is implied by the analysis context. Legal review (OQ-004 / cross-cuts existing legal queue): if ČS legal requires a specific form of attribution for transaction-aggregate data, the upload-form default updates accordingly. Flagged as a self-monitoring trigger; not a separate open-questions entry because it routes through the existing OQ-004 legal channel.

- **Q-PO-005 — Is a PDF mandatory?** **Resolved: optional.** See §4.4 above. PdfLink block omits silently when `pdf_url` is absent.

- **Q-PO-008 — Stale threshold.** **Resolved: 91 days (one quarter).** See §4.5 above. Confirms design spec proposal verbatim. Cadence assumption: quarterly per NACE at v0.3.

### 7.2 Explicitly deferred — reasons given, lifted to `docs/project/open-questions.md`

- **Q-PO-002 — Admin-side upload flow.** **Deferred** to a separate spec. PM commissions a follow-up; orchestrator routes the design lane to PD (admin upload page), the engineering lane to EN (upload pipeline + storage + signed URLs + image processing), and the data lane to DE (analyses table schema). **Blocking for engineer implementation start on Pulz oboru.** Not blocking for the PM product doc (this file) or the design spec.

- **Q-PO-003 — Chart alt-text input contract.** **Deferred** as part of the admin upload flow scope (Q-PO-002). PM position is recorded for the admin-flow spec to consume: alt-text is **mandatory at the upload form**; the form must reject submission of a chart image without substantive alt text (length floor and "not generic" check are accessibility / designer concerns to specify in the admin-flow design). Without this enforcement, screen-reader users receive no chart information and accessibility certification fails.

- **Q-PO-006 — "Notify me" CTA in empty state.** **Deferred to Increment 3+.** **Hard rule at MVP: no give-to-get capture.** Per CLAUDE.md guardrail and PRD §9. The Pulz oboru empty state does not, will not, and must not contain any data-capture field at MVP. Reopen trigger: Increment 3 Additional Customer Information Gatherer planning. Logged in `open-questions.md` with the explicit out-of-MVP marker so an engineer reading the design spec does not re-introduce it accidentally.

- **Q-PO-007 — `--color-ink-muted (#888)` contrast at 15 px.** **Deferred to engineer measurement.** Not a product decision — it is a WCAG AA pass/fail measurement against final implementation. Engineer applies the designer's fallback (shift to `--color-ink-tertiary (#666)` = 5.74:1) if the audit fails. Tracked in `open-questions.md` as an engineer-scoped item, not a PM-scoped one.

- **Q-PO-009 — Multi-NACE owner profiles.** **Deferred — post-MVP.** v0.3 demo owner is single-NACE per [D-023](../project/decision-log.md). If multi-NACE becomes a requirement, the section must support stacked Pulz oboru blocks (one per NACE the owner operates in) — but this is post-MVP. Reopen trigger: multi-NACE owner profile feature enters planning.

## 8. Acceptance criteria (for PM sign-off on this spec)

A reviewer (orchestrator or user) accepts this spec when all of the following hold:

- [ ] **Data contract is canonical and unambiguous.** §4.3's table fully specifies every analyst-uploaded field, its type, its required-vs-optional status, and its rendering destination. A reader can translate it into a JSONB schema or a TypeScript type without further PM input.
- [ ] **Section IA is locked.** Order is: cohort tiles (Section 1) → Pulz oboru (Section 2) → Analýzy briefs list (Section 3). Pulz oboru content order inside the section is: heading → optional stale badge → publication-date subline → 3 chart tiles row → summary text → optional PDF link → action box.
- [ ] **Screen states are exhaustive.** US-1 through US-6 cover default, stale, empty, error states. No fifth state is invented by this spec.
- [ ] **Czech copy is canonical.** Every user-facing string in §5 confirms the design spec's draft verbatim. No string is "to be drafted by designer". No new glossary term is introduced.
- [ ] **Pairing model is absent.** Pulz oboru actions are flat orphans — the brief-detail-page `paired_observation_index` mechanism is not carried over. The action box reuses the orphan-action card pattern only.
- [ ] **Q-PO-001, 004, 005, 008 are resolved with an explicit position.** §7.1 resolves; §4 carries the substance.
- [ ] **Q-PO-002, 003, 006, 007, 009 are explicitly deferred with a reason and a routing.** §7.2 defers; each is logged in `docs/project/open-questions.md`.
- [ ] **Lane discipline.** The section reads only the `brief` lane ([D-010](../project/decision-log.md)). No RM-visible or credit-risk-lane surfacing. No per-owner data renders inside Pulz oboru.
- [ ] **Give-to-get out at MVP.** The empty state has no capture field. The default state has no "tell us about your business" prompt. The action box has no "mark as done" or "follow up" interactive control.
- [ ] **No automated brief generation surfaces.** The analyst publishes; the section renders. Drafts (from the Track C pipeline per [D-026](../project/decision-log.md)) never reach the owner-facing section.

## 9. Downstream artifacts

- **Design** (already shipped, upstream of this PM doc): [docs/design/pulz-oboru.md](../design/pulz-oboru.md). Owns: visual treatment of all components in §4 and §5; tile sizing, breakpoints, color palette, typography; accessibility checklist; mobile collapse; loading skeletons; visual distinction between EmptyStateCard (dashed border) and ErrorCard (solid border); StaleWarningBadge visual.
- **Engineering** (not yet drafted): expected at `docs/engineering/pulz-oboru.md` or inline notes in PRs during Phase 3.x. Owns: rendering pipeline (server-component fetch from Supabase REST per existing v0.3 pattern; static `<img>` rendering; no chart library); types for the data contract; cache / revalidation strategy; error-boundary scoping (the section's error must not break the dashboard); the `<a download>` PDF link mechanics; signed-URL or public-bucket choice for chart images and PDF; section-only retry implementation.
- **Data** (not yet drafted): expected at `docs/data/analyses-schema.md` or addendum to existing `analysis-pipeline-data.md`. Owns: the storage table for Pulz oboru analyses (likely a new `analyses` table or an extension of existing `briefs` JSONB); image-asset references; the lane-tag (`brief`) on the rows; cohort-math interaction (none — Pulz oboru is sector-aggregate, not cohort-percentile); audit log entries for analyst publish events; how the Track C draft pipeline ([D-026](../project/decision-log.md)) hands off into the analyses table.
- **Admin upload flow** (deferred — separate spec): owns: PD admin upload page, EN upload pipeline, alt-text-mandatory enforcement, source-caption-mandatory-when-CS-internal enforcement, NACE assignment UI, period-string capture, PDF attachment optional flow, three-charts-required validation, 1–3-actions validation, draft / publish state machine. Tracked as Q-PO-002 in `open-questions.md`.
- **Sibling product specs**: [dashboard-v0-2.md](dashboard-v0-2.md) (governs Sections 1 + 3 of `/`; this spec adds Section 2 between them; no change required to the sibling spec); [brief-page-v0-2.md](brief-page-v0-2.md) (the brief detail page; the action-box pattern Pulz oboru reuses; no change required).

## 10. Open questions

Items below are lifted to `docs/project/open-questions.md` by the orchestrator with assigned `OQ-NNN` IDs. Status reflects the position in §7 above.

| Local ID | Question | PM position | Routing |
|---|---|---|---|
| Q-PO-002 | Admin-side upload flow for Pulz oboru content. | Deferred to a separate spec. Blocking for engineer implementation start. | PD + EN + DE (admin-flow spec) |
| Q-PO-003 | Chart alt-text input contract enforcement. | Mandatory at the upload form. Lives inside Q-PO-002 admin-flow spec. | PD + EN (admin-flow scope) |
| Q-PO-006 | "Notify me" CTA in the empty state. | Deferred to Increment 3+. **Hard rule: no give-to-get capture at MVP.** | Reopen trigger: Increment 3 planning |
| Q-PO-007 | `--color-ink-muted (#888)` contrast at 15 px normal weight. | Engineer measures during implementation; applies designer's fallback to `--color-ink-tertiary (#666)` if audit fails. Not a PM decision. | EN |
| Q-PO-009 | Multi-NACE Pulz oboru display for owners with multiple NACE divisions. | Deferred — post-MVP. v0.3 single-NACE per [D-023](../project/decision-log.md). | Reopen trigger: multi-NACE owner profile feature |

Resolved (recorded for traceability):

| Local ID | Resolution |
|---|---|
| Q-PO-001 | Resolved by this PM doc (§4.3 data contract + §3 acceptance criteria + §6 non-negotiables). |
| Q-PO-004 | Resolved: source attribution required for ČS-internal-data charts at the admin upload form (§7.1). Default text `Zdroj: data České spořitelny; vlastní zpracování`. |
| Q-PO-005 | Resolved: PDF is optional; PdfLink block omits silently when `pdf_url` is absent (§4.4). |
| Q-PO-008 | Resolved: stale threshold = 91 days from `published_at` (§4.5). Quarterly cadence assumed at v0.3. |

## Changelog

- 2026-04-28 — initial draft. Backfills the PM lane behind the design spec at [docs/design/pulz-oboru.md](../design/pulz-oboru.md). Confirms data contract (Q-PO-001), takes positions on Q-PO-004 (source attribution required for ČS-internal-data charts), Q-PO-005 (PDF optional), Q-PO-008 (91-day stale threshold). Defers Q-PO-002 (admin flow), Q-PO-003 (alt-text input — admin-flow scope), Q-PO-006 (notify-me CTA — Increment 3+), Q-PO-007 (color contrast — EN measurement), Q-PO-009 (multi-NACE — post-MVP). Confirms Czech copy from design spec verbatim; introduces no new glossary term. Action-box pattern reuses [brief-page-v0-2.md](brief-page-v0-2.md) §5.1 orphan-action card; pairing-with-tiles model is **not** carried over (Pulz oboru actions are always orphans). — product-manager
