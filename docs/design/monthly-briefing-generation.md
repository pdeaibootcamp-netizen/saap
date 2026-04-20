# Monthly Briefing Generation — Design

*Owner: designer · Slug: monthly-briefing-generation · Last updated: 2026-04-20*

---

## 1. Upstream links

- Product doc: [docs/product/monthly-briefing-generation.md](../product/monthly-briefing-generation.md)
- PRD sections driving constraints:
  - §4 Non-Goals — "No automated brief generation at MVP"; no LLM assistance
  - §7.2 Verdicts, not datasets — analyst must confirm every observation ends in a verdict
  - §7.3 Plain language — publish-gate checklist enforces this human-to-human
  - §7.5 Privacy as product — authoring surface stays in the `brief` lane only; never embeds a per-user identifier
  - §8.1 Sector Briefing Engine — 2–4 observations, 2–4 actions, time-horizon tags
  - §9 Release Plan — Monthly Briefing Generation pulled forward to MVP; explicit "back-end authoring surface, automation out of scope"
  - §13.1 Brief production doesn't scale — authoring UX must minimize analyst friction
- Decisions in force: D-001, D-002, D-003, D-004, D-005, D-006, D-007, D-008, D-011, D-013
- Assumptions relied on: A-001, A-002, A-003, A-004, A-005, A-006, A-011, A-012, A-013, A-016
- Backlog items respected: B-001 (no cadence UI or "publish on date" picker)
- Reference artifacts (read-only — do not edit):
  - [docs/design/information-architecture.md](information-architecture.md) — canonical brief content model (§2) and three-surface specs (§3); this artifact references but never duplicates that content.
  - [docs/design/trust-and-consent-patterns.md](trust-and-consent-patterns.md) — owner-facing consent patterns; out of scope for this analyst-facing surface.

---

## 2. Primary flow

The analyst is already authenticated via ČS-analyst auth (implementation owned by engineering). The flow begins at the authoring dashboard.

```mermaid
flowchart TD
    A["Analyst authenticated\n(ČS analyst auth — engineering-owned)"] --> B["Authoring dashboard\n(draft list + 'Nový přehled' button)"]

    B --> C{Existing draft?}
    C -->|"Resumes existing"| D["Brief editor\n(sector locked from creation)"]
    C -->|"Creates new"| E["Sector picker\n(NACE sector only — D-006)"]

    E --> F{Sector has seed cohort?\n(D-001 — pre-populated data)}
    F -->|"No → sector absent from list"| E
    F -->|"Yes"| G["Brief created, keyed to NACE sector\n(immutable — D-006, US-1 AC 3)"]
    G --> D

    D --> H["Analyst authors six structured sections\n(Záhlaví · Úvodní přehled · Pozorování 2–4\n· Srovnávací přehled · Doporučené kroky 2–4 · Zápatí)"]

    H --> I["Auto-save (interval — engineering-owned)\n+ Manual save ('Uložit koncept')"]

    H --> J["Analyst selects email-teaser observation\n(exactly one Pozorování flagged — US-4)"]
    H --> K["Analyst optionally selects email-teaser snippet\n(zero or one BenchmarkSnippet — US-4)"]

    H --> L["Analyst opens preview\n(tab toggle: Email · Webový přehled · PDF)"]
    L --> M["Reviews three delivery surfaces\n(no email sent, no PDF persisted — US-3)"]
    M --> D

    D --> N["Analyst triggers 'Publikovat'\n(button active only when form is valid)"]

    N --> O["Publish-gate checklist screen\n(human affirmation — US-5)"]

    O --> P{All three checklist items affirmed?}
    P -->|"Not all affirmed"| O
    P -->|"All affirmed"| Q{Validation passes?\n(count rules, tag rules,\nemail-teaser selection)}
    Q -->|"Blocked — validation error"| R["Publish blocked\n(inline error on offending field)\nEditor re-opens at error location"]
    R --> D
    Q -->|"Passes"| S["Brief published\n(versioned artifact emitted to delivery pipeline — ADR-0002)\nAnalyst identity + checklist version + timestamp recorded"]

    S --> T["Authoring dashboard\n(published brief listed; 'Upravit / nová verze' available)"]
    T --> B
```

---

## 2b. Embedded variant (George Business WebView)

Not applicable — this is a ČS-analyst-facing back-end surface. It is not embedded in George Business. It runs behind ČS-analyst auth, accessed via a standalone internal web URL. No George Business WebView constraints apply.

