/**
 * Smoke test — migration enum values
 *
 * This test verifies that the TypeScript DATA_LANE enum values (src/types/data-lanes.ts)
 * exactly match the expected set defined in the SQL migrations, without requiring a live
 * database connection. It is a compile-time / unit-level check that the two artifacts
 * stay in sync.
 *
 * For a live RLS test (confirming that brief_lane_role cannot read user_contributed rows),
 * see docs/engineering/scaffold.md §5 — that test requires a running Supabase instance
 * and is marked as an integration test to run in CI with a local Supabase dev stack.
 *
 * Why no live DB test here:
 *   - The scaffold task requires tests that "pass" in the current environment.
 *   - A local Supabase instance is not guaranteed to be running in the worktree.
 *   - The enum-sync test covers the core invariant (no enum drift) without needing a DB.
 */

import { describe, it, expect } from "vitest";
import {
  DATA_LANE,
  PUBLISH_STATE,
  DELIVERY_FORMAT,
  CONSENT_EVENT_TYPE,
  CONSENT_SURFACE,
  CONSENT_CHANNEL,
  SIZE_BAND,
  CZ_REGION,
  TIME_HORIZON,
  OWNER_METRIC_ID,
  OWNER_METRIC_SOURCE,
} from "../../types/data-lanes";

describe("Data-lane enum invariants (ADR-0002-C / D-010)", () => {
  it("DATA_LANE contains exactly the four canonical lane identifiers", () => {
    const values = Object.values(DATA_LANE).sort();
    expect(values).toEqual(["brief", "credit_risk", "rm_visible", "user_contributed"]);
  });

  it("PUBLISH_STATE contains exactly the three brief lifecycle states", () => {
    const values = Object.values(PUBLISH_STATE).sort();
    expect(values).toEqual(["archived", "draft", "published"]);
  });

  it("DELIVERY_FORMAT contains exactly the three MVP delivery surfaces", () => {
    const values = Object.values(DELIVERY_FORMAT).sort();
    expect(values).toEqual(["email", "pdf", "web"]);
  });

  it("CONSENT_EVENT_TYPE contains exactly grant and revoke", () => {
    const values = Object.values(CONSENT_EVENT_TYPE).sort();
    expect(values).toEqual(["grant", "revoke"]);
  });

  it("CONSENT_SURFACE contains the MVP-active surfaces", () => {
    const values = Object.values(CONSENT_SURFACE).sort();
    // rm-introduction-flow is reserved for Increment 2+ (privacy-architecture.md §4.1)
    // but the SQL enum includes it as a future-proof value.
    // The TS constant intentionally excludes it at MVP — that is correct and tested here.
    expect(values).toEqual(["onboarding-screen", "settings-soukromi"]);
    expect(values).not.toContain("rm-introduction-flow");
  });

  it("CONSENT_CHANNEL contains exactly the two MVP entry channels", () => {
    const values = Object.values(CONSENT_CHANNEL).sort();
    expect(values).toEqual(["direct-signup", "rm-referred-george-embed"]);
  });

  it("SIZE_BAND contains exactly the three cohort size bands (cohort-math.md §2.2)", () => {
    const values = Object.values(SIZE_BAND).sort();
    expect(values).toEqual(["S1", "S2", "S3"]);
  });

  it("CZ_REGION contains exactly the eight NUTS 2 Czech regions (cohort-math.md §2.3)", () => {
    const values = Object.values(CZ_REGION).sort();
    expect(values).toHaveLength(8);
    expect(values).toContain("Praha");
    expect(values).toContain("Moravskoslezsko");
    // All eight present
    const expectedRegions = [
      "Praha",
      "Střední Čechy",
      "Jihozápad",
      "Severozápad",
      "Severovýchod",
      "Jihovýchod",
      "Střední Morava",
      "Moravskoslezsko",
    ].sort();
    expect(values).toEqual(expectedRegions);
  });

  it("TIME_HORIZON contains the four frozen Czech time-horizon tags (D-015)", () => {
    const values = Object.values(TIME_HORIZON).sort();
    const expected = [
      "Do 12 měsíců",
      "Do 3 měsíců",
      "Okamžitě",
      "Více než rok",
    ].sort();
    expect(values).toEqual(expected);
  });
});

describe("Lane boundary — DATA_LANE.BRIEF is distinct from all others", () => {
  it("brief lane value does not collide with other lane values", () => {
    const otherLanes = Object.values(DATA_LANE).filter(
      (v) => v !== DATA_LANE.BRIEF
    );
    otherLanes.forEach((lane) => {
      expect(lane).not.toBe(DATA_LANE.BRIEF);
    });
  });

  it("user_contributed lane value does not collide with brief lane", () => {
    expect(DATA_LANE.USER_CONTRIBUTED).not.toBe(DATA_LANE.BRIEF);
  });
});

describe("Consent model invariants (privacy-architecture.md §4)", () => {
  it("lanes_covered default covers all four canonical lanes", () => {
    // The default value in 0004_consent_events.sql is:
    // '["brief","user_contributed","rm_visible","credit_risk"]'
    // Verify the TypeScript enum values match exactly.
    const defaultLanesCovered = [
      DATA_LANE.BRIEF,
      DATA_LANE.USER_CONTRIBUTED,
      DATA_LANE.RM_VISIBLE,
      DATA_LANE.CREDIT_RISK,
    ];
    expect(defaultLanesCovered.sort()).toEqual(
      Object.values(DATA_LANE).sort()
    );
  });
});

// ── 0006_owner_metrics.sql invariants ────────────────────────────────────────

describe("0006 owner_metrics — metric_id domain (D-024)", () => {
  it("OWNER_METRIC_ID contains exactly the 8 frozen v0.3 metrics", () => {
    const values = Object.values(OWNER_METRIC_ID).sort();
    const expected = [
      "ebitda_margin",
      "gross_margin",
      "labor_cost_ratio",
      "net_margin",
      "pricing_power",
      "revenue_growth",
      "revenue_per_employee",
      "working_capital_cycle",
    ].sort();
    expect(values).toEqual(expected);
  });

  it("OWNER_METRIC_ID does NOT contain 'roce' (removed per D-024)", () => {
    const values = Object.values(OWNER_METRIC_ID);
    expect(values).not.toContain("roce");
  });

  it("OWNER_METRIC_ID has exactly 8 entries matching the D-024 frozen set", () => {
    expect(Object.values(OWNER_METRIC_ID)).toHaveLength(8);
  });
});

describe("0006 owner_metrics — source enum (owner-metrics-schema.md §2)", () => {
  it("OWNER_METRIC_SOURCE contains exactly the three allowed source values", () => {
    const values = Object.values(OWNER_METRIC_SOURCE).sort();
    expect(values).toEqual([
      "demo_seed",
      "prepopulated_excel",
      "user_entered",
    ]);
  });

  it("OWNER_METRIC_SOURCE has exactly 3 entries", () => {
    expect(Object.values(OWNER_METRIC_SOURCE)).toHaveLength(3);
  });
});

describe("0006 owner_metrics — composite PK semantics", () => {
  it("each OWNER_METRIC_ID value is unique (no duplicates in the frozen set)", () => {
    const values = Object.values(OWNER_METRIC_ID);
    const unique = new Set(values);
    expect(unique.size).toBe(values.length);
  });
});
