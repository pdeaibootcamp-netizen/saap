-- ============================================================
-- 0011_pulz_analyses.sql
-- Strategy Radar v0.3 Track C — Pulz oboru published-analysis tables
--
-- Creates:
--   - pulz_analyses         — publication header, one row per (NACE × period)
--   - pulz_analysis_charts  — exactly 3 chart-tile rows per analysis
--   - pulz_analysis_actions — 1–3 action rows per analysis
--
-- All three tables: lane = 'brief' only. No FK to user_db, cohort_companies,
-- consent_events, or any rm_visible / credit_risk table. No user_id, ico,
-- or recipient_id on any row.
--
-- MANUAL STEPS REQUIRED (cannot be done via SQL):
--   Create two private Supabase Storage buckets in the Supabase dashboard:
--
--   1. Storage → New bucket → Name: pulz-charts  → Public: OFF (private)
--      Purpose: chart tile images (PNG / SVG / WebP) for Pulz oboru sections.
--      Storage RLS: service-role write; signed-URL-only read (no public read).
--
--   2. Storage → New bucket → Name: pulz-pdfs  → Public: OFF (private)
--      Purpose: optional full-publication PDF attachments for Pulz oboru.
--      Storage RLS: same as pulz-charts.
--
--   These buckets are separate from the existing 'publications' bucket
--   (which holds n8n pipeline input artefacts — different lifecycle).
--   See docs/data/analyses-schema.md §4.1 for rationale.
--
-- Idempotent: every CREATE guarded by IF NOT EXISTS or DO $$ block,
-- matching the convention in 0001_init_lanes.sql, 0002_briefs.sql,
-- 0008_analysis_jobs.sql.
--
-- Depends on: 0001_init_lanes.sql (data_lane enum, brief_lane_role)
-- Does NOT depend on: 0002_briefs.sql, 0008_analysis_jobs.sql
-- ============================================================


-- ----------------------------------------------------------------
-- 1. pulz_analyses — publication header
-- ----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS pulz_analyses (
  -- Primary key — stable per row; each re-publish creates a new row.
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Lane enforcement. Always 'brief'.
  data_lane         data_lane   NOT NULL DEFAULT 'brief'
                                CHECK (data_lane = 'brief'),

  -- NACE 2-digit division code. E.g. '31' (furniture), '49' (road freight).
  nace_division     TEXT        NOT NULL
                                CHECK (nace_division ~ '^\d{2}$'),

  -- Czech NACE division label. Denormalised at publish time so the rendering
  -- layer needs no NACE-dictionary join. E.g. 'Výroba nábytku'.
  nace_label_czech  TEXT        NOT NULL,

  -- Analyst-authored Czech period label. Rendered verbatim.
  -- E.g. '2. čtvrtletí 2026'.
  publication_period TEXT       NOT NULL,

  -- Moment the analysis went live. Source of truth for the 91-day stale check.
  published_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Soft-supersession flag. Exactly ONE true row per nace_division,
  -- enforced by the partial unique index defined below.
  is_current        BOOLEAN     NOT NULL DEFAULT true,

  -- Set when this row is superseded (is_current flips to false).
  superseded_at     TIMESTAMPTZ,

  -- FK to the row that superseded this one. NULL for the current row
  -- and for rows that were never superseded.
  superseded_by     UUID        REFERENCES pulz_analyses(id) ON DELETE SET NULL,

  -- 3–6 sentence plain-Czech synthesis. Hard cap 4000 chars.
  summary_text      TEXT        NOT NULL
                                CHECK (char_length(summary_text) BETWEEN 1 AND 4000),

  -- Storage bucket path for the optional full-publication PDF.
  -- NULL when no PDF attached (PM Q-PO-005: PDF is optional).
  -- Format: {analysis_id}/publication.pdf
  pdf_storage_path  TEXT,

  -- Source attribution for the PDF link subline.
  -- E.g. 'Ekonomické a strategické analýzy České spořitelny'.
  -- Required when pdf_storage_path is non-NULL (CHECK enforces this).
  pdf_source_label  TEXT        CHECK (pdf_storage_path IS NULL OR pdf_source_label IS NOT NULL),

  -- Analyst identifier (email or Supabase auth UUID as text).
  created_by        TEXT        NOT NULL,

  -- Row-creation timestamp; immutable.
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Lifecycle status: 'draft' while the analyst is authoring; 'published'
  -- once the analysis is visible to owners.
  status            TEXT        NOT NULL DEFAULT 'draft'
                                CHECK (status IN ('draft', 'published'))
);

-- ── Indexes ──────────────────────────────────────────────────────────────────

-- Primary access pattern: fetch the current analysis for a NACE in one probe.
-- The partial unique index also enforces the supersession invariant:
-- at most one is_current = true row per nace_division, ever.
CREATE UNIQUE INDEX IF NOT EXISTS idx_pulz_analyses_current_by_nace
  ON pulz_analyses (nace_division)
  WHERE is_current = true;

