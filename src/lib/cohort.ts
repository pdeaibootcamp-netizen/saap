/**
 * cohort.ts — Stubbed cohort resolution for MVP trial
 *
 * At MVP, cohorts are hand-assigned per D-001 on pre-populated data.
 * This module resolves a (NACE, size_band, region) tuple to a pre-seeded
 * cohort_id, and returns pre-computed benchmark snippet data.
 *
 * Stub posture: percentile/quartile values are pre-seeded fiction for trial.
 * Real computation comes from the cohort-math pipeline (Track B, Increment 2+).
 *
 * Cohort IDs are assigned at seed time by loadSeedCohorts().
 * The floor is N=30 global (cohort-math.md §3.1). At MVP the seed data
 * always passes the floor (validity_floor_met = true) for seeded cohorts.
 *
 * OQ-047: priority-NACE list not yet frozen. Using all seeded NACE codes.
 */

import type { SizeBand, CzRegion } from "../types/data-lanes";
import type { BenchmarkSnippet } from "./briefs";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CohortEntry {
  cohort_id: string;
  nace_sector: string;
  size_band: SizeBand;
  region: CzRegion;
  n_firms: number; // count of firms in cohort cell
}

// ─── Seed data ───────────────────────────────────────────────────────────────

// Hand-assigned cohorts per D-001. Extended in seed.ts for full MVP data.
// These are trial stubs — real cohort assignment is a data-engineer deliverable.
const SEED_COHORTS: CohortEntry[] = [
  { cohort_id: "cohort-46-S2-Praha", nace_sector: "46", size_band: "S2", region: "Praha", n_firms: 42 },
  { cohort_id: "cohort-46-S1-Praha", nace_sector: "46", size_band: "S1", region: "Praha", n_firms: 38 },
  { cohort_id: "cohort-10-S2-Jihozapad", nace_sector: "10", size_band: "S2", region: "Jihozápad", n_firms: 31 },
  { cohort_id: "cohort-62-S3-Praha", nace_sector: "62", size_band: "S3", region: "Praha", n_firms: 55 },
  { cohort_id: "cohort-41-S2-Stredni-Cechy", nace_sector: "41", size_band: "S2", region: "Střední Čechy", n_firms: 33 },
  // v0.2 PoC: NACE 31 furniture SME (Praha, S2). n_firms=34 clears global floor
  // (N≥30) but sits below per-metric floor (N≥50) for working_capital_cycle.
  // See docs/data/dummy-owner-metrics.md §3.1 and OQ-054.
  { cohort_id: "cohort-31-S2-Praha", nace_sector: "31", size_band: "S2", region: "Praha", n_firms: 34 },
];

/** Load and return all seed cohort entries. Development helper. */
export function loadSeedCohorts(): CohortEntry[] {
  return [...SEED_COHORTS];
}

/** Resolve a (NACE, size_band, region) tuple to a cohort entry. */
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

// ─── Benchmark snapshot ──────────────────────────────────────────────────────

/**
 * Return a pre-seeded benchmark snippet for a cohort at publish time.
 * Stub: returns fictional but structurally correct percentile data.
 * validity_floor_met = true for all seeded cohorts (N >= 30).
 *
 * Real computation: cohort_compute_batch (Track B, cohort-math.md §3).
 */
