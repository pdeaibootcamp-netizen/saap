/**
 * cohort-compute.test.ts — unit tests for src/lib/cohort-compute.ts
 *
 * No DB, no mocking required — all functions are pure.
 * Covers: floor enforcement, winsorization, mid-rank percentile, synth
 * interpolation, quartile boundary rules, empty/below-floor states.
 * Test plan: cohort-runtime.md §5.
 * Algorithm: Hyndman & Fan (1996) type 4, percentile-compute.md §3.4.
 */

import { describe, it, expect } from "vitest";
import {
  computePercentile,
  computePercentileFromQuintiles,
  computeQuartileLabel,
  determineConfidenceState,
  getFloor,
  type SynthQuintiles,
  type PercentileInput,
} from "../cohort-compute";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeInput(
  metricId: PercentileInput["metricId"],
  ownerValue: number
): PercentileInput {
  return {
    metricId,
    ownerValue,
    naceDivision: "49",
    sizeBand: "S2",
    region: "Praha",
  };
}

/** 100 values: 1..100 uniformly spaced. */
function uniform100(): number[] {
  return Array.from({ length: 100 }, (_, i) => i + 1);
}

const NACE49_SYNTH: SynthQuintiles = {
  q1: 12.0,   // P20
  q2: 16.0,   // P40
  median: 18.0, // P50
  q3: 20.0,   // P60
  q4: 25.0,   // P80
  n_proxy: 200,
};

// ── Floor enforcement ─────────────────────────────────────────────────────────

describe("floor enforcement", () => {
  it("global floor is 30", () => {
    expect(getFloor("gross_margin")).toBe(30);
    expect(getFloor("net_margin")).toBe(30);
    expect(getFloor("revenue_per_employee")).toBe(30);
  });

  it("strict floor is 50 for working_capital_cycle", () => {
    expect(getFloor("working_capital_cycle")).toBe(50);
    // ROE replaced pricing_power (D-032). ROE is normal-distribution; uses
    // GLOBAL_FLOOR (30), not STRICT_FLOOR.
    expect(getFloor("roe")).toBe(30);
  });

  it("29 real values → below-floor result (rung 4)", () => {
    const values = Array.from({ length: 29 }, (_, i) => i + 1);
    const result = computePercentile(makeInput("gross_margin", 15), values, null);
    expect(result.confidenceState).toBe("below-floor");
    expect(result.achievedRung).toBe(4);
    expect(result.percentile).toBeNull();
    expect(result.quartileLabel).toBeNull();
  });

  it("30 real values → valid result (at the global floor boundary)", () => {
    const values = Array.from({ length: 30 }, (_, i) => i + 1);
    const result = computePercentile(makeInput("gross_margin", 15), values, null);
    expect(result.confidenceState).toBe("valid");
    expect(result.percentile).not.toBeNull();
  });

  // working_capital_cycle is now the only metric with the N≥50 strict floor.
  it("49 real values for working_capital_cycle → below-floor (strict floor = 50)", () => {
    const values = Array.from({ length: 49 }, (_, i) => i + 1);
    const result = computePercentile(makeInput("working_capital_cycle", 25), values, null);
    expect(result.confidenceState).toBe("below-floor");
  });

  it("50 real values for working_capital_cycle → valid (exactly at strict floor)", () => {
    const values = Array.from({ length: 50 }, (_, i) => i + 1);
    const result = computePercentile(makeInput("working_capital_cycle", 25), values, null);
    expect(result.confidenceState).toBe("valid");
  });
});

// ── Real-data happy path (mid-rank percentile) ────────────────────────────────

