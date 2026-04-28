# Pulz oboru — Engineering

*Owner: engineer · Slug: pulz-oboru · Last updated: 2026-04-28*

## 1. Upstream links

- Product: [docs/product/pulz-oboru.md](../product/pulz-oboru.md)
- Design (owner-facing): [docs/design/pulz-oboru.md](../design/pulz-oboru.md)
- Design (admin): [docs/design/pulz-oboru-admin.md](../design/pulz-oboru-admin.md)
- Data: [docs/data/analyses-schema.md](../data/analyses-schema.md)

---

## 2. Architecture overview

```
Browser (owner)
  │
  └─ GET /
       └─ src/app/page.tsx  (server component)
            └─ <PulzOboruSection naceDivision={activeNace} />  (server component)
                 └─ getCurrentPulzAnalysisForNace(nace)
                      ├─ supabase REST: pulz_analyses (is_current + published)
                      ├─ supabase REST: pulz_analysis_charts × 3  (parallel)
                      ├─ supabase REST: pulz_analysis_actions 1–3 (parallel)
                      ├─ signChartUrl() × 3  (Supabase Storage signed URL, 1 h)
                      └─ signPdfUrl()         (optional, same TTL)
                 └─ Renders: StaleWarningBadge? | ChartTile×3 | SummaryTextBlock
                             | PdfLink? | ActionBox
                             | EmptyStateCard (null path)
                             | ErrorCard (throw path)

Browser (analyst)
  │
  ├─ GET  /admin/pulz-oboru           → src/app/admin/pulz-oboru/page.tsx
  ├─ GET  /admin/pulz-oboru/new       → src/app/admin/pulz-oboru/new/page.tsx
  └─ GET  /admin/pulz-oboru/[id]/edit → src/app/admin/pulz-oboru/[id]/edit/page.tsx
       └─ <PulzOboruForm initialData? />  (client component — "use client")
            └─ multipart POST/PUT → /api/admin/pulz-oboru
                 └─ src/app/api/admin/pulz-oboru/route.ts
                      ├─ validatePayload()
                      ├─ findPublishedConflict() → 409 on dupe (nace + period)
                      ├─ uploadChartImage() × 0–3
                      ├─ uploadPdf() × 0–1
                      ├─ upsert pulz_analyses + pulz_analysis_charts + pulz_analysis_actions
                      └─ supersede prior is_current row (if ?supersede=true)
```

### Privacy boundaries

All Pulz oboru data sits in the **`brief` lane** only (D-010). The three DB tables
(`pulz_analyses`, `pulz_analysis_charts`, `pulz_analysis_actions`) contain no per-owner
fields: no `user_id`, `ico`, `owner_id`, or `recipient_id` columns exist or are written.

`getCurrentPulzAnalysisForNace()` accepts only a NACE division string — a sector code,
not an owner identifier. Signed URL minting is server-side only; the browser never
receives a long-lived storage URL. No cross-lane reads occur anywhere in the Pulz oboru
component tree.

The two storage buckets (`pulz-charts`, `pulz-pdfs`) are private; access requires
a service-role key, which is only present server-side.

---

## 3. ADRs

### ADR-PO-001 — File-upload drop zone: CSS-only, no library

- **Date**: 2026-04-28
- **Context**: The admin chart-tile builder needs a drag-and-drop file upload zone
  (Q-POAL-002 from the PD spec). Options reviewed: `react-dropzone`, `filepond`,
  CSS-only styled `<input type="file">` wrapper.
- **Decision**: CSS-only. A `<div>` wraps a `<input type="file" style="position:absolute;
  opacity:0;inset:0">` to capture clicks and drag events. No external library added.
- **Consequences**: No new `node_modules` dependency. Drag-and-drop is functional without
  `dragover`/`drop` custom styling at parity with `react-dropzone`'s minimal config.
  Advanced features (preview thumbnails for non-image uploads, multi-file reorder) are
  not available, but Pulz oboru upload is single-file-per-slot only.
- **Rejected alternatives**:
  - `react-dropzone` — new runtime dependency; adds ~9 kB gzipped for no functional gain
    at single-file/single-slot scope.
  - `filepond` — heavier (~30 kB), designed for multi-file queues, not suited for 3
    independent single-file slots.

### ADR-PO-002 — Modal dialog: minimal `role="dialog"` pattern, no library

