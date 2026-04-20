# Quartile Position Display

*Owner: product-manager · Slug: quartile-position-display · Last updated: 2026-04-20*

## 1. Summary

Quartile Position Display is how a computed percentile — produced upstream by Percentile Position Calculation — reaches the SME owner inside a brief: as a **named quartile label in plain Czech** plus the **exact percentile number**, bound together in a single verdict sentence. It never renders standalone; it is always a field inside an embedded BenchmarkSnippet under one of the four canonical benchmark categories. It is the last mile that turns a cohort-math output into "verdicts, not datasets" — a quartile word the owner can repeat to their accountant, anchored by a specific number they can check later.

## 2. Upstream links

- **PRD sections:**
  - [§8.2 Peer Position Engine (minimal, MVP)](../../PRD/PRD.md#82-peer-position-engine-minimal-mvp) — the minimal-peer-position surface this feature renders; embedded in briefs, not a standalone dashboard.
  - [§8.7 — not a real section; the user brief referenced "§8.7"; the controlling scope is §8.2 + §9 Quartile Position Display [basic]](../../PRD/PRD.md#9-release-plan).
  - [§9 Release Plan — Quartile Position Display [basic]](../../PRD/PRD.md#9-release-plan) — MVP scope; the **[advanced]** variant (historical quartile tracking, multi-period framing) is Increment 3 and is explicitly **out of MVP scope** below (§4).
  - [§7.2 Verdicts, not datasets](../../PRD/PRD.md#7-product-principles) — a raw percentile without a quartile word is a failure, not a feature; a quartile word without a percentile number is also forbidden (both halves of the verdict must ship together per §6).
  - [§7.3 Plain language, no jargon](../../PRD/PRD.md#7-product-principles) — the quartile label is Czech, positional, and owner-legible; no "Q1/Q2/Q3/Q4" notation ever reaches the owner.
  - [§10 Cohort segmentation + minimum-cohort flag](../../PRD/PRD.md#10-data-and-technical-foundation) — the below-floor fallback behavior MVP must implement and render.
  - [§13.5 Cold-start constraint](../../PRD/PRD.md#13-risks-and-open-questions) — silent low-confidence numbers are prohibited; the fallback ladder owns this guarantee.
- **ČS business goals served:**
  - **G1 Engagement** — the quartile label is the owner's recognizable "where do I stand?" verdict; it is the payload of the embedded snippet that makes the brief memorable beyond the opening summary. Drives "time spent per brief" and "observation engagement" per PRD §6 Goal 1.
  - **G2 Data depth + cadence** — indirectly. The quartile label is the output the owner gets in exchange for ČS holding and hand-assigning their data under D-001; it is how the give-to-get posture *reads* at MVP even though no capture UX is built (A-013).
  - **G3 RM lead generation** — not at MVP (D-002, A-002). Future RM-visible quartile summaries inherit the canonical labels frozen here; opportunity-framing rules (A-016) will apply whenever that lane activates.
- **Related decisions:**
  - [D-001](../project/decision-log.md) — hand-assigned cohorts on pre-populated data; constrains which users can see a rung-0 quartile vs. a degraded rung.
  - [D-003](../project/decision-log.md) — the eight ratios for which a quartile can ever be rendered at MVP.
  - [D-004](../project/decision-log.md) — all user-facing copy is Czech; the canonical quartile labels below are Czech.
  - [D-006](../project/decision-log.md) — brief grain is NACE only; size/region only via the embedded snippet, which is where this feature lives.
  - [D-011](../project/decision-log.md) — the four canonical benchmark categories under which quartile verdicts sit.
  - [D-012](../project/decision-log.md) — revocation = stop-future-flow; already-rendered quartile verdicts in already-delivered briefs are not retroactively altered.
- **Upstream assumptions (must hold):** [A-003](assumption-log.md) (the eight ratios), [A-006](assumption-log.md) (NACE grain), [A-011](assumption-log.md) (human-authored briefs — analysts may paraphrase the verdict sentence around the frozen quartile label, not replace the label), [A-012](assumption-log.md) (briefs are the atomic unit; no standalone quartile surface), [A-017](assumption-log.md) (statistical-validity floor suppression is silent-to-user).
- **Upstream data contract:** [`docs/data/cohort-math.md`](../data/cohort-math.md) §4 (five-rung degradation ladder), §6 (percentile + quartile computation — Q1/Q2/Q3/Q4 mapping, average-rank tie handling, one-decimal percentile precision), §5.1 (working-capital-cycle sign inversion — "best quartile = shortest cycle" handled in the copy layer, i.e. here).
- **Upstream design contract:** [`docs/design/information-architecture.md`](../design/information-architecture.md) §4.3 BenchmarkSnippet — the component this feature's output is rendered by; states `default`, `low-confidence / below floor`, `empty`, `loading`, `error`. The canonical quartile labels below populate the `quartileLabel` prop.

## 3. User stories

### US-1 — Owner reads a cohort-grounded quartile verdict

- **As an** SME owner reading my monthly brief,
- **I want** each benchmark snippet inside the brief to tell me — in one short Czech sentence — which quarter of my peer cohort my business sits in, together with the exact percentile,
- **so that** I can describe my position to my accountant in a single phrase ("we're in the top quarter on gross margin, sixty-eighth percentile") without having to interpret a chart, a delta, or any statistical notation.

  **Acceptance criteria:**
  - [ ] Every rendered quartile snippet contains **both** the canonical Czech quartile label (§ canonical labels below) **and** the integer-rounded percentile number — never one without the other. Missing either half is a render-time failure; the snippet must degrade to the empty state, not ship half a verdict. (Enforces PRD §7.2.)
  - [ ] The quartile label is one of exactly four canonical Czech strings (see "Canonical Czech quartile labels" below). Any other string — including "Q1/Q2/Q3/Q4", any English word, any statistical notation — is rejected by the render layer.
  - [ ] The percentile renders as an integer 1–99 (never 0, never 100 — cohort-math §6.2 `(rank − 0.5)/N` offset guarantees the open interval), formatted as "{n}. percentil" in Czech.
  - [ ] The quartile label comes *before* the percentile in the sentence (verdict first, supporting number second). The reverse order is rejected in analyst authoring guidance and in the rendered template.
  - [ ] For the **working capital cycle** metric (and only for it), the "best" direction is inverted per cohort-math §5.1; the render layer consumes cohort-math's already-inverted quartile assignment and uses the same canonical labels without special-casing copy. Analyst authoring guidance confirms the direction is handled upstream so the analyst never has to remember the inversion.

### US-2 — Owner sees a graceful, plain-language fallback when the cohort is too small

- **As an** SME owner whose cohort cell is too small for a reliable quartile,
- **I want** the brief to simply not surface that metric's quartile, with a brief plain-language note where the snippet would have been,
- **so that** I am never shown a misleading number, and I am never told "your cohort is below a statistical-validity floor" — I see something my accountant would say.

  **Acceptance criteria:**
  - [ ] When cohort-math emits a rung-1/2/3 `degradation_signal` (pooled cohort cleared the floor; see cohort-math §4.1), the snippet renders with the achieved-rung cohort-qualifier footnote and still shows quartile label + percentile. The verdict text is written by the analyst per the rung's copy pattern; the quartile label and number are the same canonical strings as rung 0.
  - [ ] When cohort-math emits a rung-4 `degradation_signal` (`reason: "below_floor_all_rungs"`), the snippet renders the **below-floor fallback copy** ("Tento ukazatel zatím nemůžeme spolehlivě porovnat — k dispozici je málo srovnatelných firem v kohortě.") and renders **no quartile label and no percentile number anywhere**, including alt text, tooltips, data attributes, and PDF. (Enforces PRD §7.2 and A-017 — never a raw number without a quartile word, never any number at all below the floor.)
  - [ ] The email surface, per IA §4.3 rule, omits a below-floor or low-confidence snippet entirely rather than rendering the fallback copy (the email is already condensed; the fallback belongs only in web view + PDF where space permits a proper explanation).
  - [ ] The fallback state never surfaces the literal words "statistical-validity floor," "minimum cohort," "confidence interval," or "sample size" to the owner. Plain-language only (§7.3).
  - [ ] No telemetry or instrumentation is user-visible. Suppression is silent-to-user; the system still records the event per A-017.

### US-3 — Analyst authors the verdict sentence around the frozen quartile label

- **As a** ČS analyst authoring an embedded benchmark snippet inside a brief,
- **I want** the authoring back-end to give me the canonical quartile label and rounded percentile as non-editable fields, with an editable one-sentence verdict text that must mention both,
- **so that** I cannot accidentally drop the number, rename the quartile, or write a raw-number-only sentence.

  **Acceptance criteria:**
  - [ ] The authoring back-end renders `quartileLabel` and `percentile` as read-only fields populated from the upstream cohort-math snapshot. The analyst cannot edit either.
  - [ ] The analyst writes a `verdictText` field (1 sentence, Czech, vykání formal register) that must textually include **both** the quartile label string **and** the rendered percentile. Publishing is blocked until both substrings are present.
  - [ ] If cohort-math emits rung 4 for this metric × cell, the authoring back-end hides `quartileLabel` and `percentile` fields and only accepts the canonical below-floor fallback copy (which the analyst confirms but does not edit) — preventing an analyst from paraphrasing away the suppression.
  - [ ] Each snippet carries a `metricId` that matches one of the eight D-003 ratios; the category assignment (D-011) is looked up automatically and is not analyst-editable.

## 4. Scope

- **In scope:**
  - Canonical Czech quartile label set (frozen below) that populates `BenchmarkSnippet.quartileLabel` per IA §4.3.
  - Render contract: quartile label + integer percentile together, quartile-word-first, in the single-sentence verdict inside a BenchmarkSnippet.
  - Below-floor fallback copy (no number, plain-language) rendered in place of the verdict when cohort-math returns rung 4.
  - Rung-1/2/3 behavior: same canonical quartile label + percentile, with an analyst-authored cohort-qualifier footnote per cohort-math §4.1.
  - Analyst authoring-back-end constraints that make it structurally impossible to ship a raw-number-only snippet or a quartile-label-only snippet.
  - Working-capital-cycle inversion handled upstream in cohort-math §5.1; this feature consumes the already-correct quartile without special copy.
- **Out of scope:**
  - **Historical quartile tracking** (e.g., "last month you were in the second quarter") — Increment 2 per PRD §9 Historical Position Tracking. MVP shows the current-period quartile only.
  - **Peer cohort summary statistics beyond the single quartile** (e.g., "the cohort median is 14%", "the interquartile range is 3.8 pp", cohort distribution charts) — Increment 2 per PRD §9 Peer Cohort Summary Statistics. MVP surfaces one quartile label + one percentile per snippet.
  - **Any standalone dashboard, metric browser, or persistent quartile view** — A-012; PRD §4 non-goal ("No benchmark dashboard as a standalone product at MVP"). Quartile verdicts exist only inside a brief.
  - **Cause attribution** (why your quartile changed) — Increment 3 per PRD §9 Cause Attribution Analysis.
  - **Quartile Position Display [advanced]** — historical, multi-cohort, or per-period quartile comparison — Increment 3 per PRD §9.
  - **RM-facing quartile views** — deferred by D-002; no RM surface is built at MVP.
  - **Confidence intervals, error bars, or any statistical-uncertainty visualization** — violates §7.3 plain-language principle; cohort-math §3 floor + §4 rung ladder already own the confidence guarantee at MVP.
- **Increment:** MVP (Increment 1).

## 5. Success metrics

Ties to PRD §6 where possible.

- **Verdict completeness rate** (target: 100%) — share of rendered snippets where both the canonical quartile label and the integer percentile are present in the verdict sentence. Measured at render-time; a violation is a shipping defect, not a metric to drift on. Enforces §7.2.
- **Suppression correctness rate** (target: 100%) — share of rung-4 snippets that render the fallback copy with zero numeric or quartile-label content. Measured by render-time validator; violations block publish. Enforces A-017.
- **Owner engagement on snippet-bearing briefs (PRD §6 Goal 1 proxy)** — time-spent per brief and observation click-throughs (§6) for briefs that contain at least one rung-0/1/2/3 snippet vs. briefs where all snippets hit rung 4. Expect the snippet-bearing cohort to show higher engagement; if not, revisit whether the quartile verdict is reading to owners or being skimmed past.
- **Analyst publish-error rate** (operational) — share of brief-publish attempts blocked by the "both halves present" validator. A non-zero rate is healthy (the constraint is working); a sustained >20% rate is a sign the authoring UX is confusing and should be revisited with the designer.
- **Per-brief snippet fill rate** (diagnostic, not a target at MVP) — median count of non-rung-4 snippets per brief, segmented by cohort-cell readiness. This is the measured version of cohort-math §7.3's planning numbers; feeds Q-008 in cohort-math once real data lands.

Not measuring at MVP: absolute accuracy of the quartile assignment (cohort-math owns the computation and its confidence floor — PM doesn't second-guess the math); owner comprehension of the quartile label (deferred to post-trial qualitative review; tracked as an open question below).

## 6. Non-negotiables

- **Verdicts, not datasets (§7.2).** Every rendered quartile snippet carries **both** the canonical quartile label **and** the integer percentile, in that order. A quartile word without a number, or a number without a quartile word, is a shipping defect. The authoring back-end enforces this structurally per US-3.
- **Plain language, no jargon (§7.3).** Quartile labels are Czech, positional, and owner-legible. "Q1/Q2/Q3/Q4" notation never reaches the owner. "Percentile" renders as "percentil" in Czech with an ordinal number ("68. percentil"). No "p-value," no "CI," no statistical notation anywhere in the user surface.
- **Day-one proof of value (§7.4).** The quartile verdict is the owner's most memorable take-away from the embedded snippet block; it must render on the first brief a bank-referred owner ever sees (A-014). No configuration, no prior session, no prerequisite interaction.
- **Privacy as product (§7.5).** The quartile verdict is derived entirely from the `brief` data lane (cohort-math §3 enforcement point). No user-contributed capture (A-013) is introduced to unlock more snippets. No RM-visible derivation (A-002, D-002). No cross-lane leak.
- **Cold-start: never a silent low-confidence number (§13.5, A-017).** The rung-4 fallback is mandatory and is owned by this feature end-to-end: the authoring back-end enforces it, the render layer enforces it, and the PDF layer enforces it. There is no path by which a below-floor percentile can leak to the owner.
- **Bank-native distribution (§7.7).** The quartile verdict is the same string across email teaser snippet (when `confidenceState === 'valid'`, per IA §4.3 rule), web view, and PDF. Multi-Format Delivery faithfulness is a render-layer guarantee; this feature does not customize the label by surface.
- **No give-to-get feature in MVP.** The below-floor fallback does **not** offer the owner a "fill in your headcount to unlock this comparison" CTA. Give-to-get capture is Increment 3 per CLAUDE.md guardrail and A-013; any such CTA in a fallback state requires orchestrator approval.

### Canonical Czech quartile labels (frozen at MVP)

The four labels below are **the entire allowed set** for the `quartileLabel` render prop. They map 1:1 to cohort-math §6.1's `Q1`/`Q2`/`Q3`/`Q4` enum. Analysts may not rename, re-order, or abbreviate them. Designer consumes these as-is in `BenchmarkSnippet.quartileLabel`.

| cohort-math enum | Canonical Czech label (user-facing) | What it means to the owner |
|---|---|---|
| `Q4` (75th–100th percentile) | **horní čtvrtina** | "the top quarter of your peer cohort" — best performers |
| `Q3` (50th–75th percentile) | **třetí čtvrtina** | "the quarter above the median" — above-average |
| `Q2` (25th–50th percentile) | **druhá čtvrtina** | "the quarter below the median" — below-average |
| `Q1` (0th–25th percentile) | **spodní čtvrtina** | "the bottom quarter of your peer cohort" — worst performers |

**Why these four strings.**

- **Positional, not evaluative.** "horní / třetí / druhá / spodní čtvrtina" are positional ordinals, not value-laden adjectives like "nejhorší" (the worst). The owner already reads the position as a verdict; the label does not need to editorialize. This matters most for Q1: "spodní čtvrtina" reads as "the bottom quarter" (descriptive), not "nejhorší čtvrtina" (harsh, moralizing), and is closer to how an accountant would phrase it in a meeting — matching §7.3.
- **Symmetric ends, middle ordinals.** "horní" and "spodní" bracket the ranked set; "druhá" and "třetí" are numbered from the bottom (matching the Q1→Q4 convention where Q1 is lowest). A reader who sees "třetí čtvrtina" in one snippet and "horní čtvrtina" in the next gets a consistent spatial frame.
- **Works under working-capital-cycle inversion.** Cohort-math §5.1 inverts the quartile assignment for working capital cycle *before* this feature consumes it, so a firm with the shortest cycle receives `Q4` → "horní čtvrtina" correctly without this feature having to know about the inversion. The positional labels do not carry a hidden "high value = good" semantic that would break under inversion.
- **Short enough for a one-sentence verdict.** Two Czech words each; fits inline without forcing line-wraps in the email teaser or PDF body.
- **Compatible with cohort-math's published rung-0 example.** Cohort-math §4.1 shows a rung-0 example as "…places you in the **third quartile**…" which, translated to the frozen Czech form, becomes "…patří do **třetí čtvrtiny** kohorty…" This feature freezes that exact noun ("třetí čtvrtina") rather than letting "třetí kvartil" and "třetí čtvrtina" drift across artifacts.

**Alternative considered and rejected.** Evaluative labels of the form "nejlepší čtvrtina / nadprůměrná čtvrtina / podprůměrná čtvrtina / nejhorší čtvrtina" were considered; rejected because "nejhorší" editorializes in a direction the brief's verdict already carries, and because "nadprůměrná / podprůměrná" are technically incorrect for quartiles (they describe halves, not quarters). The designer may propose a softer Q1 label if post-trial qualitative review shows "spodní čtvrtina" reads as harsh — logged as OQ-QPD-001 below.

### Below-floor fallback copy (frozen at MVP)

Rendered verbatim in place of the verdict when cohort-math emits `achieved_rung: 4`:

> "Tento ukazatel zatím nemůžeme spolehlivě porovnat — k dispozici je málo srovnatelných firem v kohortě."

- No quartile label, no number, no "statistical-validity floor" vocabulary.
- "Zatím" ("for now") preserves the posture that this is a timing constraint, not a permanent "we don't know" — consistent with cohort-math §4.1 rung 4 copy ("…we'll include it next time the cohort is ready").
- Legal review required before production (OQ-005 parent in `trust-and-consent-patterns.md`; this string is added to that review scope — see OQ-QPD-002 below).

### Rung-1/2/3 cohort-qualifier footnote (guidance, not frozen copy)

Rungs 1–3 ship the same canonical quartile label + percentile, with a one-line plain-language cohort qualifier appended by the analyst per cohort-math §4.1. Analyst authoring-back-end guidance will carry the suggested patterns (e.g., rung 1 "…napříč Českem pro firmy vaší velikosti" / rung 3 "…napříč Českem ve vašem oboru"). Exact strings are analyst-authored per brief and are not frozen here — the frozen contract is that the quartile label and percentile are unchanged across rungs 0–3.

## 7. Open questions

Log each in [`docs/project/open-questions.md`](../project/open-questions.md) at the next orchestrator gate with the same local ID.

- **OQ-QPD-001** — Does "spodní čtvrtina" read to Czech SME owners as accurate-and-neutral, or as harsh-enough to disengage at the Q1 snippet? Proposed resolution: post-trial qualitative review at end of MVP trial window (A-010). Designer may propose a softer alternative (e.g., "poslední čtvrtina") before first brief ships if trust-and-consent-patterns review flags it; any change is a new PDR, not a silent edit. Does not block MVP.
- **OQ-QPD-002** — Legal review of the below-floor fallback copy string ("Tento ukazatel zatím nemůžeme spolehlivě porovnat…") — is the "spolehlivě" claim defensible without a named methodology reference? Sibling to OQ-005 (brief-surface Czech copy legal review). Blocks production readiness, not design.
- **OQ-QPD-003** — Should the PDF surface render the rung-1/2/3 cohort qualifier as a proper footnote (numbered, at page bottom) or as an inline parenthetical? Owner is the designer; logged here because PM's verdict-first principle constrains which option is acceptable (inline parenthetical is preferred — the verdict stays intact; a page-bottom footnote risks the owner reading the quartile without the cohort qualifier).
- **OQ-QPD-004** — For working-capital-cycle inversion (cohort-math §5.1), is there any risk that an analyst-authored verdict sentence contradicts the pre-inverted quartile (e.g., analyst writes "váš cyklus je dlouhý" while cohort-math assigns Q4 "horní čtvrtina" because the cycle is short)? Proposed resolution: authoring-back-end renders the metric's "direction" cue ("kratší cyklus = lepší") next to the quartile label field so the analyst cannot miswrite the sentence. Engineer owns implementation; PM owns the constraint.

## 8. Downstream artifacts

- **Design:** [`docs/design/quartile-position-display/`](../design/quartile-position-display/) — not yet drafted (Phase 2 Track B deliverable). Designer consumes: canonical Czech quartile label set (§6), below-floor fallback copy (§6), rung-qualifier guidance (§6), and the authoring-back-end constraints (US-3). Upstream dependency already in place: [`docs/design/information-architecture.md`](../design/information-architecture.md) §4.3 BenchmarkSnippet.
- **Engineering:** [`docs/engineering/quartile-position-display.md`](../engineering/quartile-position-display.md) — not yet drafted (Phase 2 Track B deliverable). Engineer consumes: the render-time validator contract (both halves present or render empty state), the analyst-authoring-back-end validators (US-3), the label enum as a type, and the consumer contract against cohort-math's `degradation_signal` payload (cohort-math §4.3).
- **Data:** no addendum needed in `docs/data/`. The upstream contract is already complete in [`docs/data/cohort-math.md`](../data/cohort-math.md) §§4, 5.1, 6; this feature is downstream of that artifact and does not add new data-model requirements.
- **Product sibling:** [`docs/product/percentile-position-calculation.md`](percentile-position-calculation.md) — not yet drafted (Phase 2 Track B, sequenced before this PRD in build-plan §5 Track B). This feature consumes its output via cohort-math's published snapshot schema (cohort-math §6.1 row shape); if `percentile-position-calculation.md` renames any of those fields, this PRD's US-3 authoring contract must be revisited.
- **Product sibling:** [`docs/product/category-based-layout.md`](category-based-layout.md) — not yet drafted (Phase 2 Track B). Category assignment per D-011 is looked up by `metricId` (US-3 AC); this feature does not own the category layout itself.

## Changelog

- 2026-04-20 — initial draft freezing the canonical Czech quartile label set (horní / třetí / druhá / spodní čtvrtina), the below-floor fallback copy, the "both halves present" render contract, and the Increment-2 out-of-scope markers (historical tracking, cohort summary stats, standalone dashboard) — product-manager
