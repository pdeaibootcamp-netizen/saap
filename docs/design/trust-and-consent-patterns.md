# Trust and Consent Patterns — Design

*Owner: designer · Slug: trust-and-consent-patterns · Last updated: 2026-04-17*

---

## 1. Upstream links

- Product doc: [docs/product/glossary.md](../product/glossary.md)
- PRD sections driving constraints: §3 (trust barrier — fear that data feeds credit risk), §7.5 (privacy as product), §7.6 (lead signals opportunity-flavored only), §10 (data architecture, RM lead signal architecture), §11 (George Business distribution)
- Decisions in force: D-002 (no RM lead signal at MVP), D-007 (single opt-in, all lanes), D-008 (single-screen declaration before first brief view), D-009 (no in-product advisor sharing)
- Parallel artifact: `docs/data/privacy-architecture.md` (data-engineer, in-progress) — revocation semantics must align with §5 below. Conflict logged as Q-TBD-006.
- Information architecture: [docs/design/information-architecture.md](information-architecture.md) — consent screen is Screen B row 1 in that document's §3 inventory.

---

## 2. Design principles for this artifact

1. **Reassurance-first.** Every data lane row leads with what ČS does NOT do with the data, then what it does. This directly counters the #1 trust barrier (PRD §3): the fear that data feeds into credit risk decisions.
2. **Transparency, not negotiation.** D-007 is a single opt-in. The four lanes are displayed as educational transparency rows, not as toggles. The owner is not being asked to configure; they are being informed before they proceed.
3. **Opportunity-flavored only.** The RM-visible lane must never suggest surveillance or risk assessment. At MVP (D-002), the RM lane is not active; copy says so explicitly.
4. **One primary action.** "Rozumím a chci pokračovat" is the only forward path. There is no "accept only some lanes" option — that is by design (D-007).
5. **Plain language.** No legal terms, no statistical notation, no "processing", "controller", "data subject". Write like the owner's accountant explaining it.

---

## 3. Single-screen declaration — layout

### Screen purpose
Shown once per owner, before the first brief view inside the George Business WebView. After consent is given, the owner proceeds directly to the brief. On all subsequent visits, this screen is skipped.

### Viewport behaviour
Full-screen within the WebView. Single scroll-column. The confirm button is anchored at the bottom of the viewport on mobile (sticky footer), so the owner can confirm without scrolling through all four rows — but the rows remain visible by scrolling up. This is intentional: informed consent does not require the owner to have read every word, but the content must be available.

### Layout structure

```
┌──────────────────────────────────────────────┐
│  [ČS wordmark]                               │
│                                              │
│  Jak nakládáme s vašimi daty                 │  ← Screen heading (H1)
│                                              │
│  Než zobrazíme váš první přehled, chceme     │  ← Intro paragraph
│  vám ukázat, jak přesně s vašimi daty        │
│  zacházíme. Nemusíte nic nastavovat —        │
│  stačí přečíst a pokračovat.                 │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │ [Lane row A — Obsah přehledů]          │  │  ← Lane row (see §4)
│  └────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────┐  │
│  │ [Lane row B — Vaše data v srovnání]    │  │
│  └────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────┐  │
│  │ [Lane row C — Váš poradce ČS]          │  │
│  └────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────┐  │
│  │ [Lane row D — Úvěrové hodnocení]       │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  Svůj souhlas můžete kdykoli odvolat v       │  ← Revocation notice (small text)
│  nastavení aplikace pod položkou             │
│  Soukromí.                                   │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │  Rozumím a chci pokračovat             │  │  ← Primary confirm button (sticky footer)
│  └────────────────────────────────────────┘  │
│                                              │
│  [Zpět do George]                            │  ← Exit link (below button)
└──────────────────────────────────────────────┘
```

### Lane row structure (each of the four rows)

Each lane row contains, in order:
1. **Lane icon** (small, decorative; see Q-TBD-005 re component availability)
2. **Lane heading** — short label for the data type
3. **"Co neděláme"** line — what ČS does NOT do (visually distinct; may use a different text color or a "✗" indicator — accessible: color must not be the sole signal; use a label or icon pair)
4. **"Co děláme"** line — what ČS does do

---

## 4. The four data lanes — transparency rows with copy drafts

> **Legal review required before production.** All copy below is a draft. Flag: Q-TBD-003 (in `docs/design/information-architecture.md`) and Q-TBD-007 (this file, §8). Do not ship without legal sign-off.

---

### Lane A — Obsah přehledů (Brief data)

