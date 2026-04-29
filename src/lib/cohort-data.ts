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
 *
 * v0.3 connection note: refactored from postgres tagged-template SQL to
 * @supabase/supabase-js REST client because the dev environment blocks
 * outbound TCP 5432/6543 to the Supabase pooler. Same constraint that
 * forced the same refactor in lib/briefs.ts and the from-n8n route.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { MetricId, SynthQuintiles } from "./cohort-compute";
import { getFloor } from "./cohort-compute";
import type { CzRegion, SizeBand } from "../types/data-lanes";

// ── Supabase REST client ─────────────────────────────────────────────────────

let _client: SupabaseClient | null = null;
function db(): SupabaseClient {
  if (_client) return _client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("[cohort-data] NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY must be set");
  }
  _client = createClient(url, key, { auth: { persistSession: false } });
  return _client;
}

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
  // ROE added in migration 0012 (D-032). Populated from
  // HV za účetní období / Vlastní kapitál × 100 at ingest time.
  roe: "roe",
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

// ── Helper: fetch cohort_companies values for a given filter set ─────────────

async function fetchValues(
  column: string,
  filters: { nace_division: string; size_band?: SizeBand; cz_region?: CzRegion }
): Promise<number[]> {
  let q = db()
    .from("cohort_companies")
    .select(column)
    .eq("nace_division", filters.nace_division)
    .not(column, "is", null);
  if (filters.size_band !== undefined) q = q.eq("size_band", filters.size_band);
  if (filters.cz_region !== undefined) q = q.eq("cz_region", filters.cz_region);

  // Supabase REST default page size is 1000 rows. For larger cohorts (NACE 49
  // freight has ~3500 rows) we must paginate to fetch all values; otherwise
  // percentile compute runs against a truncated cohort.
  const pageSize = 1000;
  const all: number[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await q.range(from, from + pageSize - 1);
    if (error) {
      throw new Error(`[cohort-data] fetchValues: ${error.message}`);
    }
    if (!data || data.length === 0) break;
    for (const row of data as unknown as Array<Record<string, number | null>>) {
      const v = row[column];
      if (v !== null && v !== undefined) all.push(Number(v));
    }
    if (data.length < pageSize) break;
  }
  return all;
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

  // Build the four rungs in order. Rungs 0 and 2 require region; skip when null.
  const rungs: Array<{
    rung: 0 | 1 | 2 | 3;
    query: () => Promise<number[]>;
  }> = [];

  // Rung 0 — (naceDivision, sizeBand, region)
  if (region !== null) {
    rungs.push({
      rung: 0,
      query: () =>
        fetchValues(column, {
          nace_division: naceDivision,
          size_band: sizeBand,
          cz_region: region,
        }),
    });
  }

  // Rung 1 — (naceDivision, sizeBand) — drop region
  rungs.push({
    rung: 1,
    query: () =>
      fetchValues(column, { nace_division: naceDivision, size_band: sizeBand }),
  });

  // Rung 2 — (naceDivision, region) — drop size
  if (region !== null) {
    rungs.push({
      rung: 2,
      query: () =>
        fetchValues(column, { nace_division: naceDivision, cz_region: region }),
    });
  }

  // Rung 3 — (naceDivision) — drop both
  rungs.push({
    rung: 3,
    query: () => fetchValues(column, { nace_division: naceDivision }),
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
  const { data, error } = await db()
    .from("cohort_aggregates")
    .select("q1, q2, median, q3, q4, n_proxy")
    .eq("nace_division", naceDivision)
    .eq("metric_id", metricId)
    .eq("source", "synthetic")
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`[cohort-data] getSyntheticQuintiles: ${error.message}`);
  }
  if (!data) return null;
  const r = data as {
    q1: number;
    q2: number;
    median: number;
    q3: number;
    q4: number;
    n_proxy: number;
  };
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
  const { data, error } = await db()
    .from("cohort_companies")
    .select("nace_division")
    .eq("ico", ico)
    .order("year", { ascending: false })
    .limit(1);
  if (error) {
    throw new Error(`[cohort-data] getNaceDivisionByIco: ${error.message}`);
  }
  return ((data ?? [])[0] as { nace_division: string } | undefined)?.nace_division ?? null;
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
  // No CASE WHEN equivalent in REST. Fetch all matching rows (≤2: one real,
  // one synth) and pick real when present.
  const { data, error } = await db()
    .from("cohort_aggregates")
    .select("source, q1, q2, median, q3, q4, n_proxy")
    .eq("nace_division", naceDivision)
    .eq("metric_id", metricId);
  if (error) {
    throw new Error(`[cohort-data] getCohortAggregate: ${error.message}`);
  }
  if (!data || data.length === 0) return null;
  const rows = data as Array<{
    source: string;
    q1: number;
    q2: number;
    median: number;
    q3: number;
    q4: number;
    n_proxy: number;
  }>;
  const real = rows.find((r) => r.source === "real");
  const synth = rows.find((r) => r.source === "synthetic");
  const picked = real ?? synth;
  if (!picked) return null;
  return {
    source: picked.source as "real" | "synthetic",
    data: {
      q1: Number(picked.q1),
      q2: Number(picked.q2),
      median: Number(picked.median),
      q3: Number(picked.q3),
      q4: Number(picked.q4),
      n_proxy: Number(picked.n_proxy),
    },
  };
}
