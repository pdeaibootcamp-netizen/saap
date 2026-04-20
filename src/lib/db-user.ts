/**
 * Database connection — user_contributed lane
 *
 * PRIVACY BOUNDARY: This module is the ONLY access point for the
 * user_contributed lane. It must NEVER be imported from src/lib/db.ts
 * or share a connection pool with the brief lane.
 *
 * The user_contributed lane stores: sector_profiles (NACE, size_band, region)
 * and the consent_events ledger (cross-lane meta-table).
 *
 * In production, DATABASE_URL_USER must point to the user_contributed_lane_role
 * credentials. At MVP trial, using the service-role key via Supabase is
 * acceptable (see scaffold.md §7 EN-S-003). Set DATABASE_URL_USER to the same
 * Supabase pooler URL — RLS enforces the lane boundary at the DB layer.
 *
 * Privacy invariant: no query through this client may return individual-level
 * financial data. Only sector_profiles (NACE, size_band, region) and
 * consent_events (event_type, ts) are stored in this lane at MVP.
 *
 * ADR reference: scaffold.md §3 — the lane separation is mandatory. This module
 * exists because the scaffold explicitly mandated "never merging" the lanes.
 */

import postgres from "postgres";

// Lazy posture (see db.ts): placeholder URL so module load doesn't throw
// during Next.js build-time page-data collection. Runtime queries without
// a real URL will fail at connect time.
const userDbUrl =
  process.env.DATABASE_URL_USER ||
  process.env.DATABASE_URL ||
  "postgres://placeholder:placeholder@127.0.0.1:5432/placeholder";

/**
 * `sqlUser` — query client for the user_contributed data lane.
 *
 * Separate pool from `sql` in db.ts. No cross-lane JOIN is possible
 * through this client because the tables it queries have RLS policies
 * that restrict to user_contributed-lane rows.
 *
 * Export only this symbol — callers must not instantiate postgres() directly.
 */
export const sqlUser = postgres(userDbUrl, {
  max: 5,
  idle_timeout: 30,
  connect_timeout: 10,
  transform: postgres.camel,
});
