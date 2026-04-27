-- ============================================================
-- 0007_cohort_data.sql
-- Strategy Radar v0.3 — Cohort data tables (Track B)
--
-- Creates:
--   - cohort_companies  — per-firm anonymised industry data ingested from
--                         Excel extracts (cohort-ingestion.md §3)
--   - cohort_aggregates — per-(NACE, metric) summary quintiles, real or
--                         synthetic (synthetic-quintile-policy.md §2)
--
-- Privacy posture:
--   - Both tables contain INDUSTRY-WIDE data (not per-user consent-bound data).
--   - No data_lane enum column: these tables are shared reference data
--     used by both brief_lane_role and user_contributed_lane_role.
--   - No consent_event_id FK: ingested under existing data agreements (OQ-003).
--   - RLS: read-only SELECT to user_contributed_lane_role (which performs
--     cohort lookups) and brief_lane_role (which may read for analysis pipeline).
--   - Write access: migration scripts and the ingest/seed scripts only.
--
-- Migration number: 0007 (Track A uses 0006, Track C uses 0008).
-- Idempotent: guarded by IF NOT EXISTS on tables, indexes, and policies.
-- Depends on: 0001_init_lanes.sql (size_band enum, cz_region enum,
--             brief_lane_role, user_contributed_lane_role).
-- ============================================================

-- ----------------------------------------------------------------
-- 1. cohort_companies — per-firm row, one row per (ico, year)
-- ----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS cohort_companies (
  -- Business registry ID — Czech IČO, always 8 digits.
  ico                  TEXT         NOT NULL
                                    CHECK (ico ~ '^\d{8}$'),

  -- Reporting year of the snapshot (almost always 2024 for v0.3 ingest).
  year                 INTEGER      NOT NULL
                                    CHECK (year BETWEEN 2015 AND 2030),

  -- NACE — both grains stored (cohort-ingestion.md §3, §4.1).
  --   nace_class:    4-digit, e.g. '4941'
  --   nace_division: 2-digit, e.g. '49' — the grain used by cohort math (cohort-math.md §2.1)
  nace_class           TEXT         NOT NULL
                                    CHECK (nace_class ~ '^\d{4}$'),
  nace_division        TEXT         NOT NULL
                                    CHECK (nace_division ~ '^\d{2}$'),

  -- Czech NUTS-2 region derived from city via cz-city-region-map.json.
  -- NULL when city is unmapped (row still ingests; excluded from region-scoped cohort cells).
  cz_region            cz_region,

  -- Size band — S1 (1-24 employees at v0.3), S2 (25-49), S3 (50+).
  -- cohort-ingestion.md §4.3: 1-24 collapsed into S1 per orchestrator brief (OQ-CI-01).
  size_band            size_band    NOT NULL,

  -- Raw financial inputs (CZK). Nullable — coverage gaps are expected.
  revenue_czk          NUMERIC(18,2),
  profit_czk           NUMERIC(18,2),
  employee_count       INTEGER,

  -- Derived per-firm metric values. Computed at ingest time (cohort-ingestion.md §4.4).
  -- NULL when inputs missing or value falls outside plausibility envelope.
  --   net_margin:           percent points (e.g. 7.4 means 7,4 %)
  --   revenue_per_employee: thousands of CZK per FTE
  net_margin           NUMERIC(8,4),
  revenue_per_employee NUMERIC(12,2),

  -- Provenance.
  source_file          TEXT         NOT NULL,
  ingested_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),

  PRIMARY KEY (ico, year)
);

-- Index for cohort cell queries (nace_division, size_band, cz_region).
CREATE INDEX IF NOT EXISTS idx_cohort_companies_cell
  ON cohort_companies (nace_division, size_band, cz_region);

-- Index for division+year queries (aggregate computation).
CREATE INDEX IF NOT EXISTS idx_cohort_companies_division_year
  ON cohort_companies (nace_division, year);

-- Lookup index for the IČO-based demo switcher (D-023).
CREATE INDEX IF NOT EXISTS idx_cohort_companies_ico
  ON cohort_companies (ico);

