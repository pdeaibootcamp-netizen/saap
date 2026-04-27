-- ============================================================
-- 0005_profile_history.sql
-- Strategy Radar MVP — Sector profile edit history
--
-- Creates:
--   - sector_profile_history — append-only history of profile edits (US-4)
--     per sector-profile-configuration.md §3.3
--
-- Also adds the email column to sector_profiles for email delivery
-- (needed by publish pipeline to look up recipient email addresses).
--
-- Lane: user_contributed (D-010).
-- Idempotent: guarded by IF NOT EXISTS.
-- Depends on: 0003_user_contributed.sql, 0004_consent_events.sql.
-- ============================================================

-- ----------------------------------------------------------------
-- 1. sector_profile_history table (US-4 edit history)
-- ----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS sector_profile_history (
  -- Mirrors sector_profiles columns
  id                  UUID        NOT NULL,
  data_lane           data_lane   NOT NULL DEFAULT 'user_contributed',
  user_id             UUID        NOT NULL,
  nace_sector         TEXT        NOT NULL,
  size_band           size_band   NOT NULL,
  region              cz_region   NOT NULL,
  source              TEXT        NOT NULL,
  consent_event_id    UUID        NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL,
  updated_at          TIMESTAMPTZ NOT NULL,
  -- When this row was superseded (i.e., the owner edited their profile)
  superseded_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sector_profile_history_user_id
  ON sector_profile_history (user_id, superseded_at DESC);

ALTER TABLE sector_profile_history ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'sector_profile_history'
      AND policyname = 'user_contributed_lane_role_select_history'
  ) THEN
    CREATE POLICY user_contributed_lane_role_select_history ON sector_profile_history
      FOR SELECT TO user_contributed_lane_role
      USING (data_lane = 'user_contributed');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'sector_profile_history'
      AND policyname = 'user_contributed_lane_role_insert_history'
  ) THEN
    CREATE POLICY user_contributed_lane_role_insert_history ON sector_profile_history
      FOR INSERT TO user_contributed_lane_role
      WITH CHECK (data_lane = 'user_contributed');
  END IF;
END $$;

GRANT SELECT, INSERT ON sector_profile_history TO user_contributed_lane_role;

-- ----------------------------------------------------------------
-- 2. Add email column to sector_profiles (for email delivery at MVP trial)
--
-- At MVP, the owner's email is captured during direct sign-up or pre-populated
-- from the bank seed. Stored here as a nullable field.
-- In production, email should be in a separate identity table (OQ-050).
-- ----------------------------------------------------------------

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sector_profiles' AND column_name = 'email'
  ) THEN
    ALTER TABLE sector_profiles ADD COLUMN email TEXT;
  END IF;
END $$;

-- ----------------------------------------------------------------
-- 3. prepopulated_seed table (sector-profile-configuration.md §5)
--
-- Staging area for bank-seeded profile fields. NOT sector_profiles —
-- this is unconfirmed data awaiting owner confirmation.
-- ----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS prepopulated_seed (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL UNIQUE,
  nace_sector   TEXT,        -- nullable — may be missing from seed
  size_band     size_band,   -- nullable
  region        cz_region,   -- nullable
  email         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  source        TEXT        NOT NULL DEFAULT 'cs_seed'
);

CREATE INDEX IF NOT EXISTS idx_prepopulated_seed_user_id
  ON prepopulated_seed (user_id);

ALTER TABLE prepopulated_seed ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'prepopulated_seed'
      AND policyname = 'user_contributed_lane_role_select_seed'
  ) THEN
    CREATE POLICY user_contributed_lane_role_select_seed ON prepopulated_seed
      FOR SELECT TO user_contributed_lane_role
      USING (true);
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE ON prepopulated_seed TO user_contributed_lane_role;
