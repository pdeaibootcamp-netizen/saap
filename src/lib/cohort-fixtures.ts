/**
 * cohort-fixtures.ts — v0.2 in-memory benchmark fixture data
 *
 * Moved here from cohort.ts as the last-resort fallback per ADR-CR-03.
 * This file is the "USE_REAL_COHORT_DATA=false" path and the per-metric
 * empty fallback when the DB has no data for a given (NACE, metric) cell.
 *
 * DO NOT add new data here. Extend the real-data path via cohort-data.ts.
 * This fixture exists only so the build never fails due to an empty DB.
 *
 * Track B — cohort-runtime.md ADR-CR-03.
 */

import type { BenchmarkSnippet } from "./briefs";

/**
 * Returns the v0.2 fixture BenchmarkSnippet for a NACE sector.
 * Callers use this when USE_REAL_COHORT_DATA=false or when the DB
 * returns empty for every metric.
 */
export function getFixtureSnapshot(naceSector: string): BenchmarkSnippet {
  const resolvedAt = new Date().toISOString();

  // ── NACE 31 branch — furniture SME (Praha, S2) — v0.2 PoC demo owner ────────
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
            {
              metric_id: "net_margin",
              metric_label: "Čistá marže",
              quartile_label: "třetí čtvrtina",
              percentile: 61,
              verdict_text:
                "Vaše čistá marže vás řadí do třetí čtvrtiny výrobců nábytku ve vašem oboru — 61. percentil.",
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
              metric_id: "roe",
              metric_label: "ROE",
              quartile_label: "třetí čtvrtina",
              percentile: 59,
              verdict_text:
                "Vaše ROE vás řadí do třetí čtvrtiny výrobců nábytku ve vašem oboru — 59. percentil.",
              confidence_state: "valid",
              rung_footnote: null,
              is_email_teaser_snippet: false,
            },
          ],
        },
      ],
    };
  }

  // ── Default fixture for all other NACEs ──────────────────────────────────────
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
          {
            metric_id: "net_margin",
            metric_label: "Čistá marže",
            quartile_label: "třetí čtvrtina",
            percentile: 55,
            verdict_text:
              "Vaše čistá marže vás řadí do třetí čtvrtiny kohorty ve vašem oboru — 55. percentil.",
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
            metric_id: "roe",
            metric_label: "ROE",
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
