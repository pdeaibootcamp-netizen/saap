# Brief detail page (v0.2) — Engineering

*Owner: engineer · Slug: brief-page-v0-2 · Last updated: 2026-04-21*

## 1. Upstream links

- Product: [docs/product/brief-page-v0-2.md](../product/brief-page-v0-2.md)
- Design: [docs/design/brief-page-v0-2.md](../design/brief-page-v0-2.md)
- Data: not applicable — no new data model (product spec §13 "Data: not applicable")
- Build plan: [docs/project/build-plan.md §10](../project/build-plan.md) Phase 2.2.d
- Decision in force: [D-020](../project/decision-log.md) — hybrid publication block, "Sektorová analýza" label, `paired_observation_index`, orphan section

## 2. Architecture overview

Phase 2.2.d is pure JSX surgery on two files plus an additive type extension. No new routes, no new DB columns, no new dependencies.

```
src/lib/briefs.ts          — BriefContent and ClosingAction type extension (additive)
src/app/brief/[id]/page.tsx — Rendered owner page (server component) reshaped for v0.2
```

Privacy boundaries are unchanged: the page reads from the `brief` lane only (D-010). No RM-visible output, no credit-risk data, no user-contributed data rendered.

### Component map (web surface)

```
BriefPage (server component)
  └─ SekterovaAnalyzaBlock        — opener + <details>/<summary> disclosure
       └─ MarkdownParagraphs      — double-newline split → <p> per block
  └─ ObservationActionPair (×N)   — observation + optional paired action card
  └─ OrphanActionCard (×M)        — orphan closing actions, omitted when M=0
  └─ ConsentRevokedScreen / BriefNotReadyScreen  (error states, v0.1 unchanged)
```

### Paired / orphan computation (no library)

```
isV1Shape = every action.paired_observation_index === undefined || null
pairedActionForObs(i) = actions.find(a => a.paired_observation_index === i)
orphanActions = isV1Shape ? actions : actions.filter(a => index is null/undefined)
```

## 3. ADRs

### ADR-BPV-001 — Delete BenchmarkCategorySection and BenchmarkSnippet JSX components

- **Date**: 2026-04-21
- **Context**: Both components become unreachable after the Srovnávací přehled section is removed from web and PDF surfaces. Product spec §7 says the engineer decides. Grep confirmed zero callers in the codebase outside `src/app/brief/[id]/page.tsx` itself.
- **Decision**: Delete both JSX render components entirely from `page.tsx`. The TypeScript types (`BenchmarkSnippet`, `BenchmarkCategory`, `BenchmarkMetric`) and the DB column (`benchmark_snippet`) stay on disk in `src/lib/briefs.ts` for v0.3 reintroduction.
- **Consequences**: Locks in dead-symbol removal; v0.3 will re-introduce the render components if needed. Does not touch the analyst edit page or the data model.
- **Rejected alternatives**: Keep as commented-out code — rejected: dead commented code invites drift; TypeScript types on disk are sufficient resurrection anchors.

### ADR-BPV-002 — CSS `::before` content trick for disclosure label flip

- **Date**: 2026-04-21
- **Context**: The design spec requires "Číst celou analýzu" to flip to "Skrýt celou analýzu" on `<details>` open, without JavaScript, in a Next.js server component. Options: (a) CSS `details[open] summary::before` with content — pure CSS, no JS, works in all modern browsers; (b) a client component with `useState` — adds client boundary for one string swap; (c) two spans with `display:none` CSS toggle — fragile with `listStyle: none` on summary.
- **Decision**: Option (a) — inline `<style>` tag inside the server component using `details[open] summary::before { content: "▼ Skrýt celou analýzu" }`. Class name `sr-disclosure` scopes the rule. `<summary>` carries `aria-label="Číst celou analýzu"` for screen readers (static value; browser updates `aria-expanded` automatically).
- **Consequences**: Relies on CSS `content` being readable as the accessible name in some browsers but `aria-label` on the `<summary>` element is the authoritative accessible name. The chevron text (▶/▼) is part of the `::before` generated content — fine since `aria-label` overrides it for AT.
- **Rejected alternatives**: Client component — adds unnecessary client boundary for a purely cosmetic string swap.

