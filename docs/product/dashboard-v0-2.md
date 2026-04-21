# Dashboard (v0.2 customer-testing PoC)

*Owner: product-manager · Slug: dashboard-v0-2 · Last updated: 2026-04-21*

## 0. Scope note and framing discipline

This spec governs **only** the owner-facing landing page at `/` for the v0.2 customer-testing PoC running on branch `trial-v0-2`. It is additive to, and does not replace, the MVP plan on `trial-phases-2-4`. Per [build-plan.md](../project/build-plan.md) §10.3, the demo owner sees no consent or onboarding surfaces because the PoC routes around the currently-non-functional sign-in chain — this is a bypass of broken v0.1 plumbing, not a redesign of the consent product. Consent / onboarding artifacts and specs remain untouched; this file does not speak to them.

Visual design (grid sizing, tile dimensions, colour hex values, typography, spacing tokens, responsive breakpoints, icon choices) is out of this spec's lane and is owned by the designer in `docs/design/dashboard-v0-2/`. Per-owner metric generation (dummy values, cohort position synthesis, below-floor selection) is out of this spec's lane and is owned by the data-engineer in `docs/data/dummy-owner-metrics.md`.

## 1. Summary

The dashboard is the owner's first surface at `/` in the v0.2 customer-testing PoC. It has exactly two sections: (1) a grid of **eight benchmark tiles**, one per frozen D-015 metric, each tile carrying the metric label, the owner's raw value, the cohort percentile, and a quartile indicator; (2) a **list of briefs** relevant to the owner's NACE sector. What changes for the owner: at MVP on `trial-phases-2-4`, benchmarks lived only inside briefs as embedded snippets — here, they are elevated to a standalone landing surface for the testing PoC, because the testing protocol needs a single screen a participant can read in under a minute before drilling into any brief.

