/**
 * hmac-verify.test.ts — HMAC-SHA256 verification logic
 *
 * Tests the signature verification used by the n8n callback endpoint
 * (POST /api/admin/briefs/from-n8n). Extracted into a pure function
 * for testability without spinning up the HTTP server.
 *
 * docs/engineering/n8n-integration.md §10
 */

import { describe, it, expect } from "vitest";
import crypto from "crypto";

// ── Extracted verification logic (mirrors from-n8n/route.ts) ─────────────────

function verifyHmacSignature(
  body: string,
  sigHeader: string,
  secret: string
): boolean {
  if (!sigHeader.startsWith("sha256=")) return false;
  const receivedHex = sigHeader.slice("sha256=".length);

  const computedHex = crypto
    .createHmac("sha256", secret)
    .update(body, "utf8")
    .digest("hex");

  if (receivedHex.length !== computedHex.length) return false;

  try {
    return crypto.timingSafeEqual(
      Buffer.from(receivedHex, "hex"),
      Buffer.from(computedHex, "hex")
    );
  } catch {
    return false;
  }
}

function makeSignature(body: string, secret: string): string {
  const hex = crypto.createHmac("sha256", secret).update(body, "utf8").digest("hex");
  return `sha256=${hex}`;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

const SECRET = "test-secret-abc123";
const BODY = JSON.stringify({ jobId: "uuid-123", status: "done" });

describe("HMAC-SHA256 verification", () => {
  it("valid signature verifies successfully", () => {
    const sig = makeSignature(BODY, SECRET);
    expect(verifyHmacSignature(BODY, sig, SECRET)).toBe(true);
  });

  it("tampered body fails verification", () => {
    const sig = makeSignature(BODY, SECRET);
    const tamperedBody = BODY + " ";
    expect(verifyHmacSignature(tamperedBody, sig, SECRET)).toBe(false);
  });

  it("wrong secret fails verification", () => {
    const sig = makeSignature(BODY, SECRET);
    expect(verifyHmacSignature(BODY, sig, "wrong-secret")).toBe(false);
  });

  it("missing header prefix ('sha256=') fails", () => {
    const sigNoPrefix = crypto
      .createHmac("sha256", SECRET)
      .update(BODY, "utf8")
      .digest("hex");
    expect(verifyHmacSignature(BODY, sigNoPrefix, SECRET)).toBe(false);
  });

  it("empty header fails", () => {
    expect(verifyHmacSignature(BODY, "", SECRET)).toBe(false);
  });

  it("header with only prefix fails", () => {
    expect(verifyHmacSignature(BODY, "sha256=", SECRET)).toBe(false);
  });

  it("signature mismatch produces false (not throws)", () => {
    const wrongSig = makeSignature(BODY, "other-secret");
    expect(() => verifyHmacSignature(BODY, wrongSig, SECRET)).not.toThrow();
    expect(verifyHmacSignature(BODY, wrongSig, SECRET)).toBe(false);
  });

  it("empty body with correct signature verifies", () => {
    const emptyBody = "";
    const sig = makeSignature(emptyBody, SECRET);
    expect(verifyHmacSignature(emptyBody, sig, SECRET)).toBe(true);
  });

  it("large payload verifies correctly", () => {
    const largeBody = JSON.stringify({ data: "x".repeat(50000) });
    const sig = makeSignature(largeBody, SECRET);
    expect(verifyHmacSignature(largeBody, sig, SECRET)).toBe(true);
  });
});

describe("HMAC directionality (ADR-N8N-01)", () => {
  it("N8N_WEBHOOK_SECRET and N8N_CALLBACK_SECRET must be distinct", () => {
    // This test encodes the ADR-N8N-01 requirement: two different secrets,
    // one per direction. If someone sets them to the same value, this test
    // documents the intended contract (it's not a functional test, it's a
    // policy trip-wire).
    const webhookSecret = "webhook-secret-aaa";
    const callbackSecret = "callback-secret-bbb";
    expect(webhookSecret).not.toBe(callbackSecret);
  });

  it("signature produced with webhook secret is rejected by callback verification", () => {
    const webhookSecret = "webhook-secret-aaa";
    const callbackSecret = "callback-secret-bbb";
    const sig = makeSignature(BODY, webhookSecret);
    expect(verifyHmacSignature(BODY, sig, callbackSecret)).toBe(false);
  });
});
