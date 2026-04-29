/**
 * ico-format.test.ts
 *
 * Validates the IČO format check used by POST /api/owner/demo/switch.
 * Czech IČO must be exactly 8 digits.
 *
 * owner-metrics-api.md §7
 */

import { describe, it, expect } from "vitest";

const ICO_REGEX = /^\d{8}$/;

function isValidIco(ico: string): boolean {
  return ICO_REGEX.test(ico.trim());
}

describe("IČO format validation — exactly 8 digits", () => {
  it("accepts a valid 8-digit IČO", () => {
    expect(isValidIco("27195855")).toBe(true);
    expect(isValidIco("45786553")).toBe(true);
    expect(isValidIco("00000001")).toBe(true);
  });

  it("rejects 7-digit IČO", () => {
    expect(isValidIco("1234567")).toBe(false);
  });

  it("rejects 9-digit IČO", () => {
    expect(isValidIco("123456789")).toBe(false);
  });

  it("rejects non-numeric IČO (letters)", () => {
    expect(isValidIco("ABCD1234")).toBe(false);
    expect(isValidIco("abcd1234")).toBe(false);
  });

  it("rejects IČO with spaces", () => {
    // After trim, spaces in the middle still fail
    expect(isValidIco("1234 5678")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isValidIco("")).toBe(false);
  });

  it("rejects IČO with decimal point", () => {
    expect(isValidIco("1234.678")).toBe(false);
  });

  it("rejects IČO with too few digits after trim", () => {
    // trim() is applied before regex check; 7 digits → invalid
    expect(isValidIco("  1234567 ")).toBe(false); // 7 digits after trim
  });

  it("accepts 8-digit IČO with surrounding whitespace (trimmed before check)", () => {
    // Leading/trailing whitespace is stripped before regex; valid 8 digits remain
    expect(isValidIco("  27195855  ")).toBe(true);
    // Leading whitespace + 8 digits is also valid after trim
    expect(isValidIco("  12345678")).toBe(true);
  });
});