The three-surface **preview** within the editor does render how the brief will appear in the three owner-facing surfaces (email, WebView, PDF), but these previews are read-only renderings inside the analyst tool, not live delivery surfaces. Preview rendering must faithfully apply the George Business WebView layout constraints from [information-architecture.md §2b](information-architecture.md) for the web-view preview pane.

---

## 3. Screen inventory

| Screen | Purpose | Entry | Exit | Empty state | Error states |
|---|---|---|---|---|---|
| Authoring dashboard | Lists all briefs by state (koncept / publikováno); entry point for new brief or resuming a draft | Analyst authentication | Opens sector picker (new) or brief editor (existing); or logs out | No briefs yet: "Zatím nemáte žádné přehledy. Začněte výběrem sektoru." with "Nový přehled" button | Network error loading list: "Nepodařilo se načíst seznam přehledů. Zkuste to znovu." with retry |
| Sector picker | Analyst selects one NACE sector before any content can be drafted | "Nový přehled" button on dashboard | Brief editor (after sector confirmed); or cancel back to dashboard | No eligible sectors (all seed cohorts missing): "Nejsou k dispozici žádné sektory s dostatečnými daty. Obraťte se na správce dat." — publish-blocked by definition | Network error loading sector list: "Nepodařilo se načíst seznam sektorů. Zkuste to znovu." |
| Brief editor | Core authoring surface; six structured sections; save and preview controls | Sector picker (new brief) or dashboard (existing draft) | Preview (preview tab), publish-gate checklist (publish trigger), dashboard (save + exit) | Each section starts empty with placeholder prompt; first load of a new brief has all sections blank | Auto-save failure: non-blocking toast "Automatické uložení se nezdařilo. Uložte přehled ručně."; form-level validation errors are inline on each field (see §4 ObservationAuthoringCard, ActionAuthoringCard); network error on manual save: modal with retry |
| Three-surface preview | Read-only rendering of the brief across the three delivery formats | "Náhled" tab in brief editor | Back to editor ("Zpět do editoru" button) | Not applicable — preview renders current draft state; if a section is empty, the preview renders it as visibly incomplete (not hidden) | Preview render failure: "Náhled se nepodařilo vygenerovat. Zkuste to znovu." with retry; no production delivery infrastructure touched |
| Publish-gate checklist | Human affirmation of plain-language and verdict-first compliance before publish | "Publikovat" button in editor (only active when form passes structural validation) | Confirmed → brief published → dashboard; or "Zpět do editoru" → editor | Not applicable — this screen has exactly three checklist items, always visible | Publish server call failure: "Publikování se nezdařilo. Zkuste to prosím znovu." modal with retry; checklist items remain affirmed |

---

## 4. Component specs

### 4.1 SectorPicker

**Purpose:** Lets the analyst choose one NACE sector to key the new brief. Only sectors with a pre-populated seed cohort are shown (D-001). Sectors without seed data are absent, not disabled.

| State | Description |
|---|---|
| Default | Searchable dropdown/list of available NACE sectors (label: sector name + NACE code); no sector selected |
| Sector selected | Selection highlighted; "Vytvořit přehled" confirm button becomes active |
| Loading | Skeleton list while sector list is fetched |
| Empty (no eligible sectors) | Plain-language message (see copy §5); no list items; button absent |
| Error | Network error message with retry; no list items |

**Props needed:** `availableSectors: { id: string; naceCode: string; sectorName: string }[]`, `loading: boolean`, `error: string | null`, `onSelect: (sectorId: string) => void`, `onConfirm: () => void`.

**Used in:** Sector picker screen.

**Constraint:** Only sectors in `availableSectors` are rendered. The prop is server-filtered before it reaches this component — no client-side filter on "has seed data" to avoid leaking the existence of absent sectors.

---

### 4.2 BriefEditorLayout

**Purpose:** Container that holds the six structured sections of the brief, plus the save controls, publish button, and preview tab trigger.

| State | Description |
|---|---|
| Default | All six sections visible in order; any section may be incomplete |
| Partial (some sections complete) | Completed sections show a subtle completion indicator (e.g., a checkmark badge on the section heading); incomplete sections remain open |
| Validated (all sections structurally complete) | "Publikovat" button becomes active; a summary badge shows "Přehled je připraven k publikování" |
| Publish-blocked | "Publikovat" button is disabled with a tooltip enumerating the unresolved blocking conditions (count violations, missing tags, missing email-teaser selection); summary badge absent |
| Auto-saving | Non-blocking indicator "Ukládám…" in the toolbar; does not block editing |
| Saved | Indicator changes to "Uloženo" with timestamp |

