-- Migration 0009: cohort_companies.name
--
-- Adds a nullable `name` column to cohort_companies so the IčO switcher can
-- surface the active firm's name on the dashboard. Without this, the
-- moderator has to remember which IčO maps to which firm — a friction point
-- the user flagged on 2026-04-27.
--
-- Privacy posture: the source data is the public Czech business registry
-- (Veřejný rejstřík). Firm names there are public information, distinct from
-- the user_contributed lane that holds owner-volunteered financials. This
-- column does NOT relax the "client data never enters base-model training"
-- guarantee — it merely surfaces an already-public registry attribute that
-- happens to make the demo UX legible.
--
-- Re-ingest (`npm run ingest:industry`) populates the column. Existing rows
-- without name remain NULL until re-ingest; the IčO switcher falls back to
-- the static DEMO_ICO_NAMES map in demo-owner.ts during that window.

ALTER TABLE cohort_companies
  ADD COLUMN IF NOT EXISTS name TEXT;
