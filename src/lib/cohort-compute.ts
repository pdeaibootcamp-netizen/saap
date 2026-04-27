/**
 * cohort-compute.ts — Pure percentile computation functions (Track B)
 *
 * No DB calls. No Supabase imports. All DB reads happen in cohort-data.ts.
 * Algorithm spec: docs/data/percentile-compute.md §3–§6.
 * ADR: cohort-runtime.md ADR-CR-01 (pure module, DB-free).
 *
 * Percentile algorithm: Hyndman & Fan (1996) type 4, applied as a
 * mid-rank percentile rank for an external query point against a
 * pre-fetched sorted cohort array.
 *
 * Hyndman, R.J. and Fan, Y. (1996). "Sample quantiles in statistical
 * packages." The American Statistician, 50(4), 361–365.
 * Definition (type 4 / SAS PROC RANK PERCENT with mid-tie):
 *
 *   rank(x, V) = #{i : V_i < x} + 0.5 × #{i : V_i = x}
 *   percentile(x, V) = rank(x, V) / n × 100
 *
 * where V = {V_1, …, V_n} is the (winsorized) cohort and x is the owner value.
 * The owner is NOT a member of V (owner lives in owner_metrics, cohort in
 * cohort_companies). This is the correct algebra for an external query point.
 *
 * Floors (cohort-math.md §3.1–§3.2):
 *   - Global: N ≥ 30
 *   - Per-metric for working_capital_cycle, pricing_power: N ≥ 50
 */

import type { CzRegion, SizeBand } from "../types/data-lanes";

// ── Frozen type aliases ───────────────────────────────────────────────────────

export type MetricId =
  | "gross_margin"
  | "ebitda_margin"
  | "labor_cost_ratio"
  | "revenue_per_employee"
  | "working_capital_cycle"
  | "net_margin"
  | "revenue_growth"
  | "pricing_power";

export type QuartileLabel =
  | "spodní čtvrtina"
  | "druhá čtvrtina"
  | "třetí čtvrtina"
  | "horní čtvrtina";

// ── Floor constants ───────────────────────────────────────────────────────────

/** Global statistical-validity floor (cohort-math.md §3.1). */
const GLOBAL_FLOOR = 30;

/** Stricter per-metric floor for heavy-tail metrics (cohort-math.md §3.2). */
const STRICT_FLOOR_METRIC_IDS: ReadonlyArray<MetricId> = [
  "working_capital_cycle",
  "pricing_power",
];
const STRICT_FLOOR = 50;

// ── Canonical rung footnotes (percentile-compute.md §5) ──────────────────────

const RUNG_FOOTNOTES: Record<1 | 2 | 3 | 4, string> = {
  1: "Srovnání s českými firmami vaší velikosti v oboru — bez regionálního rozlišení.",
  2: "Srovnání s firmami ve vašem regionu a oboru — napříč velikostmi.",
  3: "Srovnání s českými firmami ve vašem oboru.",
  4: "Tato hodnota není k dispozici — počet firem v kohortě je zatím příliš nízký pro spolehlivé srovnání.",
};

// ── Exported interfaces ───────────────────────────────────────────────────────

export interface SynthQuintiles {
  q1: number;
  q2: number;
  median: number;
  q3: number;
  q4: number;
  n_proxy: number;
}

export interface PercentileInput {
  metricId: MetricId;
  ownerValue: number;
  naceDivision: string;
  sizeBand: SizeBand;
  region: CzRegion | null;
}

