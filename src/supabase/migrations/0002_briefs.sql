-- ============================================================
-- 0002_briefs.sql
-- Strategy Radar MVP — Brief and delivery tables
--
-- Creates:
--   - briefs — authored brief records (ADR-0002-B)
--   - brief_deliveries — delivery audit log (ADR-0002-B)
--
-- Both tables are in the 'brief' data lane (ADR-0002-C / D-010).
-- RLS is enabled; brief_lane_role may SELECT/INSERT/UPDATE.
-- No other role may access these tables (except superuser for admin ops).
--
-- Idempotent: guarded by IF NOT EXISTS.
-- Depends on: 0001_init_lanes.sql (data_lane enum, publish_state enum,
--             delivery_format enum, brief_lane_role).
-- ============================================================

-- ----------------------------------------------------------------
-- 1. briefs table
-- ----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS briefs (
  -- Primary key
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Lane enforcement (ADR-0002-C / D-010). Always 'brief'.
  data_lane         data_lane   NOT NULL DEFAULT 'brief'
                                CHECK (data_lane = 'brief'),

  -- Targeting grain: NACE 2-digit division code (cohort-math.md §2.1 / D-006).
  -- E.g., '10' = Manufacture of food products, '46' = Wholesale trade.
  nace_sector       TEXT        NOT NULL
                                CHECK (nace_sector ~ '^\d{2}$'),

  -- Brief lifecycle state (ADR-0002-B).
  publish_state     publish_state NOT NULL DEFAULT 'draft',

  -- Monotonically incrementing version counter (ADR-0002-D).
  -- Starts at 1 on first save; incremented on each subsequent save.
  version           INTEGER     NOT NULL DEFAULT 1
                                CHECK (version >= 1),

  -- Authorship — analyst identifier (email or Supabase auth user UUID as text).
  author_id         TEXT        NOT NULL,

  -- Timestamps
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at      TIMESTAMPTZ,           -- Set on first publish; null while draft.

  -- Content sections — array of section objects per information-architecture.md §2.
  -- Schema: [{ section_id, heading, body, order }]
  -- Mandatory section_ids at MVP: 'sector-context', 'observations', 'actions'.
  -- Validated by the analyst back-end before publish is allowed (ADR-0002-B).
  content_sections  JSONB       NOT NULL DEFAULT '[]'::jsonb,

  -- Benchmark snippet — cohort-aggregate outputs embedded at publish time.
  -- Schema per ADR-0002-B: { cohort_id, resolved_at, metrics: [...] }
  -- Does NOT contain individual client financial data — cohort aggregates only.
  -- Null until publish pipeline resolves the cohort (ADR-0002-E).
  benchmark_snippet JSONB,

  -- Enforce: published briefs must have a published_at timestamp.
  CONSTRAINT published_has_timestamp
    CHECK (
      publish_state != 'published'
      OR published_at IS NOT NULL
    )
);

-- Index: analysts and the delivery pipeline look up briefs by NACE sector.
CREATE INDEX IF NOT EXISTS idx_briefs_nace_sector
  ON briefs (nace_sector);

-- Index: common query — published briefs only, ordered by publication date.
CREATE INDEX IF NOT EXISTS idx_briefs_published
  ON briefs (publish_state, published_at DESC)
  WHERE publish_state = 'published';

-- ----------------------------------------------------------------
-- 2. RLS on briefs — brief_lane_role only sees brief-lane rows
-- ----------------------------------------------------------------

ALTER TABLE briefs ENABLE ROW LEVEL SECURITY;

-- brief_lane_role: full CRUD on brief-lane rows only.
-- The CHECK constraint (data_lane = 'brief') makes the WHERE clause
-- redundant but we include it explicitly for defence-in-depth.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'briefs' AND policyname = 'brief_lane_role_select'
  ) THEN
    CREATE POLICY brief_lane_role_select ON briefs
      FOR SELECT TO brief_lane_role
      USING (data_lane = 'brief');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'briefs' AND policyname = 'brief_lane_role_insert'
  ) THEN
    CREATE POLICY brief_lane_role_insert ON briefs
      FOR INSERT TO brief_lane_role
      WITH CHECK (data_lane = 'brief');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'briefs' AND policyname = 'brief_lane_role_update'
  ) THEN
    CREATE POLICY brief_lane_role_update ON briefs
      FOR UPDATE TO brief_lane_role
      USING (data_lane = 'brief')
      WITH CHECK (data_lane = 'brief');
  END IF;
END $$;

-- Grant table-level privileges (RLS policies narrow to lane-level rows).
GRANT SELECT, INSERT, UPDATE ON briefs TO brief_lane_role;

-- ----------------------------------------------------------------
-- 3. brief_deliveries table — delivery audit log
-- ----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS brief_deliveries (
  -- Primary key
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Lane enforcement (ADR-0002-C / D-010). Always 'brief'.
  data_lane       data_lane     NOT NULL DEFAULT 'brief'
                                CHECK (data_lane = 'brief'),

  -- Brief reference
  brief_id        UUID          NOT NULL REFERENCES briefs (id) ON DELETE RESTRICT,

  -- Version snapshot at delivery time (ADR-0002-D).
  -- Allows answering "which version of this brief did this recipient receive?"
  brief_version   INTEGER       NOT NULL CHECK (brief_version >= 1),

  -- Recipient identifier — anonymous trial ID or George token subject.
  -- Not a FK to a users table at scaffold stage; user table comes in Phase 2
  -- when sector-profile-configuration is implemented.
  recipient_id    TEXT          NOT NULL,

  -- Delivery format
  format          delivery_format NOT NULL,

  -- Timestamp
  delivered_at    TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- Index: look up all deliveries for a brief (for the analyst publish status view).
CREATE INDEX IF NOT EXISTS idx_brief_deliveries_brief_id
  ON brief_deliveries (brief_id, delivered_at DESC);

-- Index: look up all deliveries for a recipient (for the owner's history view, Phase 2+).
CREATE INDEX IF NOT EXISTS idx_brief_deliveries_recipient
  ON brief_deliveries (recipient_id, delivered_at DESC);

-- ----------------------------------------------------------------
-- 4. RLS on brief_deliveries
-- ----------------------------------------------------------------

ALTER TABLE brief_deliveries ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'brief_deliveries' AND policyname = 'brief_lane_role_select'
  ) THEN
    CREATE POLICY brief_lane_role_select ON brief_deliveries
      FOR SELECT TO brief_lane_role
      USING (data_lane = 'brief');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'brief_deliveries' AND policyname = 'brief_lane_role_insert'
  ) THEN
    CREATE POLICY brief_lane_role_insert ON brief_deliveries
      FOR INSERT TO brief_lane_role
      WITH CHECK (data_lane = 'brief');
  END IF;
END $$;

GRANT SELECT, INSERT ON brief_deliveries TO brief_lane_role;

-- ----------------------------------------------------------------
-- 5. Comment — what is NOT stored here (privacy invariant)
--
-- The briefs table stores ONLY:
--   - Analyst-authored content (no per-user financial data).
--   - Cohort-AGGREGATE benchmark data (no individual user rows).
--
-- Individual client financial data (P&L, balance sheet) lives in
-- user_contributed lane (user_db). The benchmark_snippet column carries
-- only cohort-level percentile snapshots — never a per-user row.
-- Audit queries on this table cannot reconstruct any individual's financials.
-- Ref: privacy-architecture.md §2, §3 (cohort_compute_batch pipeline).
-- ----------------------------------------------------------------
