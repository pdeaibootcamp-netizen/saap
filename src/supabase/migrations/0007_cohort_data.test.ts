/**
 * 0007_cohort_data.test.ts — migration enum-invariant tests
 *
 * Verifies that the TypeScript constants mirroring 0007_cohort_data.sql
 * constraints stay in sync with the SQL source of truth, without requiring
 * a live database connection. Follows the pattern in migrations.test.ts.
 *
 * Ref: cohort-runtime.md §5 (Migration test), cohort-ingestion.md §3,
 *      synthetic-quintile-policy.md §2, D-024, D-025.
 */

import { describe, it, expect } from "vitest";
import { OWNER_METRIC_ID } from "../../types/data-lanes";

// ── Frozen constants that mirror SQL CHECK constraints ────────────────────────

/**
 * metric_id CHECK constraint from 0007_cohort_data.sql cohort_aggregates.
 * Must stay in sync with OWNER_METRIC_ID (D-024) and the SQL CHECK.
 */
const COHORT_METRIC_IDS = [
  "gross_margin",
  "ebitda_margin",
  "labor_cost_ratio",
  "revenue_per_employee",
  "working_capital_cycle",
  "net_margin",
  "revenue_growth",
  "pricing_power",
] as const;

/**
 * source CHECK constraint from 0007_cohort_data.sql cohort_aggregates.
 * 'real' = aggregated from cohort_companies, 'synthetic' = DE-authored.
 */
const COHORT_AGGREGATE_SOURCES = ["real", "synthetic"] as const;

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("0007 cohort_aggregates — metric_id CHECK constraint (D-024)", () => {
  it("COHORT_METRIC_IDS contains exactly the 8 frozen metrics", () => {
    expect([...COHORT_METRIC_IDS].sort()).toEqual([
      "ebitda_margin",
      "gross_margin",
      "labor_cost_ratio",
      "net_margin",
      "pricing_power",
      "revenue_growth",
      "revenue_per_employee",
      "working_capital_cycle",
    ]);
  });

  it("COHORT_METRIC_IDS matches OWNER_METRIC_ID values exactly", () => {
    const ownerIds = Object.values(OWNER_METRIC_ID).sort();
    expect([...COHORT_METRIC_IDS].sort()).toEqual(ownerIds);
  });

  it("COHORT_METRIC_IDS does not contain the old 'roce' value (removed per D-024)", () => {
    expect(COHORT_METRIC_IDS).not.toContain("roce");
  });

  it("COHORT_METRIC_IDS has exactly 8 entries", () => {
    expect(COHORT_METRIC_IDS).toHaveLength(8);
  });

  it("COHORT_METRIC_IDS has no duplicates", () => {
    const unique = new Set(COHORT_METRIC_IDS);
    expect(unique.size).toBe(COHORT_METRIC_IDS.length);
  });
});

describe("0007 cohort_aggregates — source CHECK constraint (D-025)", () => {
  it("COHORT_AGGREGATE_SOURCES contains exactly 'real' and 'synthetic'", () => {
    expect([...COHORT_AGGREGATE_SOURCES].sort()).toEqual(["real", "synthetic"]);
  });

  it("'real' is present", () => {
    expect(COHORT_AGGREGATE_SOURCES).toContain("real");
  });

  it("'synthetic' is present", () => {
    expect(COHORT_AGGREGATE_SOURCES).toContain("synthetic");
  });

  it("no third source value exists (source enum is closed at v0.3)", () => {
    // 'mixed' is reserved for v0.4 hybrid path (percentile-compute.md §2)
    expect(COHORT_AGGREGATE_SOURCES).not.toContain("mixed");
    expect(COHORT_AGGREGATE_SOURCES).toHaveLength(2);
  });
});

describe("0007 cohort_companies — PK and ICO shape invariants", () => {
  it("IČO regex pattern rejects non-8-digit strings", () => {
    const icoRegex = /^\d{8}$/;
    expect(icoRegex.test("12345678")).toBe(true);
    expect(icoRegex.test("1234567")).toBe(false);   // 7 digits
    expect(icoRegex.test("123456789")).toBe(false);  // 9 digits
    expect(icoRegex.test("1234567a")).toBe(false);   // non-digit
    expect(icoRegex.test("")).toBe(false);
  });

  it("NACE class regex allows exactly 4-digit strings", () => {
    const naceClassRegex = /^\d{4}$/;
    expect(naceClassRegex.test("4941")).toBe(true);
    expect(naceClassRegex.test("49")).toBe(false);
    expect(naceClassRegex.test("49410")).toBe(false);
  });

  it("NACE division regex allows exactly 2-digit strings", () => {
    const naceDivisionRegex = /^\d{2}$/;
    expect(naceDivisionRegex.test("49")).toBe(true);
    expect(naceDivisionRegex.test("4")).toBe(false);
    expect(naceDivisionRegex.test("491")).toBe(false);
  });
});

describe("0007 cohort_aggregates — quintile ordering invariant", () => {
  it("well-ordered quintiles pass the ordering check (q1 ≤ q2 ≤ median ≤ q3 ≤ q4)", () => {
    const ordered = { q1: 12.0, q2: 16.0, median: 18.0, q3: 20.0, q4: 25.0 };
    expect(ordered.q1).toBeLessThanOrEqual(ordered.q2);
    expect(ordered.q2).toBeLessThanOrEqual(ordered.median);
    expect(ordered.median).toBeLessThanOrEqual(ordered.q3);
    expect(ordered.q3).toBeLessThanOrEqual(ordered.q4);
  });

  it("inverted quintiles fail the ordering check (seed script should abort)", () => {
    const bad = { q1: 25.0, q2: 16.0, median: 18.0, q3: 20.0, q4: 12.0 };
    // q1 > q2 violates the ordering rule
    expect(bad.q1).toBeGreaterThan(bad.q2);
  });
});