Relationship to the MVP principle that **briefs are the atomic unit of value** ([PRD §1](../../PRD/PRD.md#1-summary), [PRD §4](../../PRD/PRD.md#4-goals-and-non-goals)): the v0.2 dashboard is a **customer-testing PoC scaffold**, not an MVP feature. It does not imply a post-test rollout of a standalone benchmark dashboard. The briefs list section keeps briefs one click away and preserves the brief as the thing the owner actually reads.

## 2. Upstream links

- PRD sections:
  - [§4 Goals & Non-Goals](../../PRD/PRD.md#4-goals-and-non-goals) — "no standalone benchmarking dashboard" is an MVP non-goal. The v0.2 dashboard is not a product commitment toward that non-goal; it is a PoC instrument for customer testing only. Flagged explicitly so no downstream specialist reads this as a scope change.
  - [§7.1 Day-one proof of value](../../PRD/PRD.md#7-product-principles) — the dashboard exists so the participant sees something concrete within seconds of landing. No configuration-first surfaces.
  - [§7.2 Verdicts, not datasets](../../PRD/PRD.md#7-product-principles) — every tile must pair a raw value with a cohort comparison (percentile + quartile). A tile that shows a raw value alone is a spec violation.
  - [§7.3 Plain language](../../PRD/PRD.md#7-product-principles) — all copy below is Czech, formal vykání register, no statistical notation.
  - [§7.5 Privacy is a product feature](../../PRD/PRD.md#7-product-principles) — the tiles carry the owner's own numbers. No cross-owner, cross-RM, or credit-risk-lane surfacing. Dashboard reads from `brief` and `user_contributed` lanes only (per [D-010](../project/decision-log.md)).
  - [§8.1 Sector Briefing Engine](../../PRD/PRD.md#81-sector-briefing-engine--what-this-means-for-you-primary-mvp) — the briefs list ties the dashboard to the atomic unit of value.
  - [§8.2 Peer Position Engine (minimal MVP)](../../PRD/PRD.md#82-peer-position-engine-minimal-mvp) — the tile grid is a customer-testing elevation of what §8.2 calls the "embedded benchmark snippet." Same data contract, different surface.

- ČS business goals served:
  - **G1 Engagement** — the dashboard is the testing-PoC instrument for measuring whether an owner orients themselves in under a minute. The success heuristics in §6 below are customer-testing signals that feed G1 measurement design.
  - **G2 Data depth + cadence** — by surfacing the eight frozen ratios as a grid, the dashboard is the cleanest probe for which ratios the owner recognizes, reacts to, or ignores. That reaction is the raw material for G2 prioritization.
  - *Not served:* **G3 RM lead generation**. The dashboard does not surface, route, or derive any RM-visible output ([D-002](../project/decision-log.md)).

- Related decisions:
  - [D-015](../project/decision-log.md) — freezes the eight metric ids, four categories, and Czech quartile labels this dashboard consumes.
  - [D-014](../project/decision-log.md) — graceful-degradation posture: below-floor means silent on the ratio inside a brief. On the dashboard we cannot be silent (the tile slot physically exists), so we adopt an **empty-state variant** of the same principle; copy in §5 below.
  - [D-012](../project/decision-log.md) — revocation stop-flow-only; not exercised on the demo owner (no consent path), but any code path that reads owner metrics must still respect the lane boundary.
  - [D-016](../project/decision-log.md) — Phase 3 partial-ratification context; the v0.2 branch diverges from this state per build-plan §10.

## 3. User stories

### US-1 — PoC participant orients at a glance

- **As a** Czech SME owner participating in a customer-testing session and landing on `/` as the hardcoded demo owner,
- **I want** to see where my business sits on the eight key indicators and what's been written about my sector,
- **so that** I can form a first impression within the testing observation window (roughly one minute) without clicking or scrolling past the fold.
- **Acceptance criteria:**
  - [ ] The dashboard renders at `/` with no intervening screen (no consent, no onboarding, no "welcome" modal).
  - [ ] The eight tiles are visible above the fold on a standard laptop viewport (designer defines exact sizing).
  - [ ] Each tile carries: metric label (Czech), raw value with unit, cohort percentile, and named quartile — never fewer than all four for a value-bearing tile.
  - [ ] The briefs list is reachable within one vertical scroll from the top.

### US-2 — Participant recognizes a signal and drills in

- **As a** testing participant who has oriented on the tiles,
- **I want** to click through to a brief that speaks to whatever caught my eye,
- **so that** the moderator can observe what concrete reading intent the dashboard surfaced.
- **Acceptance criteria:**
  - [ ] Each brief list item is a single click target that navigates to the brief detail page (route owned by the existing brief page; v0.2's brief page rework is specced separately in [brief-page-v0-2.md](brief-page-v0-2.md)).
  - [ ] The brief list item shows: brief title, publication month, and a NACE sector badge (format in §5).
  - [ ] Briefs are ordered most-recent `published_at` first.

### US-3 — Participant encounters a below-floor tile

- **As a** testing participant whose hardcoded owner happens to have one or more below-floor ratios in the dummy dataset,
- **I want** the tile to tell me plainly that there isn't enough comparable data yet, instead of showing a misleading or missing number,
- **so that** my trust in the product survives the encounter with statistical gaps.
- **Acceptance criteria:**
  - [ ] A below-floor tile shows the metric label and the empty-state copy from §5, and nothing else from the value-bearing fields.
  - [ ] The tile does not show a partial value (no "raw value only, percentile missing" state).
  - [ ] The tile does not disappear from the grid; its slot is retained so the grid doesn't reflow mid-session (the data-engineer-provided dummy set determines which tiles, if any, are below-floor — PM does not preassign this).

## 4. Scope

- **In scope:**
  - Information architecture of `/`: two sections, fixed order (tiles first, briefs second).
  - Tile content model: which fields each tile carries, including the below-floor variant.
  - Relevance rule for the briefs list.
  - All user-facing Czech copy on the dashboard.
  - Success heuristics (customer-testing signals, not in-product telemetry).
  - Acceptance criteria for PM sign-off on the spec.

- **Out of scope:**
  - Visual design (grid shape, colour palette, typography, hover/focus/active visual states, responsive breakpoints, iconography). Owned by designer in `docs/design/dashboard-v0-2/`.
  - Dummy owner metric generation — raw value distributions, which percentile each metric resolves to, and which (if any) are seeded below-floor. Owned by data-engineer in `docs/data/dummy-owner-metrics.md`.
  - Identity bypass mechanism that hardcodes the demo owner. Owned by engineer in `docs/engineering/v0-2-identity-bypass.md`.
  - Any change to the brief detail page or the removal of the "Srovnávací přehled" section from it. Owned by `brief-page-v0-2.md` (PM) and `docs/design/brief-page-v0-2.md` (designer).
  - Consent, onboarding, revocation, and `/settings/soukromi` — explicitly untouched (build-plan §10.3).
  - RM-facing surfaces, admin back-office, PDF, email — none of these touch `/`.

- **Increment:** v0.2 customer-testing PoC only. Not MVP; not a post-MVP dashboard commitment. If the PoC outcomes argue for promoting a dashboard surface into MVP or Increment 2, that requires a new decision-log entry, not a reinterpretation of this file.

## 5. Copy draft (canonical)

All Czech copy on the dashboard, consolidated for single-source consumption by designer and engineer. Register: formal vykání, plain language per [plain-language-translation.md](plain-language-translation.md) — no statistical notation, no jargon. Quartile labels are the frozen D-015 set; do not substitute.

### 5.1 Page chrome

| Element | Czech string | Notes |
|---|---|---|
| Browser tab title | `Strategy Radar` | Plain brand. No "Dashboard" suffix at v0.2. |
| Page header (visible) | `Přehled` | Single word. This is the existing owner-facing term per [glossary.md](glossary.md) — "Přehled" otherwise denotes a single briefing document, but for the PoC landing surface it carries the landing-page meaning. See §7, OQ-DV02-01. |
| Header subline (optional, one sentence) | `Rychlý pohled na vaši firmu a na to, co se aktuálně děje ve vašem oboru.` | Designer may elect to omit for visual density; content stays here if used. |

### 5.2 Tile grid section

| Element | Czech string | Notes |
|---|---|---|
| Section header | `Vaše pozice v kohortě` | The eight tiles live under this heading. |
| Section sub-header (optional, one sentence) | `Jak si vedete ve srovnání s podobnými českými firmami.` | Designer decides whether to render. |
| Tile: metric label | Canonical Czech name from [mvp-metric-list.md](mvp-metric-list.md) §"The eight ratios" — e.g. `Hrubá marže`, `Marže EBITDA`, `Podíl osobních nákladů`, `Cyklus pracovního kapitálu`, `ROCE`, `Růst tržeb vs. medián kohorty`, `Cenová síla`, `Tržby na zaměstnance`. | No substitutions. |
| Tile: raw value format | `{value} {unit}` — e.g. `34,2 %`, `62 dní`, `1 850 000 Kč`. | Decimal separator is comma. Thousands separator is a narrow non-breaking space. Units: `%` for percentage-valued ratios, `dní` for working capital cycle, `Kč` (CZK) for revenue per employee. Exact rounding and formatting for each ratio is inherited from [cohort-math.md](../data/cohort-math.md) / [dummy-owner-metrics.md](../data/dummy-owner-metrics.md); PM does not re-specify. |
| Tile: percentile format | `{N}. percentil` — e.g. `68. percentil`, `12. percentil`. | One decimal is allowed if cohort-math emits it (e.g. `67,5. percentil`); PM does not force integer-only. |
| Tile: quartile label (one of four, frozen) | `horní čtvrtina` / `třetí čtvrtina` / `druhá čtvrtina` / `spodní čtvrtina`. | From D-015. Lower-case as shown. The designer decides visual treatment (pill, underline, colour band) — but the string is fixed. |
| Tile: one-sentence hover/tooltip copy | *Deferred to the designer and data-engineer jointly.* PM decision: at PoC we do not require a hover tooltip, because every tile already carries label + raw + percentile + quartile, which satisfies §7.2 verdict + dataset pairing on its own. If the designer elects to add one (e.g., accessibility / screen-reader caption), the copy source is the "Why it matters to the owner" one-liner in [mvp-metric-list.md](mvp-metric-list.md) §"The eight ratios", lightly trimmed — PM does not draft new copy for a component whose necessity isn't established. Logged as OQ-DV02-02. | — |
| Tile: below-floor empty state (main line) | `Zatím nemáme dostatek srovnatelných firem pro spolehlivé srovnání.` | Plain explanation; does not name "the floor" or "statistical validity." Aligned with D-014 graceful-degradation posture and PRD §7.3. |
| Tile: below-floor empty state (sub-line, optional) | `Ukážeme vám srovnání, jakmile bude k dispozici.` | Soft forward-looking promise; no date commitment. Designer may omit if space is tight. |

### 5.3 Briefs list section

| Element | Czech string | Notes |
|---|---|---|
| Section header | `Přehledy pro váš obor` | Plural "Přehledy" denotes a list of briefing documents; the singular "Přehled" in the page header refers to the landing surface. Both usages are pre-existing in the codebase; see §7, OQ-DV02-01. |
| Section sub-header (optional) | `Vybrali jsme pro vás aktuální přehledy k oboru, ve kterém podnikáte.` | Designer decides whether to render. |
| Brief list item — title | Brief title verbatim from the authored brief. | No truncation rule at v0.2 (designer decides wrapping). |
| Brief list item — publication month | Czech month name + four-digit year — e.g. `duben 2026`, `květen 2026`. Lower-case month name per Czech convention. | Rendered from `published_at`. The month name is derived from `published_at` — there is no separate `publication_month` field the PM commits to; engineer picks the formatting helper. |
| Brief list item — NACE badge | `Obor {nace_code} — {nace_label_czech}` — e.g. `Obor 31 — Výroba nábytku`. | The NACE label is the Czech NACE division name. The demo owner is NACE 31 (furniture); at v0.2 only one label is needed in seeded data, so a full NACE label dictionary is out of scope — provided by the engineer in the seed. |
| Brief list — empty state | `Pro váš obor zatím nejsou k dispozici žádné přehledy. Jakmile nějaký připravíme, objeví se zde.` | Used if zero briefs match. PoC seeds three furniture briefs so this should not trigger; we spec it anyway for robustness. |

### 5.4 Micro-copy

No dashboard-level loading-state, error-state, or "last updated" copy is specified at PoC. The demo owner is hardcoded and data is seeded; there is no async fetch path that warrants user-facing loading copy. Engineer may use a minimal spinner at their discretion; no PM copy is contributed for it.

## 6. Information architecture

Two sections on `/`, fixed order:

```
+-----------------------------------------------------------+
| Minimal header                                            |
|   - Brand wordmark ("Strategy Radar")                     |
|   - No navigation, no profile menu, no bank chrome        |
+-----------------------------------------------------------+
| Section 1 — Tile grid                                     |
|   Section header: "Přehled" / "Vaše pozice v kohortě"     |
|   (PM note: "Přehled" is page-level chrome above;         |
|    "Vaše pozice v kohortě" is the tile-section header.    |
|    Two separate headings, not one.)                       |
|                                                           |
|   8 tiles, one per D-015 metric.                          |
|   Tiles visually grouped by the four D-015 categories     |
|   (Ziskovost / Náklady a produktivita / Efektivita        |
|    kapitálu / Růst a tržní pozice). Grouping is a         |
|    product requirement; visual expression is the          |
|    designer's lane.                                       |
|                                                           |
|   Each tile renders one of:                               |
|     - value-bearing variant: label + raw value +          |
|       percentile + quartile (all four, never partial)     |
|     - below-floor variant: label + empty-state copy       |
+-----------------------------------------------------------+
| Section 2 — Briefs for your sector                        |
|   Section header: "Přehledy pro váš obor"                 |
|                                                           |
|   Vertical list of briefs matching the owner's NACE.      |
|   Each item: title + publication month + NACE badge.      |
|   Order: most recent published_at first.                  |
|   Empty state: single fallback sentence (§5.3).           |
+-----------------------------------------------------------+
```

**Category grouping within the tile section is load-bearing.** The eight tiles do not render as an undifferentiated 2×4 or 4×2 grid; they render as four groups of two, in the D-015 / [D-011](../project/decision-log.md) order: (1) Ziskovost, (2) Náklady a produktivita, (3) Efektivita kapitálu, (4) Růst a tržní pozice. Within each category the order follows the ratio order in [mvp-metric-list.md](mvp-metric-list.md) §"The eight ratios". Whether the category label is rendered as a visible sub-header, a colour band, a spacer, or an invisible semantic grouping is the designer's decision; the grouping itself is not. (If the designer proposes to drop category grouping on visual grounds, that is an escalation to the PM, not a design-lane call.)

**No side navigation, no top navigation, no footer chrome, no consent banner, no profile menu, no bank-brand lockup** at v0.2. The header is a single brand wordmark; that is the entire chrome.

## 7. Brief-list relevance rule

- **Inclusion predicate (v0.2):** `brief.nace_sector == owner.nace_sector` where `owner.nace_sector` is the hardcoded demo owner's NACE value (31 — furniture). Only published briefs are eligible (`brief.status == 'published'` — existing field from Phase 3 storage model). Drafts and archived briefs are excluded.
- **Order:** `published_at DESC`. Most recent first.
- **Tie-breaker (same `published_at`):** `created_at DESC`. If still tied, `id` (lexical) — arbitrary but deterministic. Rare enough that the engineer may pick any stable order and note it.
- **Limit:** no explicit limit at v0.2 (PoC seeds three briefs; unbounded is safe). If the PoC seed expands beyond ten briefs, PM re-specifies pagination; not needed today.
- **Edge case — zero briefs match:** render the empty-state sentence from §5.3. The empty state is not a blank section; the section header still renders so the page structure stays stable.
- **Out of scope at v0.2:** cross-NACE relevance (e.g., NACE 31 furniture owner seeing a brief authored for NACE 16 wood products because they share a supply chain). This is a substantive relevance-model question that belongs in a future MVP / Increment 2 decision; PoC uses the simplest possible NACE-match rule so the testing signal is clean.
- **Out of scope at v0.2:** per-owner personalization of the list beyond NACE match — e.g., surfacing a brief more prominently because the owner's current cohort quartile for a ratio it references is extreme. D-006 locks MVP personalization grain to NACE only, and the PoC does not deviate.

## 8. Success metrics / customer-testing heuristics

These are signals a testing moderator can observe and record in real time; they are **not** in-product telemetry. Tracked under G1 Engagement (§2 above). Targets are directional, not thresholds — the PoC's job is to calibrate them, not to pass them.

1. **First-fixation on a value-bearing tile within ~3 seconds of page load.** Moderator observes where the participant's eye lands first. A fixation on a tile (rather than the header or the briefs list) is the signal that the grid is doing its job as an orientation surface. A fixation on the browser URL bar or outside the page entirely is a failure signal.
2. **Participant reads at least one quartile label aloud without moderator prompting within ~30 seconds.** If the participant articulates "horní čtvrtina" or similar on their own, the plain-language quartile system is landing. If they read the raw percentile number instead (e.g., "sixty-eight"), the verdict-not-dataset frame is at risk and the copy ordering on the tile needs review.
3. **Participant correctly interprets a below-floor tile on first read, if one is present.** The test is unprompted: does the participant understand that the empty-state copy means "not enough data" rather than "something is broken"? A "what does this one mean?" question asked within 10 seconds of hovering is neutral (copy is legible but ambiguous); a request for the moderator to explain is a failure.
4. **Participant clicks a brief in the list within ~60 seconds of landing.** The list's job is to convert the tile-level signal into a reading intent. A first click on a tile instead (tiles are not clickable at v0.2 — see §9 acceptance criterion 5) is a useful miss: it tells us participants expect tiles to be drill-ins. That finding goes back to the PM for Increment-2 scoping.
5. **Participant does not ask about or look for navigation chrome.** The chrome-minimal design is intentional. If the participant asks "where's the menu?" or "how do I get back?" within the first minute, the minimal header is confusing rather than clean; that reshapes the brief-page-v0-2 spec.

Heuristics 1 and 4 are the two that most directly feed the G1 measurement design. The rest are diagnostic.

## 9. Acceptance criteria (for PM sign-off on this spec)

A reviewer (orchestrator or user) can accept this spec when all of the following hold:

- [ ] **Metric set unchanged.** The eight tiles correspond one-to-one to the D-015 / [mvp-metric-list.md](mvp-metric-list.md) eight ratios, in the four-category order from [D-011](../project/decision-log.md). No ratio added, removed, or substituted.
- [ ] **Tile content model complete.** Every tile carries exactly one of the two variants — value-bearing (label + raw value + percentile + quartile) or below-floor (label + empty-state copy). No third variant is introduced by this spec.
- [ ] **Copy is canonical and complete.** Every user-facing Czech string on the dashboard is listed in §5. No string is deferred to "designer to draft" or "engineer to fill in." Frozen quartile labels (D-015) are used verbatim.
- [ ] **Below-floor posture aligned with D-014.** The empty-state copy in §5.2 does not name the statistical-validity floor, does not show a partial value, and does not disappear the tile from the grid.
- [ ] **Relevance rule is unambiguous.** A reader can translate §7 into a SQL query or an engineering function without further PM input. Ordering, tie-break, and empty-state are specified.
- [ ] **Consent / onboarding are untouched.** The spec does not mention, redesign, or propose changes to the consent screen, onboarding screen, or `/settings/soukromi`. The demo-owner hardcoding is described as a bypass of non-functional v0.1 plumbing, not a consent-product change.
- [ ] **Lane discipline.** The spec names only `brief` and `user_contributed` lanes ([D-010](../project/decision-log.md)); no RM-visible or credit-risk-lane surfacing is introduced ([D-002](../project/decision-log.md)).
- [ ] **Tiles are not drill-in targets at v0.2.** The dashboard does not promise tile-level click-through to a per-metric page; there is no per-metric detail page at MVP or v0.2, and the spec does not invent one. (This is the asymmetry flagged as a diagnostic in §8 heuristic 4.)

## 10. Downstream artifacts

- Design: `docs/design/dashboard-v0-2/` — folder owned by designer per build-plan §10.5; expected contents `layout.md`, `tile-states.md`, `brief-list-item.md`. *Not yet drafted at time of this spec.*
- Data: `docs/data/dummy-owner-metrics.md` — owned by data-engineer per build-plan §10.5; produces the per-tile dummy values and determines which tiles (if any) are below-floor. *Not yet drafted.*
- Engineering: `docs/engineering/v0-2-identity-bypass.md` — owned by engineer; specifies the hardcoded-demo-owner mechanism. *Not yet drafted.* Related code paths: a future `src/lib/owner-metrics.ts` per build-plan §10.2 and an amended `src/lib/briefs` helper for the NACE-filtered list query (`listPublishedBriefsByNace()` per build-plan §10.4).
- Product (sibling, v0.2 track): [brief-page-v0-2.md](brief-page-v0-2.md) — the brief detail page rework; draws the brief-list items in §7 into a different, already-specced surface.

## 11. Non-negotiables (PRD §7 principles applied)

- **§7.1 Day-one proof of value** — the entire landing surface is readable before any click or configuration; consent is already bypassed at PoC. A loading spinner that blocks the tile grid at first paint is a failure mode.
- **§7.2 Verdicts, not datasets** — every value-bearing tile pairs raw value with a named quartile. A tile that shows a percentile number alone, or a raw value alone, is blocked at review.
- **§7.3 Plain language** — no σ, no "p<0.05", no "CI", no "sample size of N". Empty-state copy in §5.2 avoids "floor", "cohort too small", "statistical validity" — plain "zatím nemáme dostatek srovnatelných firem."
- **§7.5 Privacy is a product feature** — dashboard reads only `brief` and `user_contributed` lanes. No RM-visible output is derived or surfaced. The demo-owner data shown to a testing participant is the demo owner's own (hardcoded) data; it is never another owner's data or a cross-owner aggregate at individual grain.
- **No give-to-get capture** — the dashboard does not introduce any "please enter your…" field. Gaps in the dummy dataset resolve as below-floor tiles, not as capture prompts.
- **No automated brief generation** — the briefs list surfaces only briefs authored by ČS analysts via the existing admin back-office.

## 12. Open questions to orchestrator

1. **OQ-DV02-01 — "Přehled" term collision on the dashboard surface.** The glossary and existing codebase use "Přehled" as the owner-facing name for a single briefing document ([glossary.md](glossary.md) § Sector brief; also referenced in customer-testing-brief.md §8). §5.1 of this spec reuses "Přehled" as the page-level header of the landing surface, and §5.3 uses "Přehledy pro váš obor" for the briefs list. Two adjacent meanings of the same Czech noun on one screen is a legibility risk. Three resolution options: (a) keep as specced — "Přehled" for the landing, "Přehledy" for the list, accepting that the plural disambiguates; (b) rename the page-level header to something else — candidates: "Dnes ve vaší firmě", "Vaše situace", "Úvodní přehled" — and reserve "Přehled/Přehledy" for briefing documents only; (c) drop the page-level header entirely and let the section headers carry the structure. PM preference: (a) ships the PoC without a rename event that would drift other artifacts, and the plural form is standard Czech. But this is a copy decision the orchestrator should confirm with the user before the designer consumes the copy. If (b), the glossary entry for "Sector brief" / "Přehled" is unaffected — only the landing-page header string changes.

2. **OQ-DV02-02 — Tile tooltip: necessary or noise?** §5.2 defers the question of whether each tile needs one-sentence hover/tooltip copy. PM view: the label + raw + percentile + quartile quartet is already a complete verdict-dataset pair and does not require a tooltip to be legible, and adding one introduces a new maintenance surface. But an accessibility case (screen reader, small viewport) may compel one. Resolution path: designer proposes or declines in `docs/design/dashboard-v0-2/tile-states.md`; if the designer declines, this OQ closes. If the designer proposes one, PM authors the exact Czech string for each of the eight metrics in a spec addendum, sourcing from the "Why it matters to the owner" lines in [mvp-metric-list.md](mvp-metric-list.md).

Both OQs are non-blocking for the designer and data-engineer to start their tracks — they can proceed on the spec as-written and these resolve inline. Neither is a substantive product-scope question.

## Changelog

- 2026-04-21 — initial draft for v0.2 customer-testing PoC. Consumes D-015 eight-metric freeze, D-011 four-category grouping, D-014 graceful-degradation posture, D-012 stop-flow revocation boundary. Two OQs logged for orchestrator routing. — product-manager