- **Date**: 2026-04-28
- **Context**: The admin form needs two modal dialogs: a publish-confirmation dialog and
  a 409-conflict dialog (Q-POAL-001). Existing admin pages in the codebase use none.
  Options: Headless UI, Radix UI Dialog, custom `role="dialog"` + backdrop.
- **Decision**: Custom `role="dialog" aria-modal="true"` + semi-transparent backdrop `<div>`.
  Focus is managed by auto-focus on the primary CTA button via `autoFocus` prop. Backdrop
  click closes the modal. Escape key closes the modal via `onKeyDown`.
- **Consequences**: No new library dependency. Covers both use cases (confirm + conflict).
  Complex animations and complex focus-trap edge cases (e.g., tabbing into an iframe inside
  the modal) are not handled, but neither dialog contains nested focusable surfaces.
- **Rejected alternatives**:
  - Headless UI — would require adding `@headlessui/react`; overkill for two modals.
  - Radix UI Dialog — same cost; Radix is not present anywhere else in the codebase.

### ADR-PO-003 — SVG security: `<img>` tag, not inline SVG

- **Date**: 2026-04-28
- **Context**: Analysts may upload SVG chart files. Inline SVG (`dangerouslySetInnerHTML`
  or direct import) allows embedded `<script>` and `xlink:href` execution. Q-POAL-007
  in the PD spec flagged this risk.
- **Decision**: All chart images — including SVG — are rendered as `<img src={signedUrl}>`.
  Scripts in SVG are inert when served through `<img>`. The MIME allow-list
  (`image/png | image/svg+xml | image/webp`) is enforced at upload time server-side.
- **Consequences**: Closes the stored-XSS vector for SVG. No client-side sanitization
  library needed. Limitation: SVG text-scaling and accessibility features that require
  inline SVG (title/desc elements readable by screen readers) are not available; chart
  information is conveyed by mandatory alt text instead.
- **Rejected alternatives**:
  - DOMPurify sanitize-then-inline — adds a runtime dep; DOMPurify's SVG sanitization
    is complex to configure correctly and is still evolving. Unnecessary when `<img>` is
    a complete mitigation.

### ADR-PO-004 — Soft-supersede model: partial unique index

- **Date**: 2026-04-28
- **Context**: The DE schema (analyses-schema.md §3) specifies a soft-supersede model:
  a new publication for the same NACE does not hard-delete the prior row; it flips
  `is_current = false` on the old row and sets `is_current = true` on the new one.
  The unique constraint must prevent two `is_current = true` rows for the same NACE.
- **Decision**: Partial unique index:
  `CREATE UNIQUE INDEX ON pulz_analyses(nace_division) WHERE is_current = true`
  This enforces the single-current-row invariant at the DB level with no application-layer
  race condition.
- **Consequences**: Supersession from the API is not a single atomic REST call (Supabase
  REST does not expose multi-statement transactions). The sequence is:
  (1) insert new row (`is_current = false`), (2) upload assets, (3) flip prior rows to
  `is_current = false`, (4) flip new row to `is_current = true`. A crash between steps
  3 and 4 leaves two `is_current = false` rows (safe — nothing renders). A crash between
  steps 3 and 4 is safe because the partial unique index still enforces only one `true`
  row. Full rollback is manual (flip new row to false, flip prior row to true).
- **Rejected alternatives**:
  - Hard-delete prior row — loses audit trail; rejected by DE spec.
  - Application-level uniqueness check only — race condition possible under concurrent
    publishes.

### ADR-PO-005 — Error boundary in server component: try/catch, not React ErrorBoundary

- **Date**: 2026-04-28
- **Context**: `PulzOboruSection` is a Next.js App Router async server component. React
  `ErrorBoundary` (client-only) cannot wrap a server component. The section must degrade
  gracefully without affecting Section 1 (cohort tiles) or Section 3 (briefs list).
- **Decision**: `try/catch` around `getCurrentPulzAnalysisForNace()` inside the async
  server component. On throw, sets a local `fetchError` flag and renders `ErrorCard`
  (which is a `"use client"` component that provides a retry button via
  `window.location.reload()`).
- **Consequences**: Error is scoped to the Pulz oboru section only. The rest of the page
  renders normally. The ErrorCard retry reloads the whole page, not just the section —
  acceptable for a demo context; a partial-section RSC refetch would require React 18
  `startTransition` + router invalidation which is out of scope.
