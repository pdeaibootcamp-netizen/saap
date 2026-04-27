/**
 * owner-metrics.ts — v0.3 owner metric read path
 *
 * When USE_REAL_OWNER_METRICS=true (default), reads from the owner_metrics
 * Supabase table for the given user and derives percentile/quartile from a
 * cohort-compute stub (or Track B's real compute when available).
 *
 * When USE_REAL_OWNER_METRICS is unset or false, falls back to the v0.2
 * in-memory fixture so the build never hard-fails.
 *
 * Privacy: owner_metrics is user_contributed lane only. This module never
 * writes to or reads from briefs, rm_visible, or credit_risk tables.
 *
 * v0.3 shape changes vs v0.2:
 *   - raw_value is stored as a human-meaningful number (23.4 for 23,4 %)
 *     rather than a 0–1 decimal. Display formatting is pre-computed on write
 *     and stored in raw_value_display. (owner-metrics-schema.md §3)
 *   - confidence_state gains "ask" when raw_value IS NULL.
 *   - Metric ROCE is removed; net_margin added (D-024).
 */

import { createClient } from "@supabase/supabase-js";
import { DEMO_OWNER_USER_ID } from "./demo-owner";
import type { BenchmarkMetric } from "./briefs";
import { OWNER_METRIC_ID, type OwnerMetricId } from "../types/data-lanes";

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * Per-owner raw metric value for the dashboard tile layer.
 * Extends v0.2 shape with the new "ask" confidence_state.
 */
export interface OwnerMetric {
  metric_id: string;         // matches OWNER_METRIC_ID values
  metric_label: string;      // frozen Czech label per D-011/D-015/D-024
  category_id: string;       // one of the four D-011 category IDs
  raw_value: number | null;  // null = owner hasn't provided this value yet
  raw_value_display: string | null; // Czech-formatted, render-ready; null when raw_value null
  unit_note: string;         // short human note about unit/interpretation
  confidence_state: BenchmarkMetric["confidence_state"] | "ask";
  quartile_label: string | null;
  percentile: number | null;
  // Additional props for ask-state tiles
  prompt_help_text?: string;
  unit_suffix?: string;
}

// ─── Metric metadata — frozen D-024 set ──────────────────────────────────────

const THIN_SPACE = " ";

interface MetricMeta {
  label: string;
  category_id: string;
  unit_note: string;
  prompt_help_text: string;
  unit_suffix: string;
}

const METRIC_META: Record<OwnerMetricId, MetricMeta> = {
  gross_margin: {
    label: "Hrubá marže",
    category_id: "ziskovost",
    unit_note: "percent, stored as 23.4 for 23,4 %",
    prompt_help_text: "Uveďte prosím vaši hrubou marži za poslední uzavřený rok.",
    unit_suffix: "%",
  },
  ebitda_margin: {
    label: "Marže EBITDA",
    category_id: "ziskovost",
    unit_note: "percent",
    prompt_help_text: "Uveďte prosím vaši EBITDA marži za poslední uzavřený rok.",
    unit_suffix: "%",
  },
  net_margin: {
    label: "Čistá marže",
    category_id: "ziskovost",
    unit_note: "percent (replaces ROCE per D-024)",
    prompt_help_text: "Uveďte prosím vaši čistou marži za poslední uzavřený rok (hospodářský výsledek dělený obratem).",
    unit_suffix: "%",
  },
  labor_cost_ratio: {
    label: "Podíl osobních nákladů",
    category_id: "naklady-produktivita",
    unit_note: "percent",
    prompt_help_text: "Uveďte prosím podíl mzdových a osobních nákladů na vašich tržbách.",
    unit_suffix: "%",
  },
  revenue_per_employee: {
    label: "Tržby na zaměstnance",
    category_id: "naklady-produktivita",
    unit_note: "thousands of CZK per FTE per year",
    prompt_help_text: "Uveďte prosím průměrné roční tržby na jednoho zaměstnance.",
    unit_suffix: "tis. Kč",
  },
  working_capital_cycle: {
    label: "Cyklus pracovního kapitálu",
    category_id: "efektivita-kapitalu",
    unit_note: "days (DSO+DIO−DPO)",
    prompt_help_text: "Uveďte prosím, kolik dní v průměru trvá váš cyklus pracovního kapitálu (od nákupu po inkaso).",
    unit_suffix: "dní",
  },
  revenue_growth: {
    label: "Růst tržeb",
    category_id: "rust-trzni-pozice",
    unit_note: "percent YoY; sign-prefixed",
    prompt_help_text: "Uveďte prosím meziroční růst vašich tržeb za poslední uzavřený rok.",
    unit_suffix: "%",
  },
  pricing_power: {
    label: "Cenová síla",
    category_id: "rust-trzni-pozice",
    unit_note: "percentage points YoY margin delta",
    prompt_help_text: "Uveďte prosím, o kolik procentních bodů se za poslední rok změnila vaše marže oproti předchozímu roku.",
    unit_suffix: "p. b.",
  },
};