export interface PercentileResult {
  percentile: number | null;
  quartileLabel: QuartileLabel | null;
  confidenceState: "valid" | "below-floor" | "empty";
  /** Rung at which computation succeeded; 4 = suppressed */
  achievedRung: 0 | 1 | 2 | 3 | 4;
  /** Count of cohort firms used at the winning rung; null when no result */
  nUsed: number | null;
  source: "real" | "synthetic" | "mixed";
  footnote: string | null;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Returns the relevant floor for a metric (cohort-math.md §3.1–§3.2).
 */
export function getFloor(metricId: MetricId): number {
  return STRICT_FLOOR_METRIC_IDS.includes(metricId) ? STRICT_FLOOR : GLOBAL_FLOOR;
}

/**
 * Determines whether a cohort of size n meets the validity floor.
 *
 * Returns:
 *   'valid'       — n ≥ floor, data may be used.
 *   'below-floor' — n < floor but n > 0; data suppressed.
 *   'empty'       — n === 0; no data at all.
 */
export function determineConfidenceState(
  metricId: MetricId,
  cohortN: number
): "valid" | "below-floor" | "empty" {
  if (cohortN <= 0) return "empty";
  return cohortN >= getFloor(metricId) ? "valid" : "below-floor";
}

/**
 * Winsorize an array at the 1st and 99th percentiles using simple nearest-rank.
 * The winsorized array has the same length; extreme values are replaced by the
 * 1st/99th percentile boundary values. Winsorized firms still count toward N.
 * (cohort-math.md §5.2)
 */
function winsorize(values: number[]): number[] {
  if (values.length === 0) return [];
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  // Index of the 1st percentile (floor of 0.01 * n, clamped to 0)
  const lo = Math.max(0, Math.floor(0.01 * n));
  const hi = Math.min(n - 1, Math.ceil(0.99 * n) - 1);
  const loVal = sorted[lo];
  const hiVal = sorted[hi];
  return values.map((v) => Math.max(loVal, Math.min(hiVal, v)));
}

/**
 * Hyndman & Fan type 4 mid-rank percentile rank.
 *
 * Formula (percentile-compute.md §3.4):
 *   rank(x) = #{i : v_i < x} + 0.5 × #{i : v_i = x}
 *   percentile = rank(x) / n × 100
 *
 * The owner (x) is external to the cohort (V). Result rounded to 1 decimal.
 */
function midRankPercentile(ownerValue: number, cohortValues: number[]): number {
  const n = cohortValues.length;
  if (n === 0) return 0;
  let below = 0;
  let equal = 0;
  for (const v of cohortValues) {
    if (v < ownerValue) below++;
    else if (v === ownerValue) equal++;
  }
  const rank = below + 0.5 * equal;
  return Math.round((rank / n) * 1000) / 10; // one decimal place
}

/**
 * Map a percentile [0, 100] to a frozen Czech quartile label.
 * Boundary rules (percentile-compute.md §3.5):
 *   < 25  → spodní čtvrtina
 *   25–<50 → druhá čtvrtina
 *   50–<75 → třetí čtvrtina
 *   ≥ 75  → horní čtvrtina
 */
export function computeQuartileLabel(percentile: number): QuartileLabel {
  if (percentile < 25) return "spodní čtvrtina";
  if (percentile < 50) return "druhá čtvrtina";
  if (percentile < 75) return "třetí čtvrtina";
  return "horní čtvrtina";
}

/**
 * Piecewise-linear interpolation on synth quintile boundaries.
 * (percentile-compute.md §6.2)
 *
 * Boundaries:  (-∞, 0), (q1, 20), (q2, 40), (median, 50), (q3, 60), (q4, 80), (+∞, 100)
 * Clamps:
 *   x < q1  → percentile in [0, 20]
 *   x > q4  → percentile in [80, 100]
 *   otherwise → linear interpolation between adjacent stored quintiles
 */
export function computePercentileFromQuintiles(
  metricId: string,
  ownerValue: number,
  quintiles: { q1: number; q2: number; q3: number; q4: number; median: number }
): { percentile: number; quartileLabel: QuartileLabel } {
  const { q1, q2, median, q3, q4 } = quintiles;

  // Segments: [v_lo, p_lo, v_hi, p_hi]
  const segments: Array<[number, number, number, number]> = [
    [q1, 20, q2, 40],
    [q2, 40, median, 50],
    [median, 50, q3, 60],
    [q3, 60, q4, 80],
  ];

  let pct: number;

  if (ownerValue <= q1) {
    // Below or at q1 — clamp to [0, 20]
    if (q1 === ownerValue) {
      pct = 20;
    } else {
      // Linear extrapolation toward 0; clamp at 0
      // We don't have a lower bound so we just clamp to spodní čtvrtina
      pct = Math.max(0, Math.min(20, 20 * (ownerValue / q1)));
    }
  } else if (ownerValue >= q4) {
    // Above or at q4 — clamp to [80, 100]
    pct = 100;
  } else {
    // Interior: find the segment containing ownerValue
    pct = 80; // default to q4 bucket start (should be overridden)
    for (const [vLo, pLo, vHi, pHi] of segments) {
      if (ownerValue >= vLo && ownerValue <= vHi) {
        if (vHi === vLo) {
          pct = pLo;
        } else {
          pct = pLo + ((ownerValue - vLo) / (vHi - vLo)) * (pHi - pLo);
        }
        break;
      }
    }
  }

  pct = Math.round(pct * 10) / 10;
  pct = Math.max(0, Math.min(100, pct));

  return { percentile: pct, quartileLabel: computeQuartileLabel(pct) };
}

// ── Main exported function ────────────────────────────────────────────────────

/**
 * computePercentile — main entry point (cohort-runtime.md §4.1)
 *
 * Takes pre-fetched real cohort values and/or synth quintiles.
 * Algorithm:
 *   1. If realValues is provided and n ≥ floor:
 *      - Winsorize at 1st/99th.
 *      - Compute mid-rank percentile (Hyndman & Fan type 4).
 *      - Map to quartile label.
 *      - source = 'real'
 *   2. Else if synth quintiles provided:
 *      - Piecewise-linear interpolation (percentile-compute.md §6.2).
 *      - source = 'synthetic'; n_proxy = synth.n_proxy (always 200 for DE rows).
 *      - Synth rows never trigger rung 4 (n_proxy = 200 >> floor).
 *   3. Else → confidenceState = 'empty', achievedRung = 4.
 *
 * @param input       — owner context (metricId, ownerValue, naceDivision, etc.)
 * @param realValues  — pre-fetched cohort values from cohort_companies at the
 *                      winning rung; null if no real-data path succeeded.
 * @param synth       — synth quintiles from cohort_aggregates; null if no row.
 * @param achievedRung — the rung at which realValues was fetched (0–3); ignored
 *                       when realValues is null.
 */
// Overload 1 — Track B full call with pre-fetched values (primary path used by cohort.ts)
export function computePercentile(
  input: PercentileInput,
  realValues: number[] | null,
  synth: SynthQuintiles | null,
  achievedRung?: 0 | 1 | 2 | 3
): PercentileResult;

// Overload 2 — Track A single-arg call: computePercentile(input)
// Called from owner-metrics.ts tryGetPercentile with a PercentileInput-shaped object
// (metricId typed as string rather than MetricId union) and without pre-fetched cohort
// values. Returns PercentileResult in below-floor / empty state since this pure module
// cannot do DB lookups (ADR-CR-01). Track A maps .confidenceState in its own projection.
export function computePercentile(
  input: { metricId: string; ownerValue: number; naceDivision: string; sizeBand: SizeBand; region: CzRegion | null }
): PercentileResult;

// Implementation
export function computePercentile(
  input: PercentileInput | { metricId: string; ownerValue: number; naceDivision: string; sizeBand: SizeBand; region: CzRegion | null },
  realValues?: number[] | null,
  synth?: SynthQuintiles | null,
  achievedRung: 0 | 1 | 2 | 3 = 0
): PercentileResult {
  const realValuesArg = realValues ?? null;
  const synthArg = synth ?? null;

  const floor = getFloor(input.metricId as MetricId);

  // ── Real-data path ─────────────────────────────────────────────────────────
  if (realValuesArg !== null && realValuesArg.length >= floor) {
    const winsorized = winsorize(realValuesArg);
    const pct = midRankPercentile(input.ownerValue, winsorized);
    const ql = computeQuartileLabel(pct);
    const fn =
      achievedRung === 0
        ? null
        : RUNG_FOOTNOTES[achievedRung as 1 | 2 | 3 | 4];
    return {
      percentile: pct,
      quartileLabel: ql,
      confidenceState: "valid",
      achievedRung,
      nUsed: realValuesArg.length,
      source: "real",
      footnote: fn ?? null,
    };
  }

  // ── Synth-fallback path ────────────────────────────────────────────────────
  // Synth rows are authoritative (n_proxy = 200 >> floor); they never trigger rung 4.
  // (percentile-compute.md §6.4, D-025)
  if (synthArg !== null) {
    const { percentile: pct, quartileLabel: ql } = computePercentileFromQuintiles(
      input.metricId,
      input.ownerValue,
      synthArg
    );
    return {
      percentile: pct,
      quartileLabel: ql,
      confidenceState: "valid",
      achievedRung: 3, // synth applies at NACE-only grain (percentile-compute.md §7.3)
      nUsed: synthArg.n_proxy,
      source: "synthetic",
      footnote: RUNG_FOOTNOTES[3],
    };
  }

  // ── No data at all ─────────────────────────────────────────────────────────
  const state =
    realValuesArg !== null && realValuesArg.length > 0 ? "below-floor" : "empty";
  return {
    percentile: null,
    quartileLabel: null,
    confidenceState: state,
    achievedRung: 4,
    nUsed: realValuesArg?.length ?? null,
    source: "real",
    footnote: RUNG_FOOTNOTES[4],
  };
}

