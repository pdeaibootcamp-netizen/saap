-- ============================================================
-- 0006_owner_metrics.sql
-- Strategy Radar v0.3 — Owner metrics: user_contributed lane
--
-- Creates:
--   - owner_metrics — per-owner raw metric values for the 8 frozen
--                     v0.3 metrics (D-024). user_contributed lane.
--
-- Privacy posture:
--   - data_lane = 'user_contributed' enforced by DEFAULT + CHECK.
--   - RLS: user_contributed_lane_role may SELECT/INSERT/UPDATE own rows only.
--   - brief_lane_role: NO grants. analyst_aggregate_role: NO direct grants
--     (reads via SECURITY DEFINER functions only — deferred to v0.4).
--   - Every row carries a consent_event_id FK (privacy-architecture.md §4.2).
--
-- Migration number: 0006 (Track A — Track B uses 0007, Track C uses 0008).
-- Idempotent: guarded by IF NOT EXISTS / IF NOT EXISTS on policies.
-- Depends on:
--   - 0001_init_lanes.sql  (data_lane enum, user_contributed_lane_role)
--   - 0004_consent_events.sql  (consent_events table for FK)
--
-- Per-owner upsert semantics: (user_id, metric_id) is the composite PK.
-- History table deferred to v0.4 (OQ-OM-02 in owner-metrics-schema.md).
-- ============================================================

-- ----------------------------------------------------------------
-- 1. owner_metrics table
-- ----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS owner_metrics (
  user_id            UUID         NOT NULL,
  metric_id          TEXT         NOT NULL,

  -- Lane enforcement (ADR-0002-C / D-010). Always 'user_contributed'.
  data_lane          data_lane    NOT NULL DEFAULT 'user_contributed'
                                  CHECK (data_lane = 'user_contributed'),

  -- Numeric raw value. Ratios stored as percent points (e.g. 23.4 for 23,4 %).
  -- Monetary: revenue_per_employee in thousands of CZK per owner-metrics-schema.md §3.
  -- working_capital_cycle: days. revenue_growth + pricing_power: pp / %.
  -- Nullable: NULL means "owner has not yet supplied this metric" (drives 'ask' state).
  raw_value          NUMERIC(14,4),

  -- Czech-locale display string (decimal comma, thin-space U+202F thousands,
  -- non-breaking space U+00A0 before unit suffix). Formatted on write by the API layer.
  raw_value_display  TEXT,

  -- Source of the raw value:
  --   'user_entered'       — owner typed via in-tile prompt (PATCH API)
  --   'prepopulated_excel' — ingested from cohort_companies row at activation
  --   'demo_seed'          — moderator-side fixture for first-paint demo firms
  source             TEXT         NOT NULL
                                  CHECK (source IN (
                                    'user_entered',
                                    'prepopulated_excel',
                                    'demo_seed'
                                  )),

  -- Timestamps (set_updated_at trigger from 0003_user_contributed.sql pattern).
  captured_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),

  -- Privacy-architecture.md §4.2: every user_contributed row MUST reference a
  -- non-revoked grant event. NOT NULL enforced; RESTRICT prevents deletion of a
  -- consent event that has owner_metrics rows still attached.
  consent_event_id   UUID         NOT NULL
                                  REFERENCES consent_events(consent_event_id)
                                  ON DELETE RESTRICT,

  -- Composite PK: idempotent upsert semantics (ON CONFLICT DO UPDATE).
  PRIMARY KEY (user_id, metric_id),

  -- Domain check on metric_id: frozen 8 metrics per D-024.
  -- 'roce' was in D-003/D-015 but replaced by 'net_margin' per D-024.
  CHECK (metric_id IN (
    'gross_margin',
    'ebitda_margin',
    'labor_cost_ratio',
    'revenue_per_employee',
    'working_capital_cycle',
    'net_margin',
    'revenue_growth',
    'pricing_power'
  ))
);

-- ----------------------------------------------------------------
-- 2. Index for user_id lookups (full 8-metric read on dashboard load)
-- ----------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_owner_metrics_user_id
  ON owner_metrics (user_id);

-- ----------------------------------------------------------------
-- 3. updated_at trigger (reuse set_updated_at() from 0003_user_contributed.sql)
-- The function is assumed to exist. If it doesn't yet exist in a clean
-- Supabase project, create it here idempotently.
-- ----------------------------------------------------------------

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_owner_metrics_updated_at ON owner_metrics;
CREATE TRIGGER trg_owner_metrics_updated_at
  BEFORE UPDATE ON owner_metrics
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ----------------------------------------------------------------
-- 4. Row Level Security
-- ----------------------------------------------------------------

ALTER TABLE owner_metrics ENABLE ROW LEVEL SECURITY;

-- SELECT: own rows only (user_contributed_lane_role).
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'owner_metrics' AND policyname = 'user_contributed_lane_role_select'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY user_contributed_lane_role_select ON owner_metrics
        FOR SELECT TO user_contributed_lane_role
        USING (
          data_lane = 'user_contributed'
          AND user_id = current_setting('app.current_user_id', true)::uuid
        )
    $policy$;
  END IF;
END $$;

-- INSERT: own rows only.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'owner_metrics' AND policyname = 'user_contributed_lane_role_insert'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY user_contributed_lane_role_insert ON owner_metrics
        FOR INSERT TO user_contributed_lane_role
        WITH CHECK (
          data_lane = 'user_contributed'
          AND user_id = current_setting('app.current_user_id', true)::uuid
        )
    $policy$;
  END IF;
END $$;

-- UPDATE: own rows only.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'owner_metrics' AND policyname = 'user_contributed_lane_role_update'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY user_contributed_lane_role_update ON owner_metrics
        FOR UPDATE TO user_contributed_lane_role
        USING (
          data_lane = 'user_contributed'
          AND user_id = current_setting('app.current_user_id', true)::uuid
        )
        WITH CHECK (
          data_lane = 'user_contributed'
          AND user_id = current_setting('app.current_user_id', true)::uuid
        )
    $policy$;
  END IF;
END $$;

-- Grant DML to user_contributed_lane_role.
-- No grant to brief_lane_role or analyst_aggregate_role on the raw table.
GRANT SELECT, INSERT, UPDATE ON owner_metrics TO user_contributed_lane_role;
