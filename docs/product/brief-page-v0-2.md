# Brief detail page (v0.2 customer-testing PoC)

*Owner: product-manager · Slug: brief-page-v0-2 · Last updated: 2026-04-21*

## 0. Scope note and framing discipline

This spec governs **only** the owner-facing brief detail page at `/brief/[id]` for the v0.2 customer-testing PoC on branch `trial-v0-2`. It is additive to, and does not replace, the v0.1 brief authoring and rendering specs in [monthly-briefing-generation.md](monthly-briefing-generation.md), [observation-generation.md](observation-generation.md), [action-specificity-framing.md](action-specificity-framing.md), and [plain-language-translation.md](plain-language-translation.md). Those PRDs stay in force on `trial-phases-2-4` and on the analyst edit page (`/admin/brief/[id]/edit`), which v0.2 does not touch.

The analyst authoring back-office is out of lane for this spec. So is the PDF and email rendering (those stay on v0.1 shape until v0.3+). The v0.2 brief detail page is web-view-only.

Visual design (typography, spacing, colour, collapsibility affordance styling, pairing visual treatment) is the designer's lane and is owned by [docs/design/brief-page-v0-2.md](../design/brief-page-v0-2.md) (not yet drafted at time of this spec). This spec decides **what** is on the page and **what content it carries**; the designer decides how it looks.

Engineering is the engineer's lane. This spec proposes **additive** extensions to the `BriefContent` type in [src/lib/briefs.ts](../../src/lib/briefs.ts); the engineer owns the migration, the JSON shape on disk, and the analyst-edit-page backward-compatibility.

## 1. Summary

The v0.2 brief detail page reworks the owner-facing reading experience around three product changes. First, the page opens with a **layperson-oriented sector-analysis opener** (authored by ČS analysts in plain Czech, 200–400 words) that distills the heavy ČS Ekonomické a strategické analýzy publication into something a furniture SME owner reads in under two minutes, with the full analyst publication body available beneath it as a collapsible "Číst celou analýzu" section. Second, the benchmark section ("Srovnávací přehled") is **removed from the brief page** — benchmarks now live on the v0.2 dashboard tiles per [dashboard-v0-2.md](dashboard-v0-2.md); the brief page stops being a two-surface hybrid and becomes pure reading matter. Third, the observation and closing-action lists — which in v0.1 read as "disconnected / random" two parallel columns — are **re-paired**: each closing action is optionally bound to one observation, and the UI renders the action immediately after the observation it follows from, with orphan observations and cross-cutting actions still explicitly permitted.

