-- ============================================================
-- 0008_analysis_jobs.sql
-- Strategy Radar v0.3 Track C — Analysis automation job table
--
-- Creates:
--   - analysis_jobs — tracks n8n publication-analysis pipeline jobs
--
-- This table is in the 'brief' data lane (ADR-N8N-03).
-- RLS is enabled; brief_lane_role may SELECT/INSERT/UPDATE.
-- user_contributed_lane_role has no grants (intentional —
-- ADR-N8N-03: the job is an analyst artifact, not owner data).
--
-- MANUAL STEP REQUIRED (cannot be done via SQL):
--   Create Supabase Storage bucket 'publications' in the Supabase dashboard:
--   Storage → New bucket → Name: publications → Public: OFF (private).
--   This bucket stores the uploaded PDF/DOCX files that n8n fetches
--   via signed URLs. See docs/engineering/n8n-integration.md ADR-N8N-02.
--
-- Idempotent: guarded by IF NOT EXISTS and DO $$ blocks.
-- Depends on: 0001_init_lanes.sql (data_lane enum, brief_lane_role)
--             0002_briefs.sql (briefs table for FK)
-- ============================================================

-- ----------------------------------------------------------------
-- 1. analysis_jobs table
-- ----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS analysis_jobs (
  -- Primary key
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Job lifecycle state.
  -- queued:  job row created, webhook fired to n8n (or about to be)
  -- running: n8n has acknowledged and is processing (not currently set by app;
  --          reserved for future n8n progress callbacks)
  -- done:    n8n callback received with status='done'; brief row created
  -- failed:  n8n callback received with status='failed'; error captured
  status         TEXT        NOT NULL DEFAULT 'queued'
                             CHECK (status IN ('queued','running','done','failed')),

  -- Supabase Storage path (not the signed URL — that changes per signing call).
  -- Format: {jobId}-{filename}, e.g. "uuid4-sectors-q1-2026.pdf"
  file_path      TEXT        NOT NULL,

  -- NACE 2-digit division code (matches briefs.nace_sector format).
  nace_division  TEXT        NOT NULL
                             CHECK (nace_division ~ '^\d{2}$'),

  -- Whether the analyst opted to include the active demo owner's metric snapshot.
  -- Only a boolean — the snapshot itself is NOT stored here (ADR-N8N-03).
  snapshot_used  BOOLEAN     NOT NULL DEFAULT false,

  -- Foreign key to the brief created on completion. Null until status='done'.
  brief_id       UUID        REFERENCES briefs(id) ON DELETE SET NULL,

  -- Error message from n8n when status='failed'.
  error          TEXT,

  -- Timestamps
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at   TIMESTAMPTZ,          -- Set when status transitions to done or failed.

  -- Lane enforcement (ADR-0002-C / D-010). Always 'brief'.
  -- analyst job records live in the brief lane.
  data_lane      data_lane   NOT NULL DEFAULT 'brief'
                             CHECK (data_lane = 'brief')
);

-- Index: analyst polling by job ID is always a PK lookup; secondary index
-- on status lets background sweeps and monitoring queries run efficiently.
CREATE INDEX IF NOT EXISTS idx_analysis_jobs_status
  ON analysis_jobs (status);

-- Index: look up the job that produced a given brief (for audit / re-link).
CREATE INDEX IF NOT EXISTS idx_analysis_jobs_brief_id
  ON analysis_jobs (brief_id)
  WHERE brief_id IS NOT NULL;

-- ----------------------------------------------------------------
-- 2. RLS on analysis_jobs — brief_lane_role only
-- ----------------------------------------------------------------

ALTER TABLE analysis_jobs ENABLE ROW LEVEL SECURITY;

-- SELECT: brief_lane_role can read brief-lane job rows.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'analysis_jobs' AND policyname = 'analysis_jobs_brief_lane_select'
  ) THEN
    CREATE POLICY analysis_jobs_brief_lane_select ON analysis_jobs
      FOR SELECT TO brief_lane_role
      USING (data_lane = 'brief');
  END IF;
END $$;

-- INSERT: brief_lane_role may create new job rows.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'analysis_jobs' AND policyname = 'analysis_jobs_brief_lane_insert'
  ) THEN
    CREATE POLICY analysis_jobs_brief_lane_insert ON analysis_jobs
      FOR INSERT TO brief_lane_role
      WITH CHECK (data_lane = 'brief');
  END IF;
END $$;

-- UPDATE: brief_lane_role may update status, brief_id, error, completed_at.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'analysis_jobs' AND policyname = 'analysis_jobs_brief_lane_update'
  ) THEN
    CREATE POLICY analysis_jobs_brief_lane_update ON analysis_jobs
      FOR UPDATE TO brief_lane_role
      USING (data_lane = 'brief')
      WITH CHECK (data_lane = 'brief');
  END IF;
END $$;

-- Grant table-level privileges to brief_lane_role.
-- user_contributed_lane_role gets NO grants intentionally (ADR-N8N-03).
GRANT SELECT, INSERT, UPDATE ON analysis_jobs TO brief_lane_role;

-- ----------------------------------------------------------------
-- 3. Comment — what is NOT stored here (privacy invariant)
--
-- analysis_jobs intentionally does NOT store:
--   - The owner's raw financial values (raw_value).
--   - The owner's IČO, user_id, or any personally identifying field.
--   - The ownerMetricSnapshot payload sent to n8n — this is in-process only.
--
-- 'snapshot_used' (boolean) is the only pointer back to the user_contributed
-- lane; it is intentionally NOT a foreign key. Once the job is done, the
-- snapshot itself is discarded. See docs/data/analysis-pipeline-data.md §3.
-- ----------------------------------------------------------------
