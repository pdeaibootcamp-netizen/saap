/**
 * seed-synth-quintiles.ts — DE-authored synthetic quintile seed data
 *
 * Library function that seeds cohort_aggregates with sector-plausible quintile
 * values for NACE divisions not yet covered by real ingested data.
 *
 * Spec: docs/data/synthetic-quintile-policy.md §5.
 * Decision: D-025 — synthetic per-NACE quintile fallback.
 *
 * Usage sequence:
 *   1. Apply migration 0007_cohort_data.sql (creates cohort_aggregates table).
 *   2. Run ingest:industry (populates cohort_companies with real data).
 *   3. Run seed:synth-quintiles (fills coverage gaps without overwriting real rows).
 *
 * Idempotent: uses ON CONFLICT DO UPDATE with source guard — synthetic rows
 * never overwrite existing real-data rows (source='real').
 *
 * Generated_by value: 'de-spec-2026-04-27' (matches DE spec mandate in task brief).
 */

// ── Synth data (synthetic-quintile-policy.md §5) ──────────────────────────────

interface SynthRow {
  nace_division: string;
  metric_id: string;
  q1: number;
  q2: number;
  median: number;
  q3: number;
  q4: number;
  methodology_note: string;
}

const SYNTH_ROWS: SynthRow[] = [
  // ── NACE 49 — Road transport (§5.1) ────────────────────────────────────────
  // Only the 6 metrics not covered by real Excel data.
  // net_margin and revenue_per_employee are covered by real cohort_companies data.
  {
    nace_division: "49", metric_id: "gross_margin",
    q1: 12.0, q2: 16.0, median: 18.0, q3: 20.0, q4: 25.0,
    methodology_note: "Road haulage low-gross-margin; median ~18 % consistent with MPO Panorama transport aggregates. Fuel/sub-contracting/leased fleets compress margin.",
  },
  {
    nace_division: "49", metric_id: "ebitda_margin",
    q1: 3.0, q2: 5.5, median: 7.0, q3: 8.5, q4: 12.0,
    methodology_note: "Single-digit EBITDA typical for Czech road carriers; well-run firms reach ~12 %. Loss-makers below q1.",
  },
  {
    nace_division: "49", metric_id: "labor_cost_ratio",
    q1: 22.0, q2: 27.0, median: 30.0, q3: 33.0, q4: 38.0,
    methodology_note: "Driver wages dominate cost stack. Median ~30 % matches Czech transport sector wage share (MPO Panorama).",
  },
  {
    nace_division: "49", metric_id: "working_capital_cycle",
    q1: 18.0, q2: 32.0, median: 42.0, q3: 52.0, q4: 75.0,
    methodology_note: "DSO 45-60 days from large logistics-buyer customers; DPO partly offsets. Median ~42 days.",
  },
  {
    nace_division: "49", metric_id: "revenue_growth",
    q1: -4.0, q2: 0.0, median: 2.5, q3: 5.0, q4: 10.0,
    methodology_note: "2024-2026 sector mostly flat-to-low-single-digit; freight volumes recovered slowly post-2023.",
  },
  // ── NACE 31 — Furniture manufacturing (§5.2) ────────────────────────────────
  {
    nace_division: "31", metric_id: "gross_margin",
    q1: 15.0, q2: 20.0, median: 23.0, q3: 26.0, q4: 32.0,
    methodology_note: "Discrete manufacturing with material variance; median ~23 % matches MPO furniture aggregates.",
  },
  {
    nace_division: "31", metric_id: "ebitda_margin",
    q1: 4.0, q2: 7.0, median: 9.0, q3: 11.0, q4: 15.0,
    methodology_note: "Median 9 %; negative tail extends in soft consumer-discretionary cycles.",
  },
  {
    nace_division: "31", metric_id: "labor_cost_ratio",
    q1: 22.0, q2: 26.0, median: 29.0, q3: 32.0, q4: 37.0,
    methodology_note: "Mid-automation production; Praha wage premium pushes the upper band.",
  },
  {
    nace_division: "31", metric_id: "revenue_per_employee",
    q1: 1600.0, q2: 2100.0, median: 2400.0, q3: 2700.0, q4: 3400.0,
    methodology_note: "Czech furniture median ~2,4 M CZK/FTE; matches public Bisnode data.",
  },
  {
    nace_division: "31", metric_id: "working_capital_cycle",
    q1: 35.0, q2: 52.0, median: 62.0, q3: 72.0, q4: 90.0,
    methodology_note: "Inventory-heavy; furniture finished goods + customer terms dominate.",
  },
  {
    nace_division: "31", metric_id: "net_margin",
    q1: 1.5, q2: 3.5, median: 4.8, q3: 6.2, q4: 9.0,
    methodology_note: "Compresses ~4 p.b. from EBITDA after tax + finance cost.",
  },
  {
    nace_division: "31", metric_id: "revenue_growth",
    q1: -5.0, q2: 0.5, median: 3.0, q3: 5.5, q4: 10.0,
    methodology_note: "2026 furniture demand subdued; positive but low growth typical.",
  },
  // ── NACE 25 — Fabricated metal products (§5.3) ──────────────────────────────
  {
    nace_division: "25", metric_id: "gross_margin",
    q1: 14.0, q2: 18.0, median: 21.0, q3: 24.0, q4: 30.0,
    methodology_note: "Material-intensive; median ~21 %.",
  },
  {
    nace_division: "25", metric_id: "ebitda_margin",
    q1: 4.0, q2: 7.0, median: 9.0, q3: 11.0, q4: 15.0,
    methodology_note: "Similar structure to furniture.",
  },
  {
    nace_division: "25", metric_id: "labor_cost_ratio",
    q1: 20.0, q2: 24.0, median: 27.0, q3: 30.0, q4: 35.0,
    methodology_note: "Slightly lower than furniture (more automated).",
  },
  {
    nace_division: "25", metric_id: "revenue_per_employee",
    q1: 1800.0, q2: 2400.0, median: 2800.0, q3: 3200.0, q4: 4000.0,
    methodology_note: "Higher than furniture due to capital intensity.",
  },
  {
    nace_division: "25", metric_id: "working_capital_cycle",
    q1: 30.0, q2: 48.0, median: 58.0, q3: 70.0, q4: 92.0,
    methodology_note: "AR-heavy; B2B customer terms dominate.",
  },
  {
    nace_division: "25", metric_id: "net_margin",
    q1: 1.8, q2: 4.0, median: 5.2, q3: 6.5, q4: 9.5,
    methodology_note: "Metal fabrication net margin; calibrated against ČSÚ structural statistics.",
  },
  {
    nace_division: "25", metric_id: "revenue_growth",
    q1: -6.0, q2: 0.0, median: 2.5, q3: 5.0, q4: 9.0,
    methodology_note: "Industrial demand cycle 2024-2026.",
  },
  // ── NACE 47 — Retail trade (§5.4) ────────────────────────────────────────────
  {
    nace_division: "47", metric_id: "gross_margin",
    q1: 16.0, q2: 22.0, median: 26.0, q3: 30.0, q4: 38.0,
    methodology_note: "Wide retail spread — discounters low, specialty high.",
  },
  {
    nace_division: "47", metric_id: "ebitda_margin",
    q1: 2.0, q2: 4.5, median: 6.0, q3: 7.5, q4: 11.0,
    methodology_note: "Tighter than wholesale due to rent + retail labour.",
  },
  {
    nace_division: "47", metric_id: "labor_cost_ratio",
    q1: 12.0, q2: 16.0, median: 19.0, q3: 22.0, q4: 28.0,
    methodology_note: "Retail labour share lower than services because of rent share.",
  },
  {
    nace_division: "47", metric_id: "revenue_per_employee",
    q1: 1500.0, q2: 2200.0, median: 2700.0, q3: 3200.0, q4: 4500.0,
    methodology_note: "Specialty retail at the top; supermarkets-style at the bottom.",
  },
  {
    nace_division: "47", metric_id: "working_capital_cycle",
    q1: -10.0, q2: 5.0, median: 15.0, q3: 28.0, q4: 50.0,
    methodology_note: "Cash-business low; B2B-leaning retail higher. Negative band covers fast-turnover discounters.",
  },
  {
    nace_division: "47", metric_id: "net_margin",
    q1: 0.5, q2: 2.5, median: 3.5, q3: 4.8, q4: 7.5,
    methodology_note: "Tight retail margin after tax.",
  },
  {
    nace_division: "47", metric_id: "revenue_growth",
    q1: -4.0, q2: 1.0, median: 3.5, q3: 6.0, q4: 12.0,
    methodology_note: "Czech consumer demand modest growth.",
  },
  // ── NACE 62 — IT services (§5.5) ─────────────────────────────────────────────
  {
    nace_division: "62", metric_id: "gross_margin",
    q1: 35.0, q2: 45.0, median: 52.0, q3: 58.0, q4: 68.0,
    methodology_note: "High-services-margin sector; wage cost is the cost-of-services.",
  },
  {
    nace_division: "62", metric_id: "ebitda_margin",
    q1: 8.0, q2: 13.0, median: 16.0, q3: 20.0, q4: 28.0,
    methodology_note: "Czech IT-services typical EBITDA.",
  },
  {
    nace_division: "62", metric_id: "labor_cost_ratio",
    q1: 35.0, q2: 42.0, median: 46.0, q3: 50.0, q4: 58.0,
    methodology_note: "Wages dominate in IT services.",
  },
  {
    nace_division: "62", metric_id: "revenue_per_employee",
    q1: 1800.0, q2: 2600.0, median: 3200.0, q3: 3800.0, q4: 5500.0,
    methodology_note: "Higher than industrial sectors; outsourced firms toward upper end.",
  },
  {
    nace_division: "62", metric_id: "working_capital_cycle",
    q1: 25.0, q2: 40.0, median: 52.0, q3: 65.0, q4: 90.0,
    methodology_note: "Project-billing AR is the dominant component.",
  },
  {
    nace_division: "62", metric_id: "net_margin",
    q1: 5.0, q2: 9.0, median: 12.0, q3: 15.0, q4: 22.0,
    methodology_note: "Wide spread — strong firms keep most of EBITDA.",
  },
  {
    nace_division: "62", metric_id: "revenue_growth",
    q1: -3.0, q2: 2.0, median: 6.0, q3: 10.0, q4: 18.0,
    methodology_note: "IT-services growth typically faster than other Czech SMEs.",
  },
  // ── NACE 41 — Construction of buildings (§5.6) ───────────────────────────────
  {
    nace_division: "41", metric_id: "gross_margin",
    q1: 8.0, q2: 12.0, median: 14.0, q3: 17.0, q4: 22.0,
    methodology_note: "Tight construction margin; sub-contracting eats spread.",
  },
  {
    nace_division: "41", metric_id: "ebitda_margin",
    q1: 2.0, q2: 4.0, median: 5.5, q3: 7.5, q4: 11.0,
    methodology_note: "Cyclical; medians compressed in 2025-26 weak cycle.",
  },
  {
    nace_division: "41", metric_id: "labor_cost_ratio",
    q1: 15.0, q2: 20.0, median: 23.0, q3: 27.0, q4: 33.0,
    methodology_note: "Sub-contracting reduces direct labour share vs services.",
  },
  {
    nace_division: "41", metric_id: "revenue_per_employee",
    q1: 2200.0, q2: 3200.0, median: 3800.0, q3: 4500.0, q4: 6200.0,
    methodology_note: "High per-FTE because sub-contractor revenue passes through.",
  },
  {
    nace_division: "41", metric_id: "working_capital_cycle",
    q1: 60.0, q2: 90.0, median: 110.0, q3: 135.0, q4: 170.0,
    methodology_note: "Long project cycles; AR dominates working capital.",
  },
  {
    nace_division: "41", metric_id: "net_margin",
    q1: 0.5, q2: 2.0, median: 3.0, q3: 4.2, q4: 7.0,
    methodology_note: "Construction net margin; calibrated against ČSÚ structural statistics.",
  },
  {
    nace_division: "41", metric_id: "revenue_growth",
    q1: -12.0, q2: -3.0, median: 1.5, q3: 6.0, q4: 14.0,
    methodology_note: "High variance — project pipeline timing dominates.",
  },

  // ── NACE 10 — Food / bakery (D-032, ROE-only synth fallback) ───────────────
  {
    nace_division: "10", metric_id: "roe",
    q1: 2.0, q2: 5.0, median: 8.0, q3: 12.0, q4: 20.0,
    methodology_note: "Bakery ROE distribution — calibrated to ČSÚ food-mfg structural data.",
  },

  // ── NACE 31 — Furniture (D-032, ROE-only synth fallback) ───────────────────
  {
    nace_division: "31", metric_id: "roe",
    q1: 3.0, q2: 7.0, median: 11.0, q3: 16.0, q4: 25.0,
    methodology_note: "Furniture-mfg ROE — moderate variance; well-capitalised firms cluster mid.",
  },

  // ── NACE 46 — Wholesale of metal (D-032, ROE-only synth fallback) ──────────
  {
    nace_division: "46", metric_id: "roe",
    q1: 4.0, q2: 8.0, median: 12.0, q3: 18.0, q4: 28.0,
    methodology_note: "Metal-wholesale ROE — capital-light distributors achieve higher ROE.",
  },

  // ── NACE 49 — Freight (D-032, ROE-only synth fallback) ─────────────────────
  {
    nace_division: "49", metric_id: "roe",
    q1: 2.0, q2: 5.0, median: 9.0, q3: 14.0, q4: 22.0,
    methodology_note: "Freight ROE — fleet-asset-heavy firms drag tail; tight middle.",
  },
];

