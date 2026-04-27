-- ============================================================
-- 0004_consent_events.sql
-- Strategy Radar MVP — Consent ledger
--
-- Creates:
--   - consent_events — append-only consent ledger implementing D-007 single opt-in.
--
-- Design per privacy-architecture.md §4.1:
--   - Append-only: consent events are immutable. Revocation is a new row
--     referencing the prior grant event (prior_event_id FK).
--   - Every row in any lane whose existence depends on user consent must carry
--     a consent_event_id FK pointing to a non-revoked grant event (§4.2).
--   - lanes_covered jsonb array: at MVP always all four canonical lanes per D-010.
--
-- This table lives outside the four data-lane enum values — it is the
-- cross-lane meta-table that enforces lane membership. It is readable by
-- any lane role (they need to resolve consent status at read time, §5.2)
-- but writable only by the API server role (via the service-role key).
--
-- Idempotent: guarded by IF NOT EXISTS.
-- Depends on: 0001_init_lanes.sql (consent_event_type, consent_surface,
--             consent_channel enums).
-- ============================================================

-- ----------------------------------------------------------------
-- 1. consent_events table
-- ----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS consent_events (
  -- Primary key — referenced by every lane row as consent_event_id FK.
  consent_event_id      UUID              PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Owner identifier (same pseudonymous UUID used in sector_profiles.user_id).
  user_id               UUID              NOT NULL,

  -- Grant or revoke (D-007 single opt-in; D-012 revocation = stop-flow-only).
  event_type            consent_event_type NOT NULL,

  -- When the event was captured (UTC).
  ts                    TIMESTAMPTZ       NOT NULL DEFAULT now(),

  -- Pins which consent copy version the user saw (e.g., 'v1.0-2026-04').
  -- Content of the copy is version-controlled in the consent_copy table (Phase 2).
  -- At MVP a simple string is sufficient.
  consent_copy_version  TEXT              NOT NULL,

  -- Four-lane declaration per D-010.
  -- At MVP always: ["brief","user_contributed","rm_visible","credit_risk"]
  -- Array form is future-proof for per-lane toggles if D-007 is revised.
  -- "credit_risk" in this array declares the architectural boundary (what
  -- the bank does NOT do), not a lane the user grants access to.
  lanes_covered         JSONB             NOT NULL DEFAULT '["brief","user_contributed","rm_visible","credit_risk"]'::jsonb,

  -- Surface where the event was captured.
  surface               consent_surface   NOT NULL,

  -- Channel — how the user arrived.
  channel               consent_channel   NOT NULL,

  -- For revoke events: points at the grant being revoked.
  -- Null for grant events.
  prior_event_id        UUID              REFERENCES consent_events (consent_event_id)
                                          ON DELETE RESTRICT,

  -- Audit-trail integrity: SHA-256 hash of the consent copy the user saw.
  -- Retrieved from consent_copy table by consent_copy_version at event time.
  captured_text_hash    TEXT              NOT NULL,

  -- Truncated IP prefix (e.g., /24) for audit only.
  -- Full IP is not stored (privacy-architecture.md §4.1).
  ip_prefix             TEXT,

  -- Semantic constraints:
  -- 1. A grant event must not reference a prior event.
  CONSTRAINT grant_has_no_prior
    CHECK (
      event_type != 'grant'
      OR prior_event_id IS NULL
    ),

  -- 2. A revoke event must reference a prior event.
  CONSTRAINT revoke_has_prior
    CHECK (
      event_type != 'revoke'
      OR prior_event_id IS NOT NULL
    )
);

-- Index: look up all consent events for a user, ordered by time.
-- Primary use: resolve "is this user's latest event a grant or revoke?"
-- (privacy-architecture.md §5.2).
CREATE INDEX IF NOT EXISTS idx_consent_events_user_ts
  ON consent_events (user_id, ts DESC);

-- Index: look up a grant event by its ID (for FK resolution in lane tables).
CREATE INDEX IF NOT EXISTS idx_consent_events_id
  ON consent_events (consent_event_id);

-- ----------------------------------------------------------------
-- 2. Helper view: current_consent_status
--
-- Returns the most recent consent event per user_id. Downstream
-- pipelines JOIN on this view to filter revoked users (§5.2).
-- Created as a view so it can be updated without a migration when
-- the resolution logic changes.
-- ----------------------------------------------------------------

CREATE OR REPLACE VIEW current_consent_status AS
SELECT DISTINCT ON (user_id)
  user_id,
  consent_event_id,
  event_type     AS latest_event_type,
  ts             AS latest_ts,
  lanes_covered
FROM consent_events
ORDER BY user_id, ts DESC;

-- ----------------------------------------------------------------
-- 3. RLS on consent_events
-- ----------------------------------------------------------------

ALTER TABLE consent_events ENABLE ROW LEVEL SECURITY;

-- brief_lane_role: read-only access to resolve consent status at
-- delivery time (ADR-0002-E; privacy-architecture.md §5.2).
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'consent_events' AND policyname = 'brief_lane_role_select'
  ) THEN
    CREATE POLICY brief_lane_role_select ON consent_events
      FOR SELECT TO brief_lane_role
      USING (true);
  END IF;
END $$;

-- user_contributed_lane_role: read-only — consent lookup at ingestion time.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'consent_events' AND policyname = 'user_contributed_lane_role_select'
  ) THEN
    CREATE POLICY user_contributed_lane_role_select ON consent_events
      FOR SELECT TO user_contributed_lane_role
      USING (true);
  END IF;
END $$;

-- INSERT: only the service-role (API server) may write consent events.
-- No lane role writes here — consent is a meta-layer above the lanes.
-- The service-role key (SUPABASE_SERVICE_ROLE_KEY) bypasses RLS.
-- No explicit policy needed for service-role; Supabase service role bypasses RLS.

GRANT SELECT ON consent_events TO brief_lane_role;
GRANT SELECT ON consent_events TO user_contributed_lane_role;
GRANT SELECT ON current_consent_status TO brief_lane_role;
GRANT SELECT ON current_consent_status TO user_contributed_lane_role;

-- ----------------------------------------------------------------
-- 4. Add consent_event_id FK back-reference to sector_profiles
--    (the deferred step noted in 0003_user_contributed.sql §4)
-- ----------------------------------------------------------------

ALTER TABLE sector_profiles
  ADD CONSTRAINT fk_sector_profiles_consent_event
  FOREIGN KEY (consent_event_id) REFERENCES consent_events (consent_event_id)
  ON DELETE RESTRICT
  NOT VALID;

-- Validate after data is loaded (safe for concurrent production use; not
-- relevant for MVP where migrations run on an empty DB, but correct practice).
ALTER TABLE sector_profiles
  VALIDATE CONSTRAINT fk_sector_profiles_consent_event;