**What data:** The sector brief content the owner reads — sector statistics, market context, peer comparison summaries. This data is sector-level; it does not identify the owner's specific firm.

**Draft copy:**

> **Obsah přehledů**
>
> **Co neděláme:** Obsah přehledů nevzniká na základě vašich osobních finančních dat.
>
> **Co děláme:** Přehledy píší analytici České spořitelny na základě sektorových statistik a veřejně dostupných tržních dat. Váš přehled odráží situaci ve vašem oboru — ne vaše konkrétní firemní čísla.

---

### Lane B — Vaše data v srovnání (Cohort / benchmark data)

**What data:** The owner's position within their cohort — sector, size band, region. This is the data that drives the embedded benchmark snippets in the brief. At MVP this is hand-assigned on pre-populated data (D-001); no owner-supplied financial data is collected at MVP.

**Draft copy:**

> **Vaše data v srovnání**
>
> **Co neděláme:** Vaše srovnávací pozice není sdílena s jinými firmami ani s nikým mimo Českou spořitelnu. Data z přehledů nikdy nevstupují do trénování žádného AI modelu.
>
> **Co děláme:** Na základě informací o vašem oboru, velikosti a regionu vás zařadíme do skupiny podobných firem. Ukážeme vám, jak si váš obor vede v porovnání s ostatními — nikoli komu konkrétně patří která čísla.

---

### Lane C — Váš poradce ČS (RM-visible data)

**What data:** Whether and how your relationship manager at ČS may receive signals related to your engagement with Strategy Radar. At MVP (D-002), this lane is not active — no signals are surfaced to RMs.

**Draft copy:**

> **Váš poradce ČS**
>
> **Co neděláme:** Váš poradce nevidí vaše finanční výsledky ani vaše chování v aplikaci. Tato funkce v současné verzi aplikace není aktivní.
>
> **Co děláme:** V budoucích verzích může mít váš poradce přístup k obecným informacím o tom, jak využíváte přehledy — například že vás zajímá téma expanze. Cílem je, aby vám mohl nabídnout relevantní služby ve správný čas. Nikdy to nebude sloužit k hodnocení vašeho úvěrového rizika.

*Design note:* The MVP state ("tato funkce není aktivní") is intentional — it is honest, it previews the future use in non-threatening terms, and it maintains the opportunity-flavored framing required by PRD §7.6 and the CLAUDE.md guardrail. When D-002 is reversed in a future increment, this copy must be updated and re-consent triggered (as noted in D-007 rationale).

---

### Lane D — Úvěrové hodnocení (Credit-risk data)

**What data:** The hard separation between Strategy Radar data and ČS credit-risk processes. This lane exists solely to name the owner's #1 fear (PRD §3) and directly deny it.

**Draft copy:**

> **Úvěrové hodnocení**
>
> **Co neděláme:** Data z aplikace Strategy Radar nikdy neslouží jako podklad pro úvěrové hodnocení vaší firmy. Tato aplikace a úvěrové oddělení České spořitelny jsou od sebe přísně odděleny.
>
> **Co děláme:** Strategy Radar funguje jako samostatná služba. Žádná data, která zde vidíte nebo která s námi sdílíte, nejsou předávána do procesů hodnocení bonity.

*Design note:* This lane's heading and "Co neděláme" line must remain the strongest, clearest copy on the screen. It should never be de-emphasized in layout or visual hierarchy relative to the other three lanes.

---

## 5. Single confirm action

The confirm button is the only forward path on the consent screen.

- **Label:** "Rozumím a chci pokračovat"
- **Type:** Primary button, full-width on mobile, minimum 44 × 44 px touch target
- **Placement:** Sticky footer — always visible without scrolling on ≥375 px viewport
- **On tap:** Consent is recorded server-side (implementation detail for engineer — see Q-TBD-008); WebView navigates to brief detail screen. No animation delay beyond standard navigation transition.
- **Exit alternative:** "Zpět do George" text link, placed immediately below the sticky button. On tap: WebView closes; owner returns to George Business. Consent is not recorded; brief is not shown. Owner may re-enter the flow later from the George card.

### States for the confirm button

| State | Appearance | When |
|---|---|---|
| Default | Primary style; full-width; "Rozumím a chci pokračovat" | Always on initial load |
| Loading | Button shows a loading indicator; text hidden | After owner taps, while server consent-recording call is in flight |
| Error | Button returns to default; inline error message above button: "Nepodařilo se zaznamenat váš souhlas. Zkuste to prosím znovu." | If server call fails |
| Success | Not shown — screen immediately navigates to brief; no success state on this screen | After successful server confirmation |

