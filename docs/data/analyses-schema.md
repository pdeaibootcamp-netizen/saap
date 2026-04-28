# Pulz oboru — Analyses Schema and Storage Contract

*Owner: data-engineer · Slug: analyses-schema · Last updated: 2026-04-28*

---

## 1. Upstream links

- Product: [docs/product/pulz-oboru.md](../product/pulz-oboru.md) — §4.3 is the canonical content data contract this schema implements.
- Design: [docs/design/pulz-oboru.md](../design/pulz-oboru.md) — owner-facing surface; §4.2 chart tile, §4.5 action box, §5 copy.
- Admin design: `docs/design/pulz-oboru-admin.md` — **not yet landed at the time of writing**. This schema is designed to absorb a sensible analyst form without rework; if the admin spec lands and disagrees, see §10 reconciliation hooks.
- PRD sections: §1 (briefs as atomic unit), §7.1, §7.2, §7.3, §7.5 (privacy as product), §7.6, §8.1, §10 (data and technical foundation), §13.3.
- Data lane source of truth: [docs/data/privacy-architecture.md](privacy-architecture.md) §2 — Pulz oboru content lives in the `brief` lane only.
- Sibling data spec: [docs/data/analysis-pipeline-data.md](analysis-pipeline-data.md) — n8n Track C **draft generation** pipeline. Pulz oboru is a separate published-content type; relationship is described in §2 below.
- Existing brief storage: [src/lib/briefs.ts](../../src/lib/briefs.ts), [src/supabase/migrations/0002_briefs.sql](../../src/supabase/migrations/0002_briefs.sql).
- Decisions: [D-001](../project/decision-log.md) (hand-assigned cohorts on pre-populated data — same authoring posture for Pulz oboru), [D-002](../project/decision-log.md) (no RM lane at MVP), [D-006](../project/decision-log.md) (brief personalization grain = NACE only), [D-010](../project/decision-log.md) (canonical lane identifiers), [D-015](../project/decision-log.md) (frozen time-horizon enum), [D-018](../project/decision-log.md), [D-019](../project/decision-log.md), [D-020](../project/decision-log.md), [D-026](../project/decision-log.md), [D-027](../project/decision-log.md).
- Cross-cutting: [docs/project/open-questions.md](../project/open-questions.md) — OQ-077 (admin upload flow gate, this DE spec is its data half), OQ-078 (alt-text input contract), OQ-080 (color-ink-muted contrast).
- Build plan phase: v0.3 Track C, branch `trial-v0-3-analyzy`.

---

## 2. Schema purpose and relationship to existing brief and pipeline storage

Pulz oboru is the **first brief-lane content type with a structured publish-time payload** — three chart-tile records (image + verdict + caption + alt text), a summary text, an optional PDF attachment, and 1–3 actions, all keyed by `(NACE division, publication period)`. This is structurally different from the existing `briefs` table whose payload is a free-form `content_sections` JSONB plus a separate `benchmark_snippet`. Pulz oboru's payload is fixed-shape and rendering-layer-driven; it is not authored as a long-form document.

**Position taken: Pulz oboru is a new brief-lane content type, modelled in its own table family (`pulz_analyses` + `pulz_analysis_charts` + `pulz_analysis_actions`) — not an extension of `briefs`.** Reasoning:

1. **Different access pattern.** The owner-facing surface fetches *exactly one* analysis per (NACE × period), keyed by NACE; the briefs list reads many. The natural primary index differs.
2. **Different content shape.** A normalised chart-tile sub-table avoids stuffing a fixed-cardinality 3-element array into `content_sections` JSONB and re-using the brief's free-form schema for something the design spec hard-constrains to "exactly three". Hard constraints belong in DDL, not JSONB.
3. **Different authoring lifecycle.** Briefs have a `draft → published → archived` lifecycle plus version bumping on edit (per `0002_briefs.sql`). Pulz oboru's lifecycle at MVP is simpler: publish supersedes prior; no in-place editing of a published row (see §5 versioning).
4. **No automated brief generation crossover.** The n8n pipeline (`docs/data/analysis-pipeline-data.md`) writes into `briefs` via `app/api/admin/briefs/from-n8n/route.ts`. Pulz oboru is **not** produced by that pipeline; it is published directly by the analyst from the admin upload form (OQ-077). Coupling the two would entangle two unrelated authoring loops.
5. **Cold-start performance.** A NACE that has no Pulz oboru must resolve to "no row" in a single index probe (§7). Mixing it into `briefs` would force a `publish_state = 'published' AND content_sections @> '...'` query that is slower and obscures empty-state intent.

**Relationship to `analysis-pipeline-data.md`.** Both live in the brief lane; both key on `nace_division`. They never share rows. The n8n pipeline produces draft `briefs` rows that an analyst reviews and publishes to the **brief detail page** (`/brief/[id]`); Pulz oboru is published directly via the admin upload form to the **dashboard section** at `/`. Future increments may converge them; at MVP they are independent.

**Relationship to `briefs`.** No FK. A future content-management UI may want to surface "the brief detail page that links from this Pulz oboru's PDF" or vice versa, but at MVP the PDF link in Pulz oboru downloads a Storage object directly (see §4); it does not navigate to a brief page.