// ─── Canonical metric order (recommended-ask order, in-tile-prompts.md §7) ───

const METRIC_ORDER: OwnerMetricId[] = [
  "gross_margin",
  "ebitda_margin",
  "net_margin",
  "revenue_per_employee",
  "labor_cost_ratio",
  "revenue_growth",
  "working_capital_cycle",
  "pricing_power",
];

// ─── Czech locale formatting ──────────────────────────────────────────────────

/**
 * Format a raw numeric value for display per owner-metrics-schema.md §3.
 * Returns null when rawValue is null (ask state).
 */
function formatDisplay(metricId: OwnerMetricId, rawValue: number | null): string | null {
  if (rawValue === null) return null;

  const signPlus = (n: number) => (n >= 0 ? "+" : "");

  switch (metricId) {
    case "gross_margin":
    case "ebitda_margin":
    case "net_margin":
    case "labor_cost_ratio": {
      const formatted = rawValue.toFixed(1).replace(".", ",");
      return `${formatted} %`;
    }
    case "revenue_per_employee": {
      // Stored in thousands; display with thin-space thousands separator.
      const int = Math.round(rawValue);
      const str = int.toLocaleString("cs-CZ").replace(/\s/g, THIN_SPACE);
      return `${str} tis. Kč`;
    }
    case "working_capital_cycle": {
      const int = Math.round(rawValue);
      return `${int} dní`;
    }
    case "revenue_growth": {
      const formatted = Math.abs(rawValue).toFixed(1).replace(".", ",");
      return `${signPlus(rawValue)}${formatted} %`;
    }
    case "pricing_power": {
      const formatted = Math.abs(rawValue).toFixed(1).replace(".", ",");
      // Use Unicode minus U+2212 for negative per schema
      const sign = rawValue >= 0 ? "+" : "−";
      return `${sign}${formatted} p. b.`;
    }
    default:
      return String(rawValue);
  }
}

// ─── Cohort compute stub ─────────────────────────────────────────────────────

interface StubPercentileResult {
  percentile: number | null;
  quartile_label: string | null;
  confidence_state: "valid" | "below-floor" | "empty";
}

/**
 * Cross-track bridge: compute percentiles for all metrics with raw values
 * via Track B's getBenchmarkSnapshotAsync(), in a single batch call.
 *
 * Per cohort-runtime.md §4.3, getBenchmarkSnapshotAsync walks the four-rung
 * degradation ladder per metric and applies real-data + synth-quintile
 * fallback per D-025. Returns a BenchmarkSnippet whose categories.metrics[]
 * carry computed percentile / quartile_label / confidence_state.
 *
 * If Track B's module is unreachable (hasn't shipped, DB unreachable, or
 * cohort_aggregates is empty), this returns null and callers fall back to
 * confidence_state="below-floor" per metric. Build never hard-fails.
 *
 * @param ownerValues — Map<MetricId, number | null> per Track B contract.
 * @param naceDivision — 2-digit NACE division (e.g. "49").
 * @param sizeBand    — S1 | S2 | S3, from active demo profile.
 * @param region      — CzRegion string or null.
 */
async function computeBenchmarkSnippet(
  ownerValues: Map<string, number | null>,
  naceDivision: string,
  sizeBand: "S1" | "S2" | "S3",
  region: string | null,
): Promise<BenchmarkMetric[] | null> {
  try {
    const cohort = await import("./cohort").catch(() => null);
    if (!cohort?.getBenchmarkSnapshotAsync) return null;

    // Track B's signature: (naceDivision, sizeBand, region, Map<MetricId, number|null>)
    // The Map keys are MetricId-typed; owner-metrics uses string-typed keys but the
    // values are the same frozen 8 IDs. Cast through unknown to honour the typed signature.
    const snippet = await cohort.getBenchmarkSnapshotAsync(
      naceDivision,
      sizeBand as never,
      region as never,
      ownerValues as never,
    );

    // Flatten categories → metrics array, preserving the per-metric percentile fields.
    return snippet.categories.flatMap((c) => c.metrics);
  } catch (err) {
    console.error("[owner-metrics] cohort compute failed:", err);
    return null;
  }
}

