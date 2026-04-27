#!/usr/bin/env tsx
/**
 * seed-synth-quintiles.ts — CLI to seed cohort_aggregates with DE-authored synth quintiles
 *
 * Usage:
 *   npm run seed:synth-quintiles
 *
 * Run AFTER:
 *   1. Migration 0007_cohort_data.sql applied (creates cohort_aggregates table).
 *   2. (Optionally) ingest:industry has run to populate cohort_companies with real data.
 *      Synth rows will not overwrite real-data rows — they coexist via the composite
 *      PK (nace_division, metric_id, source).
 *
 * Seeds synth quintiles for all NACE divisions defined in src/lib/seed-synth-quintiles.ts:
 *   NACE 49 (road transport), 31 (furniture), 25 (metal), 47 (retail),
 *   62 (IT services), 41 (construction).
 *
 * Idempotent: safe to re-run. Uses ON CONFLICT DO UPDATE on synthetic rows only.
 * Does NOT overwrite source='real' rows.
 *
 * Spec: docs/data/synthetic-quintile-policy.md §6.
 * Decision: D-025 — synthetic per-NACE quintile fallback.
 *
 * Track A note: Track A's seed.ts main() should call seedSynthQuintilesForNaceDivision
 * from src/lib/seed-synth-quintiles.ts for each division instead of calling this CLI.
 * Do NOT edit src/scripts/seed.ts directly — Track A owns it.
 */

import postgres from "postgres";
import {
  seedSynthQuintilesForNaceDivision,
  SYNTH_NACE_DIVISIONS,
} from "../lib/seed-synth-quintiles";

async function main() {
  const dbUrl =
    process.env.DATABASE_URL_USER ||
    process.env.DATABASE_URL ||
    "postgres://placeholder:placeholder@127.0.0.1:5432/placeholder";

  const sql = postgres(dbUrl, { max: 3, idle_timeout: 30, connect_timeout: 15 });

  console.log(`[seed-synth] Seeding synth quintiles for ${SYNTH_NACE_DIVISIONS.length} NACE divisions: ${SYNTH_NACE_DIVISIONS.join(", ")}`);

  try {
    for (const division of SYNTH_NACE_DIVISIONS) {
      await seedSynthQuintilesForNaceDivision(division, sql);
    }
    console.log("[seed-synth] Done. All synth quintiles seeded successfully.");
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error("[seed-synth] FATAL:", err);
  process.exit(1);
});