-- Audit / rollback: history of all versions for a NACE, newest first.
CREATE INDEX IF NOT EXISTS idx_pulz_analyses_history
  ON pulz_analyses (nace_division, published_at DESC);

-- Admin list view: find all drafts for a given NACE.
CREATE INDEX IF NOT EXISTS idx_pulz_analyses_status
  ON pulz_analyses (status, nace_division);


-- ----------------------------------------------------------------
-- 2. pulz_analysis_charts — the three chart-tile records
-- ----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS pulz_analysis_charts (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Parent analysis. CASCADE-DELETE removes chart rows when the analysis is
  -- hard-deleted (rare; rollback cases only — see docs/data/analyses-schema.md §5).
  analysis_id       UUID        NOT NULL
                                REFERENCES pulz_analyses(id) ON DELETE CASCADE,

  data_lane         data_lane   NOT NULL DEFAULT 'brief'
                                CHECK (data_lane = 'brief'),

  -- Tile position 1–3. UNIQUE per (analysis_id, slot_index).
  slot_index        SMALLINT    NOT NULL
                                CHECK (slot_index BETWEEN 1 AND 3),

  -- One-sentence verdict rendered above the chart image.
  -- Hard cap 280 chars. Sentence-count enforcement is admin-form scope.
  verdict           TEXT        NOT NULL
                                CHECK (char_length(verdict) BETWEEN 1 AND 280),

  -- Storage bucket path inside pulz-charts bucket.
  -- Format: {analysis_id}/slot-{slot_index}.{ext}
  image_storage_path TEXT       NOT NULL,

  -- MIME type of the uploaded chart image.
  -- Allow-list: PNG, SVG, WebP. JPEG excluded (lossy artefacts on charts).
  image_mime_type   TEXT        NOT NULL
                                CHECK (image_mime_type IN (
                                  'image/png',
                                  'image/svg+xml',
                                  'image/webp'
                                )),

  -- Accessibility-mandatory alt text. 20-char floor blocks one-word placeholders.
  -- The upload form enforces the 30-char soft floor and the "no generic placeholder"
  -- rule (admin-flow scope). OQ-078.
  alt_text          TEXT        NOT NULL
                                CHECK (char_length(alt_text) >= 20),

  -- Analyst-authored source attribution rendered below the chart.
  -- Required at the upload form when uses_cs_internal_data = true (PM Q-PO-004).
  -- The schema does not enforce this — the upload form does.
  caption           TEXT,

  -- Provenance flag. True when the chart is derived from ČS internal data
  -- (e.g. card-transaction aggregates). Used by the upload form to require
  -- a caption. Not a lane-crossing flag — this row is brief-lane content.
  uses_cs_internal_data BOOLEAN NOT NULL DEFAULT false,

  -- Enforce exactly 3 tiles per analysis, each in a distinct slot.
  UNIQUE (analysis_id, slot_index)
);

-- Render-time fetch of the 3 tiles for an analysis, ordered by slot.
CREATE INDEX IF NOT EXISTS idx_pulz_analysis_charts_by_analysis
  ON pulz_analysis_charts (analysis_id, slot_index);


-- ----------------------------------------------------------------
-- 3. pulz_analysis_actions — the action box (1–3 per analysis)
-- ----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS pulz_analysis_actions (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  analysis_id       UUID        NOT NULL
                                REFERENCES pulz_analyses(id) ON DELETE CASCADE,

  data_lane         data_lane   NOT NULL DEFAULT 'brief'
                                CHECK (data_lane = 'brief'),

  -- Order 1–3. The 1–3 range matches PM §4.3 (1–3 actions per publication).
  slot_index        SMALLINT    NOT NULL
                                CHECK (slot_index BETWEEN 1 AND 3),

  -- Action body text. Opportunity-framed per PRD §7.6.
  action_text       TEXT        NOT NULL
                                CHECK (char_length(action_text) BETWEEN 1 AND 600),

  -- Frozen time-horizon enum (D-015). String literals match the existing
  -- closing_actions[*].time_horizon payload in briefs.content_sections.
  -- Not modelled as a Postgres enum to keep the surface consistent with briefs.
  time_horizon      TEXT        NOT NULL
                                CHECK (time_horizon IN (
                                  'Okamžitě',
                                  'Do 3 měsíců',
                                  'Do 12 měsíců',
                                  'Více než rok'
                                )),

  -- No paired_observation_index — Pulz oboru actions are flat orphans (PM §4.3).
  -- No category column — the orphan-action card pattern does not surface category.

  UNIQUE (analysis_id, slot_index)
);

-- Render-time fetch of 1–3 actions for an analysis, ordered by slot.
CREATE INDEX IF NOT EXISTS idx_pulz_analysis_actions_by_analysis
  ON pulz_analysis_actions (analysis_id, slot_index);


-- ----------------------------------------------------------------
-- 4. RLS — brief_lane_role only on all three tables
--
-- user_contributed_lane_role gets NO grants (same rationale as
-- analysis_jobs in 0008_analysis_jobs.sql: these are analyst artefacts,
-- not owner data).
-- ----------------------------------------------------------------