---

## 6. Revocation UX

### Entry point

Settings > Soukromí. Within the George Business WebView, a "Nastavení" link is accessible from the brief detail screen footer (see `docs/design/information-architecture.md` §3, Surface B).

> **Engineering dependency:** The Settings > Soukromí screen is not yet designed as a standalone screen in this artifact because the full settings structure has not been defined for MVP. The revocation action is specified here; the broader settings screen is a Q-TBD-009.

### Soukromí screen — minimal spec for MVP

| Element | Spec |
|---|---|
| Screen heading | "Soukromí" |
| Body copy | "Svůj souhlas se zpracováním dat v aplikaci Strategy Radar můžete kdykoli odvolat. Po odvolání souhlasu vám přestanou chodit přehledy a nebudete moci otevřít obsah aplikace." |
| Revocation action label | "Odvolat souhlas" |
| Action style | Destructive / secondary button — visually distinct from primary; red or danger-style within ČS design system (check design-system delta Q-TBD-005) |
| Touch target | Minimum 44 × 44 px |

### Revocation confirmation dialog

Shown as a modal overlay after the owner taps "Odvolat souhlas".

```
┌────────────────────────────────────────────┐
│  Odvolat souhlas                           │  ← Dialog heading
│                                            │
│  Opravdu chcete odvolat souhlas?           │  ← Body
│  Přehledy vám přestanou být doručovány     │
│  a obsah aplikace nebude přístupný.        │
│                                            │
│  [Zpět]          [Ano, odvolat souhlas]    │  ← Two buttons
└────────────────────────────────────────────┘
```

| Button | Style | Action |
|---|---|---|
| "Zpět" | Secondary / text button | Dismisses dialog; no action taken |
| "Ano, odvolat souhlas" | Destructive primary | Triggers consent revocation (server-side); navigates to post-revocation screen |

### Post-revocation screen

Displayed inside the WebView immediately after successful revocation. Owner may not proceed to the brief from this screen.

```
┌────────────────────────────────────────────┐
│  [ČS wordmark]                             │
│                                            │
│  Souhlas byl odvolán                       │  ← Heading
│                                            │
│  Váš souhlas jsme zaznamenali.             │  ← Body
│  Přehledy vám nebudou nadále doručovány    │
│  a obsah aplikace Strategy Radar nebude    │
│  dostupný.                                 │
│                                            │
│  Pokud si přejete službu obnovit, obraťte  │
│  se na svého poradce České spořitelny      │
│  nebo nás kontaktujte na [e-mail/telefon]. │  ← Q-TBD-010: ČS support contact
│                                            │
│  [Zpět do George]                          │  ← Primary action
└────────────────────────────────────────────┘
```

**Copy draft — post-revocation screen:**

| Element | Copy |
|---|---|
| Heading | "Souhlas byl odvolán" |
| Body paragraph 1 | "Váš souhlas jsme zaznamenali. Přehledy vám nebudou nadále doručovány a obsah aplikace Strategy Radar nebude dostupný." |
| Body paragraph 2 | "Pokud si přejete službu obnovit, obraťte se na svého poradce České spořitelny nebo nás kontaktujte na {{kontakt}}." |
| Primary action | "Zpět do George" |

### Downstream revocation semantics

**D-012 alignment (2026-04-17):** Revocation semantics are now decided as Option A — stop future flow only; no deletion of user-contributed rows or previously-delivered data. The post-revocation copy above ("Přehledy vám nebudou nadále doručovány") already reflects this correctly: it states delivery stops and content becomes inaccessible, but does not imply deletion of existing data. No copy change required. Q-TBD-006 is resolved for the copy-alignment concern.

The full data-side implementation of the `revoke` consent event (pipeline stop, cohort exclusion) remains owned by the data-engineer in `docs/data/privacy-architecture.md`.

---

## 7. Revocation error state

If the server call to record revocation fails:

- Dialog stays open.
- Error message appears above the buttons: "Odvolání souhlasu se nepodařilo. Zkuste to prosím znovu nebo kontaktujte podporu."
- Both buttons remain active.

---

## 8. Accessibility checklist