- **Rejected alternatives**:
  - Next.js `error.tsx` boundary — catches the entire route, not the section.

---

## 4. Data contracts

Full schema spec: [docs/data/analyses-schema.md](../data/analyses-schema.md).

Summary of what the read layer consumes:

| Table | Columns read | Filter |
|---|---|---|
| `pulz_analyses` | `id, nace_division, nace_label_czech, publication_period, summary_text, published_at, pdf_storage_path, pdf_source_label` | `nace_division = $1 AND is_current = true AND status = 'published'` LIMIT 1 |
| `pulz_analysis_charts` | `slot_index, verdict, image_storage_path, image_mime_type, alt_text, caption, uses_cs_internal_data` | `analysis_id = $id` ORDER BY `slot_index` |
| `pulz_analysis_actions` | `slot_index, action_text, time_horizon` | `analysis_id = $id` ORDER BY `slot_index` |

`PulzAnalysisView` (the TypeScript type returned by `getCurrentPulzAnalysisForNace`) is
documented inline in `src/lib/pulz-analyses.ts`. It contains no `user_id`, `ico`, or
per-owner fields — confirmed by privacy invariant tests.

Signed URL TTL: 3600 s (1 hour). URLs are minted server-side at render time and
embedded directly in `<img src>` / `<a href>` props. They never persist in the DB.

---

## 5. Test plan

### Unit

`src/lib/pulz-analyses.test.ts` — no live DB, Supabase mocked via `vi.mock`.

| Area | What is tested |
|---|---|
| Privacy invariants | `PulzAnalysisView` and `PulzChartView` contain no `user_id`, `ico`, `owner_id`, `percentile`, `raw_value` |
| Stale threshold | >91 days = stale; 90 days = not stale; exactly 91 days = stale |
| Storage path helpers | `chartStoragePath`, `pdfStoragePath`, `mimeToExt` output patterns |
| Storage constants | `SIGNED_URL_TTL_SECONDS = 3600`; `CHART_MIME_ALLOW_LIST` excludes JPEG |
| `validateForPublish` (mirrors server route) | Valid full payload passes; each field rejects as expected (empty NACE, 3-digit NACE, empty period, <3 tiles, empty verdict, JPEG MIME, >2 MB chart, alt text <30 chars, generic "Graf." placeholder, `uses_cs_internal_data=true` without caption, empty summary, wrong PDF MIME, >20 MB PDF, missing pdf_source_label, 0 actions, 4 actions, invalid time_horizon, empty action_text) |
| Time horizons | All four Czech values accepted; English value rejected |
| Supersession model | Prior row `is_current` flips to false; conflict detection; `excludeId` idempotent re-publish |
| Czech month formatting | `formatCzechMonthYear` returns correct Czech genitive month name (January = "ledna", April = "dubna", December = "prosince") |

`src/supabase/migrations/0011_pulz_analyses.test.ts` — constant / invariant parity.

| Area | What is tested |
|---|---|
| `PULZ_TIME_HORIZONS` | Exactly the four frozen Czech values |
| `PULZ_CHART_MIME_TYPES` | Matches migration CHECK constraint |
| `PULZ_DATA_LANE` | `"brief"` |
| Cardinality | `PULZ_CHART_COUNT = 3`, `PULZ_ACTION_MIN = 1`, `PULZ_ACTION_MAX = 3` |
| Alt-text floor | `PULZ_ALT_TEXT_MIN_CHARS = 20` |
| Stale threshold | `PULZ_STALE_THRESHOLD_DAYS = 91`, `PULZ_STALE_THRESHOLD_MS` derived correctly |
| Privacy forbidden fields | `user_id`, `ico`, `owner_id` absent from type surface |
| Supersession model | Partial unique index invariant, soft-supersede state transitions |
| Czech month formatting | `formatCzechMonthYear` genitive cases |

### Integration

Not automated at MVP. Manual smoke test against Supabase project:

1. Run migration `0011_pulz_analyses.sql` on a local Supabase instance.
2. Insert a row via the admin `/new` form; confirm `is_current = true`.
3. Publish a second row for the same NACE; confirm prior row `is_current = false`,
   `superseded_at` and `superseded_by` are set.