---

## 3. ERD and table-by-table specification

```
pulz_analyses (1) ────< (3) pulz_analysis_charts
       │
       └────────────< (1..3) pulz_analysis_actions
```

All three tables: lane = `brief`. RLS grants `brief_lane_role` only. No FK to `user_db`, `cohort_companies`, `consent_events`, or any rm_visible / credit_risk table. No `user_id`, `ico`, `recipient_id`, or any per-owner field on any of the three.

### 3.1 `pulz_analyses` — the publication header

| Field | Type | Constraints | Domain | May train? | RM-visible? | Retention | Notes |
|---|---|---|---|---|---|---|---|
| `id` | UUID | PK, `DEFAULT gen_random_uuid()` | brief | no | no | indefinite (versioned content) | Primary key. Stable across supersession of prior publications for the same NACE+period — each row is a distinct row. |
| `data_lane` | `data_lane` enum | NOT NULL, DEFAULT `'brief'`, CHECK `(data_lane = 'brief')` | brief | no | no | — | Lane-discipline column matching the convention from `0002_briefs.sql`. |
| `nace_division` | TEXT | NOT NULL, CHECK `(nace_division ~ '^\d{2}$')` | brief | no | no | indefinite | 2-digit NACE division. Same regex as `briefs.nace_sector` and `analysis_jobs.nace_division`. |
| `publication_period` | TEXT | NOT NULL | brief | no | no | indefinite | Free-form analyst-authored Czech period label, e.g. `"2. čtvrtletí 2026"`. Per PM §4.3 the analyst supplies this verbatim; we do not parse it. |
| `published_at` | TIMESTAMPTZ | NOT NULL, DEFAULT `now()` | brief | no | no | indefinite | Source of truth for the rendering layer's stale check (91 days per PM §4.5). |
| `is_current` | BOOLEAN | NOT NULL, DEFAULT `true` | brief | no | no | — | Soft-supersession flag (see §5). Exactly one `true` per `nace_division` enforced by partial unique index. |
| `superseded_at` | TIMESTAMPTZ | NULL | brief | no | no | — | Set when `is_current` flips from `true` to `false`. NULL for the current row. |
| `superseded_by` | UUID | NULL, REFERENCES `pulz_analyses(id)` ON DELETE SET NULL | brief | no | no | — | Pointer to the row that superseded this one. NULL for current and for never-superseded rows. |
| `nace_label_czech` | TEXT | NOT NULL | brief | no | no | indefinite | Czech NACE division name e.g. `"Výroba nábytku"`. Denormalised onto the row at publish time so the rendering layer does not need to join a NACE dictionary. Source of truth for the dictionary lives elsewhere (per `dashboard-v0-2.md` seed data); copy here is a snapshot. |
| `summary_text` | TEXT | NOT NULL, CHECK `(char_length(summary_text) BETWEEN 1 AND 4000)` | brief | no | no | indefinite | The 3–6 sentence summary block. Soft cap of 6 sentences enforced at the upload form (admin-flow scope). The 4000-char hard cap is a defence-in-depth ceiling — well above 6 sentences of Czech prose. |
| `pdf_storage_path` | TEXT | NULL | brief | no | no | indefinite | Storage bucket path (not a signed URL — see §4). NULL when analyst attaches no PDF (PM Q-PO-005: PDF optional). |
| `pdf_source_label` | TEXT | NULL, CHECK `(pdf_storage_path IS NULL OR pdf_source_label IS NOT NULL)` | brief | no | no | indefinite | E.g. `"Ekonomické a strategické analýzy České spořitelny"`. Required when PDF is present (PM §4.3). |
| `created_by` | TEXT | NOT NULL | brief | no | no | indefinite | Analyst identifier (email or Supabase auth UUID as text). Same shape as `briefs.author_id`. |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT `now()` | brief | no | no | indefinite | Row-creation timestamp; immutable. |

**Lane key:** `brief` only across all columns. Domain key per `privacy-architecture.md` §2. No column on this table is user-contributed, RM-visible, or credit-risk-derived. The schema **could not** mix lanes by accident — there is no FK, no JSONB blob with arbitrary keys, and no path from this row to any user_db column.

### 3.2 `pulz_analysis_charts` — the three tile records

One-to-many on `pulz_analyses` with cardinality enforced at exactly 3 per current row (see §3.4 invariant).

