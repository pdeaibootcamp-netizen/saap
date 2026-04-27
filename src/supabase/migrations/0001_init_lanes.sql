-- ============================================================
-- 0001_init_lanes.sql
-- Strategy Radar MVP — Data-lane foundation
--
-- Creates:
--   - data_lane enum (D-010, ADR-0002-C)
--   - publish_state enum (ADR-0002-B)
--   - delivery_format enum (ADR-0002-B brief_deliveries)
--   - consent_event_type enum (privacy-architecture.md §4.1)
--   - size_band enum (cohort-math.md §2.2)
--   - cz_region enum (cohort-math.md §2.3)
--   - Lane-scoped database roles (ADR-0002-C)
--   - RLS-skeleton helper function
--
-- Idempotent: every CREATE is guarded by IF NOT EXISTS or DO $$ blocks.
--
-- Escalation note: any change to the data_lane enum values is an
-- irreversible action — must be approved via a new decision-log entry
-- before a migration is written. Ref: CLAUDE.md non-negotiable rule #5.
-- ============================================================

-- ----------------------------------------------------------------
-- 1. Enums
-- ----------------------------------------------------------------

-- data_lane — canonical lane identifiers per D-010.
-- Values match DATA_LANE constants in src/types/data-lanes.ts.
DO $$ BEGIN
  CREATE TYPE data_lane AS ENUM (
    'brief',
    'user_contributed',
    'rm_visible',
    'credit_risk'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- publish_state — analyst-controlled brief lifecycle (ADR-0002-B).
DO $$ BEGIN
  CREATE TYPE publish_state AS ENUM (
    'draft',
    'published',
    'archived'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- delivery_format — which surface was delivered to (ADR-0002-B brief_deliveries).
DO $$ BEGIN
  CREATE TYPE delivery_format AS ENUM (
    'email',
    'web',
    'pdf'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- consent_event_type — grant or revoke (privacy-architecture.md §4.1).
DO $$ BEGIN
  CREATE TYPE consent_event_type AS ENUM (
    'grant',
    'revoke'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- consent_surface — where the consent event was captured (privacy-architecture.md §4.1).
-- 'rm-introduction-flow' is reserved for Increment 2+; not used at MVP.
DO $$ BEGIN
  CREATE TYPE consent_surface AS ENUM (
    'onboarding-screen',
    'settings-soukromi',
    'rm-introduction-flow'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- consent_channel — how the user arrived (privacy-architecture.md §4.1).
DO $$ BEGIN
  CREATE TYPE consent_channel AS ENUM (
    'direct-signup',
    'rm-referred-george-embed'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- size_band — three employee-count bands per cohort-math.md §2.2.
DO $$ BEGIN
  CREATE TYPE size_band AS ENUM (
    'S1',   -- 10–24 employees
    'S2',   -- 25–49 employees
    'S3'    -- 50–100 employees
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- cz_region — Czech NUTS 2 regions per cohort-math.md §2.3.
DO $$ BEGIN
  CREATE TYPE cz_region AS ENUM (
    'Praha',
    'Střední Čechy',
    'Jihozápad',
    'Severozápad',
    'Severovýchod',
    'Jihovýchod',
    'Střední Morava',
    'Moravskoslezsko'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ----------------------------------------------------------------
-- 2. Lane-scoped database roles
--
-- One role per active lane at MVP. Each role is granted RLS-scoped
-- access only to rows where data_lane = '<lane>' (policies defined
-- per-table in later migrations).
--
-- credit_risk role is intentionally absent: credit-risk data never
-- enters the Strategy Radar data plane (privacy-architecture.md §2).
-- rm_visible role is created but granted nothing: the lane is dormant
-- at MVP (D-002 / privacy-architecture.md §9).
--
-- In production, DATABASE_URL should point to the brief_lane_role
-- connection; a separate env var would point to user_contributed_lane_role
-- when that lane is activated in Phase 2 feature work.
-- ----------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'brief_lane_role') THEN
    CREATE ROLE brief_lane_role NOLOGIN;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'user_contributed_lane_role') THEN
    CREATE ROLE user_contributed_lane_role NOLOGIN;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'rm_visible_lane_role') THEN
    -- Dormant at MVP (D-002). Role exists; no table grants or RLS policies written yet.
    CREATE ROLE rm_visible_lane_role NOLOGIN;
  END IF;
END $$;

-- ----------------------------------------------------------------
-- 3. Comment block — lane ownership contract
--
-- Every table created in subsequent migrations must:
--   a) Include a data_lane column of type data_lane NOT NULL.
--   b) Include a CHECK constraint: CHECK (data_lane = '<expected_lane>').
--   c) Have RLS enabled (ALTER TABLE ... ENABLE ROW LEVEL SECURITY).
--   d) Have a SELECT policy granting brief_lane_role access only where
--      data_lane = 'brief'.
--
-- This is the ADR-0002-C enforcement pattern. Any deviation requires
-- escalation per CLAUDE.md non-negotiable rule #5 (irreversible action).
-- ----------------------------------------------------------------

-- No tables in this migration — tables come in 0002+ to keep lane setup
-- distinct from schema setup (easier to review separately).
