/**
 * owner-metrics.ts — Synthetic PoC demo fixture
 *
 * SYNTHETIC DATA. NOT A REAL ČS CLIENT. Not user_contributed lane.
 * Not in cohort_stats. Not consent-backed. Exists only on the v0.2 PoC
 * dashboard demo path. See docs/data/dummy-owner-metrics.md.
 *
 * v0.3+ path: replace with an owner_metrics table in user_db,
 * RLS-scoped to user_id, carrying a consent_event_id FK.
 */

import { DEMO_OWNER_USER_ID } from "./demo-owner";
import { getBenchmarkSnapshot } from "./cohort";
import type { BenchmarkMetric } from "./briefs";

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * Per-owner raw metric value for the dashboard tile layer.
 * See docs/data/dummy-owner-metrics.md §2 for full field semantics.
 */
export interface OwnerMetric {
  metric_id: string;         // matches BenchmarkMetric.metric_id (briefs.ts L50)
  metric_label: string;      // frozen Czech label per D-011/D-015
  category_id: string;       // one of the four D-011 category IDs
  raw_value: number;         // unformatted numeric; ratios as decimals (0.234)
  raw_value_display: string; // Czech-formatted, render-ready (e.g. "23,4 %")
  unit_note: string;         // short human note about unit/interpretation
  // Fields from the cohort snapshot — joined on metric_id at construction time.
  confidence_state: BenchmarkMetric["confidence_state"];
  quartile_label: string | null;
  percentile: number | null;
}

// ─── Fixture — dummy furniture SME (NACE 31 / S2 / Praha) ───────────────────
// Raw values from docs/data/dummy-owner-metrics.md §4.
// Thin-space thousands separator: U+202F (narrow no-break space).
// Sign prefix (+) on growth/relative metrics per §4.

const THIN_SPACE = "\u202F";

const DUMMY_RAW_METRICS: Omit<OwnerMetric, "confidence_state" | "quartile_label" | "percentile">[] = [
  {
    metric_id: "gross_margin",
    metric_label: "Hrubá marže",
    category_id: "ziskovost",
    raw_value: 0.234,
    raw_value_display: `23,4\u00A0%`,
    unit_note: "ratio as percentage",
  },
  {
    metric_id: "ebitda_margin",
    metric_label: "EBITDA marže",
    category_id: "ziskovost",
    raw_value: 0.082,
    raw_value_display: `8,2\u00A0%`,
    unit_note: "ratio as percentage",
  },
  {
    metric_id: "labor_cost_ratio",
    metric_label: "Podíl mzdových nákladů",
    category_id: "naklady-produktivita",
    raw_value: 0.298,
    raw_value_display: `29,8\u00A0%`,
    unit_note: "ratio as percentage",
  },
  {
    metric_id: "revenue_per_employee",
    metric_label: "Tržby na zaměstnance",
    category_id: "naklady-produktivita",
    raw_value: 2_450_000,
    raw_value_display: `2${THIN_SPACE}450${THIN_SPACE}000\u00A0Kč`,
    unit_note: "CZK per FTE per year",
  },
  {
    metric_id: "working_capital_cycle",
    metric_label: "Obratový cyklus",
    category_id: "efektivita-kapitalu",
    raw_value: 62,
    raw_value_display: `62\u00A0dní`,
    unit_note: "days (DSO+DIO−DPO)",
  },
  {
    metric_id: "roce",
    metric_label: "ROCE",
    category_id: "efektivita-kapitalu",
    raw_value: 0.143,
    raw_value_display: `14,3\u00A0%`,
    unit_note: "ratio as percentage",
  },
  {
    metric_id: "revenue_growth",
    metric_label: "Růst tržeb",
    category_id: "rust-trzni-pozice",
    raw_value: 0.031,
    raw_value_display: `+3,1\u00A0%`,
    unit_note: "YoY growth vs prior period",
  },
  {
    metric_id: "pricing_power",
    metric_label: "Cenová síla",
    category_id: "rust-trzni-pozice",
    raw_value: 0.008,
    raw_value_display: `+0,8\u00A0p.\u00A0b.`,
    unit_note: "change in gross margin, in percentage points",
  },
];

// ─── Function ─────────────────────────────────────────────────────────────────

/**
 * Return the 8 owner metrics for the given user. At v0.2 this is an
 * in-memory lookup against a single synthetic furniture-SME fixture.
 *
 * For any userId other than DEMO_OWNER_USER_ID, returns an empty array.
 * Returning [] rather than throwing is intentional: callers (dashboard page)
 * render a graceful empty state rather than a crash. The async signature is
 * forward-compatible with the v0.3+ DB-backed implementation (see §6 of
 * docs/data/dummy-owner-metrics.md).
 */
export async function getOwnerMetrics(userId: string): Promise<OwnerMetric[]> {
  if (userId !== DEMO_OWNER_USER_ID) {
    // Non-demo user — no fixture available at v0.2.
    return [];
  }

  // Join raw fixture with cohort benchmark snapshot on metric_id.
  // getBenchmarkSnapshot("31") is the NACE 31 branch added in cohort.ts §3.2.
  const snapshot = getBenchmarkSnapshot("31");

  // Flatten all BenchmarkMetric entries into a lookup map keyed by metric_id.
  const cohortIndex = new Map<string, BenchmarkMetric>();
  for (const category of snapshot.categories) {
    for (const metric of category.metrics) {
      cohortIndex.set(metric.metric_id, metric);
    }
  }

  return DUMMY_RAW_METRICS.map((raw) => {
    const cohort = cohortIndex.get(raw.metric_id);
    // All 8 raw metric_ids must exist in the NACE 31 snapshot; if somehow
    // one is missing (a bug), surface it as below-floor rather than crashing.
    const confidence_state: BenchmarkMetric["confidence_state"] =
      cohort?.confidence_state ?? "below-floor";
    const quartile_label = cohort?.quartile_label ?? null;
    const percentile = cohort?.percentile ?? null;

    return {
      ...raw,
      confidence_state,
      quartile_label,
      percentile,
    };
  });
}
