/**
 * cohort.ts — Cohort resolution and benchmark snapshot (v0.3 refactor)
 *
 * This module provides two paths:
 *
 * 1. **Sync fixture path** (legacy, used by publish.ts and any v0.2 callers):
 *    `getBenchmarkSnapshot(naceSector)` — unchanged sync signature.
 *    When USE_REAL_COHORT_DATA !== 'true', returns the v0.2 in-memory fixture.
 *    When USE_REAL_COHORT_DATA=true and DB is empty for all metrics, falls back
 *    to the fixture for that NACE.
 *
 * 2. **Async real-compute path** (v0.3, for dashboard API route / Track A):
 *    `getBenchmarkSnapshotAsync(naceDivision, sizeBand, region, ownerValues)`
 *    Calls cohort-data.ts + cohort-compute.ts to produce live percentiles.
 *    Feature flag: USE_REAL_COHORT_DATA (default true).
 *
 * ADR-CR-03: the fixture path is the last-resort fallback, not deleted.
 * Ref: cohort-runtime.md §4.3 + §5 (test plan).
 *
 * PRIVACY: ownerValues come in as an argument — this module never reads
 * owner_metrics directly. DB reads stay in cohort-data.ts (industry tables only).
 */

import type { SizeBand, CzRegion } from "../types/data-lanes";
import type { BenchmarkSnippet, BenchmarkMetric } from "./briefs";
import {
  computePercentile,
  type MetricId,
  type PercentileInput,
} from "./cohort-compute";
import {
  getCohortFirmsForCell,
  getSyntheticQuintiles,
  clearCohortMemo,
} from "./cohort-data";
import { getFixtureSnapshot } from "./cohort-fixtures";

// ── Feature flag ──────────────────────────────────────────────────────────────

const USE_REAL_COHORT_DATA =
  process.env.USE_REAL_COHORT_DATA !== "false"; // default true

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CohortEntry {
  cohort_id: string;
  nace_sector: string;
  size_band: SizeBand;
  region: CzRegion;
  n_firms: number;
}

// ── Seed data (legacy — v0.2 cohort assignment, kept for publish.ts compat) ───

const SEED_COHORTS: CohortEntry[] = [
  { cohort_id: "cohort-46-S2-Praha", nace_sector: "46", size_band: "S2", region: "Praha", n_firms: 42 },
  { cohort_id: "cohort-46-S1-Praha", nace_sector: "46", size_band: "S1", region: "Praha", n_firms: 38 },
  { cohort_id: "cohort-10-S2-Jihozapad", nace_sector: "10", size_band: "S2", region: "Jihozápad", n_firms: 31 },
  { cohort_id: "cohort-62-S3-Praha", nace_sector: "62", size_band: "S3", region: "Praha", n_firms: 55 },
  { cohort_id: "cohort-41-S2-Stredni-Cechy", nace_sector: "41", size_band: "S2", region: "Střední Čechy", n_firms: 33 },
  { cohort_id: "cohort-31-S2-Praha", nace_sector: "31", size_band: "S2", region: "Praha", n_firms: 34 },
];

export function loadSeedCohorts(): CohortEntry[] {
  return [...SEED_COHORTS];
}

export function resolveCohort(
  nace_sector: string,
  size_band: SizeBand,
  region: CzRegion
): CohortEntry | null {
  return (
    SEED_COHORTS.find(
      (c) => c.nace_sector === nace_sector && c.size_band === size_band && c.region === region
    ) ?? null
  );
}

// ── Frozen metric category mapping ────────────────────────────────────────────

const METRIC_META: Record<MetricId, { label: string; categoryId: string; categoryLabel: string; isEmailTeaser: boolean }> = {
  gross_margin:           { label: "Hrubá marže",             categoryId: "ziskovost",           categoryLabel: "Ziskovost",              isEmailTeaser: true  },
  ebitda_margin:          { label: "EBITDA marže",            categoryId: "ziskovost",           categoryLabel: "Ziskovost",              isEmailTeaser: false },
  net_margin:             { label: "Čistá marže",             categoryId: "ziskovost",           categoryLabel: "Ziskovost",              isEmailTeaser: false },
  labor_cost_ratio:       { label: "Podíl mzdových nákladů",  categoryId: "naklady-produktivita", categoryLabel: "Náklady a produktivita", isEmailTeaser: false },
  revenue_per_employee:   { label: "Tržby na zaměstnance",    categoryId: "naklady-produktivita", categoryLabel: "Náklady a produktivita", isEmailTeaser: false },
  working_capital_cycle:  { label: "Obratový cyklus",         categoryId: "efektivita-kapitalu", categoryLabel: "Efektivita kapitálu",   isEmailTeaser: false },
  revenue_growth:         { label: "Růst tržeb",              categoryId: "rust-trzni-pozice",   categoryLabel: "Růst a tržní pozice",   isEmailTeaser: false },
  roe:                    { label: "ROE",                     categoryId: "rust-trzni-pozice",   categoryLabel: "Růst a tržní pozice",   isEmailTeaser: false },
};

const METRIC_ORDER: MetricId[] = [
  "gross_margin",
  "ebitda_margin",
  "net_margin",
  "labor_cost_ratio",
  "revenue_per_employee",
  "working_capital_cycle",
  "revenue_growth",
  "roe",
];

const CATEGORY_ORDER = [
  "ziskovost",
  "naklady-produktivita",
  "efektivita-kapitalu",
  "rust-trzni-pozice",
];

// ── Async v0.3 compute path ───────────────────────────────────────────────────