// ─── v0.2 fixture fallback ───────────────────────────────────────────────────

const FIXTURE_METRICS: Omit<OwnerMetric, "confidence_state" | "quartile_label" | "percentile">[] = [
  {
    metric_id: "gross_margin",
    metric_label: "Hrubá marže",
    category_id: "ziskovost",
    raw_value: 23.4,
    raw_value_display: `23,4 %`,
    unit_note: "percent",
    prompt_help_text: METRIC_META.gross_margin.prompt_help_text,
    unit_suffix: "%",
  },
  {
    metric_id: "ebitda_margin",
    metric_label: "Marže EBITDA",
    category_id: "ziskovost",
    raw_value: 8.2,
    raw_value_display: `8,2 %`,
    unit_note: "percent",
    prompt_help_text: METRIC_META.ebitda_margin.prompt_help_text,
    unit_suffix: "%",
  },
  {
    metric_id: "net_margin",
    metric_label: "Čistá marže",
    category_id: "ziskovost",
    raw_value: 5.1,
    raw_value_display: `5,1 %`,
    unit_note: "percent",
    prompt_help_text: METRIC_META.net_margin.prompt_help_text,
    unit_suffix: "%",
  },
  {
    metric_id: "labor_cost_ratio",
    metric_label: "Podíl osobních nákladů",
    category_id: "naklady-produktivita",
    raw_value: 29.8,
    raw_value_display: `29,8 %`,
    unit_note: "percent",
    prompt_help_text: METRIC_META.labor_cost_ratio.prompt_help_text,
    unit_suffix: "%",
  },
  {
    metric_id: "revenue_per_employee",
    metric_label: "Tržby na zaměstnance",
    category_id: "naklady-produktivita",
    raw_value: 2450,
    raw_value_display: `2${THIN_SPACE}450 tis. Kč`,
    unit_note: "thousands CZK per FTE",
    prompt_help_text: METRIC_META.revenue_per_employee.prompt_help_text,
    unit_suffix: "tis. Kč",
  },
  {
    metric_id: "working_capital_cycle",
    metric_label: "Cyklus pracovního kapitálu",
    category_id: "efektivita-kapitalu",
    raw_value: 62,
    raw_value_display: `62 dní`,
    unit_note: "days",
    prompt_help_text: METRIC_META.working_capital_cycle.prompt_help_text,
    unit_suffix: "dní",
  },
  {
    metric_id: "revenue_growth",
    metric_label: "Růst tržeb",
    category_id: "rust-trzni-pozice",
    raw_value: 3.1,
    raw_value_display: `+3,1 %`,
    unit_note: "percent YoY",
    prompt_help_text: METRIC_META.revenue_growth.prompt_help_text,
    unit_suffix: "%",
  },
  {
    metric_id: "pricing_power",
    metric_label: "Cenová síla",
    category_id: "rust-trzni-pozice",
    raw_value: 0.8,
    raw_value_display: `+0,8 p. b.`,
    unit_note: "pp YoY margin delta",
    prompt_help_text: METRIC_META.pricing_power.prompt_help_text,
    unit_suffix: "p. b.",
  },
];

function getFixtureMetrics(): OwnerMetric[] {
  return FIXTURE_METRICS.map((raw) => ({
    ...raw,
    confidence_state: "valid" as const,
    quartile_label: "třetí čtvrtina",
    percentile: 55,
  }));
}

// ─── DB-backed implementation ─────────────────────────────────────────────────

/**
 * Read the 8 owner metrics from owner_metrics table.
 * Returns all 8 metric rows regardless of nullability — callers
 * render "ask" state for rows with raw_value === null.
 *
 * naceDivision: used to route the cohort-compute percentile lookup.
 * Falls back to "49" (NACE 49.41 = demo NACE) when not supplied.
 */