| Field | Type | Constraints | Domain | Notes |
|---|---|---|---|---|
| `id` | UUID | PK, `DEFAULT gen_random_uuid()` | brief | |
| `analysis_id` | UUID | NOT NULL, REFERENCES `pulz_analyses(id)` ON DELETE CASCADE | brief | When the parent row is deleted (rare — only for hard-rollback cases per §5), child rows go too. |
| `data_lane` | `data_lane` enum | NOT NULL, DEFAULT `'brief'`, CHECK `(data_lane = 'brief')` | brief | |
| `slot_index` | SMALLINT | NOT NULL, CHECK `(slot_index BETWEEN 1 AND 3)` | brief | Tile position 1–3. UNIQUE per `(analysis_id, slot_index)`. |
| `verdict` | TEXT | NOT NULL, CHECK `(char_length(verdict) BETWEEN 1 AND 280)` | brief | One-sentence verdict per design §4.2. Hard cap 280 chars is a defence-in-depth ceiling. Sentence count is enforced at upload-form input (admin-flow scope). |
| `image_storage_path` | TEXT | NOT NULL | brief | Path inside the chart-images bucket (see §4). Storing the path, not the signed URL — signing happens at render time. |
| `image_mime_type` | TEXT | NOT NULL, CHECK `(image_mime_type IN ('image/png','image/svg+xml','image/webp'))` | brief | Allow-list per §4.3. JPEG explicitly excluded — no photo content; chart images are vector or lossless raster. |
| `alt_text` | TEXT | NOT NULL, CHECK `(char_length(alt_text) >= 20)` | brief | OQ-078 — accessibility-mandatory. The 20-char floor blocks one-word placeholders like `"graf"`; substantive-prose enforcement is admin-form scope. |
| `caption` | TEXT | NULL | brief | Source attribution. Required at the upload form when the chart uses ČS internal data (PM Q-PO-004); the schema does not enforce this — the upload form does (admin-flow scope). |
| `uses_cs_internal_data` | BOOLEAN | NOT NULL, DEFAULT `false` | brief | Provenance flag per the orchestrator brief ("a flag on the chart row"). When `true` AND `caption IS NULL`, the upload form rejects the submission. The rendering layer can also use this flag for a "Zdroj: ČS" marker if §5.3 of the design spec evolves to require one. **This flag is a label about the source of the *aggregate macro data* shown — it does not turn this row into user-contributed-lane data.** Per `privacy-architecture.md` §3, ČS-aggregate transaction stats published by analyst-authored content are brief-lane-eligible (the publication is brief content; the underlying data is sector-aggregate, not per-owner). |

**Constraint summary:**
- `UNIQUE (analysis_id, slot_index)` — no two tiles in the same slot.
- `CHECK (slot_index BETWEEN 1 AND 3)` — three slots only.
- Cardinality "exactly 3" enforced at publish time (see §3.4) — not enforceable in DDL alone.

### 3.3 `pulz_analysis_actions` — the action box

| Field | Type | Constraints | Domain | Notes |
|---|---|---|---|---|
| `id` | UUID | PK, `DEFAULT gen_random_uuid()` | brief | |
| `analysis_id` | UUID | NOT NULL, REFERENCES `pulz_analyses(id)` ON DELETE CASCADE | brief | |
| `data_lane` | `data_lane` enum | NOT NULL, DEFAULT `'brief'`, CHECK `(data_lane = 'brief')` | brief | |
| `slot_index` | SMALLINT | NOT NULL, CHECK `(slot_index BETWEEN 1 AND 3)` | brief | Order 1–3, UNIQUE per `(analysis_id, slot_index)`. The 1–3 range matches PM §4.3 (1–3 actions per publication). |
| `action_text` | TEXT | NOT NULL, CHECK `(char_length(action_text) BETWEEN 1 AND 600)` | brief | Action body per design §4.5. |
| `time_horizon` | TEXT | NOT NULL, CHECK `(time_horizon IN ('Okamžitě','Do 3 měsíců','Do 12 měsíců','Více než rok'))` | brief | Frozen enum per [D-015](../project/decision-log.md). String literals match the existing `closing_actions[*].time_horizon` payload in `briefs.content_sections`. **Not** modelled as a Postgres enum because the brief-page schema already uses string literals and we keep the surface consistent — adding a Postgres enum would be a cross-feature change. The CHECK constraint enforces the four-value floor. |

**No `paired_observation_index`.** PM §4.3 explicitly states Pulz oboru actions are flat orphans — pairing model is not carried over. Schema reflects this.

**No `category` column.** The brief-page `ClosingAction.category` (D-011 four canonical categories) is not used by Pulz oboru per design §4.5 (orphan-action card pattern, no category surfacing). Adding it would invent product scope.

### 3.4 Publish-time invariants (enforced in application code, not DDL)

DDL cannot enforce "exactly 3 charts and 1–3 actions per row." These are enforced at the publish endpoint and re-asserted by a post-write integrity check:

```
A pulz_analyses row with is_current = true MUST satisfy:
  (SELECT count(*) FROM pulz_analysis_charts WHERE analysis_id = self.id) = 3
  AND
  (SELECT count(*) FROM pulz_analysis_actions WHERE analysis_id = self.id) BETWEEN 1 AND 3
```