4. Load the owner dashboard for the demo NACE; confirm the section renders the new
   row and the stale badge does not appear.
5. Delete the published row (only drafts are deletable — confirm 400 on published).

### End-to-end

Not automated at MVP. Covered by manual demo flow:

1. Create analysis via `/admin/pulz-oboru/new`, publish.
2. Load `/` as the demo owner; confirm Section 2 renders with chart tiles, summary,
   optional PDF link, and action box.
3. Set `published_at` to 92 days ago; reload `/`; confirm `StaleWarningBadge` appears.
4. Delete the published row (unblock by downgrading to draft first); reload `/`;
   confirm `EmptyStateCard` renders.

### Privacy invariant tests

In `src/lib/pulz-analyses.test.ts`:

- "PulzAnalysisView does not contain user_id, ico, or owner_id fields" — enforced by
  structural check on the TypeScript type interface.
- "PulzChartView does not have a percentile or raw_value field" — same structural check.
- `PULZ_DATA_LANE` constant must equal `"brief"` — tests that the migration's data_lane
  CHECK does not drift to another lane identifier.

---

## 6. Deployment + rollback

### Deploy

1. Run migration `src/supabase/migrations/0011_pulz_analyses.sql` against the target
   Supabase project (Supabase Dashboard → SQL Editor, or `supabase db push`).
   **Requires manual bucket creation** — see migration file header for the two
   `INSERT INTO storage.buckets` statements to run once.
2. Set env vars (already present for existing features):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Deploy the Next.js app via Vercel (push to branch; Vercel auto-deploys).
4. No seed data required — the section renders `EmptyStateCard` until an analyst
   creates the first publication via `/admin/pulz-oboru/new`.

### Rollback

1. Unpublish (downgrade to draft) any published Pulz oboru rows.
2. Remove the `<PulzOboruSection>` from `src/app/page.tsx` (or wrap behind a feature
   flag — see below).
3. Drop the three tables if a full data rollback is required:
   `DROP TABLE pulz_analysis_actions, pulz_analysis_charts, pulz_analyses;`
   This is destructive and loses all authored analyses. Only do this if the feature is
   being removed permanently.
4. Delete storage objects in `pulz-charts` and `pulz-pdfs` buckets manually via the
   Supabase Storage dashboard if needed.

### Feature flag

Name: `NEXT_PUBLIC_PULZ_OBORU_ENABLED`
Default: `true` (feature is on)
Kill-switch: set to `""` or `"false"` in Vercel env vars. Add a guard in
`src/components/pulz-oboru/PulzOboruSection.tsx`:
```tsx
if (!process.env.NEXT_PUBLIC_PULZ_OBORU_ENABLED || process.env.NEXT_PUBLIC_PULZ_OBORU_ENABLED === "false") {
  return null;
}
```
No feature flag is currently wired — add during Phase 3.2 hardening if needed.

---

## 7. Open questions

| ID | Question | Status |
|---|---|---|
| OQ-080 | `#888` contrast failure at 15 px normal — applied `#666` (5.74:1) to chart captions, PDF subline, and empty-state body. | **Closed** — applied in implementation |
| OQ-082 | Field-naming mismatch `data_source_is_cs` vs `uses_cs_internal_data` | **Closed** — `uses_cs_internal_data` throughout |
| OQ-083 | Manual save-as-draft vs. auto-save | **Closed** — manual save-as-draft implemented per PD recommendation (OQ-083 PM confirmation received per routing note in open-questions.md) |
| Q-POAL-001 | Modal component: library vs. custom | **Closed** — custom `role="dialog"` pattern (ADR-PO-002) |
| Q-POAL-002 | File-upload drop zone: library vs. CSS | **Closed** — CSS-only (ADR-PO-001) |
| Q-POAL-006 | Admin list page implementation detail | **Closed** — `src/app/admin/pulz-oboru/page.tsx` shipped |
| Q-POAL-007 | SVG security posture | **Closed** — `<img>` tag, not inline SVG (ADR-PO-003) |
| OQ-084 | Track C n8n pre-pop draft path — data contract for pre-populated drafts unspecified | Open — fold into OQ-068 at Track C spec gate |
| OQ-085 | `privacy-architecture.md` editorial addendum for two new pipelines | Open — DE to extend at next revision |

---

## Changelog

- 2026-04-28 — initial draft — engineer