-- ----------------------------------------------------------------
-- 2. cohort_aggregates — per-(NACE division, metric) quintile summary
-- ----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS cohort_aggregates (
  -- 2-digit NACE division.
  nace_division        TEXT         NOT NULL
                                    CHECK (nace_division ~ '^\d{2}$'),

  -- Metric identifier — frozen 8 per D-024.
  metric_id            TEXT         NOT NULL
                                    CHECK (metric_id IN (
                                      'gross_margin',
                                      'ebitda_margin',
                                      'labor_cost_ratio',
                                      'revenue_per_employee',
                                      'working_capital_cycle',
                                      'net_margin',
                                      'revenue_growth',
                                      'pricing_power'
                                    )),

  -- Five distribution cut-points.
  --   Units match owner_metrics-schema.md §3 and cohort_companies columns.
  --   q1 = 20th pct, q2 = 40th pct, median = 50th pct, q3 = 60th pct, q4 = 80th pct.
  -- Constraint q1 ≤ q2 ≤ median ≤ q3 ≤ q4 is enforced in the seed script
  -- (synthetic-quintile-policy.md §6), not at DB level (to keep the migration idempotent).
  q1                   NUMERIC(14,4) NOT NULL,
  q2                   NUMERIC(14,4) NOT NULL,
  median               NUMERIC(14,4) NOT NULL,
  q3                   NUMERIC(14,4) NOT NULL,
  q4                   NUMERIC(14,4) NOT NULL,

  -- Claimed-equivalent cohort size.
  --   For DE-authored synthetic rows: n_proxy = 200 (always clears the floor).
  --   For real-data rows: actual count of firms in the NACE × metric cell.
  n_proxy              INTEGER      NOT NULL DEFAULT 200,

  -- Data source — 'real' (aggregated from cohort_companies) or 'synthetic' (DE-authored).
  -- Composite PK includes source so a real and synth row may coexist for the same cell.
  -- computePercentile() always prefers the real row (percentile-compute.md §9 OQ-PC-03).
  source               TEXT         NOT NULL
                                    CHECK (source IN ('real', 'synthetic')),

  -- Audit fields.
  generated_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
  -- 'de-authored' for DE-written synth rows; 'compute-pipeline' reserved for v0.4 automation.
  generated_by         TEXT         NOT NULL,
  methodology_note     TEXT,

  -- Composite PK: (nace_division, metric_id, source) allows real and synth to coexist.
  PRIMARY KEY (nace_division, metric_id, source)
);

-- ----------------------------------------------------------------
-- 3. Row Level Security — cohort_companies
-- ----------------------------------------------------------------

ALTER TABLE cohort_companies ENABLE ROW LEVEL SECURITY;

-- user_contributed_lane_role: read-only (cohort lookup queries in cohort-data.ts).
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'cohort_companies'
      AND policyname = 'cohort_companies_user_contributed_select'
  ) THEN
    CREATE POLICY cohort_companies_user_contributed_select ON cohort_companies
      FOR SELECT TO user_contributed_lane_role
      USING (true);
  END IF;
END $$;

-- brief_lane_role: read-only (analysis pipeline may read cohort data to build brief context).
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'cohort_companies'
      AND policyname = 'cohort_companies_brief_lane_select'
  ) THEN
    CREATE POLICY cohort_companies_brief_lane_select ON cohort_companies
      FOR SELECT TO brief_lane_role
      USING (true);
  END IF;
END $$;

GRANT SELECT ON cohort_companies TO user_contributed_lane_role;
GRANT SELECT ON cohort_companies TO brief_lane_role;

-- ----------------------------------------------------------------
-- 4. Row Level Security — cohort_aggregates
-- ----------------------------------------------------------------

ALTER TABLE cohort_aggregates ENABLE ROW LEVEL SECURITY;

-- user_contributed_lane_role: read-only (synth quintile and real aggregate lookups).
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'cohort_aggregates'
      AND policyname = 'cohort_aggregates_user_contributed_select'
  ) THEN
    CREATE POLICY cohort_aggregates_user_contributed_select ON cohort_aggregates
      FOR SELECT TO user_contributed_lane_role
      USING (true);
  END IF;
END $$;

-- brief_lane_role: read-only.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'cohort_aggregates'
      AND policyname = 'cohort_aggregates_brief_lane_select'
  ) THEN
    CREATE POLICY cohort_aggregates_brief_lane_select ON cohort_aggregates
      FOR SELECT TO brief_lane_role
      USING (true);
  END IF;
END $$;

GRANT SELECT ON cohort_aggregates TO user_contributed_lane_role;
GRANT SELECT ON cohort_aggregates TO brief_lane_role;
