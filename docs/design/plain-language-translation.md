# Plain-Language Translation — Design

*Owner: designer · Slug: plain-language-translation · Last updated: 2026-04-20*

## 1. Upstream link

- Product doc: [docs/product/plain-language-translation.md](../product/plain-language-translation.md)
- PRD sections driving constraints: §7.2 (verdicts not datasets), §7.3 (plain language), §8.1 (brief surfaces), §13.1 (production scaling risk)
- Decisions in force: D-004 (Czech only), D-008 (consent copy), D-011 (canonical category names), D-012 (revocation semantics)

This PRD is a **policy + review-checklist** document, not a UI feature. The design deliverable is minimal: the inline review surface embedded in the analyst authoring back-end. No owner-facing screens are introduced by this feature.

## 2. Primary flow

No flow diagram. The mechanism is an inline checklist inside the authoring card, not a separate screen. The review surface is a panel that appears alongside each text field in the analyst back-end; there is no dedicated route or page transition.

## 2b. Embedded variant (George Business WebView)

Not applicable — this feature is entirely back-end (analyst authoring tool), not an owner-facing WebView surface.

## 3. Screen inventory

| Screen | Purpose | Entry | Exit | Empty state | Error states |
|---|---|---|---|---|---|
| Authoring card — checklist panel | Inline checklist of P-1..P-10 rules shown alongside each user-facing text field the analyst edits | Analyst opens or focuses a text field in the authoring back-end | Analyst saves the field; checklist collapses or persists per field | Field untouched: all items shown as "Nezadáno" (unreviewed) | Not applicable — checklist is a local UI aid; no network dependency |
| Review surface — string list | Full list of every user-facing string in the brief grouped by delivery surface (email / web / PDF), each with a pass/fail verdict column | Analyst submits draft for review; reviewer opens the brief in review mode | All strings marked "Splněno"; reviewer approves → brief advances to publish queue | Brief contains no strings yet: "Přehled neobsahuje žádné texty k revizi." | Brief data fails to load: "Texty přehledu se nepodařilo načíst. Zkuste to prosím znovu." |
| Audit view — read-only string list | Same string list as review surface, read-only; for post-publication PM audit | PM opens a shipped brief via audit action | PM logs any violations; view closes | No strings (should not happen for a shipped brief): "Žádné texty k zobrazení." | Load failure: same as review surface error copy |

## 4. Component specs

### Kontrolní seznam plain-language (Plain-language checklist panel)

**Purpose:** Surfaces the ten P-1..P-10 checkpoints from the product PRD §7 as an inline pass/fail column next to each authored text field. The analyst self-reviews before submitting; the reviewer performs a second pass using the same component in review mode.

**Placement:** Right-hand sidebar panel alongside each text-field card in the analyst authoring back-end. On narrower authoring-tool viewports, collapses to an expandable drawer below the field. Does not cover the text field.

**States per checklist item:**

| State | Visual treatment | Czech label | Trigger |
|---|---|---|---|
| Unreviewed | Neutral circle icon + grey text | "Nezadáno" | Default; field has not been reviewed yet |
| Pass | Filled check icon + green text | "Splněno" | Analyst or reviewer marks the item as passing |
| Flagged (fail) | Filled warning icon + red text | "Zamítnuto" | Reviewer marks fail; reason field appears below the item |
| Reviewer-overridden | Filled check icon + amber text + "(výjimka)" suffix | "Splněno (výjimka)" | Reviewer explicitly overrides a fail per §9 line 1 escalation path; reason required |

Color is never the only signal: each state uses a distinct icon shape (circle / check / warning / check-with-badge) in addition to color.

**Reason field (Flagged state):** Free-text input that appears inline below the flagged item. Required before the reviewer can save a "Zamítnuto" verdict. Visible to the authoring analyst on next open. Placeholder text: "Uveďte důvod zamítnutí a navrhněte úpravu."

**Publish gate badge:** When any item across any string in the brief is in the Flagged state or Unreviewed state, the publish action in the authoring back-end shows a disabled badge: "Publikování blokováno — {N} položek čeká na revizi." The engineer enforces the gate in the back-end state machine (product PRD §8); this badge is the UI reflection of that gate.

**States for the checklist as a whole:**

- **All unreviewed:** "Zkontrolujte každou položku před předáním k revizi."
- **Some flagged:** "Přehled obsahuje {N} zamítnutých položek. Upravte texty dle poznámek."
- **All pass / overridden:** "Všechny položky prošly kontrolou. Přehled je připraven k publikaci."

**Props needed from the authoring back-end:**
- `stringId` — which user-facing string this panel is attached to
- `deliverySurfaces` — which surfaces this string appears in (`email` | `web` | `pdf` | combination)
- `reviewMode: boolean` — if `true`, items are editable by reviewer; if `false` (author self-check), items are advisory only and do not gate saving
- `auditMode: boolean` — if `true`, all items are read-only

**Where used:** Every text field in the analyst authoring back-end that produces a user-facing string (opening summary, each observation headline + body, each benchmark-snippet verdict, each time-horizon pill value, each closing action, email subject + pre-header + CTA, PDF footer boilerplate, degraded/empty/error state copy).

[BLOCKED — Q-PD-PLT-001] — the authoring back-end UI framework and component library are not yet specified in `docs/engineering/`. The checklist panel is described by intent and props here; implementation details (e.g., whether this is a React sidebar component, a separate pane, or a modal) depend on the engineer's authoring-back-end design. This section is implementable for everything outside that decision.