/**
 * Compute a BenchmarkSnippet for all 8 frozen metrics using real or synth data.
 * (cohort-runtime.md §4.3)
 *
 * @param naceDivision — 2-digit NACE division, e.g. "49"
 * @param sizeBand     — S1 / S2 / S3
 * @param region       — NUTS-2 region or null
 * @param ownerValues  — map of metricId → raw numeric value (null = metric not entered)
 */
export async function getBenchmarkSnapshotAsync(
  naceDivision: string,
  sizeBand: SizeBand,
  region: CzRegion | null,
  ownerValues: Map<MetricId, number | null>
): Promise<BenchmarkSnippet> {
  clearCohortMemo();

  const metricResults: BenchmarkMetric[] = [];
  let allEmpty = true;

  for (const metricId of METRIC_ORDER) {
    const meta = METRIC_META[metricId];
    const rawValue = ownerValues.get(metricId) ?? null;

    // Owner hasn't entered this metric yet — tile is in "ask" state.
    if (rawValue === null) {
      metricResults.push({
        metric_id: metricId,
        metric_label: meta.label,
        quartile_label: null,
        percentile: null,
        verdict_text: null,
        confidence_state: "empty",
        rung_footnote: null,
        is_email_teaser_snippet: meta.isEmailTeaser,
      });
      continue;
    }

    const input: PercentileInput = {
      metricId,
      ownerValue: rawValue,
      naceDivision,
      sizeBand,
      region,
    };

    // Fetch real-data cohort values (walks the four-rung ladder internally)
    const realData = await getCohortFirmsForCell(naceDivision, sizeBand, region, metricId);
    const synth = await getSyntheticQuintiles(naceDivision, metricId);

    const pr = computePercentile(
      input,
      realData?.values ?? null,
      synth,
      (realData?.rung ?? 0) as 0 | 1 | 2 | 3
    );

    // If both DB paths returned empty, fall through to fixture for this metric only.
    if (pr.confidenceState === "empty" && realData === null && synth === null) {
      // Fixture fallback per ADR-CR-03 step 2e
      // We'll mark this metric as empty; caller decides whether to use fixture.
      metricResults.push({
        metric_id: metricId,
        metric_label: meta.label,
        quartile_label: null,
        percentile: null,
        verdict_text: null,
        confidence_state: "empty",
        rung_footnote: "Tato hodnota není k dispozici — počet firem v kohortě je zatím příliš nízký pro spolehlivé srovnání.",
        is_email_teaser_snippet: meta.isEmailTeaser,
      });
      continue;
    }

    allEmpty = false;

    const verdictText =
      pr.confidenceState === "valid" && pr.percentile !== null
        ? buildVerdictText(metricId, meta.label, pr.percentile, pr.quartileLabel!)
        : null;

    metricResults.push({
      metric_id: metricId,
      metric_label: meta.label,
      quartile_label: pr.quartileLabel,
      percentile: pr.percentile,
      verdict_text: verdictText,
      confidence_state: pr.confidenceState,
      rung_footnote: pr.footnote,
      is_email_teaser_snippet: meta.isEmailTeaser,
    });
  }

  // If every metric came back empty (DB not seeded), fall to fixture.
  if (allEmpty) {
    return getFixtureSnapshot(naceDivision);
  }

  // Group into categories in canonical order.
  const categoryMap = new Map<string, { id: string; label: string; metrics: BenchmarkMetric[] }>();
  for (const metricId of METRIC_ORDER) {
    const meta = METRIC_META[metricId];
    if (!categoryMap.has(meta.categoryId)) {
      categoryMap.set(meta.categoryId, {
        id: meta.categoryId,
        label: meta.categoryLabel,
        metrics: [],
      });
    }
  }
  for (const mr of metricResults) {
    const meta = METRIC_META[mr.metric_id as MetricId];
    categoryMap.get(meta.categoryId)!.metrics.push(mr);
  }

  const categories = CATEGORY_ORDER.map((catId) => {
    const cat = categoryMap.get(catId)!;
    return {
      category_id: cat.id,
      category_label: cat.label,
      metrics: cat.metrics,
    };
  });

  return {
    cohort_id: `real-${naceDivision}`,
    resolved_at: new Date().toISOString(),
    categories,
  };
}

function buildVerdictText(
  metricId: MetricId,
  label: string,
  percentile: number,
  quartileLabel: string
): string {
  const pRounded = Math.round(percentile);
  return `Vaše ${label.toLowerCase()} vás řadí do ${quartileLabel} firem ve vašem oboru — ${pRounded}. percentil.`;
}

// ── Sync legacy path (backward compat for publish.ts) ────────────────────────

/**
 * getBenchmarkSnapshot — sync wrapper, v0.2 fixture path.
 *
 * Kept for backward compatibility with publish.ts and any synchronous callers.
 * When USE_REAL_COHORT_DATA=true, the caller (Track A owner metrics API) should
 * use getBenchmarkSnapshotAsync() instead, which has the real compute path.
 *
 * This function always returns the fixture (no DB calls) — it is safe to call
 * in synchronous contexts (publish pipeline, etc.).
 *
 * ADR-CR-03: fixture is the last-resort fallback, not the default path.
 */
export function getBenchmarkSnapshot(naceSector: string): BenchmarkSnippet {
  if (!USE_REAL_COHORT_DATA) {
    return getFixtureSnapshot(naceSector);
  }
  // Real path is async — sync callers fall back to fixture.
  // Track A's owner-metrics API route calls getBenchmarkSnapshotAsync() directly.
  return getFixtureSnapshot(naceSector);
}