The publish handler (engineer's lane) writes parent + 3 charts + 1–3 actions in a single transaction; the transaction commits only if all three counts hold. A nightly assertion job (operational, not request-path) re-checks this invariant for every `is_current = true` row. See §8 migration plan for the test that documents this contract.

### 3.5 Indexes

| Index | Purpose | Definition |
|---|---|---|
| `idx_pulz_analyses_current_by_nace` | **Primary access pattern** — fetch the current Pulz oboru for a NACE division in one probe. | `CREATE UNIQUE INDEX idx_pulz_analyses_current_by_nace ON pulz_analyses (nace_division) WHERE is_current = true;` Partial unique index doubles as the supersession-invariant guard: at most one current row per NACE, ever. |
| `idx_pulz_analyses_history` | Audit / rollback access to prior versions. | `CREATE INDEX idx_pulz_analyses_history ON pulz_analyses (nace_division, published_at DESC);` Covers `WHERE nace_division = $1 ORDER BY published_at DESC` — admin "history" view (deferred UI). |
| `idx_pulz_analysis_charts_by_analysis` | Render-time fetch of the 3 tiles for an analysis row. | `CREATE INDEX idx_pulz_analysis_charts_by_analysis ON pulz_analysis_charts (analysis_id, slot_index);` |
| `idx_pulz_analysis_actions_by_analysis` | Render-time fetch of 1–3 actions. | `CREATE INDEX idx_pulz_analysis_actions_by_analysis ON pulz_analysis_actions (analysis_id, slot_index);` |

The partial unique index on `(nace_division) WHERE is_current = true` is the load-bearing one. Cold-start awareness: a NACE with no Pulz oboru returns zero rows from a single B-tree probe. Negative result is constant-time. No need for a separate negative cache layer at MVP.

---

## 4. Storage contract for binary assets

Two new private Supabase Storage buckets. Both follow the `publications` bucket precedent established in `0008_analysis_jobs.sql` (manual creation in the Supabase dashboard; not creatable via SQL migration).

### 4.1 Buckets

| Bucket name | Public? | Purpose | Notes |
|---|---|---|---|
| `pulz-charts` | **OFF (private)** | Chart tile images (PNG/SVG/WebP). | Read access via signed URLs only. Write access from the admin upload pipeline (engineer lane). |
| `pulz-pdfs` | **OFF (private)** | Optional full-publication PDF attachments. | Same access model. |

**Why private, not public.** The publications themselves are bank-authored content the analyst opted to expose to consenting owners through the product surface. Public-bucket exposure (a.k.a. internet-discoverable URLs) bypasses the consent and access boundaries the dashboard enforces. Signed URLs with a short TTL keep the access traceable, render in the WebView without auth headaches, and let us rotate or revoke if a publication needs to be pulled. The cost is one signing call per render — acceptable at MVP volume.

**Why not the existing `publications` bucket** (used by `analysis_jobs` in `0008_analysis_jobs.sql`)? That bucket holds **input** to the n8n pipeline (DOCX/PDF the analyst uploads for AI summarisation). It has different lifecycle, different access patterns, and may be cleared after job completion. Pulz oboru's PDFs are **published outputs** retained indefinitely. Mixing them risks accidental cleanup of published content during n8n input-bucket housekeeping.

### 4.2 Object naming

```
pulz-charts/{analysis_id}/slot-{slot_index}.{ext}
  e.g. pulz-charts/3f9b…/slot-1.png

pulz-pdfs/{analysis_id}/publication.pdf
```

- `analysis_id` is the parent `pulz_analyses.id`, embedding the lifecycle relationship in the path. CASCADE-DELETE of the parent row is **not** automatic at the storage layer — Supabase Storage is independent of Postgres. The publish pipeline must clean up storage objects when a row is hard-deleted (rare per §5). The orphan-bucket cleanup is handled by an operational sweep job (engineer scope).
- Slot-indexed naming for charts means the row's `slot_index` is the source of truth; the path is derivable. If a chart is replaced during draft authoring (admin-flow scope), the upload pipeline overwrites the same key.
- Single fixed PDF name per analysis (`publication.pdf`) — there is at most one PDF per publication.
- File extensions in DDL are **not** the source of truth — the `image_mime_type` column on `pulz_analysis_charts` is. The path extension is for human debuggability of bucket listings; the rendering layer never parses the extension.

### 4.3 Allowed MIME types and size caps

**Charts:**
- Allowed: `image/png`, `image/svg+xml`, `image/webp`. Allow-list enforced by `pulz_analysis_charts.image_mime_type` CHECK constraint and re-validated at upload time.
- Disallowed: `image/jpeg` (lossy artefacts on flat-colour chart graphics), `image/gif` (no animated charts), all video and document MIME types.
- Max size: **2 MB per chart**. Chart PNGs at typical dashboard render sizes are well under 500 KB; 2 MB allows headroom for high-DPI exports without inviting accidental upload of full-resolution scans.

**PDFs:**
- Allowed: `application/pdf` only.
- Max size: **20 MB**. ČS analyst publications observed at ~1–5 MB; 20 MB ceiling matches the existing `publications` bucket convention (engineer scope — confirm).

Size caps are enforced at the upload-pipeline boundary (engineer's lane). They are **not** in DDL — Postgres has no native object-size constraint for external storage.

### 4.4 Signed URL policy

- **TTL: 1 hour** for chart images and PDFs at render time. Matches the n8n signed-URL TTL convention from `analysis-pipeline-data.md` §1.
- Signing happens server-side in the rendering layer (the read API in §6). The signed URL is included in the response payload to the React server component, which renders the `<img>` and `<a>` tags directly. No client-side signing.
- Client-side caching across the 1-hour window is fine; longer caches are not needed because the dashboard is server-rendered and re-renders on each page load at MVP.
- **No public URLs ever leave the server.** A leaked signed URL expires in 1 hour; a leaked public URL would be permanent.

### 4.5 Storage objects do not carry metadata that could leak into another lane

The chart image and the PDF have no embedded user-contributed-lane payload — they are sector-aggregate content the analyst authored. The upload form (admin-flow scope) must not allow analyst-authored content to embed per-owner data; this is an authoring-policy invariant, not a schema invariant. Logged for the admin spec.

---

## 5. Versioning and supersession on re-upload

**Position taken: soft-supersede (versioned), not hard-overwrite.** The orchestrator brief explicitly asked for a decision; this is it.

### 5.1 Mechanics

When the analyst uploads a new analysis for a NACE that already has a `is_current = true` row:

1. The publish transaction inserts a **new** `pulz_analyses` row with `is_current = true`.
2. The previously current row is updated: `is_current = false`, `superseded_at = now()`, `superseded_by = <new row id>`.
3. The partial unique index `idx_pulz_analyses_current_by_nace` enforces: only one `is_current = true` per NACE at any moment. The transaction either commits both changes atomically or fails — there is never a window with two current rows or zero current rows.
4. The new row's child charts and actions are inserted before commit.
5. The prior row's child charts and actions are **retained** (not cascade-deleted). They are still reachable via `analysis_id` for audit/rollback.
6. Storage objects of the prior row are **retained** by default. The audit-trail value of having the prior PDF and prior charts available outweighs the bucket-storage cost at MVP volume. A retention sweep is post-MVP; for now we keep everything.

### 5.2 Why soft-supersede over hard-overwrite

- **Audit trail.** ČS analyst-authored content is bank-published; the ability to answer "what did this NACE's Pulz oboru look like in Q1 vs Q2?" is a traceability property, not a feature. Hard-overwrite loses this by design.
- **Rollback.** If a publish goes out with a content error, an analyst-side rollback tool (post-MVP UI; data path exists at MVP) flips `is_current` back to the prior row in seconds. Hard-overwrite would force a re-upload of the corrected content from analyst notes.
- **Cost is negligible at MVP.** v0.3 NACE coverage is 31 + 49 (per [D-027](../project/decision-log.md)). Quarterly cadence × 2 NACEs × ~4 quarters/year = 8 rows/year. Bucket cost is ~tens of MB/year. The marginal storage and DB cost is dominated by the audit-trail benefit.
- **Reversibility.** Soft-supersede can later add a hard-purge sweep (e.g. "older than 18 months and not is_current → delete"). Hard-overwrite cannot retroactively recover history.

### 5.3 What the rendering layer sees

The read API in §6 always reads `WHERE is_current = true`. Prior rows are invisible to the owner-facing surface. The admin UI (when it exists per OQ-077) will read the full history.

### 5.4 Trade-off accepted

A NACE with a long history of misfires accumulates rows. At 8 rows/NACE/year × 100 NACEs (post-MVP) × 5 years = ~4000 rows — still trivial. If row count ever becomes load-bearing, a retention policy lifts old `is_current = false` rows out. Logged in §11.

---

## 6. Read API for the rendering layer

A single function on `src/lib/pulz-analyses.ts` (engineer creates this file; this spec is the contract).

### 6.1 Function signature

```ts
/**
 * Fetch the current Pulz oboru analysis for a NACE division, with all child
 * rows hydrated and binary-asset signed URLs minted.
 *
 * Lane: brief. Reads pulz_analyses + pulz_analysis_charts + pulz_analysis_actions
 * via the brief_lane_role REST connection. Mints 1-hour signed URLs for the
 * `pulz-charts` and `pulz-pdfs` buckets at fetch time.
 *
 * Returns null when no current analysis exists for the NACE — the rendering
 * layer interprets null as the EmptyStateCard.
 *
 * Throws on transport / DB error — the rendering layer catches and renders
 * the ErrorCard.
 */
export async function getCurrentPulzAnalysisForNace(
  naceDivision: string
): Promise<PulzAnalysisView | null>;

export interface PulzAnalysisView {
  id: string;
  naceDivision: string;
  naceLabelCzech: string;
  publicationPeriod: string;
  publishedAt: string;             // ISO 8601 — rendering layer formats Czech month
  summaryText: string;
  pdfUrl: string | null;            // 1-hour signed URL; null when no PDF attached
  pdfSourceLabel: string | null;
  charts: [PulzChartView, PulzChartView, PulzChartView]; // exactly 3, slot-ordered
  actions: PulzActionView[];        // 1–3 entries, slot-ordered
}

export interface PulzChartView {
  slotIndex: 1 | 2 | 3;
  verdict: string;
  imageUrl: string;                 // 1-hour signed URL
  altText: string;
  caption: string | null;
  usesCsInternalData: boolean;
}

export interface PulzActionView {
  slotIndex: 1 | 2 | 3;
  actionText: string;
  timeHorizon: "Okamžitě" | "Do 3 měsíců" | "Do 12 měsíců" | "Více než rok";
}
```

### 6.2 Behaviour

- The function performs **one** REST read against `pulz_analyses` filtered by `(nace_division = ? AND is_current = true)` LIMIT 1 — single index probe, returning at most one row.
- On hit, it performs two more REST reads for the joined `pulz_analysis_charts` and `pulz_analysis_actions` (engineer's choice: parallel `Promise.all` or one combined query). Either way, three reads total.
- Signed URLs for chart images and PDF are minted via the Supabase Storage REST API after the row reads complete. The function must not return paths or unsigned URLs.
- On miss (`naceDivision` has no current row), returns `null` after a single read. Negative result is fast.
- The function is read-only and does not write any row, audit log, or counter. View-tracking is out of scope.

### 6.3 Why this signature, not `getLatestAnalysisForNace`

The orchestrator brief offered `getLatestAnalysisForNace` as a sketch. **`getCurrent...`** is the precise verb because of the supersession model: "latest" is ambiguous when soft-superseded rows exist (latest by `published_at` is current under MVP; under any future "draft"-like state it could differ). `is_current = true` is the unambiguous, indexed predicate.

### 6.4 Caching

No application-level cache at MVP. The dashboard is server-rendered, the read is a single index probe, and the volume is low. If render times degrade, an LRU cache keyed by `nace_division` with a short TTL can be added without changing the function signature. Logged in §11.

---

## 7. Privacy-lane verification

### 7.1 Brief-lane sufficiency check

Every column on every Pulz oboru table is one of:

- **Authored content** (verdict, summary_text, action_text, alt_text, caption, nace_label_czech, publication_period, pdf_source_label) — analyst-typed strings. Brief lane.
- **Authored binary asset references** (image_storage_path, pdf_storage_path) — paths into private Supabase Storage buckets owned by the brief lane. Brief lane.
- **Lifecycle bookkeeping** (id, analysis_id, slot_index, is_current, superseded_at, superseded_by, published_at, created_at, created_by) — neither user-contributed nor derived from any other lane. Brief lane.
- **Categorical content tags** (data_lane = 'brief', uses_cs_internal_data, time_horizon, image_mime_type) — schema-level metadata. Brief lane.

There is **no field** that requires a `consent_event_id` FK. There is no field that holds an owner's `user_id` or `ico` or any per-firm financial value. There is no path from this schema into `user_db.owner_metrics`, `cohort_companies` per-row data, `consent_events`, or any rm_visible/credit_risk plane.

### 7.2 The one provenance-flag question worth naming

`pulz_analysis_charts.uses_cs_internal_data` is a flag *about* the macro source of the chart's underlying data, not a pointer to per-owner data. The chart image itself is a **sector-level aggregate** rendered from analyst's summary statistics — the same analyst-authored macro pattern that `cohort_aggregates` (per `0007_cohort_data.sql`) uses for cohort percentile snapshots. Per `privacy-architecture.md` §3 the `cohort_compute_batch` pipeline produces brief-lane-distributable aggregates from user_contributed-lane source data; that aggregation work happens *upstream* of the analyst's publication, in a separate analytics environment, and the resulting numbers reach Pulz oboru only through the analyst's authored chart image. **No per-owner data flows into or out of `pulz-charts` images at any point.** This is an authoring-policy invariant, additionally guarded by (a) the analyst review checklist (admin-flow scope) and (b) the bucket access model (private + signed URLs minted from brief-lane reads only).

If this invariant is ever in doubt for a specific publication — e.g., a chart that visualises a small sample where individual firms could be inferred — that is an authoring escalation, not a schema problem. Logged for the admin upload checklist (admin-flow scope).

### 7.3 Brief-lane allow-list — extension required?

The privacy-architecture allow-list (`privacy-architecture.md` §3) currently lists six MVP pipelines. Pulz oboru introduces:

- `pulz_analysis_publish` — admin upload form → `pulz_analyses` + child rows + storage buckets. Source: analyst input. Sink: `brief` lane only. **No new boundary crossed** — same shape as `brief_author_publish` from §3 of privacy-architecture.md.
- `pulz_analysis_render` — `pulz_analyses` + children → ephemeral signed URLs → server-rendered HTML. Source: `brief` lane. Sink: ephemeral render. **No new boundary crossed** — analogous to `brief_render_delivery` minus the `user_contributed → render` NACE lookup.

The dashboard server component that renders Pulz oboru *also* reads `user_contributed`-lane data for the active demo owner's NACE (the same pattern used by the existing dashboard tile grid). That cross-lane composition happens in the request handler, exactly as documented in `privacy-architecture.md` §3 and `analysis-pipeline-data.md` §3 — not inside this schema.

**Verdict: no extension to the brief-lane allow-list is required.** The existing `brief → brief` and `brief → (render)` entries cover both Pulz oboru pipelines. The privacy-architecture doc may want a one-line addendum for documentation completeness; that is editorial, not a privacy-architecture change. Recommend the addendum as a tidy-up in the next privacy-architecture revision.

### 7.4 Consent dependencies

**None directly imposed by this schema.** Pulz oboru content is brief-lane authored content; it does not depend on per-owner consent to *exist*. Per `privacy-architecture.md` §10 (consent-dependencies summary) and the parallel rule that `monthly-briefing-generation` requires a consent grant before brief delivery (because delivery personalises via NACE lookup), the **rendering** of Pulz oboru on the owner's dashboard inherits the dashboard's own consent gate. At v0.3 the demo owner is on the "demo bypass" path per `build-plan.md §10.3`; at MVP-real, the dashboard's existing consent check covers this section without modification.

This schema therefore introduces **no new consent event** and **no new consent copy**. Consent for Pulz oboru is fully covered by the existing single-opt-in (D-007) under the `brief` and `user_contributed` lane declarations the user already saw on the onboarding screen.

---

## 8. Migration plan

### 8.1 New migration files (per existing convention)

| File | Purpose | Idempotent? |
|---|---|---|
| `src/supabase/migrations/0011_pulz_analyses.sql` | Creates `pulz_analyses`, `pulz_analysis_charts`, `pulz_analysis_actions` tables; indexes; RLS policies; `brief_lane_role` grants. | Yes — every CREATE guarded by `IF NOT EXISTS` or `DO $$` block, matching the convention in `0001_init_lanes.sql`, `0002_briefs.sql`, `0008_analysis_jobs.sql`. |
| `src/supabase/migrations/0011_pulz_analyses.test.ts` | Vitest enum-invariant tests, mirroring the pattern in `0008_analysis_jobs.test.ts`. Asserts: (a) the four `time_horizon` values match the frozen enum; (b) the three permitted MIME types match the rendering layer's image-tag handling; (c) `data_lane` is `'brief'` only on all three tables; (d) the publish-time invariant is documented (3 charts, 1–3 actions). No live DB connection required. | n/a |

**Manual step required (cannot be done via SQL, same pattern as `0008_analysis_jobs.sql` for the `publications` bucket):**

> Create two private Supabase Storage buckets in the dashboard:
> - `pulz-charts` (Public: OFF)
> - `pulz-pdfs` (Public: OFF)
>
> Storage RLS policies for these buckets are defined manually in the Supabase dashboard at create time, granting service-role write access (for the upload pipeline) and signed-URL-only read access (no public read). The migration file's header comment block must surface this manual step prominently, exactly like `0008_analysis_jobs.sql` lines 13–20.

### 8.2 Migration ordering and dependencies

- `0011` follows the existing numerical sequence (`0010_cohort_companies_extended_financials.sql` is the latest landed migration). No conflicts; `0011` is additive only — no ALTER on existing tables, no new enum values, no rename.
- Depends on: `0001_init_lanes.sql` (`data_lane` enum, `brief_lane_role`).
- Does **not** depend on `0002_briefs.sql` (no FK to `briefs`).
- Does **not** depend on `0008_analysis_jobs.sql` (no FK to `analysis_jobs`).

### 8.3 Test convention

`0011_pulz_analyses.test.ts` mirrors `0008_analysis_jobs.test.ts`:

- `describe` blocks per CHECK constraint family.
- Frozen TS constants (e.g. `PULZ_TIME_HORIZONS`, `PULZ_CHART_MIME_TYPES`) that mirror the SQL CHECKs and serve as a trip-wire if the SQL drifts.
- Explicit "forbidden columns" test: the publish tables must not contain `user_id`, `ico`, `recipient_id`, `consent_event_id`, `raw_value`, or any column name matching the user-contributed/RM lanes' shapes. This is the same trip-wire pattern as `0008_analysis_jobs.test.ts` privacy-invariants block.
- Publish-invariant prose test (the "exactly 3 charts and 1–3 actions" rule cannot be enforced in DDL alone; the test documents that this is enforced in the application publish handler and re-asserted by an operational sweep — see §3.4).

### 8.4 Rollback

Hard rollback of `0011` is straightforward: `DROP TABLE pulz_analysis_actions, pulz_analysis_charts, pulz_analyses CASCADE; DROP INDEX ...`. CASCADE handles FKs. Storage buckets are not dropped automatically — operational step. At MVP this rollback is acceptable because no Pulz oboru content exists in production at the migration moment; data created after migration would be lost on rollback (an obvious property of any rollback of a content table).

---

## 9. Coordination with `/PD` (admin upload form)

The admin design at `docs/design/pulz-oboru-admin.md` has not landed at the time this spec is written. To minimise downstream rework, this schema makes the following assumptions about the upload form's shape; if `/PD` produces a form that contradicts these, escalate via OQ-077.

### 9.1 Assumed admin form structure

| Form section | Maps to | Notes |
|---|---|---|
| "Sektor a období" (NACE division dropdown + period free-text) | `pulz_analyses.nace_division`, `pulz_analyses.publication_period`, `pulz_analyses.nace_label_czech` (resolved server-side from NACE dictionary) | Single screen at top of form. |
| "Tři grafy" — three vertical sub-forms, one per `slot_index` | `pulz_analysis_charts` × 3 | Each sub-form: (image upload, alt text textarea, verdict text input, caption text input, "Používá interní data ČS?" checkbox). The checkbox writes `uses_cs_internal_data`. When checked AND caption empty → form-level submit error. |
| "Shrnutí" (summary textarea) | `pulz_analyses.summary_text` | Soft 6-sentence cap with a UI counter. Hard 4000-char cap from DDL. |
| "PDF (volitelné)" — file upload + source label input | `pulz_analyses.pdf_storage_path`, `pulz_analyses.pdf_source_label` | When file is uploaded, source label becomes required (DDL CHECK enforces this). |
| "Doporučené kroky" — 1–3 rows of (textarea + horizon dropdown) | `pulz_analysis_actions` | Plus/Remove buttons cap at 3. |
| "Publikovat" button | Triggers the publish transaction in §3.4. | Confirmation dialog shows "Tato analýza nahradí stávající Pulz oboru pro {nace_label}. Předchozí verze zůstane v archivu." |

### 9.2 Flagged contract concerns for `/PD`

If `/PD`'s form structure forces any of the following, escalate before implementation:

- **Flat fields requiring server-side splitting.** If the form posts a single "all three charts as one JSON blob" field, the server must split it into 3 child rows; this is mechanical but adds a parsing layer. Prefer 3 explicit chart sub-forms.
- **Grouping that doesn't match normalisation.** If actions are nested under a chart sub-form (e.g., "action paired with chart 1"), the schema's flat-orphan model is violated. The PM has explicitly resolved this — Pulz oboru actions are flat orphans (PM §4.3 pairing note). The form must match.
- **Edit-in-place of a published row.** If the form supports "edit this published Pulz oboru" rather than "publish a new version that supersedes," supersession semantics break. The schema is designed for supersession, not in-place edit. If `/PD` proposes in-place edit, escalate — the schema would need a `version` column on the parent row and a different invariant set.

---

## 10. Reconciliation hooks (when admin design lands)

When `docs/design/pulz-oboru-admin.md` lands, this section will be updated with reconciliation notes. Anchors to revisit:

- §3.4 publish-time invariant — confirm the form enforces "exactly 3 charts and 1–3 actions" client-side and the publish handler enforces it server-side.
- §4.3 size caps and MIME types — confirm the form's client-side validation matches the DDL allow-list and 2 MB / 20 MB ceilings.
- §5 supersession — confirm the form's "publish" verb means "publish-or-supersede" and the confirmation copy matches.
- §9.1 form-to-schema mapping — confirm the actual fields match the assumed mapping; flag drifts.

If `/PD`'s spec lands after this DE doc and disagrees with any of these, the data lane is the ground truth for the storage shape; the form must adapt or escalate. Schema changes to accommodate form decisions are a privacy-architecture-adjacent move and require explicit DE + orchestrator agreement.

---

## 11. Open questions

Numbered locally; orchestrator promotes to `docs/project/open-questions.md` if cross-cutting.

| Local ID | Question | Blocking |
|---|---|---|
| Q-PA-DE-001 | **Storage retention sweep policy for soft-superseded rows.** §5.4 accepts indefinite retention at MVP. At what NACE-coverage scale (or row-count threshold per NACE) should a retention sweep activate? Suggest revisit once per-NACE history exceeds 8 rows or after 18 months in production. | Non-blocking at MVP; logged for v0.4+ planning. |
| Q-PA-DE-002 | **Bucket-cleanup orphan sweep.** When a `pulz_analyses` row is hard-deleted (rare; rollback cases only), Supabase Storage objects are not auto-removed. An operational sweep job is needed eventually. Engineer scope when the deletion path becomes live. | Non-blocking at MVP. |
| Q-PA-DE-003 | **Publish-invariant nightly check.** §3.4 documents an operational sweep that re-asserts "every is_current row has exactly 3 charts and 1–3 actions". Tooling and alerting for this is engineer scope. The DE doc names the contract; ops implementation is pending. | Non-blocking at MVP volume; flag if Pulz oboru row count ever exceeds ~50. |
| Q-PA-DE-004 | **`uses_cs_internal_data` chart flag — UX surfacing on the rendering layer.** The flag exists on the schema; design §4.2 / PM Q-PO-004 only requires the analyst-authored caption. If a future iteration wants a separate visual marker on tiles using ČS-internal data (e.g., a "Zdroj: ČS" pill), the data is already there — no schema change needed. Non-action item; logged for forward-pointer. | Non-blocking. |
| Q-PA-DE-005 | **Privacy-architecture doc addendum.** §7.3 above suggests a one-line addendum to `privacy-architecture.md` §3 listing the two new pipelines (`pulz_analysis_publish`, `pulz_analysis_render`). This is editorial completeness, not a privacy-architecture change. Either the next privacy-architecture revision absorbs it or this DE doc serves as the canonical reference until then. | Non-blocking. |
| Q-PA-DE-006 | **Admin design (`docs/design/pulz-oboru-admin.md`) has not landed.** §9 documents assumed form structure; §10 lists reconciliation anchors. If `/PD`'s spec produces structural disagreement, schema review required. | Soft-blocking — engineer implementation can proceed against this DE spec but will need to adapt any UI-driven contract drift before the form goes live. |

---

## Changelog

- 2026-04-28 — initial draft. Schema, storage contract, supersession model, read API contract, privacy-lane verification, migration plan. Coordinates with admin design (not yet landed) via assumed-mapping in §9 and reconciliation hooks in §10. Position taken: new content type (not a `briefs` extension); soft-supersede (not hard-overwrite); private buckets with 1-hour signed URLs. No new consent dependency; no extension to the privacy-architecture brief-lane allow-list required. Closes the data-engineering half of OQ-077. — data-engineer