async function getOwnerMetricsFromDB(
  userId: string,
  naceDivision: string = "49",
): Promise<OwnerMetric[]> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    // DB not configured — return fixture
    return getFixtureMetrics();
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  const { data, error } = await supabase
    .from("owner_metrics")
    .select("metric_id, raw_value, raw_value_display, source, captured_at")
    .eq("user_id", userId);

  if (error) {
    console.error("[owner-metrics] DB read error:", error.message);
    return getFixtureMetrics();
  }

  // Index DB rows by metric_id
  const dbIndex = new Map<string, { raw_value: number | null; raw_value_display: string | null }>();
  for (const row of data ?? []) {
    dbIndex.set(row.metric_id, {
      raw_value: row.raw_value !== undefined ? row.raw_value : null,
      raw_value_display: row.raw_value_display ?? null,
    });
  }

  // ── Batch percentile compute via Track B (cross-track bridge) ───────────────
  // Build an owner-values map keyed by metricId; pass once to getBenchmarkSnapshotAsync.
  const ownerValuesMap = new Map<string, number | null>();
  for (const metricId of METRIC_ORDER) {
    const dbRow = dbIndex.get(metricId);
    ownerValuesMap.set(metricId, dbRow?.raw_value ?? null);
  }

  // Demo profile defaults (DEMO_OWNER_PROFILE in demo-owner.ts).
  // v0.3 demo NACE = 49 (Silniční nákladní doprava). When the IČO switcher
  // changes the active firm at runtime, the cookie flow updates the profile;
  // for the v0.3 PoC we default to the seeded NACE division and size/region.
  const sizeBand = "S2"; // mid-size SME (DEMO_OWNER_PROFILE)
  const region = "Praha"; // DEMO_OWNER_PROFILE

  const benchmarkMetrics = await computeBenchmarkSnippet(
    ownerValuesMap,
    naceDivision,
    sizeBand,
    region,
  );

  // Index Track B's per-metric results for O(1) lookup
  const benchmarkByMetric = new Map<string, BenchmarkMetric>();
  if (benchmarkMetrics) {
    for (const bm of benchmarkMetrics) {
      benchmarkByMetric.set(bm.metric_id, bm);
    }
  }

  // Build OwnerMetric array for all 8 frozen metrics in canonical order
  const results: OwnerMetric[] = [];

  for (const metricId of METRIC_ORDER) {
    const meta = METRIC_META[metricId];
    const dbRow = dbIndex.get(metricId);
    const rawValue = dbRow?.raw_value ?? null;

    let confidence_state: OwnerMetric["confidence_state"] = "ask";
    let quartile_label: string | null = null;
    let percentile: number | null = null;

    if (rawValue !== null) {
      // Value exists — pick percentile from Track B's batch result
      const bm = benchmarkByMetric.get(metricId);
      if (bm) {
        // Map BenchmarkMetric.confidence_state ("valid"|"below-floor"|"empty")
        // to OwnerMetric.confidence_state (same set + "ask").
        confidence_state = bm.confidence_state as OwnerMetric["confidence_state"];
        quartile_label = bm.quartile_label;
        percentile = bm.percentile;
      } else {
        // Track B didn't return this metric — degrade gracefully
        confidence_state = "below-floor";
      }
    }
    // else: raw_value is null → confidence_state stays "ask"

    const displayValue = dbRow?.raw_value_display ?? (rawValue !== null ? formatDisplay(metricId, rawValue) : null);

    results.push({
      metric_id: metricId,
      metric_label: meta.label,
      category_id: meta.category_id,
      raw_value: rawValue,
      raw_value_display: displayValue,
      unit_note: meta.unit_note,
      confidence_state,
      quartile_label,
      percentile,
      prompt_help_text: meta.prompt_help_text,
      unit_suffix: meta.unit_suffix,
    });
  }

  return results;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Return the 8 owner metrics for the given user.
 *
 * When USE_REAL_OWNER_METRICS=true (default):
 *   Reads from owner_metrics table; falls back to fixture on DB error.
 *
 * When USE_REAL_OWNER_METRICS is unset or "false":
 *   Returns the v0.2 in-memory fixture unconditionally.
 *
 * naceDivision: used for percentile compute routing; defaults to "49"
 * (NACE 49.41 Silniční nákladní doprava — v0.3 demo NACE).
 */
export async function getOwnerMetrics(
  userId: string,
  naceDivision?: string,
): Promise<OwnerMetric[]> {
  if (userId !== DEMO_OWNER_USER_ID) {
    // Non-demo user — no data available at v0.3
    return [];
  }

  const useReal = process.env.USE_REAL_OWNER_METRICS !== "false";

  if (!useReal) {
    return getFixtureMetrics();
  }

  return getOwnerMetricsFromDB(userId, naceDivision ?? "49");
}

// Re-export for type-checking in tests
export { METRIC_META, METRIC_ORDER, formatDisplay };
