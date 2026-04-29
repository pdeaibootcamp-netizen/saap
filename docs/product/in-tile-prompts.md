# In-tile prompts — "ask when missing" UX (v0.3)

*Owner: product-manager · Slug: in-tile-prompts · Last updated: 2026-04-27*

## 0. Scope note and framing discipline

This spec governs **only** the new "ask when missing" tile state and the moderator-facing IČO switcher field on the v0.3 dashboard. It is additive to [dashboard-v0-2.md](dashboard-v0-2.md) and [docs/design/dashboard-v0-2/tile-states.md](../design/dashboard-v0-2/tile-states.md); the v0.2 valid / below-floor / loading states are unchanged.

Visual design (input affordance shape, toast styling, focus rings, error colour) is the designer's lane in `docs/design/in-tile-prompts.md`. Schema, API surface, and server-side validation live in DE's `docs/data/owner-metrics-schema.md` and EN's `docs/engineering/owner-metrics-api.md`. This file decides **which states exist, what each state says in Czech, what the plausibility bounds are, and what the moderator sees**.

## 1. Summary

In v0.3 the dashboard's eight tiles render against real per-owner data stored in `owner_metrics`. When a metric is null for the active demo firm, the tile becomes an "ask the owner" CTA — a one-line prompt and an inline numeric input. Saving writes the value, refreshes the tile to its valid state, and the dashboard now carries one more populated metric. A small moderator-only IČO field in the header band switches the active demo firm between pre-seeded examples and any IČO present in `cohort_companies`. The spec covers per-metric prompt copy and plausibility bounds for the eight frozen metrics from [D-024](../project/decision-log.md), the post-save feedback intent, the recommended ask order, the IČO switcher copy, and pre-seed criteria for demo firms.

## 2. Upstream links