**Props needed:** `briefId: string`, `sectorName: string`, `naceCode: string`, `validationState: 'incomplete' | 'valid' | 'blocked'`, `blockingReasons: string[]`, `lastSavedAt: Date | null`, `onSave: () => void`, `onPublish: () => void`, `onPreview: () => void`.

**Used in:** Brief editor screen.

**Note on the six sections:** The sections are, in order: Záhlaví (Brief header), Úvodní přehled (Opening summary), Pozorování (Observations, 2–4), Srovnávací přehled (Benchmark snippets, four categories), Doporučené kroky (Closing actions, 2–4), Zápatí (Footer/CTA). Canonical structure per [information-architecture.md §2](information-architecture.md). The authoring surface exposes these as sequential form sections, not tabs.

---

### 4.3 ObservationAuthoringCard

**Purpose:** Authors a single Pozorování (observation). Enforces the 2–4 count constraint in concert with the sibling set. Each card carries a time-horizon tag selector and an email-teaser radio (exactly one across all cards).

| State | Description |
|---|---|
| Default (empty) | Headline field empty, body field empty, time-horizon not selected, email-teaser not selected |
| Partial | Some fields filled; time-horizon or headline missing; validation errors shown inline on blur |
| Complete | All required fields filled and time-horizon selected; card shows a completion indicator |
| Email-teaser selected | Card shows a distinct "E-mail teaser" badge; only one card in the set may be in this state at a time (radio, not checkbox) |
| Error — missing time-horizon | Inline error below the tag selector: "Zvolte časový horizont tohoto pozorování." |
| Error — missing headline | Inline error below headline field: "Nadpis pozorování je povinný." |
| Error — verdict missing (heuristic) | Not automated (A-011); this is surfaced via the publish-gate checklist, not inline validation |
| Count error — too few (< 2) | Section-level error banner: "Přidejte alespoň 2 pozorování před publikováním." |
| Count error — too many (> 4) | "Přidat pozorování" button disabled at 4; tooltip: "Maximální počet pozorování je 4." |

**Props needed:** `index: number`, `headline: string`, `body: string`, `timeHorizon: 'immediately' | 'three-months' | 'twelve-months' | 'over-year' | null`, `isEmailTeaser: boolean`, `onUpdate: (fields) => void`, `onSetEmailTeaser: () => void`, `onRemove: () => void`, `totalCount: number`.

**Used in:** BriefEditorLayout (Pozorování section).

**Count enforcement:** "Přidat pozorování" button is present when `totalCount < 4` and absent (not disabled) when `totalCount === 4`. Remove button is present when `totalCount > 2`; if `totalCount === 2`, remove button is absent on both cards.

---

### 4.4 ActionAuthoringCard

**Purpose:** Authors a single Doporučený krok (closing action). Enforces the 2–4 count constraint. Each card carries a time-horizon tag selector and the four D-011 category grouping selector.

| State | Description |
|---|---|
| Default (empty) | Action text field empty, time-horizon not selected, D-011 category not selected |
| Partial | Some fields filled; errors inline on blur |
| Complete | All required fields filled |
| Error — missing time-horizon | "Zvolte časový horizont tohoto kroku." |
| Error — missing action text | "Text doporučeného kroku je povinný." |
| Error — missing category | "Zvolte kategorii tohoto kroku." |
| Count error — too few | Section-level error: "Přidejte alespoň 2 doporučené kroky před publikováním." |
| Count error — too many | "Přidat krok" disabled at 4; tooltip: "Maximální počet doporučených kroků je 4." |

**Props needed:** `index: number`, `actionText: string`, `timeHorizon: 'immediately' | 'three-months' | 'twelve-months' | 'over-year' | null`, `category: 'ziskovost' | 'naklady-produktivita' | 'efektivita-kapitalu' | 'rust-trzni-pozice' | null`, `onUpdate: (fields) => void`, `onRemove: () => void`, `totalCount: number`.

**Used in:** BriefEditorLayout (Doporučené kroky section).

**Count enforcement:** Same add/remove logic as ObservationAuthoringCard.

---

### 4.5 CategoryGroupingControl

**Purpose:** Structures the Srovnávací přehled (benchmark snippet block) into the four canonical D-011 categories. Within each category, the analyst selects which ratios from the category's permitted set (A-003) to include, and authors the `verdictText` and `quartileLabel` for each selected ratio.