## 5. Copy drafts

Czech only per D-004. English parenthetical not included — this surface is analyst-facing back-end tooling; analysts are Czech speakers.

**Checklist panel heading**
> Kontrolní seznam plain-language

**Checklist item labels** (one per rule, displayed in order):

| # | Rule | Czech checklist label |
|---|---|---|
| P-1 | Verdict-first | Obsahuje tento text závěr, se kterým může majitel firmy souhlasit nebo jednat? |
| P-2 | No statistical notation | Neobsahuje text statistické symboly nebo termíny (σ, p-hodnota, konfidenční interval)? |
| P-3 | No analyst vocabulary | Jsou odborné výrazy nahrazeny srozumitelnými výrazy (kohorta → obor, medián → prostřední firma)? |
| P-4 | Comparisons anchored | Je každé číslo doplněno srovnáním s oborem nebo vlastním předchozím obdobím firmy? |
| P-5 | Czech time horizons | Jsou časové údaje zapsány česky (Okamžitě / Do 3 měsíců / Do 12 měsíců / Více než rok)? |
| P-6 | Frozen terms only | Používá text pouze schválené odborné výrazy ze seznamu zmrazených pojmů? |
| P-7 | Sentence length | Je každá věta kratší než přibližně 25 slov a psána aktivním slovesem? |
| P-8 | No false precision | Je přesnost čísel přiměřená srovnání (bez zbytečných desetinných míst, bez čísel pod prahem platnosti)? |
| P-9 | No cadence promise | Neobsahuje text příslib termínu nebo periodicitu doručení přehledu? |
| P-10 | No credit-risk adjacency | Neodkazuje text na hodnocení bonity, úvěrové riziko nebo bankovní posouzení firmy? |

**Reason field placeholder**
> Uveďte důvod zamítnutí a navrhněte úpravu.

**Publish-gate badge — blocked**
> Publikování blokováno — {N} položek čeká na revizi.

**Publish-gate badge — clear**
> Všechny položky prošly kontrolou. Přehled je připraven k publikaci.

**Review surface heading**
> Revize textů přehledu

**Review surface empty state**
> Přehled neobsahuje žádné texty k revizi.

**Review surface load error**
> Texty přehledu se nepodařilo načíst. Zkuste to prosím znovu.

**Audit view heading**
> Audit textů přehledu (pouze pro čtení)

**Override state suffix**
> (výjimka)

## 6. Accessibility checklist

- [ ] All interactive elements reachable by keyboard (checklist items, reason field, override action)
- [ ] Focus states visible with sufficient contrast
- [ ] Color is never the only signal — each checklist state uses a distinct icon shape in addition to color
- [ ] Text contrast ≥ WCAG AA (4.5:1 body, 3:1 large)
- [ ] Screen-reader labels on icon-only controls — each state icon carries an `aria-label` matching its Czech state label ("Nezadáno", "Splněno", "Zamítnuto", "Splněno — výjimka")
- [ ] Checklist is a `<ul>` with each item as `<li>`; the checklist panel heading is a `<legend>` or heading element associated with the group
- [ ] Each checklist item uses a `<button>` or `role="checkbox"` with `aria-checked` reflecting its state — unreviewed = `false`, pass/overridden = `true`, flagged = `false` with an additional `aria-describedby` pointing to the reason text
- [ ] Reason field has an associated `<label>` and, when validation fires, an `aria-describedby` pointing to the error description
- [ ] Motion respects `prefers-reduced-motion` — state transitions (color change, icon swap) are instant when motion is reduced
- [ ] Publish-gate badge is announced to screen readers when its state changes (use `aria-live="polite"` on the badge container)

## 7. Design-system deltas (escalate if any)

The checklist panel is a new back-end component not covered by the existing George Business design system (OQ-006 tracks component library availability). It is an internal analyst tool — it does not need to conform to the customer-facing George design system but should reuse any shared token set (colors, typography) if the engineer's authoring-back-end stack exposes them.

No new icon set is needed if the authoring back-end already provides a standard icon library with check, warning, and circle variants. If it does not, this is escalated as Q-PD-PLT-002 below.

No new design-system components are needed for the review surface or audit view beyond the checklist panel itself — both are structured as a labeled list with verdict controls, implementable with standard form elements.

## 8. Open questions

- **Q-PD-PLT-001** — Authoring back-end UI framework not yet specified in `docs/engineering/`. The checklist panel placement, sidebar vs. drawer behavior, and component structure depend on the engineer's authoring-back-end design artifact. Blocking: exact component implementation. Non-blocking: everything else in this artifact. Orchestrator to route to engineer when authoring back-end design begins.
- **Q-PD-PLT-002** — Icon set availability in the analyst authoring back-end. If the back-end does not already include a standard icon library with check, warning, and circle-outline variants, a new icon dependency is required — this must be escalated per design-system rule 7 rather than invented here. Blocking: icon rendering in checklist states.

Note on formal Czech register: vykání is the canonical register for all owner-facing copy in this product. The copy above is analyst-facing back-end copy and uses a neutral professional register (no direct address). The design-level register convention for owner-facing copy is established in `docs/design/trust-and-consent-patterns.md` §2.5 and is not duplicated here.

## Changelog

- 2026-04-20 — initial draft — designer