- PRD sections:
  - [§7.1 Day-one proof of value](../../PRD/PRD.md#7-product-principles) — the prompt is one click and one numeric field; nothing else stands between the owner and a populated tile.
  - [§7.2 Verdicts, not datasets](../../PRD/PRD.md#7-product-principles) — a tile in CTA state cannot show a quartile because there is no value yet; the CTA copy carries the missing-verdict admission plainly.
  - [§7.3 Plain language](../../PRD/PRD.md#7-product-principles) — Czech, formal vykání, no statistical notation, no "fill in", no "missing data".
  - [§7.5 Privacy as product](../../PRD/PRD.md#7-product-principles) — values entered land in the `user_contributed` lane only ([D-010](../project/decision-log.md)). Never in `rm_visible` or `credit_risk`.
  - [§7.8 Give-to-get in mind, not in build](../../PRD/PRD.md#7-product-principles) — the in-tile prompt is the first concrete give-to-get touchpoint we ship. It is **scoped narrowly**: only the eight frozen metrics, only the demo owner, no upstream "thank you, here is more" loop at v0.3. The Additional Customer Information Gatherer ([CLAUDE.md](../../CLAUDE.md), PRD §9 Increment 3) is still out of scope.
- ČS business goals served:
  - **G1 Engagement** — testing how an owner reacts to being asked is the v0.3 PoC's central probe.
  - **G2 Data depth + cadence** — every saved value is a real datapoint that strengthens the per-owner brief and the cohort.
  - *Not served:* G3 RM lead generation. No CTA value is routed into an RM-visible surface.
- Related decisions:
  - [D-023](../project/decision-log.md) — real-firm demo owner via IČO switcher, replacing synthetic null/value mix.
  - [D-024](../project/decision-log.md) — frozen 8-metric set for v0.3 (ROCE → Net margin).
  - [D-025](../project/decision-log.md) — synthetic per-NACE quintile fallback for cohort cells not covered by real data.
  - [D-014](../project/decision-log.md) — graceful-degradation posture; below-floor stays a distinct state, not a CTA.
  - [D-010](../project/decision-log.md) — `user_contributed` lane is the only lane writes from this surface land in.

## 3. Tile-state mechanic

The tile component grows one new state. The full state matrix at v0.3:

| State | When it shows | Rendered |
|---|---|---|
| **Valid** | `owner_metrics.<metric>` is present **and** the cohort cell for the firm's NACE has a real or synthetic ([D-025](../project/decision-log.md)) percentile available. | v0.2 valid tile: label + raw value + percentile + quartile pill. Unchanged from [tile-states.md](../design/dashboard-v0-2/tile-states.md) §3 State 1. |
| **Ask** *(new at v0.3)* | `owner_metrics.<metric>` is null for the active firm. | Metric label + per-metric prompt sentence (§4) + inline input + save affordance. No raw value, no percentile, no quartile pill. |
| **Below-floor** | Owner metric is present but the cohort cell has neither real nor synthetic ([D-025](../project/decision-log.md)) coverage. Rare under v0.3 because synthetic fallback is broad; remains as a defensive state. | v0.2 below-floor tile per [tile-states.md](../design/dashboard-v0-2/tile-states.md) §3 State 2. |
| **Loading** | While `owner_metrics` and `cohort_aggregates` are being read on first paint or after a save. | v0.2 loading skeleton per [tile-states.md](../design/dashboard-v0-2/tile-states.md) §3 State 4. |

State precedence at render time: `loading` > `ask` (null owner value) > `below-floor` (cohort cell missing) > `valid`. A tile in `ask` state never simultaneously renders a quartile pill — the owner has not contributed the value yet, so the comparison cannot exist. The PRD §7.2 verdict-pairing rule is satisfied across the page (the rest of the tiles still pair value + verdict); on this single tile the CTA is the verdict-equivalent ("we cannot say where you stand until you tell us").

The `empty` state from [tile-states.md](../design/dashboard-v0-2/tile-states.md) §3 State 3 ("metric not applicable") is dropped at v0.3. The frozen 8 metrics are deliberately chosen to apply to every NACE in the test cohort; "not applicable" is collapsed into "ask" — if it does not apply, the owner is not expected to enter it, but no separate tile state is needed.

## 4. Per-metric prompt copy

All copy is Czech, formal vykání, no statistical notation, no "fill in" / "doplňte", no "missing" / "chybí". Each prompt is one sentence ending in a question mark or a period that reads as a polite ask. The unit suffix is the input-field suffix shown to the right of the numeric field; it is not part of the prompt sentence.

Each metric has three strings:

- **Prompt label** — a short header above the input. Same as the metric's canonical Czech name from [mvp-metric-list.md](mvp-metric-list.md), with one exception: ROCE is replaced by Čistá marže per D-024.
- **Help text** — one polite sentence explaining what to enter, in plain Czech.
- **Unit suffix** — the right-aligned suffix of the input.

| # | Metric (D-024 order) | Prompt label | Help text | Unit suffix |
|---|---|---|---|---|
| 1 | Hrubá marže | `Hrubá marže` | `Uveďte prosím vaši hrubou marži za poslední uzavřený rok.` | `%` |
| 2 | Marže EBITDA | `Marže EBITDA` | `Uveďte prosím vaši EBITDA marži za poslední uzavřený rok.` | `%` |
| 3 | Podíl osobních nákladů | `Podíl osobních nákladů` | `Uveďte prosím podíl mzdových a osobních nákladů na vašich tržbách.` | `%` |
| 4 | Tržby na zaměstnance | `Tržby na zaměstnance` | `Uveďte prosím průměrné roční tržby na jednoho zaměstnance.` | `tis. Kč` |
| 5 | Cyklus pracovního kapitálu | `Cyklus pracovního kapitálu` | `Uveďte prosím, kolik dní v průměru trvá váš cyklus pracovního kapitálu (od nákupu po inkaso).` | `dní` |
| 6 | Čistá marže *(replaces ROCE per [D-024](../project/decision-log.md))* | `Čistá marže` | `Uveďte prosím vaši čistou marži za poslední uzavřený rok (hospodářský výsledek dělený obratem).` | `%` |
| 7 | Růst tržeb vs. medián kohorty | `Růst tržeb` | `Uveďte prosím meziroční růst vašich tržeb za poslední uzavřený rok.` | `%` |
| 8 | Cenová síla | `Cenová síla` | `Uveďte prosím, o kolik procentních bodů se za poslední rok změnila vaše marže oproti předchozímu roku.` | `p. b.` |

Notes on copy:

- `Uveďte prosím` is the chosen verb. Rejected alternatives: `Doplňte` (reads as a form-filler chore), `Zadejte` (cold and machine-like), `Sdělte nám` (over-personal).
- "Za poslední uzavřený rok" is the implicit period for ratios 1, 2, 6, 7. We do not show a year picker at v0.3; the moderator session is short and the period framing is in the help text. Logged as OQ-IT-01 below.
- Pricing power proxy (#8) is reframed for owner legibility as a year-over-year margin point change. The full "trajectory vs cohort margin trajectory" derivation [`mvp-metric-list.md` §7] is not askable in one field; we accept the simpler proxy at v0.3 and let cohort-math reconstruct trajectory from the entered point change. Logged as OQ-IT-02.
- Help text length is held to one sentence on purpose — the prompt slot is small. The designer may render the help text as helper-text-below-input or as placeholder text; both are acceptable provided it is always visible at the moment of input (placeholder-only is rejected because it disappears on focus).

The CTA action button copy is uniform across tiles: **"Uložit"**. The cancel affordance, if the designer renders one, reads **"Zrušit"**.

## 5. Plausibility validation rules

Per-metric numeric bounds enforced **client-side at submit** and **server-side on PATCH** (the latter is EN's contract). Values outside the bounds reject with a per-metric Czech error message. Bounds are deliberately wide — the goal is to catch obvious typos (extra zero, wrong sign, percent-as-decimal), not to police plausibility narrowly.

| # | Metric | Min | Max | Decimal places | Sign allowed | Error copy on out-of-bounds |
|---|---|---|---|---|---|---|
| 1 | Hrubá marže | `-50` | `100` | 1 | both (rare loss case) | `Tato hodnota se zdá být mimo obvyklý rozsah. Zkontrolujte prosím zadání.` |
| 2 | Marže EBITDA | `-50` | `60` | 1 | both | `Tato hodnota se zdá být mimo obvyklý rozsah. Zkontrolujte prosím zadání.` |
| 3 | Podíl osobních nákladů | `0` | `90` | 1 | non-negative only | `Podíl nákladů by měl být mezi 0 a 90 %. Zkontrolujte prosím zadání.` |
| 4 | Tržby na zaměstnance | `100` | `100 000` | 0 | non-negative only | `Tato hodnota se zdá být mimo obvyklý rozsah (uveďte prosím v tisících Kč).` |
| 5 | Cyklus pracovního kapitálu | `-90` | `365` | 0 | both (negative cycle = paid-before-pay) | `Cyklus by měl být mezi -90 a 365 dny. Zkontrolujte prosím zadání.` |
| 6 | Čistá marže | `-50` | `60` | 1 | both | `Tato hodnota se zdá být mimo obvyklý rozsah. Zkontrolujte prosím zadání.` |
| 7 | Růst tržeb | `-80` | `200` | 1 | both | `Růst tržeb by měl být mezi -80 a 200 %. Zkontrolujte prosím zadání.` |
| 8 | Cenová síla | `-30` | `30` | 1 | both | `Změna marže by měla být mezi -30 a 30 procentními body.` |

A non-numeric entry (letters, multiple decimal separators, empty submit) returns a single uniform error: **"Uveďte prosím číselnou hodnotu."**

The Czech decimal separator is a comma; the input must accept either comma or period and normalise on save (engineer detail). Thousands separators on input are accepted and stripped.

The bounds are stated here so the EN spec can codify them once. **PM owns the values; if EN's server-side contract needs different bounds for a defensible reason, that returns to PM for re-spec, not silently widened.**

## 6. Save behaviour and feedback

The interaction model on save:

1. Owner clicks **"Uložit"** (or presses Enter in the input).
2. Client-side validation runs (§5 bounds). On failure: inline error copy below the input, focus stays in the input, no network call.
3. On pass: PATCH to the owner-metrics endpoint (EN spec). The whole page reloads on success — full reload is acceptable per orchestrator brief; SPA-style optimistic update is not required at v0.3.
4. On reload, the tile renders in its new **valid** state (raw value + percentile + quartile pill from cohort lookup). The other seven tiles are unchanged.

**"Just-saved" feedback intent.** The PM intent is: the owner needs a brief, unmistakable signal that their value landed. Two acceptable design renderings:

- **Toast** — a small Czech-text confirmation (`"Uloženo."`) appearing top-right or bottom-centre for ~2 s after reload, then fading. Toast text is **"Uloženo."** — short, polite, non-celebratory. Avoid `Děkujeme!` or `Skvěle!` (over-warm, reads like a marketing app).
- **Tile pulse** — the just-saved tile renders with a one-second highlight (a brief border or background shimmer) on first paint after reload. If the designer picks this approach the toast is unnecessary.

The designer picks one. PM constraints: **no modal, no full-screen confirmation, no celebratory animation, no "thank you for sharing your data" microcopy**. Verdicts not datasets applies to the feedback too — the verdict is "your tile is now populated", and that fact is visible in the tile itself; the toast or pulse is reinforcement, not the primary signal.

If the PATCH itself fails (network error, server validation rejects what the client passed): the page does not reload; the inline area below the input shows **"Hodnotu se nepodařilo uložit. Zkuste to prosím znovu."**, the input retains the entered value, and the focus stays in place.

## 7. Order of asks

When multiple tiles are simultaneously in `ask` state, the owner reads top-to-bottom across the four-category grid per [dashboard-v0-2.md](dashboard-v0-2.md) §6. The PM-recommended **ask order** — meaning: which CTA is most worth surfacing first, which prompt copy and visual emphasis the designer can use to suggest a starting point — is **by metric importance** rather than alphabetical or category order.

The order, top-to-bottom:

1. **Hrubá marže** — single clearest signal (mvp-metric-list.md §1).
2. **Marže EBITDA** — most-referenced ratio in bank conversations.
3. **Čistá marže** — completes the profitability triplet; high coverage in real data per D-024.
4. **Tržby na zaměstnance** — owner-legible productivity signal needing no interpretation.
5. **Podíl osobních nákladů** — pairs with #4 to distinguish wage-cost from productivity stories.
6. **Růst tržeb vs. medián kohorty** — directional verdict needs trajectory.
7. **Cyklus pracovního kapitálu** — cash-position signal; askable but heavier (combines AR / AP / inventory days).
8. **Cenová síla** — the most derived; left last because the prompt is also the most cognitively expensive.

This ordering does **not** override the visual grid layout — the tiles still render in the four-category arrangement from D-011. It governs only which tile the designer may choose to visually emphasise (e.g., a soft highlight, a "začněte zde" hint) when multiple are in CTA state. PM does not require visual emphasis at v0.3; if the designer renders all CTA tiles equally, that is acceptable. Logged as OQ-IT-03.

## 8. The IČO switcher field (moderator tool)

A small input field in the dashboard header band, used by the testing moderator (not the owner) to switch the active demo firm to any IČO present in `cohort_companies`. Per [D-023](../project/decision-log.md), this replaces the synthetic null/value mix as the v0.3 demo mechanism.

### 8.1 Visual treatment hint

This is a moderator tool, not a customer-facing affordance. It must not read as a primary feature of the dashboard. PM constraints — designer renders within these:

- Placed in the header band, right-aligned, after the wordmark.
- Visually de-emphasised compared to the wordmark and tile grid: muted colour, smaller font (≤ `--text-caption` 12 px), no surrounding card or shadow.
- Optionally tagged with a tiny prefix label `Demo:` (lowercase, muted) so a moderator scanning the page recognises the field instantly.
- Not hidden behind a click. The field is visible on first paint; we accept the small cosmetic cost because moderators need it always-available during a session.

### 8.2 Copy

| Element | Czech string |
|---|---|
| Field label (visually muted prefix) | `Demo:` |
| Placeholder text | `IČO firmy` |
| Submit affordance (button text or "press Enter" hint) | `Přepnout` |
| Success state (after switch) | No toast — the entire dashboard reloads with the new firm's data. The tiles re-render. The IČO field shows the now-active IČO as its value. |
| Error: IČO not found in `cohort_companies` | `Tuto firmu v datech nemáme. Zkuste prosím jiné IČO.` |
| Error: IČO format invalid (not 8 digits) | `IČO má 8 číslic. Zkontrolujte prosím zadání.` |
| Error: server / network failure | `Přepnutí se nezdařilo. Zkuste to prosím znovu.` |

The active IČO persists in a cookie ([D-023](../project/decision-log.md)). On first visit with no cookie, the dashboard loads against the first pre-seeded demo firm (§9). The cookie is dev-only / PoC; no consent surface is added for it (the moderator owns the cookie, not a customer).

### 8.3 What the IČO switcher does NOT do

- It does not authenticate as that firm. There is no login.
- It does not write any data. PATCH calls from in-tile prompts continue to write to the active demo owner's `owner_metrics` row, where the active demo owner is whichever firm the IČO field currently selects.
- It does not surface in the customer-facing brief detail page chrome — the brief page is read-only and inherits the active firm from the cookie.

## 9. Pre-seeded demo firms

The v0.3 build seeds a small set of demo firms at build time so the dashboard never opens to a blank state. The orchestrator brief asked PM to spec the **selection criteria**, not the actual IČOs (those come at seed time from the NACE 49.41 Excel).

### 9.1 Recommended set size

**Three to five firms.** Five gives the moderator enough variety for a 30-minute session without overwhelming the test plan. Three is the floor — fewer than three makes the IČO switcher feel underused.

### 9.2 Selection criteria

The seed picker (whether a person or a script) chooses firms that satisfy **all** of:

1. **NACE 49.41 (Silniční nákladní doprava)** — single-NACE focus per build-plan §11.5.
2. **Present in the current `cohort_companies` ingest** — the firm must have a row, otherwise the IČO switcher will reject it.
3. **Distinct size cohorts across the set** — at least one large firm (revenue > 100 M Kč), one mid-size firm (revenue 25–100 M Kč), and one small firm (revenue < 25 M Kč). This lets the moderator probe how tile interpretation changes by firm scale.

And **at least one firm in the set must satisfy each of**:

4. **Employee count missing.** Drives a `Tržby na zaměstnance` CTA tile on first paint.
5. **Profit / hospodářský výsledek missing.** Drives a `Čistá marže` CTA tile.
6. **Coverage gap on at least one further metric** beyond #4 and #5 (i.e., a third missing field). Provides three CTAs simultaneously to test the order-of-asks behaviour from §7.

And **at least one firm in the set must satisfy**:

7. **All available data populated** — revenue, employees, profit all present. This firm is the "happy path" demo where the dashboard opens with eight valid tiles (real values where possible, synthetic per [D-025](../project/decision-log.md) for cells the data does not cover).

The first firm in the seed (the cookie-default) **must be a firm satisfying #4–#6** — not the happy-path firm. The PoC's central probe is the in-tile prompt UX, and a happy-path-only first impression undersells the give-to-get product mechanic the test is designed to surface.

Geographic diversity is a nice-to-have, not required. City of registered office is data-engineer information, not material at PoC.

### 9.3 What the seed contains

The seed is a list of IČOs and an ordering. The actual firm financials live in `cohort_companies` and are read at runtime; the seed itself does not duplicate them. Owner-side `owner_metrics` rows are created on first activation per IČO with all metrics nulled; values land only via the in-tile prompts or via direct ingestion of the firm's row from the Excel where the metric is computable from real data (DE owns that mechanic).

## 10. Acceptance criteria

A reviewer (PD during design, EN during 3.2.A implementation, user during 3.3 walkthrough) can accept the spec as implemented when all of the following hold:

- [ ] **Three tile states render correctly.** A tile with a non-null `owner_metrics` value and a real-or-synth cohort cell renders as **valid** (v0.2 visual). A tile with null `owner_metrics` value renders as **ask** (prompt + input + Uložit). A tile with a value but no cohort coverage renders as **below-floor** (v0.2 visual).
- [ ] **Per-metric prompt copy is verbatim §4.** All eight metrics carry the prompt label, help text, and unit suffix from the §4 table. No substitutions, no editorial drift.
- [ ] **Plausibility bounds enforced both client- and server-side.** A value outside §5 bounds is rejected with the per-metric error copy. A non-numeric entry returns the uniform "Uveďte prosím číselnou hodnotu." error.
- [ ] **Save reloads the page and renders the just-saved tile in valid state.** Either a toast `"Uloženo."` or a one-second tile pulse confirms the save (designer picks). No modal, no celebratory copy.
- [ ] **The IČO switcher is present, visually de-emphasised, and copy-faithful to §8.2.** Placeholder is `IČO firmy`. Unknown IČO returns `Tuto firmu v datech nemáme. Zkuste prosím jiné IČO.`. Active IČO persists in a cookie.
- [ ] **Pre-seeded demo firms satisfy §9.2 criteria.** The seed contains 3–5 NACE 49.41 firms covering small / mid / large size bands; at least one firm has employee count missing and at least one has profit missing; at least one is happy-path (all data present); the cookie-default first firm is a missing-data firm.

## 11. Open questions (non-blocking)

- **OQ-IT-01 — Period framing for ratio metrics.** §4 prompts assume "poslední uzavřený rok" implicitly. If a moderator session reveals owners interpreting the field as YTD or last-quarter, we add an explicit period selector. Self-monitoring; not in `open-questions.md`.
- **OQ-IT-02 — Cenová síla simplification.** §4 metric #8 reframes the proxy as a year-over-year margin point change, which is owner-legible but loses the "vs cohort trajectory" cohort-anchored part of the canonical definition. DE's percentile-compute spec must reconstruct trajectory comparison from this simpler input or surface a degraded percentile. Cross-track flag — logged in `open-questions.md` as OQ-059 (orchestrator to re-ID at the v0.3 gate).
- **OQ-IT-03 — Visual emphasis on the recommended first ask.** §7 specifies an order; whether the designer renders any visual cue ("začněte zde", soft highlight) or treats all CTA tiles equally is a designer call. PM is indifferent at v0.3.

## 12. Downstream artifacts

- Design: `docs/design/in-tile-prompts.md` — *not yet drafted at time of this spec.* Owns: input affordance shape, error display position, toast vs pulse selection, IČO field placement and styling, focus and keyboard behaviour, accessibility (ARIA, screen reader announcements on state transition).
- Data: `docs/data/owner-metrics-schema.md` — owned by DE per build-plan §11.4. Owns: `owner_metrics` table shape, units stored, source enum, null semantics. PM constraint on DE: the eight metric IDs in the schema match the IDs in [mvp-metric-list.md](mvp-metric-list.md) with `roce` replaced by `net_margin` per [D-024](../project/decision-log.md).
- Engineering: `docs/engineering/owner-metrics-api.md` — owned by EN. Owns: PATCH endpoint, server-side validation matching §5 bounds, IČO-switcher endpoint and cookie, plausibility error responses in Czech, `cohort_companies` lookup contract.
- Product (sibling): [dashboard-v0-2.md](dashboard-v0-2.md) — locked; this spec is additive. [brief-page-v0-2.md](brief-page-v0-2.md) — unaffected; the ask UX does not surface on the brief detail page.

## 13. Non-negotiables (PRD §7 principles applied)

- **§7.1 Day-one proof of value** — a tile in CTA state is one input and one click away from a verdict. No multi-field form, no wizard.
- **§7.2 Verdicts, not datasets** — the CTA copy makes the missing-verdict explicit ("we cannot say where you stand until you tell us") rather than rendering a half-state with a value but no comparison.
- **§7.3 Plain language** — Czech, formal vykání, no statistical notation, no `průměr` / `medián` / `kohorta` in the prompt copy itself (the help text avoids those words).
- **§7.5 Privacy as product** — entered values land in `user_contributed` only. The IČO switcher does not authenticate or surface any RM-visible output.
- **§7.6 Opportunity-flavored, not risk-flavored** — `Uveďte prosím vaši hrubou marži…` reads as a polite request from a sector intelligence tool, not as a bank surveillance probe. No copy frames the ask as "to assess your business" or "to evaluate your position".
- **§7.8 Give-to-get in mind, not in build** — the in-tile prompt is a **bounded** capture surface (the eight frozen metrics; no upstream "thank you, here is bonus content" loop). It is **not** the Additional Customer Information Gatherer (PRD §9 Increment 3); orchestrator approval was logged via D-023 / D-024 / D-025 and the v0.3 build-plan §11.

## Changelog

- 2026-04-27 — initial draft for v0.3 in-tile prompt UX, IČO switcher, and pre-seed demo firm criteria. Consumes D-023 (real-firm demo owner), D-024 (Net margin replaces ROCE), D-025 (synthetic cohort fallback). Two cross-track OQs (OQ-IT-02 raised for orchestrator re-ID); one self-monitoring (OQ-IT-01); one designer-call (OQ-IT-03). — product-manager
