# Percentile Position Calculation — Design

*Owner: designer · Slug: percentile-position-calculation · Last updated: 2026-04-20*

## 1. Upstream links

- Product doc: [docs/product/percentile-position-calculation.md](../product/percentile-position-calculation.md)
- PRD sections driving constraints: §7.2 (verdicts, not datasets), §7.3 (plain language), §7.5 (privacy as product), §8.2 (Peer Position Engine), §10 (data foundation and floor), §13.5 (cold-start risk)
- Decisions in force: D-001, D-003, D-006, D-007, D-010, D-011, D-012
- Foundation artifacts: [docs/data/cohort-math.md](../data/cohort-math.md) (degradation ladder, floor thresholds, signal shape), [docs/design/information-architecture.md](../design/information-architecture.md) (BenchmarkSnippet §4.3, BenchmarkCategory §4.4 — not restated here)

---

## 2. Primary flow

No owner-facing flow — the compute is invisible. The monthly batch job runs on the back-end; the owner never sees a "calculating" or "updating" state. The BenchmarkSnippet component (IA §4.3) receives either a valid payload or a suppression signal; it renders accordingly without exposing any compute-layer concept. No flow diagram adds clarity beyond what is already in the IA primary flow (IA §6).

## 2b. Embedded variant (George Business WebView)

Not applicable — the compute surface has no owner-facing UI. All owner-facing rendering lives in IA §4.3 and §4.4, which already cover the WebView variant.

---

## 3. Screen inventory

### Owner-facing surfaces — below-floor suppression

The owner never sees a dedicated suppression screen or a "not enough data" message. The BenchmarkSnippet component already specifies this contract in IA §4.3. For traceability, the design rule is restated here as a single row:

| Screen | Purpose | Entry | Exit | Empty state | Error states |
|---|---|---|---|---|---|
| BenchmarkSnippet — below-floor state (rungs 1–3, rung 4) | Silent degradation of a single metric within the brief | `achieved_rung` field on snapshot row drives the copy variant (IA §4.3); rung 4 triggers full suppression | Not a distinct screen — the component is one slot in the brief body; the rest of the brief continues unaffected | Rung 4: snippet slot is omitted entirely. No copy shown to the owner. The category section (BenchmarkCategory) continues to render any metric slots that cleared the floor. | Not applicable — degradation is a data state, not an error; no retry or user action is possible or appropriate |

**Footnote copy for rungs 1–3 (pooled cohorts):** The brief copy layer appends a plain-language footnote to each pooled snippet. These are the only new strings this feature contributes to the owner-facing surface.

See §5 Copy drafts for the three footnote variants.

### Analyst-side surface — snapshot metadata panel

A read-only informational panel inside the analyst authoring back-end. Visible when an analyst opens a brief authoring session for a given owner × snapshot pair. Gives the analyst visibility into which metrics have cleared the floor, what cohort pooling was applied, and when the snapshot was produced.

| Screen | Purpose | Entry | Exit | Empty state | Error states |
|---|---|---|---|---|---|
| Snapshot metadata panel | Read-only: lets the analyst verify floor status per metric before authoring a snippet that references a peer comparison | Analyst opens a brief draft for a specific owner in the authoring back-end | Analyst proceeds to author the brief; this panel has no action controls | No snapshot available for this owner: "Pro tohoto klienta dosud nebyl vypočítán žádný snímek. Spusťte dávkový výpočet a zkuste znovu." | Snapshot fetch error: "Metadata snímku se nepodařilo načíst. Zkuste stránku obnovit." |

**Authoring hard-block — below-floor `owner_relative` framing:** If an analyst attempts to save an observation or snippet that uses an `owner_relative` framing (e.g., "vaše hrubá marže překračuje 68 % firem ve vašem sektoru") for a metric whose snapshot row carries `achieved_rung = 4`, the authoring back-end blocks the save and displays an inline error on the field. The analyst must either remove the comparative framing or replace the observation with a sector-narrative framing that does not reference a peer position.

See §5 Copy drafts for the hard-block copy.

---

## 4. Component specs

### 4.1 SnapshotMetadataPanel (analyst back-end only)