| State | Description |
|---|---|
| Default | Four category panels, each collapsed, each showing its canonical name and the two ratios assigned to it (D-011) |
| Category expanded | Ratio slots visible; each ratio has a toggle (include/exclude), a quartile label field, and a verdict text field |
| Ratio included — incomplete | Toggle on, but `quartileLabel` or `verdictText` empty; inline error on blur |
| Ratio included — complete | Both fields filled; completion indicator on the ratio slot |
| Ratio excluded | Toggle off; fields hidden; ratio will not appear in published brief |
| All ratios in category excluded | Category shows a "Žádné ukazatele v této kategorii" notice; category still renders in the preview as an empty block |
| Confidence-state warning | If the precomputed `confidenceState` for a ratio is `low-confidence` or `empty` (from cohort-math pipeline), a warning badge appears next to the ratio toggle: "Tento ukazatel nemá dostatečný počet firem v kohortě." The analyst may still choose to exclude it; the tool does not auto-exclude it. |
| Email-teaser snippet selector | One ratio across all four categories may be flagged as the email-teaser snippet (zero or one; optional per US-4). A radio appears next to each included ratio with `confidenceState === 'valid'` only. If none are valid, no radio is shown and the email teaser snippet is omitted. |

**Props needed:**
```
categories: {
  id: 'ziskovost' | 'naklady-produktivita' | 'efektivita-kapitalu' | 'rust-trzni-pozice';
  label: string;
  ratios: {
    id: string;
    metricName: string;
    confidenceState: 'valid' | 'low-confidence' | 'empty';
    included: boolean;
    quartileLabel: string;
    verdictText: string;
    isEmailTeaserSnippet: boolean;
  }[];
}[]
onUpdate: (categoryId, ratioId, fields) => void
onSetEmailTeaserSnippet: (ratioId: string | null) => void
```

**Used in:** BriefEditorLayout (Srovnávací přehled section).

**Constraint:** The set of ratios available within each category is fixed by D-011 and A-003. The analyst cannot add a ratio to a category or move a ratio between categories from within this tool. The `confidenceState` values are read from precomputed cohort-math pipeline output; this component reads them, it does not compute them.

**Cohort data degraded states:** Any ratio with `confidenceState !== 'valid'` shows the confidence warning badge. The email-teaser snippet radio is suppressed for that ratio (per US-4 AC 3 and information-architecture.md §4.3 rule). The analyst may still include the ratio in the web view and PDF with the `verdictText` they author — but the tool does not prevent this; the plain-language checklist (§4.7) is where the analyst affirms the text is accurate. This is consistent with A-011 (no automated validation at MVP).

---

### 4.6 ThreeSurfacePreview

**Purpose:** Read-only rendering of the current draft brief across the three delivery surfaces (email, web view, PDF). Renders in an in-editor pane or a modal overlay — final layout is an engineering decision (Q-PD-MBG-001).

| State | Description |
|---|---|
| Email tab | Renders the condensed email layout per [information-architecture.md §3 Surface A](information-architecture.md): header, opening summary, selected observation (email-teaser), selected snippet (if `confidenceState === 'valid'` and selected), CTA buttons, footer. Incomplete fields render as visibly empty placeholders (e.g., dashed borders) rather than hidden. |
| Webový přehled tab | Renders the full six-component web-view layout per [information-architecture.md §3 Surface B](information-architecture.md). Accordion BenchmarkCategory sections in default-first-expanded state. |
| PDF tab | Renders the PDF layout per [information-architecture.md §3 Surface C](information-architecture.md): all content expanded, A4 proportions (simulated in-browser), page footer with confidentiality notice. |
| Loading | Skeleton panels per tab while preview is being generated |
| Error | "Náhled se nepodařilo vygenerovat. Zkuste to znovu." with retry button per tab |
| Incomplete draft | Preview renders as-is; empty sections show a dashed placeholder with the section name. This is intentional — the analyst sees exactly what will be missing if the draft ships as-is. |

**Props needed:** `briefDraft: BriefDraftModel`, `activeTab: 'email' | 'web' | 'pdf'`, `loading: boolean`, `error: string | null`, `onTabChange: (tab) => void`, `onRetry: () => void`.

**Used in:** Three-surface preview screen (triggered from brief editor).

**Constraint:** Preview does not hit production delivery infrastructure. No email is sent. No PDF is persisted outside a preview buffer. This constraint is owned by engineering; design assumes it holds.

---

### 4.7 PublishGateChecklist

**Purpose:** Human affirmation screen shown immediately before publish is executed. Three items; all three must be checked before the final "Potvrdit a publikovat" button becomes active. Records the affirming analyst identity, checklist version, and timestamp (storage owned by ADR-0002).