-- pulz_analyses RLS
ALTER TABLE pulz_analyses ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'pulz_analyses'
      AND policyname = 'pulz_analyses_brief_lane_select'
  ) THEN
    CREATE POLICY pulz_analyses_brief_lane_select ON pulz_analyses
      FOR SELECT TO brief_lane_role
      USING (data_lane = 'brief');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'pulz_analyses'
      AND policyname = 'pulz_analyses_brief_lane_insert'
  ) THEN
    CREATE POLICY pulz_analyses_brief_lane_insert ON pulz_analyses
      FOR INSERT TO brief_lane_role
      WITH CHECK (data_lane = 'brief');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'pulz_analyses'
      AND policyname = 'pulz_analyses_brief_lane_update'
  ) THEN
    CREATE POLICY pulz_analyses_brief_lane_update ON pulz_analyses
      FOR UPDATE TO brief_lane_role
      USING (data_lane = 'brief')
      WITH CHECK (data_lane = 'brief');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'pulz_analyses'
      AND policyname = 'pulz_analyses_brief_lane_delete'
  ) THEN
    CREATE POLICY pulz_analyses_brief_lane_delete ON pulz_analyses
      FOR DELETE TO brief_lane_role
      USING (data_lane = 'brief');
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON pulz_analyses TO brief_lane_role;

-- pulz_analysis_charts RLS
ALTER TABLE pulz_analysis_charts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'pulz_analysis_charts'
      AND policyname = 'pulz_analysis_charts_brief_lane_select'
  ) THEN
    CREATE POLICY pulz_analysis_charts_brief_lane_select ON pulz_analysis_charts
      FOR SELECT TO brief_lane_role
      USING (data_lane = 'brief');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'pulz_analysis_charts'
      AND policyname = 'pulz_analysis_charts_brief_lane_insert'
  ) THEN
    CREATE POLICY pulz_analysis_charts_brief_lane_insert ON pulz_analysis_charts
      FOR INSERT TO brief_lane_role
      WITH CHECK (data_lane = 'brief');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'pulz_analysis_charts'
      AND policyname = 'pulz_analysis_charts_brief_lane_update'
  ) THEN
    CREATE POLICY pulz_analysis_charts_brief_lane_update ON pulz_analysis_charts
      FOR UPDATE TO brief_lane_role
      USING (data_lane = 'brief')
      WITH CHECK (data_lane = 'brief');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'pulz_analysis_charts'
      AND policyname = 'pulz_analysis_charts_brief_lane_delete'
  ) THEN
    CREATE POLICY pulz_analysis_charts_brief_lane_delete ON pulz_analysis_charts
      FOR DELETE TO brief_lane_role
      USING (data_lane = 'brief');
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON pulz_analysis_charts TO brief_lane_role;

-- pulz_analysis_actions RLS
ALTER TABLE pulz_analysis_actions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'pulz_analysis_actions'
      AND policyname = 'pulz_analysis_actions_brief_lane_select'
  ) THEN
    CREATE POLICY pulz_analysis_actions_brief_lane_select ON pulz_analysis_actions
      FOR SELECT TO brief_lane_role
      USING (data_lane = 'brief');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'pulz_analysis_actions'
      AND policyname = 'pulz_analysis_actions_brief_lane_insert'
  ) THEN
    CREATE POLICY pulz_analysis_actions_brief_lane_insert ON pulz_analysis_actions
      FOR INSERT TO brief_lane_role
      WITH CHECK (data_lane = 'brief');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'pulz_analysis_actions'
      AND policyname = 'pulz_analysis_actions_brief_lane_update'
  ) THEN
    CREATE POLICY pulz_analysis_actions_brief_lane_update ON pulz_analysis_actions
      FOR UPDATE TO brief_lane_role
      USING (data_lane = 'brief')
      WITH CHECK (data_lane = 'brief');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'pulz_analysis_actions'
      AND policyname = 'pulz_analysis_actions_brief_lane_delete'
  ) THEN
    CREATE POLICY pulz_analysis_actions_brief_lane_delete ON pulz_analysis_actions
      FOR DELETE TO brief_lane_role
      USING (data_lane = 'brief');
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON pulz_analysis_actions TO brief_lane_role;


-- ----------------------------------------------------------------
-- 5. Comment — what is NOT stored here (privacy invariant)
--
-- pulz_analyses, pulz_analysis_charts, pulz_analysis_actions
-- intentionally do NOT store:
--   - user_id, ico, owner_id, recipient_id — no per-owner fields.
--   - consent_event_id — no consent dependency in the schema.
--   - raw financial values — no raw_value, no percentile fields.
--   - any FK to user_db, cohort_companies, or any rm_visible /
--     credit_risk table.
--
-- uses_cs_internal_data is a flag about the macro source of the
-- sector-aggregate data shown in the chart — it is NOT a pointer to
-- per-owner data and does NOT make this row user-contributed-lane data.
-- See docs/data/analyses-schema.md §7.2.
-- ----------------------------------------------------------------