describe("real-data path — happy path", () => {
  it("owner at median of uniform 100 → percentile ≈ 50, druhá čtvrtina", () => {
    const values = uniform100();
    // Owner value 50 is the median. 49 values < 50, 1 value == 50.
    // rank = 49 + 0.5*1 = 49.5; pct = 49.5/100*100 = 49.5
    const result = computePercentile(makeInput("gross_margin", 50), values, null);
    expect(result.confidenceState).toBe("valid");
    expect(result.percentile).toBe(49.5);
    expect(result.quartileLabel).toBe("druhá čtvrtina");
    expect(result.source).toBe("real");
  });

  it("owner strictly above all cohort values → percentile = 100, horní čtvrtina", () => {
    const values = Array.from({ length: 30 }, (_, i) => i + 1); // 1..30
    const result = computePercentile(makeInput("gross_margin", 1000), values, null);
    expect(result.percentile).toBe(100);
    expect(result.quartileLabel).toBe("horní čtvrtina");
  });

  it("owner strictly below all cohort values → percentile = 0, spodní čtvrtina", () => {
    const values = Array.from({ length: 30 }, (_, i) => i + 10); // 10..39
    const result = computePercentile(makeInput("gross_margin", 0), values, null);
    expect(result.percentile).toBe(0);
    expect(result.quartileLabel).toBe("spodní čtvrtina");
  });
});

// ── Mid-rank tie handling ─────────────────────────────────────────────────────

describe("mid-rank tie handling", () => {
  it("all 30 cohort values equal the owner value → percentile = 50, třetí čtvrtina", () => {
    const values = Array(30).fill(42);
    const result = computePercentile(makeInput("gross_margin", 42), values, null);
    // rank = 0 + 0.5 * 30 = 15; pct = 15/30*100 = 50
    // percentile 50 maps to "třetí čtvrtina" per percentile-compute.md §3.5 (50 ≤ p < 75 → třetí)
    expect(result.percentile).toBe(50);
    expect(result.quartileLabel).toBe("třetí čtvrtina");
  });

  it("ties split between below and equal give fractional percentile", () => {
    // 10 values below, 10 equal, 10 above; owner = middle of equal
    const below = Array(10).fill(10);
    const equal = Array(10).fill(20);
    const above = Array(10).fill(30);
    const values = [...below, ...equal, ...above];
    const result = computePercentile(makeInput("net_margin", 20), values, null);
    // rank = 10 + 0.5 * 10 = 15; pct = 15/30*100 = 50
    expect(result.percentile).toBe(50);
  });
});

// ── Winsorization ─────────────────────────────────────────────────────────────

describe("winsorization", () => {
  it("extreme outliers do not more than ~2 positions from true rank", () => {
    // 50 values from 1..50 plus two extreme outliers
    const values = [
      -10_000,
      ...Array.from({ length: 50 }, (_, i) => i + 1),
      10_000,
    ]; // total 52 values; outliers at both ends
    // Owner at 25 should sit near 50th percentile on the core distribution.
    const result = computePercentile(makeInput("revenue_per_employee", 25), values, null);
    expect(result.confidenceState).toBe("valid");
    // After winsorization, outliers are clamped; owner should be around P48–P52
    expect(result.percentile).toBeGreaterThan(40);
    expect(result.percentile).toBeLessThan(60);
  });
});

// ── Synth path — interpolation ────────────────────────────────────────────────

describe("synth fallback — piecewise-linear interpolation", () => {
  it("owner at synth q1 → percentile = 20", () => {
    const { percentile, quartileLabel } = computePercentileFromQuintiles(
      "gross_margin",
      12.0,  // exactly q1
      NACE49_SYNTH
    );
    expect(percentile).toBe(20);
    expect(quartileLabel).toBe("spodní čtvrtina");
  });

  it("owner below q1 → percentile clamped ≤ 20", () => {
    const { percentile } = computePercentileFromQuintiles("gross_margin", 5, NACE49_SYNTH);
    expect(percentile).toBeLessThanOrEqual(20);
    expect(percentile).toBeGreaterThanOrEqual(0);
  });

  it("owner between q2 and median → linear interpolation", () => {
    // q2=16, median=18, p_lo=40, p_hi=50
    // x=17 → pct = 40 + (17-16)/(18-16) * (50-40) = 40 + 5 = 45
    const { percentile } = computePercentileFromQuintiles("gross_margin", 17, NACE49_SYNTH);
    expect(percentile).toBe(45);
  });

  it("owner at synth q4 → percentile = 100 (clamped to upper end)", () => {
    const { percentile } = computePercentileFromQuintiles("gross_margin", 25, NACE49_SYNTH);
    // q4 is the upper clamping point → maps to 100
    expect(percentile).toBe(100);
    expect(computeQuartileLabel(percentile)).toBe("horní čtvrtina");
  });

  it("owner above q4 → percentile = 100, horní čtvrtina", () => {
    const { percentile, quartileLabel } = computePercentileFromQuintiles(
      "gross_margin",
      999,
      NACE49_SYNTH
    );
    expect(percentile).toBe(100);
    expect(quartileLabel).toBe("horní čtvrtina");
  });

  it("computePercentile uses synth when realValues is null", () => {
    const result = computePercentile(
      makeInput("gross_margin", 17),
      null,
      NACE49_SYNTH
    );
    expect(result.source).toBe("synthetic");
    expect(result.confidenceState).toBe("valid");
    expect(result.percentile).toBe(45);
    expect(result.achievedRung).toBe(3); // synth always at NACE-only grain
    expect(result.nUsed).toBe(200); // n_proxy
  });
});

