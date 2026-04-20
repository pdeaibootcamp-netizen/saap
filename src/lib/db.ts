/**
 * Database connection — Strategy Radar
 *
 * Uses the `postgres` npm package (raw SQL, no ORM) wired to Supabase Postgres
 * (D-013 / ADR-0002-A). Chosen over Prisma and Drizzle for these reasons:
 *
 *   1. The schema is small and stable at MVP; a full ORM adds code-gen overhead
 *      with no benefit when the query surface is a handful of well-known tables.
 *   2. RLS is enforced at the DB layer (ADR-0002-C) — no ORM should be able to
 *      "help" by joining across lanes. Raw SQL makes the RLS-enforced boundary
 *      explicit in every query.
 *   3. `postgres` is a lightweight, type-safe tagged-template library with no
 *      code-generation step, which keeps CI simple.
 *
 * The `data_lane` enum is enforced as a TypeScript union in src/types/data-lanes.ts
 * (same values as the DB CHECK constraint) — so lane misuse is caught at compile
 * time before it ever reaches the DB.
 *
 * ADR reference: documented in docs/engineering/scaffold.md §3 ORM/query layer.
 *
 * PRIVACY NOTE: This module connects using a single DATABASE_URL. In production
 * the URL must point to the `brief` lane role — a role that can only read/write
 * rows where data_lane = 'brief' (per the RLS policies in 0001_init_lanes.sql).
 * When the user_contributed lane is activated in Phase 2, a second connection
 * using a separate `user_contributed` role must be created in a separate module
 * (e.g., src/lib/db-user.ts) — never by extending this file.
 */

import postgres from "postgres";

// Lazy posture: use a placeholder if DATABASE_URL is unset at module load.
// The postgres library is lazy — it only connects on first query — so build-
// time page-data collection (which imports every route module) does not need
// a live DB. Runtime query without a real URL will fail at connect time with
// a clear error.
const DB_URL =
  process.env.DATABASE_URL ||
  "postgres://placeholder:placeholder@127.0.0.1:5432/placeholder";

/**
 * `sql` — the primary query client for the `brief` data lane.
 *
 * Connection is pooled by the `postgres` library. On Vercel serverless,
 * each function invocation gets a short-lived connection; on local dev,
 * connections are reused across requests.
 *
 * Export only this symbol — callers should never instantiate postgres() directly,
 * which would bypass the single connection point and make lane tracking harder.
 */
export const sql = postgres(DB_URL, {
  // Max connections. Vercel serverless functions are stateless; the pooler
  // endpoint on Supabase handles connection multiplexing above this.
  max: 10,

  // Idle timeout: drop idle connections after 30s to avoid Supabase
  // "too many connections" errors in a serverless environment.
  idle_timeout: 30,

  // Connection timeout: fail fast if the DB isn't reachable.
  connect_timeout: 10,

  // NO transform. Types and consumers in this codebase use snake_case keys
  // identical to the DB column names (e.g., brief.publish_state). Enabling
  // postgres.camel would silently rewrite every returned field to camelCase
  // and make every snake_case access evaluate to undefined.
});

/**
 * Liveness check — returns true if the DB is reachable, false otherwise.
 * Used by the health-check route (/api/health) added in Phase 2.
 */
export async function checkDbLiveness(): Promise<boolean> {
  try {
    await sql`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}
