/**
 * cohort-data.ts — DB-facing helpers for cohort lookup (Track B)
 *
 * Reads from cohort_companies and cohort_aggregates — both are industry-
 * reference tables with no per-user consent binding.
 *
 * PRIVACY BOUNDARY:
 *   - This module NEVER imports from owner_metrics or any user-identified table.
 *   - It reads cohort_companies and cohort_aggregates only — anonymised industry data.
 *   - It returns arrays of numeric values and quintile structs — no IČO, name,
 *     or row-level firm identity leaks into the return value.
 *   - The caller (cohort.ts) passes the owner's raw value as an argument to
 *     cohort-compute.ts; this module does not receive or store owner values.
 *
 * Architecture: cohort-runtime.md §4.2 (cohort-data.ts spec) + ADR-CR-02
 * (per-request memoisation via Map).
 *
 * The four-rung degradation ladder is implemented here (cohort-math.md §4.1):
 *   Rung 0 — (naceDivision, sizeBand, region)
 *   Rung 1 — (naceDivision, sizeBand)            — drop region
 *   Rung 2 — (naceDivision, region)              — drop size
 *   Rung 3 — (naceDivision)                      — drop both
 *   (Rung 4 = all failed — returned as null)
 */

import { sqlUser } from "./db-user";
import type { MetricId, SynthQuintiles } from "./cohort-compute";
import { getFloor } from "./cohort-compute";
import type { CzRegion, SizeBand } from "../types/data-lanes";

// ── Metric → column mapping ───────────────────────────────────────────────────
// Real-data columns on cohort_companies. Coverage is sector-asymmetric:
//   - net_margin / revenue_per_employee: present in all ingested Excels.
//   - ebitda_margin (operating-margin proxy) / working_capital_cycle (Oběžná
//     aktiva days proxy): present only in Excels carrying the full P&L + BS
//     detail (currently NACE 31 furniture; NACE 49 freight rows have NULL).
//     The four-rung degradation ladder + synth fallback handles the asymmetry.
// (cohort-ingestion.md §4.4, cohort-runtime.md §4.2, migration 0010)

const METRIC_TO_COLUMN: Partial<Record<MetricId, string>> = {
  net_margin: "net_margin",
  revenue_per_employee: "revenue_per_employee",
  ebitda_margin: "ebitda_margin",
  working_capital_cycle: "working_capital_cycle",
};

// ── Per-request memoisation (ADR-CR-02) ──────────────────────────────────────
// Keys: `${naceDivision}|${sizeBand ?? ""}|${region ?? ""}|${metricId}`
// Created fresh each request context in getCohortFirmsForCell.

type MemoKey = string;
const requestMemo = new Map<MemoKey, { values: number[]; rung: 0 | 1 | 2 | 3; n: number } | null>();

/** Clear the per-request memo. Call once per request in the route handler. */
export function clearCohortMemo(): void {
  requestMemo.clear();
}

// ── getCohortFirmsForCell ─────────────────────────────────────────────────────

/**
 * Fetch real metric values from cohort_companies, applying the four-rung
 * degradation ladder (cohort-math.md §4.1).
 *
 * Returns { values, rung, n } for the first rung that clears the statistical
 * floor, or null if all rungs fail (metric has no real-data column, or
 * insufficient rows at every rung).
 *
 * @param naceDivision — 2-digit NACE division, e.g. "49"
 * @param sizeBand     — S1 / S2 / S3
 * @param region       — NUTS-2 region string or null (unknown)
 * @param metricId     — one of the 8 frozen metrics
 */