// ── Quartile boundary rules ───────────────────────────────────────────────────

describe("quartile label boundary rules (percentile-compute.md §3.5)", () => {
  it("percentile = 0 → spodní čtvrtina", () => {
    expect(computeQuartileLabel(0)).toBe("spodní čtvrtina");
  });

  it("percentile = 24.9 → spodní čtvrtina", () => {
    expect(computeQuartileLabel(24.9)).toBe("spodní čtvrtina");
  });

  it("percentile = 25 → druhá čtvrtina (inclusive lower boundary)", () => {
    expect(computeQuartileLabel(25)).toBe("druhá čtvrtina");
  });

  it("percentile = 49.9 → druhá čtvrtina", () => {
    expect(computeQuartileLabel(49.9)).toBe("druhá čtvrtina");
  });

  it("percentile = 50 → třetí čtvrtina", () => {
    expect(computeQuartileLabel(50)).toBe("třetí čtvrtina");
  });

  it("percentile = 74.9 → třetí čtvrtina", () => {
    expect(computeQuartileLabel(74.9)).toBe("třetí čtvrtina");
  });

  it("percentile = 75 → horní čtvrtina", () => {
    expect(computeQuartileLabel(75)).toBe("horní čtvrtina");
  });

  it("percentile = 100 → horní čtvrtina", () => {
    expect(computeQuartileLabel(100)).toBe("horní čtvrtina");
  });
});

// ── Real supersedes synth ─────────────────────────────────────────────────────

describe("real-supersedes-synth (D-025, percentile-compute.md §9 OQ-PC-03)", () => {
  it("when realValues has ≥ floor entries, synth is ignored", () => {
    const values = uniform100();
    const result = computePercentile(
      makeInput("gross_margin", 50),
      values,
      NACE49_SYNTH
    );
    // With real data the algorithm uses real path → source should be 'real'
    expect(result.source).toBe("real");
    expect(result.percentile).toBe(49.5); // real-path result, not synth result
  });
});

// ── Empty state ───────────────────────────────────────────────────────────────

describe("empty state", () => {
  it("null realValues and null synth → confidenceState 'empty', achievedRung 4", () => {
    const result = computePercentile(makeInput("gross_margin", 20), null, null);
    expect(result.confidenceState).toBe("empty");
    expect(result.achievedRung).toBe(4);
    expect(result.percentile).toBeNull();
    expect(result.quartileLabel).toBeNull();
    expect(result.footnote).toContain("příliš nízký");
  });
});

// ── determineConfidenceState ──────────────────────────────────────────────────

describe("determineConfidenceState helper", () => {
  it("n=0 → 'empty'", () => {
    expect(determineConfidenceState("gross_margin", 0)).toBe("empty");
  });

  it("n=29 → 'below-floor' for gross_margin (floor=30)", () => {
    expect(determineConfidenceState("gross_margin", 29)).toBe("below-floor");
  });

  it("n=30 → 'valid' for gross_margin", () => {
    expect(determineConfidenceState("gross_margin", 30)).toBe("valid");
  });

  it("n=49 → 'below-floor' for working_capital_cycle (strict floor=50)", () => {
    expect(determineConfidenceState("working_capital_cycle", 49)).toBe("below-floor");
  });

  it("n=50 → 'valid' for working_capital_cycle", () => {
    expect(determineConfidenceState("working_capital_cycle", 50)).toBe("valid");
  });
});
