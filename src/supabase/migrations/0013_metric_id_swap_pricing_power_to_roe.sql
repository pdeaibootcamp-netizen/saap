-- Migration 0013: replace pricing_power with roe in metric_id CHECK constraints
--
-- v0.3 final cohort data (D-032). Pricing_power had no real cohort data column
-- (synth-quintile fallback only) and was rarely a useful comparator for SMEs.
-- ROE replaces it as the 8th frozen metric.
--
-- This migration:
--   1. Cleans up legacy rows with metric_id='pricing_power' from
--      cohort_aggregates and owner_metrics. Destructive — synth quintile values
--      and any seeded owner values for pricing_power are removed.
--   2. Drops the existing metric_id CHECK on both tables and re-adds it with
--      'pricing_power' replaced by 'roe'. Constraint name discovery is done at
--      runtime via pg_constraint to handle Postgres auto-naming variations.
--
-- Depends on: 0006 (owner_metrics), 0007 (cohort_aggregates), 0012 (roe column).

-- ── 1. Remove legacy pricing_power rows ───────────────────────────────────────
DELETE FROM cohort_aggregates WHERE metric_id = 'pricing_power';
DELETE FROM owner_metrics    WHERE metric_id = 'pricing_power';

-- ── 2. Swap CHECK constraint on owner_metrics.metric_id ───────────────────────
-- Drop whatever CHECK on metric_id exists (auto-named or hand-named).
DO $$
DECLARE
  c_name TEXT;
BEGIN
  FOR c_name IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'owner_metrics'::regclass
      AND contype  = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%metric_id%IN%'
  LOOP
    EXECUTE 'ALTER TABLE owner_metrics DROP CONSTRAINT ' || quote_ident(c_name);
  END LOOP;
END $$;

ALTER TABLE owner_metrics
  ADD CONSTRAINT owner_metrics_metric_id_check
  CHECK (metric_id IN (
    'gross_margin',
    'ebitda_margin',
    'labor_cost_ratio',
    'revenue_per_employee',
    'working_capital_cycle',
    'net_margin',
    'revenue_growth',
    'roe'
  ));

-- ── 3. Swap CHECK constraint on cohort_aggregates.metric_id ───────────────────
DO $$
DECLARE
  c_name TEXT;
BEGIN
  FOR c_name IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'cohort_aggregates'::regclass
      AND contype  = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%metric_id%IN%'
  LOOP
    EXECUTE 'ALTER TABLE cohort_aggregates DROP CONSTRAINT ' || quote_ident(c_name);
  END LOOP;
END $$;

ALTER TABLE cohort_aggregates
  ADD CONSTRAINT cohort_aggregates_metric_id_check
  CHECK (metric_id IN (
    'gross_margin',
    'ebitda_margin',
    'labor_cost_ratio',
    'revenue_per_employee',
    'working_capital_cycle',
    'net_margin',
    'revenue_growth',
    'roe'
  ));
