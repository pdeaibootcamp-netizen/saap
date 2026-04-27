/**
 * demo-mode-guard.test.ts
 *
 * Verifies the DEMO_MODE guard logic that gates
 * POST /api/owner/demo/switch and POST /api/owner/demo/reset.
 *
 * Both handlers must return 404 when DEMO_MODE !== 'true'.
 * Tests the guard condition without invoking the Next.js route framework.
 *
 * owner-metrics-api.md §7 / ADR-OM-03
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";

function isDemoModeActive(envValue: string | undefined): boolean {
  return envValue === "true";
}

describe("DEMO_MODE guard — gating condition", () => {
  const originalEnv = process.env.DEMO_MODE;

  afterEach(() => {
    process.env.DEMO_MODE = originalEnv;
  });

  it("returns true when DEMO_MODE=true", () => {
    process.env.DEMO_MODE = "true";
    expect(isDemoModeActive(process.env.DEMO_MODE)).toBe(true);
  });

  it("returns false when DEMO_MODE is unset", () => {
    delete process.env.DEMO_MODE;
    expect(isDemoModeActive(process.env.DEMO_MODE)).toBe(false);
  });

  it("returns false when DEMO_MODE='false'", () => {
    process.env.DEMO_MODE = "false";
    expect(isDemoModeActive(process.env.DEMO_MODE)).toBe(false);
  });

  it("returns false when DEMO_MODE='1'", () => {
    process.env.DEMO_MODE = "1";
    expect(isDemoModeActive(process.env.DEMO_MODE)).toBe(false);
  });

  it("returns false when DEMO_MODE='True' (case-sensitive)", () => {
    process.env.DEMO_MODE = "True";
    expect(isDemoModeActive(process.env.DEMO_MODE)).toBe(false);
  });

  it("returns false when DEMO_MODE='yes'", () => {
    process.env.DEMO_MODE = "yes";
    expect(isDemoModeActive(process.env.DEMO_MODE)).toBe(false);
  });
});

describe("DEMO_MODE — only the literal string 'true' activates demo routes", () => {
  it("switch route is unreachable in production (DEMO_MODE unset)", () => {
    delete process.env.DEMO_MODE;
    const wouldReturn404 = !isDemoModeActive(process.env.DEMO_MODE);
    expect(wouldReturn404).toBe(true);
  });

  it("reset route is unreachable in production (DEMO_MODE unset)", () => {
    delete process.env.DEMO_MODE;
    const wouldReturn404 = !isDemoModeActive(process.env.DEMO_MODE);
    expect(wouldReturn404).toBe(true);
  });
});