| State | Description |
|---|---|
| Default — some items unchecked | Final publish button disabled; each unchecked item shows a checkbox with label; button tooltip: "Potvrďte všechny body před publikováním." |
| All items checked | Final publish button active: "Potvrdit a publikovat" |
| Publishing in progress | Button shows loading indicator; all checkboxes disabled; user cannot navigate away (browser unload guard) |
| Publish error | Error message above button: "Publikování se nezdařilo. Zkuste to prosím znovu."; checkboxes and button return to active; affirmed states are preserved |
| Success | No success state on this screen — brief editor redirects to authoring dashboard with a success toast |

**Checklist items (verbatim in §5 copy drafts):**

1. Každé pozorování končí verdiktem, ne holým číslem.
2. Každý doporučený krok obsahuje konkrétní sloveso, kontext a časový horizont.
3. V textech určených čtenáři přehledu se nevyskytuje statistická notace (σ, p-hodnota, percentil ve tvaru "p=").

**Props needed:** `checkedItems: boolean[3]`, `publisherIdentity: string` (display-only, from analyst auth session), `checklistVersion: string`, `onToggleItem: (index: number) => void`, `onPublish: () => void`, `onBack: () => void`, `publishing: boolean`, `error: string | null`.

**Used in:** Publish-gate checklist screen.

---

### 4.8 DraftListItem

**Purpose:** Represents one brief in the authoring dashboard list. Shows sector name, state (koncept / publikováno), last-saved or published timestamp.

| State | Description |
|---|---|
| Draft (koncept) | Sector name + "Koncept" badge + last-saved timestamp + "Pokračovat v editaci" link |
| Published | Sector name + "Publikováno" badge + published timestamp + "Zobrazit / nová verze" link |
| Loading | Skeleton row |

**Props needed:** `briefId: string`, `sectorName: string`, `naceCode: string`, `state: 'draft' | 'published'`, `lastModifiedAt: Date`, `onOpen: (briefId: string) => void`.

**Used in:** Authoring dashboard.

---

## 5. Copy drafts

All copy is Czech only (D-004). Formal register — vykání is appropriate even though the persona here is an internal ČS analyst; the register is professional-formal throughout. Legal review is not required for analyst-facing internal copy, but plain-language review by the PM is recommended before the tool ships.

Placeholders use `{{double-curly-braces}}`.

---

### Authoring dashboard

| Location | Copy |
|---|---|
| Page heading | "Přehledy" |
| Empty state heading | "Zatím nemáte žádné přehledy." |
| Empty state body | "Začněte výběrem sektoru a vytvořte první přehled." |
| "New brief" button | "Nový přehled" |
| Draft badge | "Koncept" |
| Published badge | "Publikováno" |
| Last saved label | "Naposledy uloženo: {{datum a čas}}" |
| Published label | "Publikováno: {{datum a čas}}" |
| Open draft link | "Pokračovat v editaci" |
| Open published link | "Zobrazit / nová verze" |
| Network error | "Nepodařilo se načíst seznam přehledů. Zkuste to znovu." |
| Retry button | "Zkusit znovu" |
| Publish success toast | "Přehled pro sektor {{sektorNázev}} byl úspěšně publikován." |

---

### Sector picker

| Location | Copy |
|---|---|
| Screen heading | "Vyberte sektor" |
| Search field placeholder | "Hledat sektor nebo kód NACE…" |
| Confirm button (active) | "Vytvořit přehled" |
| Confirm button (inactive) | "Vytvořit přehled" (disabled state — no alternate label) |
| Cancel link | "Zrušit" |
| Empty state (no eligible sectors) | "Nejsou k dispozici žádné sektory s dostatečnými daty pro tvorbu přehledu. Obraťte se na správce dat." |
| Network error | "Nepodařilo se načíst seznam sektorů. Zkuste to znovu." |
| Sector locked notice (in editor) | "Sektor: {{sektorNázev}} ({{kódNACE}}) — sektor nelze po vytvoření přehledu změnit." |

---

### Brief editor — section headings and field labels