- [ ] All interactive elements (confirm button, "Zpět do George" link, "Odvolat souhlas" button, dialog buttons) are reachable by keyboard (Tab / Shift+Tab)
- [ ] Focus order follows the visual reading order: intro → lane rows → revocation notice → confirm button
- [ ] The confirm button receives focus on screen load (autofocus on the sticky footer button) — or if autofocus is disruptive to screen reader users, focus is set to the screen heading; logged as Q-TBD-011 for engineering review
- [ ] Focus states are visible with sufficient contrast against the background (minimum 3:1 ratio for focus ring per WCAG 2.1 SC 2.4.7)
- [ ] Color is never the only signal: the "Co neděláme" / "Co děláme" distinction uses both color (e.g., muted text vs. normal text) and a textual label or icon label, not color alone
- [ ] Body text contrast ≥ 4.5:1 (WCAG AA)
- [ ] Lane headings (large text) contrast ≥ 3:1 (WCAG AA large text)
- [ ] The four lane rows each have a screen-reader accessible label: the lane heading ("Obsah přehledů", "Vaše data v srovnání", etc.) is the accessible name for the row region
- [ ] "Co neděláme" and "Co děláme" labels within each row are readable as labels, not decorative icons — if icons are used they have `aria-label` or adjacent visible text
- [ ] The confirm button label "Rozumím a chci pokračovat" is descriptive and unambiguous in isolation (screen reader reads it without context)
- [ ] The confirmation dialog for revocation traps focus within the dialog while open; focus returns to the "Odvolat souhlas" button on dismiss
- [ ] Motion: the navigation transition after tapping the confirm button respects `prefers-reduced-motion` (use a fade or instant switch, not a slide animation, when the preference is set)
- [ ] Form fields: Not applicable — this screen has no form fields; the confirm button is the only interactive submission element

---

## 9. Design-system deltas (escalate if any)

The following components are required for this screen. All are assumed to exist in the ČS / George Business design system. If any are absent, a matching entry must be added to `docs/project/open-questions.md` before implementation begins.

- Full-screen modal overlay (for consent screen within WebView)
- Sticky footer button container
- Primary button (full-width, minimum 44 × 44 px)
- Destructive/secondary button variant (for "Odvolat souhlas")
- Modal dialog component with focus trap
- Inline error message component
- Body text with muted/standard variant (for "Co neděláme" / "Co děláme" visual distinction)

Logged as Q-TBD-005 (shared with `docs/design/information-architecture.md`).

---

## 10. Open questions

| ID | Question | Blocking |
|---|---|---|
| Q-TBD-003 | All Czech copy drafts (lane rows, button labels, confirmation dialog, post-revocation screen) require legal review before production. | Production readiness of all consent copy |
| Q-TBD-006 | ~~`docs/data/privacy-architecture.md` must confirm revocation semantics: what happens to previously-delivered briefs, stored data, and email subscriptions after revocation.~~ **Resolved — D-012 Option A (2026-04-17).** Stop future flow only; no deletion. Post-revocation copy confirmed aligned. Data-side implementation remains with data-engineer. | Closed |
| Q-TBD-007 | Legal review of the four lane-row copy drafts (Lane A–D in §4) specifically for GDPR consent disclosure adequacy. The single-opt-in model (D-007) may require specific phrasing to be legally adequate — cannot be determined by the designer. | Production readiness; potentially affects whether the screen is legally sufficient as a consent surface |
| Q-TBD-008 | Engineering must specify the server-side consent recording mechanism and confirm that a failed recording call (§5 error state) does not partially advance the user into the brief. The UX assumes an atomic consent + navigation event. | §5 confirm button error state; prevents showing brief on failed consent record |
| Q-TBD-009 | The full Settings screen structure within the Strategy Radar WebView is not yet designed. The Soukromí sub-screen in §6 is specified as a minimal stub. When the settings structure is designed (Phase 2), this stub must be reconciled. | §6 revocation entry point |
| Q-TBD-010 | The ČS support contact (email or phone) for the post-revocation screen body paragraph 2 is not known. PM or ČS product owner must supply this before the screen ships. | §6 post-revocation screen body copy |
| Q-TBD-011 | Autofocus on the confirm button (sticky footer) on consent screen load: desirable for sighted users, potentially disruptive for screen reader users who haven't yet heard the lane row content. Engineering and accessibility review needed to decide between: (a) autofocus on confirm button, (b) autofocus on screen heading, (c) no autofocus. | §8 accessibility checklist |

---

## Changelog

- 2026-04-17 — initial draft — designer
- 2026-04-17 — D-012 Option A alignment confirmed in §6: post-revocation copy already implies stop-flow only (no deletion); alignment note and D-012 reference added to §6 downstream semantics block; Q-TBD-006 closed — designer