**Purpose:** Displays per-metric floor status, cohort context, and snapshot provenance for a given owner. Read-only; no owner-facing exposure.

**States:**

| State | Description |
|---|---|
| Default (loaded) | Table: one row per metric (8 rows). Columns: metric name, `achieved_rung` (0–4, rendered as a plain label — see copy below), `n_used` (integer), cohort context (e.g., "NACE 10 · S2 · Praha"), `snapshot_timestamp` (date + time) |
| Empty | No snapshot available for this owner × snapshot period. Plain-text message (§5). |
| Loading | Skeleton: column headers + 8 placeholder rows |
| Error | Inline error message with page-refresh prompt (§5). No retry button — a refresh is sufficient |

**Per-metric rung label mapping (analyst-facing, informational only):**

| `achieved_rung` value | Label shown in panel |
|---|---|
| 0 | Plná shoda (NACE × velikost × region) |
| 1 | Region sdružen (NACE × velikost) |
| 2 | Velikost sdružena (NACE × region) |
| 3 | Pouze sektor (NACE) |
| 4 | Pod prahem — srovnání potlačeno |

**Props needed:** `snapshotTimestamp: string`, `metrics: Array<{ metricKey: string, metricLabel: string, achievedRung: 0|1|2|3|4, nUsed: number, cohortCellContext: string }>`.

**Where used:** Analyst authoring back-end only. Not rendered on any owner-facing surface.

**Screen-reader labeling:** The panel is rendered as an HTML `<table>` with a `<caption>` of "Metadata snímku — stav na úrovni ukazatelů". Each column has a `<th scope="col">`. The `achieved_rung` label cell carries `aria-label` in full (e.g., `aria-label="Stupeň degradace: Region sdružen"`). The `n_used` cell carries `aria-label="Počet firem v kohortě: <value>"`. The status column's value for rung 4 carries `role="alert"` so that screen readers announce it immediately when the panel loads with any suppressed metrics.

### 4.2 AuthoringHardBlockMessage (analyst back-end only)

**Purpose:** Inline validation error shown when an analyst attempts to save an `owner_relative` snippet for a metric at rung 4.

**States:**

| State | Description |
|---|---|
| Default (triggered) | Inline error attached to the affected observation or snippet field. Non-dismissible until the analyst corrects the framing or removes the `owner_relative` content |
| Resolved | Error disappears when the field content no longer contains an `owner_relative` framing for a rung-4 metric |

**Props needed:** `metricLabel: string`, `achievedRung: 4` (always 4 at the point of block).

**Where used:** Analyst authoring back-end only.

---

## 5. Copy drafts

All copy is Czech only (D-004). Formal register, vykání where addressing the owner. The analyst-panel copy is addressed to the analyst, third-person for the owner/client.

### Owner-facing: pooled-cohort footnotes (rungs 1–3)

These footnotes appear beneath the relevant BenchmarkSnippet inside the brief web view and PDF. They are the only owner-visible string this feature contributes.

| Location | Rung | Copy |
|---|---|---|
| BenchmarkSnippet footnote — region pooled | Rung 1 | "Srovnání zahrnuje firmy vaší velikosti z celé České republiky, nikoli pouze z vašeho regionu." |
| BenchmarkSnippet footnote — size pooled | Rung 2 | "Srovnání zahrnuje firmy různých velikostí ve vašem regionu." |
| BenchmarkSnippet footnote — sector-only | Rung 3 | "Srovnání zahrnuje firmy z celého vašeho sektoru bez ohledu na velikost nebo region." |