### ADR-BPV-003 — Plain-text paragraph rendering (no markdown library)

- **Date**: 2026-04-21
- **Context**: `opener_markdown` and `full_text_markdown` are rendered on page. Options: (a) split on `\n\n`, render `<p>` per block — zero dependencies, sufficient for PoC prose; (b) import remark/rehype — enables tables, lists, inline styles in the full analyst text; new dependency requiring orchestrator clearance.
- **Decision**: Option (a). The `MarkdownParagraphs` component splits on `/\n\n+/` and renders one `<p>` per block. A comment in `briefs.ts` flags the v0.3 upgrade path.
- **Consequences**: Tables and lists in the full ČS publication text will not render as HTML tables/lists — they appear as flat paragraphs. Acceptable for v0.2 PoC. v0.3 upgrade: replace `MarkdownParagraphs` with `remark`+`rehype-react` after orchestrator approves the new dependency.
- **Rejected alternatives**: `marked` inline — new dependency, not approved; remark/rehype — same; `dangerouslySetInnerHTML` with a sanitised HTML string — XSS surface requires sanitiser library (another dependency).

## 4. Data contracts

Type additions are additive to `src/lib/briefs.ts`:

- `ClosingAction.paired_observation_index?: number | null` — optional; v0.1 briefs without it render all actions as orphans.
- `BriefPublication` interface — new; fields: `heading`, `opener_markdown`, `full_text_markdown`, `source`.
- `BriefContent.publication?: BriefPublication` — optional; v0.1 briefs without it silently omit the Sektorová analýza block.

No DB schema change. Both new fields live in the existing `content_sections` JSONB blob on `briefs` (ADR-0002). No migration.

Full type contracts: [src/lib/briefs.ts](../../src/lib/briefs.ts).

## 5. Test plan

Per the task brief, no new tests are written for 2.2.d (the spec says "Do NOT write new tests"). The existing migration-enum tests in `src/supabase/migrations/*.test.ts` are unaffected.

**Static checks run and passed:**

- `tsc --noEmit`: one error only — `lib/pdf.ts: Cannot find module 'puppeteer'` (pre-existing; present on baseline before 2.2.d changes; confirmed by `git stash` + re-run).
- `npm run build`: fails on same pre-existing puppeteer webpack error; no new errors introduced.

**Privacy invariant:** the page component imports only from `brief` lane (`src/lib/briefs.ts`, `src/lib/auth.ts`, `src/lib/consent.ts`, `src/lib/demo-owner.ts`). No cross-lane reads.

**Cross-copy sanity check (Q-TBD-BPV-003):** `src/lib/email.tsx` does not reference `closing_actions`, `Doporučené kroky`, or any closing-action structure — confirmed by grep (no matches). Email template renders a single teaser observation only; unaffected by v0.2 paired-action shape. No change needed.

## 6. Deployment + rollback

- **Deploy**: merge `trial-v0-2` to target; `npm run build` will fail on puppeteer (pre-existing). No env var changes. No DB migration.
- **Rollback**: `git revert` the commit; the two modified files revert cleanly. No data-state loss — JSONB blobs are backward-compatible in both directions (old code ignores `publication`; new code falls back gracefully when `publication` is absent).
- **Feature flag**: none. This is a hard cut on the owner page only; the analyst edit page is untouched.

## 7. Open questions

None new from 2.2.d. OQ-057 (container width) resolved — 680px per PD spec §2b. Q-TBD-BPV-001, BPV-002, BPV-003 from the design spec are handled:

- BPV-001: "Doporučený krok:" confirmed implemented as specified.
- BPV-002: `#888` on `#fafafa` at 12px is below 4.5:1 WCAG AA; applied `#666` (`--color-ink-tertiary`) per the design spec fallback — 5.74:1 passes AA.
- BPV-003: grep confirmed no stale references in email or admin code.

## Changelog

- 2026-04-21 — initial draft for Phase 2.2.d brief-page surgery — engineer
