-- ============================================================
-- 0003_user_contributed.sql
-- Strategy Radar MVP — User-contributed lane: sector profile
--
-- Creates:
--   - sector_profiles — NACE, size_band, region per owner
--                       (user_contributed lane, privacy-architecture.md §2 / D-006)
--
-- This table is in the 'user_contributed' data lane (D-010).
-- RLS is enabled; user_contributed_lane_role may SELECT/INSERT/UPDATE.
-- The brief_lane_role must NOT be able to read this table — that
-- boundary is the core of ADR-0002-C.
--
-- Every row carries a consent_event_id FK (pointing to consent_events,
-- created in 0004_consent_events.sql). The FK is added via ALTER TABLE
-- at the end of this file; the referenced table is guaranteed to exist
-- because migrations run in order.
--
-- At MVP the user_contributed lane captures ONLY:
--   - nace_sector (2-digit NACE division, cohort-math.md §2.1)
--   - size_band   (S1/S2/S3, cohort-math.md §2.2)
--   - region      (NUTS 2, cohort-math.md §2.3)
-- No other fields. Adding a field requires a new migration AND a new
-- decision-log entry (give-to-get capture is Increment 3 per CLAUDE.md guardrail).
--
-- Idempotent: guarded by IF NOT EXISTS.
-- Depends on: 0001_init_lanes.sql (data_lane, size_band, cz_region enums,
--             user_contributed_lane_role).
-- ============================================================

-- ----------------------------------------------------------------
-- 1. sector_profiles table
-- ----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS sector_profiles (
  -- Primary key
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Lane enforcement (ADR-0002-C / D-010). Always 'user_contributed'.
  data_lane           data_lane   NOT NULL DEFAULT 'user_contributed'
                                  CHECK (data_lane = 'user_contributed'),

  -- Owner identifier — pseudonymous UUID.
  -- Populated from:
  --   - George Business JWT sub claim for bank-referred owners (ADR-0001-E).
  --   - Supabase auth.users.id for direct sign-up owners.
  user_id             UUID        NOT NULL,

  -- The three sector profile fields (sector-profile-configuration.md §3 / D-006).
  -- All three are required before the owner can receive a brief.
  nace_sector         TEXT        NOT NULL
                                  CHECK (nace_sector ~ '^\d{2}$'),
  size_band           size_band   NOT NULL,
  region              cz_region   NOT NULL,

  -- Timestamps
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Source of this record (for the D-001 pre-populated seed vs. user-entered distinction).
  -- 'user_entered'    = owner typed/selected values in the onboarding form (US-2).
  -- 'prepopulated'    = values seeded from ČS pre-populated dataset (D-001 / user_ingest_prepopulated).
  -- 'user_correction' = owner edited a pre-populated value (US-1 AC-4).
  source              TEXT        NOT NULL DEFAULT 'user_entered'
                                  CHECK (source IN ('user_entered', 'prepopulated', 'user_correction')),

  -- Consent reference — every user_contributed row MUST reference a grant event
  -- (privacy-architecture.md §4.2). NOT NULL enforced.
  -- FK to consent_events(consent_event_id) added after 0004_consent_events.sql runs.
  consent_event_id    UUID        NOT NULL
);

-- Unique index: one active profile per user_id.
-- Profile edits (US-4) update the existing row (not append-only);
-- the audit trail is the consent_event_id FK chain, not row proliferation.
CREATE UNIQUE INDEX IF NOT EXISTS idx_sector_profiles_user_id
  ON sector_profiles (user_id);

-- Index for cohort-compute batch — look up all owners in a NACE × size × region cell.
CREATE INDEX IF NOT EXISTS idx_sector_profiles_cohort_cell
  ON sector_profiles (nace_sector, size_band, region);

-- ----------------------------------------------------------------
-- 2. Trigger: auto-update updated_at on row update
-- ----------------------------------------------------------------

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sector_profiles_updated_at ON sector_profiles;
CREATE TRIGGER sector_profiles_updated_at
  BEFORE UPDATE ON sector_profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ----------------------------------------------------------------
-- 3. RLS on sector_profiles
-- ----------------------------------------------------------------

ALTER TABLE sector_profiles ENABLE ROW LEVEL SECURITY;

-- user_contributed_lane_role: access only to user_contributed-lane rows.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'sector_profiles' AND policyname = 'user_contributed_lane_role_select'
  ) THEN
    CREATE POLICY user_contributed_lane_role_select ON sector_profiles
      FOR SELECT TO user_contributed_lane_role
      USING (data_lane = 'user_contributed');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'sector_profiles' AND policyname = 'user_contributed_lane_role_insert'
  ) THEN
    CREATE POLICY user_contributed_lane_role_insert ON sector_profiles
      FOR INSERT TO user_contributed_lane_role
      WITH CHECK (data_lane = 'user_contributed');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'sector_profiles' AND policyname = 'user_contributed_lane_role_update'
  ) THEN
    CREATE POLICY user_contributed_lane_role_update ON sector_profiles
      FOR UPDATE TO user_contributed_lane_role
      USING (data_lane = 'user_contributed')
      WITH CHECK (data_lane = 'user_contributed');
  END IF;
END $$;

-- CRITICAL: brief_lane_role must NOT have any access to this table.
-- Do not add a GRANT for brief_lane_role here.
-- The brief_render_delivery pipeline may perform a single NACE lookup from
-- this table — but it does so via a separate DB function / view with
-- explicit column projection (user_id → nace_sector only), not via
-- direct SELECT on this table. That DB function is a Phase 2 deliverable.

GRANT SELECT, INSERT, UPDATE ON sector_profiles TO user_contributed_lane_role;

-- ----------------------------------------------------------------
-- 4. consent_event_id FK — added after consent_events table is created
--
-- This ALTER is placed here (after table creation but before granting)
-- so it runs in the same migration transaction. If consent_events does
-- not yet exist (e.g., running migrations out of order), the migration
-- fails loudly rather than silently skipping the constraint.
--
-- NOTE: In Supabase's migration runner, migrations run in filename order
-- (0001 → 0002 → 0003 → 0004). The FK reference to consent_events from
-- 0003 would fail because 0004 hasn't run yet. Therefore the FK is added
-- as a deferred ALTER in a separate migration step applied after 0004 lands.
--
-- The comment below is the INTENT; the actual ALTER statement is in
-- 0005_fk_consent_event_id.sql (to be created) — logged in scaffold.md §7.
--
-- ALTER TABLE sector_profiles
--   ADD CONSTRAINT fk_sector_profiles_consent_event
--   FOREIGN KEY (consent_event_id) REFERENCES consent_events (consent_event_id)
--   ON DELETE RESTRICT;
--
-- ----------------------------------------------------------------
