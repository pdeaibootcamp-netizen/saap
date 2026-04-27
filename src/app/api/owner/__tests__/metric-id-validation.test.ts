/**
 * metric-id-validation.test.ts
 *
 * Tests the metric_id validation logic used by PATCH /api/owner/metrics/[metric_id].
 * Verifies that unknown metric IDs (including legacy 'roce') are rejected.
 *
 * No DB required — pure validation logic.
 *
 * owner-metrics-api.md §7
 */

import { describe, it, expect } from "vitest";
import { OWNER_METRIC_ID } from "../../../../types/data-lanes";

const VALID_METRIC_IDS = Object.values(OWNER_METRIC_ID) as string[];

function isValidMetricId(metricId: string): boolean {
  return VALID_METRIC_IDS.includes(metricId);
}

describe("metric_id validation — frozen D-024 set", () => {
  it("accepts all 8 frozen v0.3 metric IDs", () => {
    for (const id of VALID_METRIC_IDS) {
      expect(isValidMetricId(id)).toBe(true);
    }
  });

  it("rejects 'roce' (removed per D-024)", () => {
    expect(isValidMetricId("roce")).toBe(false);
  });

  it("rejects unknown metric ID", () => {
    expect(isValidMetricId("unknown_metric")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isValidMetricId("")).toBe(false);
  });

  it("rejects null-ish string 'null'", () => {
    expect(isValidMetricId("null")).toBe(false);
  });

  it("is case-sensitive (rejects 'Gross_Margin')", () => {
    expect(isValidMetricId("Gross_Margin")).toBe(false);
  });

  it("rejects partial match 'gross'", () => {
    expect(isValidMetricId("gross")).toBe(false);
  });
});