export function getBenchmarkSnapshot(naceSector: string): BenchmarkSnippet {
  const resolvedAt = new Date().toISOString();

  // ── NACE 31 branch — furniture SME (Praha, S2) — v0.2 PoC demo owner ────────
  // Values specified byte-for-byte in docs/data/dummy-owner-metrics.md §3.2.
  // working_capital_cycle is below-floor (n_firms=34 < per-metric floor N=50).
  // pricing_power is surfaced as valid per the deliberate PoC simplification
  // noted in §3.3 and flagged as OQ-054.
  if (naceSector === "31") {
    return {
      cohort_id: "cohort-31-S2-Praha",
      resolved_at: resolvedAt,
      categories: [
        {
          category_id: "ziskovost",
          category_label: "Ziskovost",
          metrics: [
            {
              metric_id: "gross_margin",
              metric_label: "Hrubá marže",
              quartile_label: "třetí čtvrtina",
              percentile: 68,
              verdict_text:
                "Vaše hrubá marže vás řadí do třetí čtvrtiny výrobců nábytku ve vašem oboru — 68. percentil.",
              confidence_state: "valid",
              rung_footnote: null,
              is_email_teaser_snippet: true,
            },
            {
              metric_id: "ebitda_margin",
              metric_label: "EBITDA marže",
              quartile_label: "druhá čtvrtina",
              percentile: 41,
              verdict_text:
                "Vaše EBITDA marže vás řadí do druhé čtvrtiny výrobců nábytku ve vašem oboru — 41. percentil.",
              confidence_state: "valid",
              rung_footnote: null,
              is_email_teaser_snippet: false,
            },
          ],
        },
        {
          category_id: "naklady-produktivita",
          category_label: "Náklady a produktivita",
          metrics: [
            {
              metric_id: "labor_cost_ratio",
              metric_label: "Podíl mzdových nákladů",
              quartile_label: "třetí čtvrtina",
              percentile: 62,
              verdict_text:
                "Váš podíl mzdových nákladů vás řadí do třetí čtvrtiny výrobců nábytku ve vašem oboru — 62. percentil.",
              confidence_state: "valid",
              rung_footnote: null,
              is_email_teaser_snippet: false,
            },
            {
              metric_id: "revenue_per_employee",
              metric_label: "Tržby na zaměstnance",
              quartile_label: "druhá čtvrtina",
              percentile: 47,
              verdict_text:
                "Vaše tržby na zaměstnance vás řadí do druhé čtvrtiny výrobců nábytku ve vašem oboru — 47. percentil.",
              confidence_state: "valid",
              rung_footnote: null,
              is_email_teaser_snippet: false,
            },
          ],
        },
        {
          category_id: "efektivita-kapitalu",
          category_label: "Efektivita kapitálu",
          metrics: [
            {
              metric_id: "working_capital_cycle",
              metric_label: "Obratový cyklus",
              quartile_label: null,
              percentile: null,
              verdict_text: null,
              confidence_state: "below-floor",
              rung_footnote:
                "Tato hodnota není k dispozici — počet firem v kohortě je zatím příliš nízký pro spolehlivé srovnání.",
              is_email_teaser_snippet: false,
            },
            {
              metric_id: "roce",
              metric_label: "ROCE",
              quartile_label: "horní čtvrtina",
              percentile: 76,
              verdict_text:
                "Váš ROCE vás řadí do horní čtvrtiny výrobců nábytku ve vašem oboru — 76. percentil.",
              confidence_state: "valid",
              rung_footnote: null,
              is_email_teaser_snippet: false,
            },
          ],
        },
        {
          category_id: "rust-trzni-pozice",
          category_label: "Růst a tržní pozice",
          metrics: [
            {
              metric_id: "revenue_growth",
              metric_label: "Růst tržeb",
              quartile_label: "druhá čtvrtina",
              percentile: 38,
              verdict_text:
                "Váš růst tržeb vás řadí do druhé čtvrtiny výrobců nábytku ve vašem oboru — 38. percentil.",
              confidence_state: "valid",
              rung_footnote: null,
              is_email_teaser_snippet: false,
            },
            {
              metric_id: "pricing_power",
              metric_label: "Cenová síla",
              quartile_label: "třetí čtvrtina",
              percentile: 59,
              verdict_text:
                "Vaše cenová síla vás řadí do třetí čtvrtiny výrobců nábytku ve vašem oboru — 59. percentil.",
              confidence_state: "valid",
              rung_footnote: null,
              is_email_teaser_snippet: false,
            },
          ],
        },
      ],
    };
  }

  // ── Default stub — all other NACE sectors ────────────────────────────────────
  // Stub benchmark data — four categories per D-011, two metrics each.
  // All seeded with fictional but plausible values.
  return {
    cohort_id: `cohort-${naceSector}-stub`,
    resolved_at: resolvedAt,
    categories: [
      {
        category_id: "ziskovost",
        category_label: "Ziskovost",
        metrics: [
          {
            metric_id: "gross_margin",
            metric_label: "Hrubá marže",
            quartile_label: "třetí čtvrtina",
            percentile: 68,
            verdict_text:
              "Vaše hrubá marže vás řadí do třetí čtvrtiny kohorty ve vašem oboru — 68. percentil.",
            confidence_state: "valid",
            rung_footnote: null,
            is_email_teaser_snippet: true,
          },
          {
            metric_id: "ebitda_margin",
            metric_label: "EBITDA marže",
            quartile_label: "druhá čtvrtina",
            percentile: 44,
            verdict_text:
              "Vaše EBITDA marže vás řadí do druhé čtvrtiny kohorty ve vašem oboru — 44. percentil.",
            confidence_state: "valid",
            rung_footnote: null,
            is_email_teaser_snippet: false,
          },
        ],
      },
      {
        category_id: "naklady-produktivita",
        category_label: "Náklady a produktivita",
        metrics: [
          {
            metric_id: "labor_cost_ratio",
            metric_label: "Podíl mzdových nákladů",
            quartile_label: "horní čtvrtina",
            percentile: 81,
            verdict_text:
              "Váš podíl mzdových nákladů vás řadí do horní čtvrtiny firem ve vašem oboru — 81. percentil.",
            confidence_state: "valid",
            rung_footnote: null,
            is_email_teaser_snippet: false,
          },
          {
            metric_id: "revenue_per_employee",
            metric_label: "Tržby na zaměstnance",
            quartile_label: "třetí čtvrtina",
            percentile: 57,
            verdict_text:
              "Vaše tržby na zaměstnance vás řadí do třetí čtvrtiny kohorty ve vašem oboru — 57. percentil.",
            confidence_state: "valid",
            rung_footnote: null,
            is_email_teaser_snippet: false,
          },
        ],
      },
      {
        category_id: "efektivita-kapitalu",
        category_label: "Efektivita kapitálu",
        metrics: [
          {
            metric_id: "working_capital_cycle",
            metric_label: "Obratový cyklus",
            quartile_label: null,
            percentile: null,
            verdict_text: null,
            confidence_state: "below-floor",
            rung_footnote: null,
            is_email_teaser_snippet: false,
          },
          {
            metric_id: "roce",
            metric_label: "ROCE",
            quartile_label: "spodní čtvrtina",
            percentile: 18,
            verdict_text:
              "Váš ROCE vás řadí do spodní čtvrtiny firem ve vašem oboru — 18. percentil.",
            confidence_state: "valid",
            rung_footnote: null,
            is_email_teaser_snippet: false,
          },
        ],
      },
      {
        category_id: "rust-trzni-pozice",
        category_label: "Růst a tržní pozice",
        metrics: [
          {
            metric_id: "revenue_growth",
            metric_label: "Růst tržeb",
            quartile_label: "horní čtvrtina",
            percentile: 78,
            verdict_text:
              "Váš růst tržeb vás řadí do horní čtvrtiny firem ve vašem oboru — 78. percentil.",
            confidence_state: "valid",
            rung_footnote: null,
            is_email_teaser_snippet: false,
          },
          {
            metric_id: "pricing_power",
            metric_label: "Cenová síla",
            quartile_label: null,
            percentile: null,
            verdict_text: null,
            confidence_state: "below-floor",
            rung_footnote: null,
            is_email_teaser_snippet: false,
          },
        ],
      },
    ],
  };
}