Relationship to the MVP principle that **briefs are the atomic unit of value** ([PRD §1](../../PRD/PRD.md#1-summary), [PRD §8.1](../../PRD/PRD.md#81-sector-briefing-engine--what-this-means-for-you-primary-mvp)): nothing in this spec challenges that principle. The brief remains the atomic unit; this spec tightens the internal structure of one brief and promotes the sector-publication body from "analyst-facing deliverable" to "the brief's opening section" so the owner gets the substantive sector read and the actionable verdicts on one page. Benchmarks are not deleted — they are relocated to the dashboard surface already specced and locked in [dashboard-v0-2.md](dashboard-v0-2.md).

## 2. Upstream links

- **PRD sections:**
  - [§7.1 Day-one proof of value](../../PRD/PRD.md#7-product-principles) — the opener is engineered to deliver the proof inside the first minute of reading, without making the owner scroll past the full analyst prose first.
  - [§7.2 Verdicts, not datasets](../../PRD/PRD.md#7-product-principles) — every paragraph of the layperson opener resolves into a plain-language conclusion; the full analyst text is wrapped as an optional expansion rather than the default surface because the analyst register is dataset-flavored.
  - [§7.3 Plain language, no jargon](../../PRD/PRD.md#7-product-principles) — the opener is the artifact that makes this principle concrete for the sector-analysis block. The analyst publication is **not** expected to pass the full [plain-language-translation.md](plain-language-translation.md) rule set; it is positioned as "the expert source" and is held to analyst register.
  - [§7.4 Proof of value before anything else](../../PRD/PRD.md#7-product-principles) — pairing each action with its observation means the owner sees "here is the finding, here is what to do about it" in adjacent reading order. The v0.1 "two disjoint lists" layout violated this by forcing the owner to re-map across sections.
  - [§8.1 Sector Briefing Engine](../../PRD/PRD.md#81-sector-briefing-engine--what-this-means-for-you-primary-mvp) — the 2–4 observation and 2–4 closing-action counts carry forward unchanged. This spec does not re-open those bounds.
- **ČS business goals served:**
  - **G1 Engagement** — the opener + pairing are the reading-experience changes that the customer test is designed to probe. Whether a furniture SME owner finishes the brief and what they click on are the G1 signals under observation.
  - **G2 Data depth and cadence** — indirect. An owner who reads through the brief is a prerequisite for any future give-to-get capture (A-013 keeps give-to-get out of MVP build).
  - **G3 RM lead generation** — not served. No RM-visible output on this page ([D-002](../project/decision-log.md)).
- **Related decisions:**
  - [D-015](../project/decision-log.md) — the eight frozen metrics. Not referenced directly on the brief page at v0.2 (benchmarks live on the dashboard) but the observations may anchor to any of them per [observation-generation.md](observation-generation.md).
  - [D-011](../project/decision-log.md) — the four canonical benchmark categories. Used by `ClosingAction.category` on the paired action structure below.
  - [D-018](../project/decision-log.md) — page header "Česká Spořitelna · Strategy Radar". Kept. The v0.1 brief page already renders this; no change.
  - [D-019](../project/decision-log.md) — "Analýzy" is the dashboard list heading; "Přehled" continues to denote one brief document. This spec introduces **"Sektorová analýza"** as a third, non-colliding term for the publication-body block inside one brief (see §5 and glossary update in §9).
  - [D-012](../project/decision-log.md) — revocation stop-flow-only. Not exercised on the demo owner (no consent path at PoC) but the consent-revoked screen already in the v0.1 page stays.
  - Build plan [§10.1–10.4](../project/build-plan.md) — v0.2 scope; Phase 2.2.d (brief-page surgery) and 2.2.e (seeded furniture brief) are the engineering phases this spec unblocks.
  - [OQ-058](../project/open-questions.md) — closed by this spec; see §9.

## 3. Clarifying questions

None at this pass. Every question raised in the orchestrator brief has a decision in §4, §5, or §7 below. Two self-monitoring signals are logged in §12 for post-PoC reopening.

## 4. Decision — publication placement: hybrid (layperson opener + collapsible full text)

### 4.1 The decision

The brief detail page **opens with a layperson-oriented sector-analysis opener** authored in plain Czech (200–400 words, formal vykání, no jargon, no tables, no percentages without a context), followed by a **collapsible "Číst celou analýzu" section containing the full ČS Ekonomické a strategické analýzy publication text verbatim**. The opener is always visible on first load; the full text is hidden behind a single disclosure affordance ("Číst celou analýzu" / "Skrýt celou analýzu") that the designer styles. Only one disclosure state is persisted per session; there is no per-subsection expansion.

This section ships above the observations-and-actions block. The owner reads in order: (i) the opener, (ii) optionally the full analyst text, (iii) the paired observations + actions.

### 4.2 Why hybrid and not full-text-only or simplified-only

**Full publication text at the top, rejected.** The ČS publication is ~21,000 Czech characters of analyst-register prose — medián, percentil, export balance tables, NACE-code references, foreign-trade statistics, AČN forecasts. It is the **right substance** but it is not written at "accountant-to-owner" register ([PRD §7.3](../../PRD/PRD.md#7-product-principles)). Opening the brief with it violates [§7.2 Verdicts-not-datasets](../../PRD/PRD.md#7-product-principles) — the owner's first minute of reading would be spent in tables before the conclusions land. It also makes [§7.1 Day-one proof of value](../../PRD/PRD.md#7-product-principles) unreachable: in the customer-testing protocol the moderator has roughly one minute to observe where the participant's attention goes; if that minute is spent page-scrolling through an analyst trade-balance paragraph, the PoC cannot measure the thing it was built to measure. And with the analyst body in the default-visible slot, the observations and actions sit beneath a ~1500-word wall — an engagement failure mode documented in the v0.1 reading feedback.

**Simplified layperson version only, no full text, rejected.** Rejected for a different reason — trust. The furniture SME participants in the customer-testing cohort are owner-operators; the product's #1 bank-native trust-transfer mechanism ([PRD §12](../../PRD/PRD.md#12-relationship-manager-enablement), CLAUDE.md bank-native-distribution guardrail) rests on the owner being able to see that the substance is real. An opener on its own reads like marketing copy. The owner who wants to verify "did somebody actually do the analysis, or is this a summary of a summary?" has no way to check. For a testing-PoC the stakes are even sharper: participant scepticism about the source is one of the things the moderator needs to observe honestly, and removing the full text removes the signal. The full analyst publication being **available** (even if most participants never expand it) is what makes the opener trustworthy.

**Hybrid wins on both fronts.** Opener satisfies §7.1 / §7.2 / §7.3: the owner gets verdicts fast, in language they recognise, in the first 200–400 words. Collapsed full text satisfies the trust-transfer: the owner who wants to drill in (or the moderator who wants to surface the drill-in behaviour in testing) has the full ČS publication one click away, attributed to the named analyst team. The cost is one expand-collapse component, which the designer owns.

### 4.3 What this locks in

- The opener is authored **separately** from the full publication text. The opener is not a truncation or the first paragraph of the publication; it is a parallel, purpose-written artifact. For the furniture brief, the opener is drafted in §6 of this spec.
- The full publication text is stored verbatim, including the ČS disclaimer footer and the author attribution (Tomáš Kozelský, Radek Novák, Tereza Hrtúsová; Ekonomické a strategické analýzy České spořitelny; březen 2026). No editorial simplification, no re-titling, no re-paragraphing beyond light markdown formatting that the engineer applies mechanically in Phase 2.2.e.
- Both the opener and the full text cite the same source line at the bottom of the opener: `Zdroj: Ekonomické a strategické analýzy České spořitelny — Nábytkářský trh v ČR, březen 2026`. This is the **only** attribution needed; the expanded full-text section re-states the authors as its own footer.
- At v0.2, the PoC seeds the furniture brief with the layperson opener from §6 and the full publication text (the engineer extracts from the .docx in Phase 2.2.e). Other seeded briefs (Phase 2.2.c placeholders) may ship **without** a publication block — see §5.2 for the data-model posture.

## 5. Decision — insight↔action connection model

### 5.1 The connection model

Each **ClosingAction** carries an optional `paired_observation_index: number | null`. If non-null, the action is *bound* to the observation at that index in the brief's `observations` array; if null, the action is an **orphan / cross-cutting action**. Observations themselves do not carry an action pointer — the pairing is directional (action → observation, not observation → action).

The UI renders this model as follows:

1. The **observations section** is the primary reading order. Observations render in authored order. Immediately after each observation, the UI renders every `ClosingAction` whose `paired_observation_index` equals that observation's index, in authored order, visually nested or adjacent-aligned (the designer owns the visual treatment — a connector line, left-edge pill strip, shared container border, or indentation is acceptable; the lane-level requirement is that the pairing is visually unambiguous).
2. **Orphan actions** — any `ClosingAction` with `paired_observation_index === null` — render in a separate **"Další doporučené kroky"** section below the observations block. This section is only rendered when at least one orphan action exists; it is omitted entirely if every action is paired.
3. An observation with **no paired action** renders alone; no placeholder, no "no action" label, no empty nest. This is the "sector-wide insight with no action" case and it is a legitimate brief shape ([Q-ASF-003](action-specificity-framing.md) default: one-way coverage, observation without action is permitted).

### 5.2 Additive type extension — `BriefContent`

The change to [src/lib/briefs.ts](../../src/lib/briefs.ts) is **additive** and **v0.1-compatible**. A v0.1 brief that predates this spec continues to load on both the analyst edit page and the v0.2 owner page.

Proposed shape (pseudo-JSON; exact TypeScript field optionality owned by engineer):

```json
{
  "title": "Nábytkářský sektor — jarní přehled 2026",
  "publication_month": "Duben 2026",

  "publication": {
    "heading": "Sektorová analýza",
    "body_markdown": "Český nábytkářský průmysl…",
    "source": "Ekonomické a strategické analýzy České spořitelny — Nábytkářský trh v ČR, březen 2026",
    "published_at_source": "2026-03-01"
  },

  "opening_summary": "…v0.1 field, remains optional and may coexist with publication.opener below…",

  "observations": [
    {
      "headline": "Objednávky nábytku se letos stabilizují po dvouletém propadu.",
      "body": "…",
      "time_horizon": "Do 3 měsíců",
      "is_email_teaser": false
    },
    {
      "headline": "Cena pracovní síly v oboru stále roste pomaleji než ve zbytku průmyslu.",
      "body": "…",
      "time_horizon": "Do 12 měsíců",
      "is_email_teaser": true
    },
    {
      "headline": "Export drží výrobu nad vodou, domácí poptávka se probouzí opatrně.",
      "body": "…",
      "time_horizon": "Více než rok",
      "is_email_teaser": false
    }
  ],

  "closing_actions": [
    {
      "action_text": "Zkontrolujte objednávkovou knihu na následující kvartál…",
      "time_horizon": "Okamžitě",
      "category": "rust-trzni-pozice",
      "paired_observation_index": 0
    },
    {
      "action_text": "Prověřte mzdové náklady…",
      "time_horizon": "Do 3 měsíců",
      "category": "naklady-produktivita",
      "paired_observation_index": 1
    },
    {
      "action_text": "Zhodnoťte odbytové kanály…",
      "time_horizon": "Do 12 měsíců",
      "category": "rust-trzni-pozice",
      "paired_observation_index": 2
    }
  ],

  "benchmark_categories": [],
  "pdf_footer_text": "…",
  "email_teaser_observation_index": 1
}
```

**Two new optional fields.** `publication` on `BriefContent`; `paired_observation_index` on `ClosingAction`.

**Backward-compat rules the engineer must preserve:**

- Both new fields are **optional**. A v0.1 brief with no `publication` object loads and renders (no publication block rendered; the page opens with `opening_summary` as today). A v0.1 brief with no `paired_observation_index` on its actions renders as "all actions are orphans" — i.e., the owner-facing UI degrades to a v0.1-style flat action list under "Další doporučené kroky". No v0.1 brief breaks; no migration is required on existing rows.
- The v0.1 analyst edit page at `/admin/brief/[id]/edit` is not in this spec's lane. The engineer must confirm that page continues to load briefs with the new fields present. Reading unknown extra fields on an object is a no-op in practice; this is flagged only so the engineer runs the v0.1 admin page against a v0.2-shaped brief before declaring Phase 2.2.d green.
- The `benchmark_categories` field stays on `BriefContent` but the brief page no longer renders it (see §7 below). Analysts authoring on the v0.1 admin page may continue to populate it for v0.3 re-introduction; it is dormant at v0.2, not deleted.
- The `benchmark_snippet` field on the top-level `Brief` stays untouched — it remains the analyst-side frozen snapshot. The brief page at v0.2 simply does not read from it or from `content.benchmark_categories`.
- `opening_summary` is kept. For the v0.2 furniture brief in §6, the opener text lives in `publication.body_markdown` (as the opener is the body of the Sektorová analýza block); `opening_summary` may be reused as a one-sentence lede above the publication block at the designer's discretion, or left empty. This is a designer / engineer judgement during 2.2.d; the content requirement is met either way.

### 5.3 Why this pairing model over the alternatives

**"Every observation carries exactly one action" — rejected.** Forces every sector-wide insight into an actionable frame. Violates §4 out-of-scope-for-MVP in [action-specificity-framing.md](action-specificity-framing.md): observation-without-action is an explicitly legitimate shape. Many furniture-sector findings ("export demand drives 70% of production") are context, not a this-week lever, and forcing an action would produce filler. Also: the 2–4 bound on observations and on actions is the same — requiring 1:1 pairing either forces actions=observations always, or requires a tree (1 obs → many actions).

**"Each observation ends with its own action sentence, no separate action list" — rejected.** Merges two reading units the owner benefits from seeing distinct. The time-horizon pill is the product's most-recognisable affordance; burying it inside the observation body dilutes it, and the closing-actions section is one of the three PRD-§6-G1 engagement KPIs ("click-throughs on the 2–4 closing actions"). Collapsing it is structurally lossy.

**"Bind action-to-observation bidirectionally; surface both directions in UI" — rejected as over-engineered for v0.2.** An observation-side pointer adds symmetry without new affordance: if every action already carries its observation index, the observation → actions projection is a trivial groupBy. We keep the one-way pointer.

The chosen model is the minimum structural change that (a) resolves the "disconnected / random" reading feedback, (b) preserves the "observation without action" legitimate case, (c) preserves the orphan / cross-cutting action case (e.g., "diskutujte s vaším účetním" as a general next step), and (d) is additive to the v0.1 type — no brief breaks.

## 6. Paired content for the furniture brief (NACE 31) — production-ready Czech

The content below is drafted to be seeded verbatim by the engineer in Phase 2.2.e. Register: formal vykání, plain Czech per [plain-language-translation.md](plain-language-translation.md) §6. Time-horizon tags are drawn verbatim from the frozen enum (Okamžitě · Do 3 měsíců · Do 12 měsíců · Více než rok).

### 6.1 Layperson opener — `publication.body_markdown`

> **Český nábytkářský průmysl: stabilizace po dvou letech útlumu, ale bez rychlého návratu k růstu.**
>
> Výroba nábytku v České republice se za posledních patnáct let přibližně zdvojnásobila — z asi 34 miliard korun v roce 2009 na 53 miliard v roce 2022. V roce 2024 obor vyrobil zboží přibližně za 49 miliard korun; je to méně než před pandemií, ale po dvou slabších letech se trh začíná stabilizovat. Klíčové je, že tuto hodnotu dnes drží výrazně méně lidí než dřív: v oboru pracuje zhruba 16 tisíc zaměstnanců, oproti 27 tisícům v roce 2009. Produktivita tedy výrazně vzrostla, zároveň ale obor už nemá kde brát další lidi, pokud by poptávka prudce oživila.
>
> Mzdy v nábytkářství rostou pomaleji než v ostatních průmyslových oborech. Pro firmy v oboru je to krátkodobě výhoda — nákladová strana drží. Střednědobě je to ale signál, že obor je u zaměstnanců méně atraktivní než alternativa ve strojírenství nebo automobilovém průmyslu a že nábor kvalifikovaných pracovníků bude stále obtížnější.
>
> Exportní stránka je silná a drží výrobu nad vodou: obchodní bilance nábytku zůstává dlouhodobě kladná, hlavním odbytištěm je Německo a západní Evropa. Domácí poptávka po nábytku v roce 2025 mírně oživila proti předchozímu roku, ale stále se nedostala na úroveň před pandemií. Ekonomické analýzy České spořitelny i Asociace českých nábytkářů předpokládají, že v roce 2026 bude trh pomalu růst, s rizikem na straně stavebnictví — pokud se odkládá dokončování bytových projektů, odkládají se i objednávky kuchyňských linek a vybavení.
>
> Co z toho plyne pro vás jako majitele firmy v oboru: sledujte objednávkovou knihu na následující kvartál — právě v první polovině roku se ukáže, jestli trh opravdu oživuje, nebo se stabilizace zasekne. Hlídejte vývoj mzdových nákladů v kontextu ostatního průmyslu — rychlejší růst u konkurence ve strojírenství znamená, že budete muset na pozice v dílně nabízet stále víc. A pokud váš odbyt stojí z většiny na jednom zahraničním zákazníkovi, zvažte diverzifikaci dřív, než se sejde objednávkový pokles se změnou směnného kurzu.
>
> *Zdroj: Ekonomické a strategické analýzy České spořitelny — Nábytkářský trh v ČR, březen 2026.*

Length check: roughly 340 Czech words. Inside the 200–400 target band. No percentile language, no "medián", no "kohorta", no statistical notation. Numbers paired with context (absolute values plus time anchor or comparison). Frozen-term compliance: no violation.

### 6.2 Paired observations (3) and actions (3) — production-ready

**Observation 1** (paired with Action 1):

- `headline`: `Objednávky nábytku se letos stabilizují po dvouletém propadu.`
- `body`: `Domácí poptávka se v roce 2025 mírně zvedla proti předchozímu roku a ekonomické analýzy předpokládají, že v roce 2026 bude pokračovat pomalý růst. Zásadní období rozhodnou první dva kvartály — pokud zakázky nepřijdou v první polovině roku, oživení se posune.`
- `time_horizon`: `Do 3 měsíců`
- `is_email_teaser`: `false`

**Action 1** (paired with Observation 1):

- `action_text`: `Zkontrolujte objednávkovou knihu na nadcházející dva kvartály a porovnejte ji se stejným obdobím loni. Pokud zakázky neoživují podle sektorového trendu, prověřte, jestli ztrácíte podíl u stávajících odběratelů, nebo jestli jde o plošný problém trhu.`
- `time_horizon`: `Okamžitě`
- `category`: `rust-trzni-pozice`
- `paired_observation_index`: `0`

**Observation 2** (paired with Action 2):

- `headline`: `Mzdy v nábytkářství rostou pomaleji než ve zbytku průmyslu — krátkodobá výhoda, střednědobě problém.`
- `body`: `Obor má nižší tempo růstu osobních nákladů než strojírenství a automobilový průmysl. Pro vaši nákladovou stranu je to dnes plus, ale znamená to, že při hledání nových lidí do dílny budete nabízet proti stále zajímavější konkurenci.`
- `time_horizon`: `Do 12 měsíců`
- `is_email_teaser`: `true`

**Action 2** (paired with Observation 2):

- `action_text`: `Srovnejte své mzdové náklady s průměrem zpracovatelského průmyslu — nejen s nábytkářstvím. Pokud chystáte nábor v dílně v nejbližších měsících, připravte mzdovou nabídku, která odpovídá širšímu průmyslu, ne jen oborovému mediánu.`
- `time_horizon`: `Do 3 měsíců`
- `category`: `naklady-produktivita`
- `paired_observation_index`: `1`

**Observation 3** (paired with Action 3):

- `headline`: `Export drží výrobu nad vodou; domácí poptávka se probouzí opatrně.`
- `body`: `Obchodní bilance oboru je dlouhodobě kladná a hlavním odbytištěm je Německo a západní Evropa. Pokud vaše tržby stojí z většiny na jednom zahraničním zákazníkovi, koncentrace se v dobrých letech neprojeví — v horších letech může zaskočit.`
- `time_horizon`: `Více než rok`
- `is_email_teaser`: `false`

**Action 3** (paired with Observation 3):

- `action_text`: `Projděte si odbytové kanály za poslední dva roky. Pokud jeden zákazník nebo jedna země tvoří víc než polovinu tržeb, začněte připravovat druhou odbytovou nohu — oslovení dalšího zahraničního trhu nebo posílení domácího prodeje trvá nejméně dva až tři kvartály.`
- `time_horizon`: `Do 12 měsíců`
- `category`: `rust-trzni-pozice`
- `paired_observation_index`: `2`

No orphan (cross-cutting) actions are seeded for the furniture brief. This is a deliberate authoring choice: three observations, three paired actions, no `Další doporučené kroky` section. The orphan-action structural capacity remains in the data model (see §5.1) for future briefs.

### 6.3 Which observation is the email teaser

Observation 2 is flagged `is_email_teaser: true`. Rationale: mzdové-náklady is the observation with the clearest owner-side action (re-tune the mzdová nabídka), and the "slower than the rest of industry" contrast is the most legible one-sentence teaser. Email delivery is out of v0.2 scope (web view only per build-plan §10.2), so this flag is ceremonial at PoC; it is set for forward-compatibility and for analyst-edit-page consistency.

### 6.4 Publication-block metadata to seed

```
publication.heading = "Sektorová analýza"
publication.source = "Ekonomické a strategické analýzy České spořitelny — Nábytkářský trh v ČR, březen 2026"
publication.published_at_source = "2026-03-01"
publication.body_markdown = <opener text from §6.1, plus, in a second markdown block inside the same field OR in a separate field the engineer elects during 2.2.e, the verbatim ČS publication text extracted from furniture-2026-Q2.docx>
```

**Decision for the engineer on body shape.** Because the opener (§6.1) and the full analyst publication are rendered on the page under different default-visibility states (opener visible; full text behind "Číst celou analýzu"), the cleanest representation is two fields — `publication.opener_markdown` and `publication.full_text_markdown`. This is a micro-additive extension inside the already-additive `publication` object and does not affect v0.1 back-compat (the object itself is optional). The engineer may equivalently use a single `body_markdown` with a sentinel separator (e.g., `\n\n---FULL---\n\n`) if migration pressure argues for the simpler shape; the PM is indifferent provided the disclosure affordance in §4 is rendered correctly. Flagged for the engineer — not a PM question.

## 7. Removals — what the v0.2 brief page no longer renders

- **"Srovnávací přehled" section is removed from the owner-facing brief detail page.** The four D-011-category accordions (Ziskovost / Náklady a produktivita / Efektivita kapitálu / Růst a tržní pozice) with their `BenchmarkSnippet` entries are not rendered at `/brief/[id]` in v0.2. Benchmarks are now surfaced on the dashboard at `/` per [dashboard-v0-2.md](dashboard-v0-2.md) — eight tiles, one per D-015 metric, grouped by the same four categories.
- **The `BenchmarkSnippet` on `Brief` and `benchmark_categories` on `BriefContent` stay on disk.** The analyst-edit page continues to author them; the publish pipeline continues to snapshot them; the v0.3+ brief page may re-introduce them, potentially in a different form (in-line alongside observations rather than as a trailing accordion block). This is **not** a data-model deletion; it is a rendering omission on exactly one surface at exactly one version.
- **No migration is required.** The engineer removes the JSX that renders the `Srovnávací přehled` section in [src/app/brief/[id]/page.tsx](../../src/app/brief/[id]/page.tsx) for both the web surface and the PDF surface (PDF is not delivered to owners at v0.2 per build-plan §10.2 but the shared page component retains the PDF branch, which the engineer also prunes for consistency). The `BenchmarkCategorySection` and the in-file `BenchmarkSnippet` components become unused; whether they are deleted or left in place for v0.3 resurrection is the engineer's judgement.
- **The v0.1 "two disjoint lists" layout is replaced by the paired layout in §5.1.** The v0.1 observations section remains (same content model, now with actions rendered nested); the v0.1 `Doporučené kroky` section is replaced with the "orphan actions only" `Další doporučené kroky` section, omitted when empty.

## 8. Acceptance criteria (for PD and engineer to validate)

A reviewer (PD during design, engineer during 2.2.d implementation, user during 2.3 walkthrough) accepts the spec as implemented when all of the following hold:

- [ ] **Page opens with the Sektorová analýza block.** Above the fold on a standard laptop viewport, the visible content is the section heading "Sektorová analýza" (or the opener paragraph if the designer elects not to render a heading), the full opener text from §6.1, and the "Číst celou analýzu" disclosure affordance. Observations and actions are reachable only after scrolling past the opener (collapsed state) or after expanding and re-collapsing the full analyst text.
- [ ] **Full analyst publication is one click away.** The "Číst celou analýzu" disclosure, when opened, renders the verbatim ČS publication text extracted from `furniture-2026-Q2.docx`, including the author attribution (Tomáš Kozelský, Radek Novák, Tereza Hrtúsová) and the ČS disclaimer footer. No editorial rewrite, no truncation, no "see full text at an external URL".
- [ ] **Insight↔action pairing renders adjacently.** For every observation with one or more paired actions, those actions render visually immediately after that observation, in authored order, with a visual treatment that makes the pairing unambiguous (designer decides the treatment; PM only asserts the adjacency). Orphan actions — `paired_observation_index === null` — render in a "Další doporučené kroky" section after the last observation, and that section is omitted entirely if there are no orphan actions.
- [ ] **Srovnávací přehled is removed from the owner page.** No BenchmarkSnippet, no category accordion, no Srovnávací přehled heading renders on `/brief/[id]` at v0.2. The analyst-edit page is untouched.
- [ ] **v0.1 briefs still load.** A brief authored on `trial-phases-2-4` (no `publication` object, no `paired_observation_index` on actions) loads on the v0.2 brief page without error. The publication block is not rendered for such a brief; actions render as orphans under "Další doporučené kroky"; observations render in a vertical list as before. The `opening_summary` field, if present, renders where it did in v0.1 (above the observations).
- [ ] **Furniture brief seed is faithful to §6.** The Phase 2.2.e seed script populates the furniture brief with `publication.opener_markdown` equal to §6.1 verbatim, `publication.full_text_markdown` equal to the verbatim .docx extraction, and the three observation / three action records equal to §6.2 verbatim. The `is_email_teaser` flag is set on observation index 1.

## 9. Open questions — resolutions

- **OQ-058 — below-floor tile copy, short vs. full form** ([open-questions.md](../project/open-questions.md)). **Resolved: keep the short form** (`Zatím nedostatek dat pro srovnání`) on the dashboard tile. Rationale: the full form (`Tento ukazatel zatím nemůžeme spolehlivě porovnat — k dispozici je málo srovnatelných firem v kohortě.`) from [quartile-position-display.md](quartile-position-display.md) §5.5 was designed for an in-brief paragraph context where the surrounding prose carries the remainder of the explanation. On a tile it reads as text-over-spillage and violates the dashboard's readability posture. The short form resolves to the same product principle (silent on the number, plain explanation of *why*, no "floor" jargon) and keeps the tile density right. The full form remains canonical inside a brief the moment a brief re-introduces benchmark snippets in v0.3+ — this decision scopes the short form to the tile surface only. PM action: no glossary change. PD action in `docs/design/dashboard-v0-2/tile-states.md` is to state the short form as the rendered string; OQ-058 closes with this spec pass.

## 10. Glossary extension — new term "Sektorová analýza"

The glossary gains one entry, published to [docs/product/glossary.md](glossary.md). Short definition:

> **Sektorová analýza** — Owner-facing label for the sector-analysis block that opens each brief at v0.2. Contains a plain-Czech layperson opener (200–400 words, formal vykání, authored per this spec) and a collapsible full publication body sourced from ČS Ekonomické a strategické analýzy. Distinct from **Analýzy (Strategy Radar)** (plural; dashboard list heading for the collection of briefs per [D-019](../project/decision-log.md)) and from **Přehled** (singular; a single brief document). Source: `brief-page-v0-2.md`; introduced at v0.2 customer-testing PoC.

The three-term family after this addition:

| Term | What it denotes | Surface |
|---|---|---|
| **Přehled** | One brief document | Singular user-facing name for a brief |
| **Analýzy** (plural) | The dashboard list of available briefs | Dashboard list heading |
| **Sektorová analýza** (singular) | The sector-publication opener-and-body block inside one brief | Top section of the brief detail page |

"Analýza" (singular) is **not** introduced as a user-facing term. The potential ambiguity with "Analýzy" (plural list heading) is exactly the overload the orchestrator flagged; "Sektorová analýza" avoids it by pairing with a discriminating adjective. PM to apply the glossary edit in the next glossary pass concurrent with this spec landing (glossary is PM-write-lane — no separate OQ needed).

## 11. Non-negotiables (PRD §7 principles applied)

- **§7.1 Day-one proof of value** — the opener in §6.1 is the payload. A participant who reads only the first ~300 Czech words of the brief has received four substantive findings (production trajectory, employment trajectory, wages vs wider industry, export dependency) and two concrete questions to check in their own business. No configuration required, no expansion click required, no onboarding.
- **§7.2 Verdicts, not datasets** — every paragraph of the opener resolves in a plain-language conclusion. No bare number without a comparison. No percentile language. The full analyst publication behind the disclosure affordance is dataset-flavored by design; its inclusion is a trust-transfer mechanism, not the default surface (see §4.2).
- **§7.3 Plain language, no jargon** — the opener is authored per [plain-language-translation.md](plain-language-translation.md) §6. The observations and actions in §6.2 are authored likewise. The analyst publication is **not** subject to the full plain-language rule set; its register is analyst-to-analyst and it is explicitly framed as "the expert source", not as owner-legible.
- **§7.4 Proof of value before anything else** — the pairing model (§5.1) is the §7.4 concretisation at the brief-body scale. "Here is what is happening in your sector, here is what to do about it, in adjacent reading order."
- **§7.5 Privacy as product** — the brief page reads from the `brief` lane only ([D-010](../project/decision-log.md)). No RM-visible output, no credit-risk adjacency, no user-contributed data rendered. The demo-owner bypass (build-plan §10.3) routes around consent but does not introduce a new lane flow.
- **§7.6 Opportunity-flavored, not risk-flavored** — the furniture observations in §6.2 are conversation-starters ("zkontrolujte", "srovnejte", "zvažte"). None reads as bank surveillance. "Diversifikujte odběratele" is opportunity-framed; there is no "pokud se dostaneš do potíží, ČS…" register anywhere.
- **§7.7 Bank-native distribution** — the brief renders the "Česká Spořitelna · Strategy Radar" header band ([D-018](../project/decision-log.md)). Source attribution on the opener (`Zdroj: Ekonomické a strategické analýzy České spořitelny …`) is the bank-native trust-transfer at the content level.
- **§7.8 Give-to-get in mind, not in build** — no data-capture field on this page. None. The "Sledujte objednávkovou knihu" action is a manual next step in the owner's own system, not a "please upload your orders" prompt.
- **No automated brief generation** — the opener in §6.1, the observations and actions in §6.2, and the full publication are all human-authored (ČS analysts for the publication; PM-as-editorial-stand-in for the opener and the observation/action trio, which the ČS analyst team will review before the PoC session).
- **No cohort statistical-validity-floor surfacing on this page** — the brief page at v0.2 does not render any ratio-level percentile. The opener uses absolute values (miliardy Kč, tisíce zaměstnanců) and plain comparatives, not cohort percentiles. The floor never needs to be referenced.

## 12. Open questions — non-blocking

Two self-monitoring items. Neither blocks PD or engineer work on this spec.

1. **OQ-BPV02-01 — Opener length validation.** The 200–400 Czech-word band is reasoned rather than tested. Target for post-PoC adjustment: if customer-testing participants finish the opener inside the observation window but bounce before the observations, the opener may be too dense; if they don't read the full opener, it may be too long. PM revisits after PoC; not logged in `open-questions.md` because it is a self-monitoring retrospective trigger, not an unresolved cross-domain question.

2. **OQ-BPV02-02 — Full-text disclosure default state for the next customer-testing cohort.** §4 locks collapsed-by-default. If the PoC signal shows participants never expand the disclosure, the full text becomes invisible rather than optional. A v0.3 reopening may move it to a separate `/brief/[id]/analyza` sub-route, or to a right-hand column on desktop. Not logged in `open-questions.md` — self-monitoring trigger only.

## 13. Downstream artifacts

- **Design**: [docs/design/brief-page-v0-2.md](../design/brief-page-v0-2.md) — not yet drafted. Owns: layout of the Sektorová analýza block, disclosure affordance styling ("Číst celou analýzu"), visual treatment of the insight↔action pairing (connector, nesting, shared container, etc.), orphan-actions section visual distinction, typography and spacing for the long-form analyst body, accessibility of the disclosure (ARIA expanded state, keyboard focus), removal of the Srovnávací přehled block from the rendered output.
- **Engineering**: not yet drafted (the engineer produces implementation notes inside `docs/engineering/` or inline PRs during Phase 2.2.d / 2.2.e). Owns: the additive type extension to `BriefContent` in [src/lib/briefs.ts](../../src/lib/briefs.ts), the JSX surgery in [src/app/brief/[id]/page.tsx](../../src/app/brief/[id]/page.tsx), the .docx-to-markdown extraction for the full publication text in the seed script, the v0.2-identity-bypass compatibility with the new page shape, the v0.1 brief back-compat verification against both the owner page and the analyst edit page.
- **Data**: not applicable — no new data model, no new cohort computation, no lane change. The `publication` object lives in the existing `content_sections` JSONB blob on `briefs` per [ADR-0002](../engineering/adr-0002-brief-storage-and-delivery.md). No addendum required in `docs/data/`.
- **Product (sibling, v0.2 track)**: [dashboard-v0-2.md](dashboard-v0-2.md) — locked; this spec links to it but does not modify it.

## Changelog

- 2026-04-21 — initial draft for the v0.2 customer-testing PoC brief detail page. Consumes D-015, D-011, D-018, D-019, D-012. Closes OQ-058. Introduces "Sektorová analýza" as a glossary term. — product-manager
