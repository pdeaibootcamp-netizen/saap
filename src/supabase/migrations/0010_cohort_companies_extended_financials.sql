-- Migration 0010: cohort_companies extended financials
--
-- Some industry-data Excels carry full P&L + balance-sheet detail per firm
-- (the furniture export 'Nábytkářský trh v ČR' is the canonical example).
-- The freight export was minimal (revenue, profit, employees) — we lost
-- nothing by ignoring the gaps. The furniture export is rich enough to
-- derive two additional metrics as proxies for the frozen 8-tile set:
--
--   ebitda_margin         ← Provozní hospodářský výsledek / Obrat, Výnosy × 100
--                            (technically operating margin, used as proxy for
--                            EBITDA margin since D&A is not separately reported)
--   working_capital_cycle ← Oběžná aktiva / Obrat, Výnosy × 365  (days)
--                            (rough "all current assets days" proxy — not the
--                            real DIO+DSO-DPO cycle, which would need AR/AP/
--                            inventory broken out separately)
--
-- The remaining raw fields (sales, costs, operating profit, balance sheet,
-- equity/debt) are persisted unconditionally so we can derive richer metrics
-- later (asset turnover, equity ratio, ROA, ROE, etc.) without re-ingesting.
--
-- Asymmetry: NACE 49 (freight) rows will have all of these new columns NULL
-- because they're not in the source Excel. NACE 31 (furniture) rows will
-- have ~60-70% coverage. The percentile compute degrades gracefully via
-- synth-quintile fallback when a column is sparse.
--
-- Privacy: all columns are anonymised industry-data fields from the public
-- business registry. The user_contributed lane (owner-volunteered values)
-- is unaffected.

ALTER TABLE cohort_companies
  -- Raw P&L fields
  ADD COLUMN IF NOT EXISTS sales_czk             NUMERIC(18,2),  -- Tržby, Výkony
  ADD COLUMN IF NOT EXISTS operating_profit_czk  NUMERIC(18,2),  -- Provozní hospodářský výsledek
  ADD COLUMN IF NOT EXISTS pretax_profit_czk     NUMERIC(18,2),  -- HV před zdaněním
  ADD COLUMN IF NOT EXISTS costs_czk             NUMERIC(18,2),  -- Náklady
  -- Raw balance-sheet fields
  ADD COLUMN IF NOT EXISTS assets_total_czk      NUMERIC(18,2),  -- Aktiva celkem
  ADD COLUMN IF NOT EXISTS fixed_assets_czk      NUMERIC(18,2),  -- Stálá aktiva
  ADD COLUMN IF NOT EXISTS current_assets_czk    NUMERIC(18,2),  -- Oběžná aktiva
  ADD COLUMN IF NOT EXISTS liabilities_total_czk NUMERIC(18,2),  -- Pasiva celkem
  ADD COLUMN IF NOT EXISTS equity_czk            NUMERIC(18,2),  -- Vlastní kapitál
  ADD COLUMN IF NOT EXISTS debt_czk              NUMERIC(18,2),  -- Cizí zdroje
  -- Derived proxy metrics (computed at ingest, plausibility-bounded)
  ADD COLUMN IF NOT EXISTS ebitda_margin         NUMERIC(8,4),   -- percent points
  ADD COLUMN IF NOT EXISTS working_capital_cycle NUMERIC(8,2);   -- days

-- Indexes for the percentile compute over division × size cells.
-- Same shape as the existing indexes on net_margin / revenue_per_employee.
CREATE INDEX IF NOT EXISTS cohort_companies_ebitda_margin_cell_idx
  ON cohort_companies (nace_division, size_band, ebitda_margin)
  WHERE ebitda_margin IS NOT NULL;

CREATE INDEX IF NOT EXISTS cohort_companies_working_capital_cycle_cell_idx
  ON cohort_companies (nace_division, size_band, working_capital_cycle)
  WHERE working_capital_cycle IS NOT NULL;