| Location | Copy |
|---|---|
| Editor page heading | "Přehled — {{sektorNázev}}" |
| Section 1 heading | "1. Záhlaví" |
| Section 2 heading | "2. Úvodní přehled" |
| Section 2 field label | "Text úvodního přehledu" |
| Section 2 hint | "2–4 věty popisující situaci v sektoru tímto měsícem. Bez statistické notace, bez holých čísel." |
| Section 3 heading | "3. Pozorování" |
| "Add observation" button | "Přidat pozorování" |
| Observation headline field | "Nadpis pozorování" |
| Observation body field | "Doplňující text" |
| Time-horizon selector label | "Časový horizont" |
| Time-horizon options | "Okamžitě" · "Do 3 měsíců" · "Do 12 měsíců" · "Více než rok" |
| Email-teaser radio label | "Označit jako e-mail teaser" |
| Email-teaser badge | "E-mail teaser" |
| Remove observation button | "Odebrat" |
| Section 4 heading | "4. Srovnávací přehled" |
| Category 1 label | "Ziskovost" |
| Category 2 label | "Náklady a produktivita" |
| Category 3 label | "Efektivita kapitálu" |
| Category 4 label | "Růst a tržní pozice" |
| Ratio include toggle label | "Zahrnout do přehledu" |
| Ratio quartile-label field | "Kvartilová pozice (např. „druhý kvartil")" |
| Ratio verdict-text field | "Text verdiktu (jeden srozumitelný závěr)" |
| Confidence warning badge | "Nedostatek firem v kohortě pro tento ukazatel" |
| Email-teaser snippet radio | "Označit jako e-mail snippet" |
| No email-teaser snippet notice | "Žádný ukazatel nemá dostatečnou důvěryhodnost dat pro e-mail snippet. Snippet bude v e-mailu vynechán." |
| Empty category notice | "Žádné ukazatele v této kategorii" |
| Section 5 heading | "5. Doporučené kroky" |
| "Add action" button | "Přidat doporučený krok" |
| Action text field | "Text doporučení (sloveso + kontext)" |
| Action category selector label | "Kategorie" |
| Remove action button | "Odebrat" |
| Section 6 heading | "6. Zápatí" |
| Footer text field | "Text zápatí (výzva k akci pro čtenáře)" |

---

### Brief editor — toolbar and controls

| Location | Copy |
|---|---|
| Save button | "Uložit koncept" |
| Auto-save in progress | "Ukládám…" |
| Saved indicator | "Uloženo {{čas}}" |
| Auto-save failure toast | "Automatické uložení se nezdařilo. Uložte přehled ručně." |
| Preview tab/button | "Náhled" |
| Publish button (active) | "Publikovat" |
| Publish button (blocked) tooltip | "Vyřešte označené chyby před publikováním." |
| Back to dashboard link | "Zpět na přehledy" |
| Ready-to-publish badge | "Přehled je připraven k publikování" |

---

### Brief editor — validation errors

| Location | Copy |
|---|---|
| Observation count — too few | "Přidejte alespoň 2 pozorování před publikováním." |
| Observation count — too many | "Maximální počet pozorování je 4." |
| Observation headline missing | "Nadpis pozorování je povinný." |
| Observation time-horizon missing | "Zvolte časový horizont tohoto pozorování." |
| Email-teaser observation not selected | "Označte jedno pozorování jako e-mail teaser." |
| Action count — too few | "Přidejte alespoň 2 doporučené kroky před publikováním." |
| Action count — too many | "Maximální počet doporučených kroků je 4." |
| Action text missing | "Text doporučeného kroku je povinný." |
| Action time-horizon missing | "Zvolte časový horizont tohoto kroku." |
| Action category missing | "Zvolte kategorii tohoto doporučeného kroku." |
| Ratio verdict-text missing (when ratio included) | "Vyplňte text verdiktu pro tento ukazatel." |
| Ratio quartile-label missing (when ratio included) | "Vyplňte kvartilovou pozici pro tento ukazatel." |
| Manual save failure | "Uložení se nezdařilo. Zkuste to prosím znovu." |

---

### Three-surface preview

| Location | Copy |
|---|---|
| Preview screen heading | "Náhled přehledu" |
| Email tab | "E-mail" |
| Web view tab | "Webový přehled" |
| PDF tab | "PDF" |
| Back to editor button | "Zpět do editoru" |
| Preview error | "Náhled se nepodařilo vygenerovat. Zkuste to znovu." |
| Retry button | "Zkusit znovu" |
| Incomplete field placeholder | "[Nevyplněno]" |

---

### Publish-gate checklist

| Location | Copy |
|---|---|
| Screen heading | "Kontrola před publikováním" |
| Intro paragraph | "Před publikováním přehledu potvrďte, že jsou splněny všechny níže uvedené podmínky. Vaše potvrzení bude zaznamenáno." |
| Checklist item 1 | "Každé pozorování končí verdiktem, ne holým číslem." |
| Checklist item 2 | "Každý doporučený krok obsahuje konkrétní sloveso, kontext a časový horizont." |
| Checklist item 3 | "V textech určených čtenáři přehledu se nevyskytuje statistická notace (σ, p-hodnota, percentil ve tvaru „p=")." |
| Publisher identity label | "Přehled publikuje:" |
| Confirm-publish button (items unchecked) | "Potvrdit a publikovat" (disabled) |
| Confirm-publish button (all checked) | "Potvrdit a publikovat" (active) |
| Disabled button tooltip | "Potvrďte všechny body před publikováním." |
| Back to editor link | "Zpět do editoru" |
| Publish error | "Publikování se nezdařilo. Zkuste to prosím znovu." |

