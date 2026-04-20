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

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL environment variable is not set. " +
      "Copy .env.example to .env.local and populate the Supabase connection string."
  );
}

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
export const sql = postgres(process.env.DATABASE_URL, {
  // Max connections. Vercel serverless functions are stateless; the pooler
  // endpoint on Supabase handles connection multiplexing above this.
  max: 10,

  // Idle timeout: drop idle connections after 30s to avoid Supabase
  // "too many connections" errors in a serverless environment.
  idle_timeout: 30,

  // Connection timeout: fail fast if the DB isn't reachable.
  connect_timeout: 10,

  // Transforms: convert snake_case column names to camelCase in returned objects.
  // This lets TypeScript types use camelCase while the DB schema stays snake_case.
  transform: postgres.camel,
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