**Rung 4 (suppress):** No copy shown to the owner. The slot is omitted. (Confirmed: PRD §6 non-negotiable #4 — "no user-facing copy says 'insufficient data for your cohort' — the brief is simply silent on that metric.")

### Analyst-facing: snapshot metadata panel

| Location | Copy |
|---|---|
| Panel caption | "Metadata snímku — stav na úrovni ukazatelů" |
| Column: metric | "Ukazatel" |
| Column: rung | "Stav sdružování" |
| Column: n_used | "Počet firem" |
| Column: cohort | "Kohorta" |
| Column: snapshot timestamp | "Datum snímku" |
| Empty state | "Pro tohoto klienta dosud nebyl vypočítán žádný snímek. Spusťte dávkový výpočet a zkuste znovu." |
| Error state | "Metadata snímku se nepodařilo načíst. Zkuste stránku obnovit." |

### Analyst-facing: authoring hard-block (rung 4)

| Location | Copy |
|---|---|
| Hard-block inline error | "Ukazatel <metricLabel> nemá pro tohoto klienta dostatek dat k porovnání (pod prahem). Odstraňte odkaz na relativní pozici klienta nebo použijte sektorový kontext bez přímého srovnání." |

`<metricLabel>` is the Czech display name of the metric as defined in [docs/product/mvp-metric-list.md](../product/mvp-metric-list.md) §Category grouping.

**Note:** The hard-block copy requires legal + analyst-workflow review before production — logged as Q-PD-PPC-001.

---

## 6. Accessibility checklist

The owner-facing change (rung 1–3 footnote text) is plain text appended inside existing BenchmarkSnippet markup. No new interactive elements; existing IA §6 checklist applies.

The analyst metadata panel is informational only:

- [ ] `<table>` with `<caption>` and `<th scope="col">` on every column — no layout table use
- [ ] Rung-4 cells carry `role="alert"` so assistive technology announces suppressed metrics on load
- [ ] `aria-label` on `achieved_rung` and `n_used` cells (values are numeric; label provides context)
- [ ] Focus states visible with sufficient contrast on any interactive elements in the parent authoring shell (the panel itself has no interactive controls)
- [ ] Color is not the only signal for rung-4 status — the label text "Pod prahem — srovnání potlačeno" is always present; color (if any) is supplementary
- [ ] Text contrast ≥ WCAG AA (4.5:1 body, 3:1 large) — inherits from authoring back-end design system; verify in implementation
- [ ] Hard-block error message (`AuthoringHardBlockMessage`) is associated with its triggering field via `aria-describedby`; error copy identifies which metric is affected
- [ ] Motion: no animation on this panel or on the hard-block message; not applicable

---

## 7. Design-system deltas (escalate if any)

**SnapshotMetadataPanel** and **AuthoringHardBlockMessage** are components in the analyst authoring back-end, not in the owner-facing product. The authoring back-end design system is not yet specified. Escalated as Q-PD-PPC-002 — the engineer and PM must confirm whether the authoring back-end has an existing component library or whether these are net-new components.

Until that is confirmed: both components are marked `[BLOCKED — Q-PD-PPC-002]` for implementation. The specs above (states, props, copy, accessibility labeling) are complete and implementable once the back-end component library is confirmed.

No new owner-facing design-system components. The rung footnote strings are rendered inside the existing BenchmarkSnippet component (IA §4.3); no new component or token is required.

---

## 8. Open questions

| Local ID | Question | Blocking |
|---|---|---|
| Q-PD-PPC-001 | The analyst-facing hard-block copy ("Ukazatel X nemá pro tohoto klienta dostatek dat…") requires analyst-workflow review and legal sign-off on phrasing. | Production readiness of authoring hard-block in §5 |
| Q-PD-PPC-002 | The analyst authoring back-end has no confirmed design system or component library. SnapshotMetadataPanel and AuthoringHardBlockMessage are spec'd but marked BLOCKED until the back-end component library is confirmed by the engineer. | Implementation of §4.1 and §4.2 |
| Q-PD-PPC-003 | The product doc (§8 Downstream artifacts) references `docs/design/percentile-position-calculation/` as a directory. This artifact is a flat file (`percentile-position-calculation.md`) rather than a directory, consistent with other Phase 2 Track B design artifacts. If the orchestrator requires a directory structure, the file should be moved. No design decision depends on this. | Artifact path consistency |

Inherited open questions acknowledged (not blocking design): OQ-019 (per-metric floor re-tuning post-trial), OQ-020 (measured cell-clearance distribution post-Phase 3 rehearsal).

---

## Changelog

- 2026-04-20 — initial draft — designer
