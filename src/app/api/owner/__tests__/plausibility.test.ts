/**
 * plausibility.test.ts — Server-side METRIC_BOUNDS validation
 *
 * Tests the METRIC_BOUNDS constants (src/types/data-lanes.ts) as enforced by
 * the PATCH /api/owner/metrics/[metric_id] handler.
 * No DB required — tests the pure validation logic.
 *
 * owner-metrics-api.md §7 (unit tests)
 */

import { describe, it, expect } from "vitest";
import { METRIC_BOUNDS, OWNER_METRIC_ID, type OwnerMetricId } from "../../../../types/data-lanes";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Mirror of the parseRawValue function in the PATCH handler. */
function parseRawValue(val: unknown): number {
  if (typeof val === "number") return val;
  if (typeof val === "string") {
    const stripped = val.replace(/[\s  ]/g, "").replace(",", ".");
    return parseFloat(stripped);
  }
  return NaN;
}

/** Mirror of the validateBounds function in the PATCH handler. */
function validateBounds(metricId: OwnerMetricId, value: number): string | null {
  if (!isFinite(value)) {
    return "Uveďte prosím číselnou hodnotu.";
  }
  const bounds = METRIC_BOUNDS[metricId];
  if (value < bounds.min || value > bounds.max) {
    return bounds.errorCopy;
  }
  return null;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("METRIC_BOUNDS — all 8 frozen metrics have correct bounds (in-tile-prompts.md §5)", () => {
  it("gross_margin: accepts -50, 0, 50, 100; rejects -51, 101", () => {
    const id = OWNER_METRIC_ID.GROSS_MARGIN;
    expect(validateBounds(id, -50)).toBeNull();
    expect(validateBounds(id, 0)).toBeNull();
    expect(validateBounds(id, 50)).toBeNull();
    expect(validateBounds(id, 100)).toBeNull();
    expect(validateBounds(id, -51)).toBeTruthy();
    expect(validateBounds(id, 101)).toBeTruthy();
  });

  it("ebitda_margin: accepts -50, 60; rejects -51, 61", () => {
    const id = OWNER_METRIC_ID.EBITDA_MARGIN;
    expect(validateBounds(id, -50)).toBeNull();
    expect(validateBounds(id, 60)).toBeNull();
    expect(validateBounds(id, -51)).toBeTruthy();
    expect(validateBounds(id, 61)).toBeTruthy();
  });

  it("labor_cost_ratio: accepts 0, 90; rejects -1, 91 (non-negative only)", () => {
    const id = OWNER_METRIC_ID.LABOR_COST_RATIO;
    expect(validateBounds(id, 0)).toBeNull();
    expect(validateBounds(id, 90)).toBeNull();
    expect(validateBounds(id, -1)).toBeTruthy();
    expect(validateBounds(id, 91)).toBeTruthy();
    // Verify the error copy is the specific one for labor_cost_ratio
    expect(validateBounds(id, 91)).toBe(
      "Podíl nákladů by měl být mezi 0 a 90 %. Zkontrolujte prosím zadání."
    );
  });

  it("revenue_per_employee: accepts 100, 100000; rejects 99, 100001", () => {
    const id = OWNER_METRIC_ID.REVENUE_PER_EMPLOYEE;
    expect(validateBounds(id, 100)).toBeNull();
    expect(validateBounds(id, 100_000)).toBeNull();
    expect(validateBounds(id, 99)).toBeTruthy();
    expect(validateBounds(id, 100_001)).toBeTruthy();
  });

  it("working_capital_cycle: accepts -90, 0, 365; rejects -91, 366", () => {
    const id = OWNER_METRIC_ID.WORKING_CAPITAL_CYCLE;
    expect(validateBounds(id, -90)).toBeNull();
    expect(validateBounds(id, 0)).toBeNull();
    expect(validateBounds(id, 365)).toBeNull();
    expect(validateBounds(id, -91)).toBeTruthy();
    expect(validateBounds(id, 366)).toBeTruthy();
  });

  it("net_margin: accepts -50, 60; rejects -51, 61", () => {
    const id = OWNER_METRIC_ID.NET_MARGIN;
    expect(validateBounds(id, -50)).toBeNull();
    expect(validateBounds(id, 60)).toBeNull();
    expect(validateBounds(id, -51)).toBeTruthy();
    expect(validateBounds(id, 61)).toBeTruthy();
  });

  it("revenue_growth: accepts -80, 0, 200; rejects -81, 201", () => {
    const id = OWNER_METRIC_ID.REVENUE_GROWTH;
    expect(validateBounds(id, -80)).toBeNull();
    expect(validateBounds(id, 0)).toBeNull();
    expect(validateBounds(id, 200)).toBeNull();
    expect(validateBounds(id, -81)).toBeTruthy();
    expect(validateBounds(id, 201)).toBeTruthy();
  });

  it("roe: accepts -100, 0, 200; rejects -101, 201", () => {
    const id = OWNER_METRIC_ID.ROE;
    expect(validateBounds(id, -100)).toBeNull();
    expect(validateBounds(id, 0)).toBeNull();
    expect(validateBounds(id, 200)).toBeNull();
    expect(validateBounds(id, -101)).toBeTruthy();
    expect(validateBounds(id, 201)).toBeTruthy();
  });
});

describe("validateBounds — non-numeric inputs", () => {
  it("returns Czech error for NaN", () => {
    expect(validateBounds("gross_margin", NaN)).toBe(
      "Uveďte prosím číselnou hodnotu."
    );
  });

  it("returns Czech error for Infinity", () => {
    expect(validateBounds("gross_margin", Infinity)).toBe(
      "Uveďte prosím číselnou hodnotu."
    );
  });
});

describe("parseRawValue — Czech comma normalisation", () => {
  it("parses numeric strings with Czech comma as decimal separator", () => {
    expect(parseRawValue("23,4")).toBeCloseTo(23.4);
  });

  it("parses numeric strings with period as decimal separator", () => {
    expect(parseRawValue("23.4")).toBeCloseTo(23.4);
  });

  it("strips thin-space thousands separators", () => {
    expect(parseRawValue("2 450")).toBeCloseTo(2450);
  });

  it("returns NaN for non-numeric string", () => {
    expect(parseRawValue("abc")).toBeNaN();
  });

  it("passes through a number unchanged", () => {
    expect(parseRawValue(42)).toBe(42);
  });

  it("returns NaN for empty string", () => {
    expect(parseRawValue("")).toBeNaN();
  });
});