// ── Validation ────────────────────────────────────────────────────────────────

function validateOrdering(row: SynthRow): void {
  if (!(row.q1 <= row.q2 && row.q2 <= row.median && row.median <= row.q3 && row.q3 <= row.q4)) {
    throw new Error(
      `Quintile ordering violated for NACE ${row.nace_division} / ${row.metric_id}: ` +
      `q1=${row.q1} q2=${row.q2} median=${row.median} q3=${row.q3} q4=${row.q4}`
    );
  }
}

// ── Seed function ─────────────────────────────────────────────────────────────

/**
 * Seed synthetic quintiles for a given NACE division into cohort_aggregates.
 * Idempotent: upsert on (nace_division, metric_id, source) — does not
 * overwrite source='real' rows because the composite PK includes source.
 *
 * Uses Supabase REST client (HTTPS) instead of the postgres TCP library —
 * the developer's network blocks 5432/6543. Same posture as the working
 * src/scripts/seed.ts.
 *
 * @param division — 2-digit NACE division, e.g. "49"
 * @param supabase — `@supabase/supabase-js` client created with the service-role key
 */
export async function seedSynthQuintilesForNaceDivision(
  division: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
): Promise<void> {
  const rows = SYNTH_ROWS.filter((r) => r.nace_division === division);
  if (rows.length === 0) {
    console.log(`[seed-synth] No synth data defined for NACE ${division} — skipping.`);
    return;
  }

  // Validate before any DB writes (synthetic-quintile-policy.md §6 step 2)
  for (const row of rows) {
    validateOrdering(row);
  }

  const payload = rows.map((row) => ({
    nace_division: row.nace_division,
    metric_id: row.metric_id,
    q1: row.q1,
    q2: row.q2,
    median: row.median,
    q3: row.q3,
    q4: row.q4,
    n_proxy: 200,
    source: "synthetic",
    generated_by: "de-spec-2026-04-27",
    methodology_note: row.methodology_note,
  }));

  const { error } = await supabase
    .from("cohort_aggregates")
    .upsert(payload, {
      onConflict: "nace_division,metric_id,source",
      ignoreDuplicates: false,
    });

  if (error) {
    throw new Error(
      `[seed-synth] Supabase upsert failed for NACE ${division}: ${error.message}`
    );
  }

  console.log(`[seed-synth] Seeded ${rows.length} synth rows for NACE ${division}.`);
}

/**
 * All NACE divisions for which synth data is defined.
 * Track A's seed.ts main() may call seedSynthQuintilesForNaceDivision for each.
 */
export const SYNTH_NACE_DIVISIONS: string[] = SYNTH_ROWS.reduce<string[]>((acc, r) => {
  if (!acc.includes(r.nace_division)) acc.push(r.nace_division);
  return acc;
}, []);

export { SYNTH_ROWS };