export async function getCohortFirmsForCell(
  naceDivision: string,
  sizeBand: SizeBand,
  region: CzRegion | null,
  metricId: MetricId
): Promise<{ values: number[]; rung: 0 | 1 | 2 | 3; n: number } | null> {
  // Check memo
  const memoKey: MemoKey = `${naceDivision}|${sizeBand}|${region ?? ""}|${metricId}`;
  if (requestMemo.has(memoKey)) {
    return requestMemo.get(memoKey)!;
  }

  const column = METRIC_TO_COLUMN[metricId];
  if (!column) {
    // No real-data column for this metric — fall to synth path immediately.
    requestMemo.set(memoKey, null);
    return null;
  }

  const floor = getFloor(metricId);

  // Try rungs 0–3 in order. Rungs 0 and 2 require region; skip them when null.
  const rungs: Array<{
    rung: 0 | 1 | 2 | 3;
    query: () => Promise<number[]>;
  }> = [];

  // Rung 0 — (naceDivision, sizeBand, region)
  if (region !== null) {
    rungs.push({
      rung: 0,
      query: async () => {
        const rows = await sqlUser<{ v: number }[]>`
          SELECT ${sqlUser(column)} AS v
          FROM cohort_companies
          WHERE nace_division = ${naceDivision}
            AND size_band     = ${sizeBand}
            AND cz_region     = ${region}
            AND ${sqlUser(column)} IS NOT NULL
        `;
        return rows.map((r) => Number(r.v));
      },
    });
  }

  // Rung 1 — (naceDivision, sizeBand) — drop region
  rungs.push({
    rung: 1,
    query: async () => {
      const rows = await sqlUser<{ v: number }[]>`
        SELECT ${sqlUser(column)} AS v
        FROM cohort_companies
        WHERE nace_division = ${naceDivision}
          AND size_band     = ${sizeBand}
          AND ${sqlUser(column)} IS NOT NULL
      `;
      return rows.map((r) => Number(r.v));
    },
  });

  // Rung 2 — (naceDivision, region) — drop size
  if (region !== null) {
    rungs.push({
      rung: 2,
      query: async () => {
        const rows = await sqlUser<{ v: number }[]>`
          SELECT ${sqlUser(column)} AS v
          FROM cohort_companies
          WHERE nace_division = ${naceDivision}
            AND cz_region     = ${region}
            AND ${sqlUser(column)} IS NOT NULL
        `;
        return rows.map((r) => Number(r.v));
      },
    });
  }

  // Rung 3 — (naceDivision) — drop both
  rungs.push({
    rung: 3,
    query: async () => {
      const rows = await sqlUser<{ v: number }[]>`
        SELECT ${sqlUser(column)} AS v
        FROM cohort_companies
        WHERE nace_division = ${naceDivision}
          AND ${sqlUser(column)} IS NOT NULL
      `;
      return rows.map((r) => Number(r.v));
    },
  });

  // Walk the ladder
  for (const { rung, query } of rungs) {
    const values = await query();
    if (values.length >= floor) {
      const result = { values, rung, n: values.length };
      requestMemo.set(memoKey, result);
      return result;
    }
  }

  // All rungs failed
  requestMemo.set(memoKey, null);
  return null;
}

// ── getSyntheticQuintiles ─────────────────────────────────────────────────────

/**
 * Fetch DE-authored synth quintiles from cohort_aggregates for a given
 * (naceDivision, metricId) cell.
 *
 * Returns null if no row with source = 'synthetic' exists.
 * (percentile-compute.md §6.1, D-025)
 */
export async function getSyntheticQuintiles(
  naceDivision: string,
  metricId: MetricId
): Promise<SynthQuintiles | null> {
  const rows = await sqlUser<{
    q1: number;
    q2: number;
    median: number;
    q3: number;
    q4: number;
    n_proxy: number;
  }[]>`
    SELECT q1, q2, median, q3, q4, n_proxy
    FROM cohort_aggregates
    WHERE nace_division = ${naceDivision}
      AND metric_id     = ${metricId}
      AND source        = 'synthetic'
    LIMIT 1
  `;

  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    q1: Number(r.q1),
    q2: Number(r.q2),
    median: Number(r.median),
    q3: Number(r.q3),
    q4: Number(r.q4),
    n_proxy: Number(r.n_proxy),
  };
}

/**
 * getNaceDivisionByIco — look up the 2-digit NACE division for a given IČO.
 * Returns the nace_division from the most recent year for that IČO, or null
 * if the IČO is not found in cohort_companies.
 * Used by the IČO-based demo switcher (D-023, route.ts Track A).
 */
export async function getNaceDivisionByIco(ico: string): Promise<string | null> {
  const rows = await sqlUser<{ nace_division: string }[]>`
    SELECT nace_division
    FROM cohort_companies
    WHERE ico = ${ico}
    ORDER BY year DESC
    LIMIT 1
  `;
  return rows[0]?.nace_division ?? null;
}

/**
 * getCohortAggregate — fetch either a real or synth aggregate row for a cell.
 * Returns the real row when both exist (D-025 / OQ-PC-03), else the synth row,
 * else null.
 */
export async function getCohortAggregate(
  naceDivision: string,
  metricId: MetricId
): Promise<{ source: "real" | "synthetic"; data: SynthQuintiles } | null> {
  const rows = await sqlUser<{
    source: string;
    q1: number;
    q2: number;
    median: number;
    q3: number;
    q4: number;
    n_proxy: number;
  }[]>`
    SELECT source, q1, q2, median, q3, q4, n_proxy
    FROM cohort_aggregates
    WHERE nace_division = ${naceDivision}
      AND metric_id     = ${metricId}
    ORDER BY CASE source WHEN 'real' THEN 0 ELSE 1 END
    LIMIT 1
  `;

  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    source: r.source as "real" | "synthetic",
    data: {
      q1: Number(r.q1),
      q2: Number(r.q2),
      median: Number(r.median),
      q3: Number(r.q3),
      q4: Number(r.q4),
      n_proxy: Number(r.n_proxy),
    },
  };
}
