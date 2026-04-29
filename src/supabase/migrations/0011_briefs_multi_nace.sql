-- Migration 0011: multi-NACE briefs
--
-- v0.3 Track C analysis automation generates ONE brief per uploaded publication
-- which can be relevant for multiple NACE sectors. Customers in any covered
-- NACE see the brief on their dashboard; the brief page renders the
-- per-NACE insights+actions matching the customer's active NACE.
--
-- Schema change:
--   - nace_sectors TEXT[] — the list of NACE divisions this brief covers.
--                            Backfilled from the existing nace_sector column
--                            for v0.1/v0.2 single-NACE briefs.
--   - nace_sector TEXT — kept (legacy / "primary" NACE for tooling that still
--                          assumes a single sector); always equals nace_sectors[0].
--
-- Per-NACE content lives inside content_sections[].body's BriefContent JSON
-- as a new optional `per_nace_content` map keyed by NACE division. Briefs
-- without per_nace_content fall back to the top-level observations +
-- closing_actions arrays (v0.1/v0.2 backward compat).
--
-- Dashboard filter changes from `WHERE nace_sector = ?` to
-- `WHERE ? = ANY(nace_sectors)` so customers see briefs whose NACE list
-- includes their active NACE.

ALTER TABLE briefs
  ADD COLUMN IF NOT EXISTS nace_sectors TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Backfill: existing rows have a single nace_sector → wrap it into the array.
UPDATE briefs
SET nace_sectors = ARRAY[nace_sector]
WHERE cardinality(nace_sectors) = 0;

-- Validity: every entry must look like a 2-digit NACE division.
-- Postgres CHECK constraints can't contain subqueries, so we coerce the
-- array to a comma-joined string and pattern-match the whole thing in
-- one go. Equivalent semantics, scalar expression.
ALTER TABLE briefs
  ADD CONSTRAINT briefs_nace_sectors_format
  CHECK (
    cardinality(nace_sectors) > 0
    AND array_to_string(nace_sectors, ',') ~ '^\d{2}(,\d{2})*$'
  );

-- GIN index for ANY() / array containment queries from the dashboard.
CREATE INDEX IF NOT EXISTS idx_briefs_nace_sectors
  ON briefs USING gin (nace_sectors);

-- Drop the old per-sector index — array containment beats it.
-- Keep nace_sector column itself for legacy code paths until v0.4 cleanup.
DROP INDEX IF EXISTS idx_briefs_nace_sector;

-- Optional: trigger to keep nace_sector in sync with nace_sectors[0] on writes.
-- For v0.3 we just enforce this in application code (lib/briefs.ts inserts
-- both fields explicitly). Skip the trigger.
