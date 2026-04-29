-- Migration 0012: cohort_companies ROE column
--
-- v0.3 final cohort data (D-032). Adds Return on Equity as a derived per-firm
-- metric. Computed at ingest time from:
--   roe = (HV za účetní období / Vlastní kapitál) × 100
-- Plausibility envelope: -100 ≤ roe ≤ 200 (allows distressed firms with tiny
-- equity flips and high-growth firms with outsized returns).
--
-- Replaces pricing_power as the 8th frozen metric (D-024 → updated by D-032).
-- See migration 0013 for the metric_id CHECK swap on owner_metrics and
-- cohort_aggregates.
--
-- Mirrors the migration 0010 pattern: nullable column + partial index.

ALTER TABLE cohort_companies
  ADD COLUMN IF NOT EXISTS roe NUMERIC(8,4);

-- Partial index for percentile compute over division × size cells.
-- Same shape as ebitda_margin / working_capital_cycle indexes.
CREATE INDEX IF NOT EXISTS cohort_companies_roe_cell_idx
  ON cohort_companies (nace_division, size_band, roe)
  WHERE roe IS NOT NULL;