---

## 6. Accessibility checklist

This surface is an internal analyst tool, not a public-facing product. WCAG AA compliance is still the target — internal tools used by professionals must not exclude analysts with disabilities.

- [ ] All interactive elements reachable by keyboard (Tab / Shift+Tab); this includes all form fields, the sector picker search, all toggle controls in CategoryGroupingControl, all radio buttons (email-teaser observation, email-teaser snippet), and all checklist checkboxes
- [ ] Focus states visible with sufficient contrast (minimum 3:1 ratio for focus ring per WCAG 2.1 SC 2.4.7); focus ring must be visible against both light and dark backgrounds of form fields
- [ ] Color is never the only signal: completion states (section completed vs. incomplete) use both a color indicator and a text label or icon with an accessible name; validation errors use both color (red border) and a visible error text beneath the field
- [ ] Body text contrast ≥ 4.5:1 (WCAG AA)
- [ ] Section headings and badge text (large text ≥ 18px regular or ≥ 14px bold) contrast ≥ 3:1 (WCAG AA large text)
- [ ] Screen-reader labels on icon-only controls: the "Odebrat" (remove) button on ObservationAuthoringCard and ActionAuthoringCard must have an `aria-label` that includes the item index (e.g., "Odebrat pozorování 2") so that identical remove buttons are distinguishable
- [ ] The time-horizon selector and category selector in each card must use `<select>` or an equivalent ARIA-labelled listbox; they must not be styled-only custom controls without role and keyboard support
- [ ] The email-teaser radio on ObservationAuthoringCard must be a true `<input type="radio">` group with a visible `<legend>` ("E-mail teaser") so that screen readers announce the group context
- [ ] The email-teaser snippet radio on CategoryGroupingControl must follow the same radio group pattern with a `<legend>` ("E-mail snippet")
- [ ] The three checklist items in PublishGateChecklist must be true `<input type="checkbox">` elements with associated `<label>` elements; not custom-styled divs
- [ ] The publish button disabled state must use `disabled` attribute or `aria-disabled="true"`, not just visual styling; the tooltip on the disabled button must be accessible (e.g., via `aria-describedby`, not CSS `::after` only)
- [ ] The three-surface preview tabs must be a `<role="tablist">` pattern with `role="tab"` and `role="tabpanel"` to ensure keyboard navigation and screen-reader announcements
- [ ] Form fields have associated `<label>` elements (not placeholder-only labels) for all text inputs and textareas in ObservationAuthoringCard, ActionAuthoringCard, CategoryGroupingControl, and BriefEditorLayout
- [ ] Error descriptions are linked to their field via `aria-describedby` so that screen readers announce the error when the field receives focus
- [ ] Toast notifications (auto-save failure, publish success) must be announced via `aria-live="polite"` region; they must not disappear before the analyst has a chance to read them (minimum 5 seconds visible)
- [ ] The browser unload guard on the PublishGateChecklist during publishing must not trap keyboard focus in an inaccessible state
- [ ] Motion: any transition animations (section expand/collapse, tab switches, toast appearance) must respect `prefers-reduced-motion`; use instant-switch or opacity fade when the preference is set

---

## 7. Design-system deltas (escalate if any)

This surface is analyst-facing and internal. It does not need to use the ČS / George Business owner-facing design system. However, if the engineering ADR (`adr-0001-tech-stack.md`) establishes a shared component library for the analyst tool, the following components are required.

Components assumed to exist in whichever component library the analyst tool uses:

- Text input / textarea (single and multiline)
- Searchable dropdown / combobox (for SectorPicker)
- Radio group (for email-teaser observation and email-teaser snippet)
- Checkbox (for PublishGateChecklist)
- Select / listbox (for time-horizon and category selectors)
- Tab panel (role="tablist" pattern, for ThreeSurfacePreview)
- Collapsible / accordion (for CategoryGroupingControl category panels)
- Toggle / switch (for ratio include/exclude in CategoryGroupingControl)
- Badge / pill (for state labels: Koncept, Publikováno, E-mail teaser, confidence warning)
- Primary button + disabled state
- Secondary button
- Inline error message
- Toast / notification (aria-live)
- Skeleton loader
- Modal dialog (for manual save failure and publish error)
- Browser unload guard / "unsaved changes" prompt

