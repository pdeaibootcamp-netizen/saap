/**
 * demo-owner.ts — v0.2 PoC demo identity
 *
 * Single source of truth for the hardcoded demo owner used in the v0.2
 * customer-testing PoC. No DB reads, no side effects, no framework imports.
 *
 * Revert checklist (v0.3 removal plan — v0-2-identity-bypass.md §8):
 *   1. Delete this file.
 *   2. Remove isDemoOwner short-circuit from src/app/brief/[id]/page.tsx lines ~280–293.
 *   3. Remove isDemoOwner early-return from src/lib/consent.ts hasActiveConsent().
 *   4. Remove cookie-setting and isDemoOwner short-circuit from src/app/page.tsx.
 */

import type { SectorProfile } from "./profiles";

// ─── Constants ───────────────────────────────────────────────────────────────

/**
 * Fixed UUID for the PoC demo owner.
 * Uses the 00000000-5eed-* pattern matching the v0.1 seed script.
 * This ID is never written to the DB by the bypass — it is recognised
 * only in-memory by isDemoOwner().
 */
export const DEMO_OWNER_USER_ID = "00000000-5eed-0000-0000-000000000001";

/**
 * Hardcoded SectorProfile for the demo owner.
 * Shape matches SectorProfile from src/lib/profiles.ts.
 * NACE 31 = furniture manufacturing (matches v0.2 brief seed).
 * consent_event_id is a dummy UUID — never written to DB.
 */
export const DEMO_OWNER_PROFILE: SectorProfile = {
  id: "00000000-5eed-0000-0000-000000000001",
  user_id: DEMO_OWNER_USER_ID,
  nace_sector: "31",
  size_band: "S2",
  region: "Praha",
  source: "prepopulated",
  consent_event_id: "00000000-5eed-0000-0000-c0n5en7e0001",
  created_at: "2026-04-21T00:00:00.000Z",
  updated_at: "2026-04-21T00:00:00.000Z",
};

// ─── Functions ───────────────────────────────────────────────────────────────

/**
 * Returns true iff userId is the PoC demo owner.
 * Single string comparison — no async, no DB, no throws.
 */
export function isDemoOwner(userId: string): boolean {
  return userId === DEMO_OWNER_USER_ID;
}

/**
 * Returns the demo owner's profile as a resolved Promise.
 * Async signature matches getProfileByUserId() so callers can substitute
 * with a conditional without changing their await pattern.
 */
export async function getDemoOwnerProfile(): Promise<SectorProfile> {
  return DEMO_OWNER_PROFILE;
}
