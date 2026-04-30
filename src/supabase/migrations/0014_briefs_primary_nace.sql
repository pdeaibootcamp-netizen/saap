-- ============================================================
-- 0014_briefs_primary_nace.sql
-- Strategy Radar v0.4 — Brief primary-NACE tag
--
-- Adds:
--   - briefs.primary_nace TEXT — the NACE division the publication is
--     primarily ABOUT (chosen by the analyst at upload time). The dashboard's
--     Pulz oboru section filters by primary_nace == active_firm_nace, so a
--     furniture publication that's also tagged with transport (cross-relevance)
--     does not surface as the "main brief" for transport firms.
--
-- nace_sectors[] (cross-relevance set, D-029) stays unchanged. Section (v)
-- "Analýzy" still lists every brief whose nace_sectors @> ARRAY[active_nace];
-- only the per-NACE label uses primary_nace.
--
-- Backfill: existing briefs get primary_nace = nace_sectors[1] (best-effort —
-- pre-v0.4 briefs had no notion of "main" NACE).
--
-- Idempotent: guarded by IF NOT EXISTS / DROP CONSTRAINT IF EXISTS.
-- Depends on: 0011_briefs_multi_nace.sql (nace_sectors column).
-- ============================================================

-- 1. Add primary_nace column (nullable; NOT NULL would break the backfill
--    path for any rows where nace_sectors is somehow empty).
ALTER TABLE briefs
  ADD COLUMN IF NOT EXISTS primary_nace TEXT;

-- 2. Backfill existing rows from nace_sectors[1] (Postgres arrays are 1-indexed).
UPDATE briefs
SET primary_nace = nace_sectors[1]
WHERE primary_nace IS NULL
  AND cardinality(nace_sectors) > 0;

-- 3. Constraint: when primary_nace is set, it must be one of the NACEs in
--    nace_sectors. Using array_position() because CHECK can't have a subquery.
ALTER TABLE briefs
  DROP CONSTRAINT IF EXISTS briefs_primary_nace_in_sectors;

ALTER TABLE briefs
  ADD CONSTRAINT briefs_primary_nace_in_sectors
  CHECK (
    primary_nace IS NULL
    OR array_position(nace_sectors, primary_nace) IS NOT NULL
  );

-- 4. Index for the Pulz oboru query (WHERE primary_nace = $1 ORDER BY
--    published_at DESC LIMIT 1).
CREATE INDEX IF NOT EXISTS idx_briefs_primary_nace
  ON briefs (primary_nace, published_at DESC)
  WHERE publish_state = 'published';