**Escalation (Q-PD-MBG-001):** The engineering ADR does not yet specify whether the analyst authoring tool uses a shared component library or builds its own minimal kit. This decision affects whether the components above are already available or need to be designed from scratch. Logged in §8.

**Escalation (Q-PD-MBG-002):** The ThreeSurfacePreview rendering approach (in-pane iframe, server-side render snapshot, or client-side re-render) is not specified. This is an engineering decision that the design assumes but cannot determine. If the approach differs from what the preview component spec implies (read-only render of draft data), the component spec may need adjustment. Logged in §8.

---

## 8. Open questions

These use local `Q-PD-MBG-NNN` IDs. The orchestrator will assign final `OQ-NNN` IDs when merging into `docs/project/open-questions.md`.

| ID | Question | Blocking |
|---|---|---|
| Q-PD-MBG-001 | The engineering ADR (`adr-0001-tech-stack.md`) does not specify whether the analyst authoring tool uses the same component library as the owner-facing surface or a separate minimal kit. This affects §7 design-system deltas: if a shared library exists, many components are already available; if not, each must be built or a third-party library selected. | §7 component availability; Phase 2 implementation start |
| Q-PD-MBG-002 | ThreeSurfacePreview rendering approach: in-pane (same-page React component render), modal overlay, or a new browser tab (note: new tab is disfavored per bank-native distribution guidelines for user-facing surfaces — but analyst-internal tool constraints may differ). Engineering must decide. | §4.6 ThreeSurfacePreview component spec; §3 preview screen layout |
| Q-PD-MBG-003 | The `confidenceState` values (`valid` / `low-confidence` / `empty`) consumed by CategoryGroupingControl (§4.5) must be precomputed and available to the analyst authoring tool at brief-creation time. The data pipeline that produces these values is owned by Track B features (`percentile-position-calculation`, `cohort-math.md`). If Track B is not complete before Track A authoring is testable end-to-end, the tool needs a fallback (e.g., default all ratios to `valid` in test mode). Engineering must confirm. | §4.5 CategoryGroupingControl confidence-state display; end-to-end testing sequencing |
| Q-PD-MBG-004 | Analyst role model: the product doc (US-7 AC 1) notes that a draft is "visible only to the analyst who created it (or to an authorized analyst role)." The role model and multi-analyst permissions are flagged as Q-MBG-002 in the product doc. If a reviewer role exists, the authoring dashboard and brief editor may need a read-only mode. Design cannot finalize the dashboard list display (§3 DraftListItem) without knowing whether other analysts' drafts are visible. | §3 authoring dashboard screen; §4.8 DraftListItem states |
| Q-PD-MBG-005 | The confidentiality notice text in the PDF footer (information-architecture.md §3 Surface C: "Důvěrné — jen pro interní potřebu firmy · Česká Spořitelna · {{měsíc}} {{rok}}") is rendered in the brief artifact. The product doc (Q-MBG-005) flags whether this text is a system-level constant or editable per brief. Design assumes it is a system constant not exposed in the authoring tool. If it becomes editable, a text field must be added to Section 6 (Zápatí). | §4 BriefEditorLayout Section 6 spec; §5 Section 6 copy |
| Q-PD-MBG-006 | Supersession UX: US-6 allows publishing a new version against the same (NACE sector, cycle) key. The authoring dashboard (§3, §4.8 DraftListItem) shows a "Zobrazit / nová verze" link for published briefs. The flow for creating a superseding version — does it fork the existing brief content into a new draft, or start blank? — is not specified in the product doc. This may interact with Q-MBG-003 (cycle key semantics). Design needs an answer to specify the "nová verze" action in §4.8. | §4.8 DraftListItem "nová verze" action; §2 primary flow (supersession branch not yet drawn) |
| Q-PD-MBG-007 | The Záhlaví (Section 1, Brief header) authoring fields are not enumerated in the product doc. Information-architecture.md §2 defines the header as: brief title, publication month, sector name (from NACE — derived, not typed), cohort label (system-derived from statistical-validity floor check). The analyst-facing question is: does the analyst type the brief title and publication month, or are both derived/system-generated? If they are typed, Section 1 needs two text fields; if system-generated, Section 1 is read-only metadata display. Design blocked on this for the Záhlaví section of BriefEditorLayout. | §4.2 BriefEditorLayout Section 1 spec; §5 Section 1 copy |

---

## Changelog

- 2026-04-20 — initial draft — designer
