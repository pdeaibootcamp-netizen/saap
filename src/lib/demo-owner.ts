/**
 * demo-owner.ts — v0.2/v0.3 PoC demo identity
 *
 * Single source of truth for the hardcoded demo owner used in the v0.2–v0.3
 * customer-testing PoC. No DB reads from this file (DB reads happen in
 * owner-metrics.ts and the API routes that consume sr_active_ico).
 *
 * v0.3 additions:
 *   - DEMO_ACTIVE_ICO_COOKIE — cookie name for the IČO switcher (ADR-OM-02).
 *   - DEMO_DEFAULT_ICO — the IČO used when no sr_active_ico cookie is set.
 *   - getDemoOwnerProfileForIco() — defers profile lookup to the caller
 *     (which reads cohort_companies); returns hardcoded fallback if unavailable.
 *
 * Revert checklist (v0.4 removal plan — v0-2-identity-bypass.md §8):
 *   1. Delete this file.
 *   2. Remove isDemoOwner short-circuit from src/app/brief/[id]/page.tsx.
 *   3. Remove isDemoOwner early-return from src/lib/consent.ts hasActiveConsent().
 *   4. Remove cookie-setting and isDemoOwner short-circuit from src/app/page.tsx.
 *   5. Remove DEMO_ACTIVE_ICO_COOKIE from middleware and API routes.
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
 * Cookie names used by the v0.3 demo identity layer (ADR-OM-02).
 *
 * sr_user_id:     planted by middleware; always DEMO_OWNER_USER_ID.
 *                 Identifies the owner row in owner_metrics.
 * sr_active_ico:  planted by POST /api/owner/demo/switch.
 *                 Identifies the active demo firm in cohort_companies.
 *                 When absent, DEMO_DEFAULT_ICO is used.
 */
export const DEMO_USER_ID_COOKIE = "sr_user_id";
export const DEMO_ACTIVE_ICO_COOKIE = "sr_active_ico";

/**
 * Pre-seeded demo IČOs for NACE 49.41 (Silniční nákladní doprava).
 * These are plausible 8-digit Czech IČOs; reconciled with actual ingested
 * IČOs from the NACE 49.41 Excel once Track B's ingest runs.
 *
 * Selection criteria (in-tile-prompts.md §9.2):
 *   DEMO_ICO_MISSING_DATA  — large firm; employee count AND profit missing → 6 ask tiles
 *   DEMO_ICO_NO_EMPLOYEES  — mid firm; employee count missing → Tržby/zaměstnance ask
 *   DEMO_ICO_NO_PROFIT     — mid firm; profit missing → Čistá marže ask
 *   DEMO_ICO_FULL_DATA     — small firm; all available data populated → happy path
 *
 * Default (cookie-default) = DEMO_ICO_MISSING_DATA — the PoC's central probe
 * is the in-tile prompt UX. A happy-path first impression undersells the give-to-get
 * mechanic the test is designed to surface (in-tile-prompts.md §9.2, last para).
 *
 * IČO reconciliation: these constants will be updated to real IČOs from the
 * NACE 49.41 Excel once Track B's ingestion script has run and committed the
 * cohort_companies rows. Current values are placeholder stubs that satisfy the
 * 8-digit Czech IČO format.
 */
export const DEMO_ICO_MISSING_DATA  = "27195855"; // Large NACE 49.41 firm; most data missing
export const DEMO_ICO_NO_EMPLOYEES  = "45786553"; // Mid-size; employee count missing
export const DEMO_ICO_NO_PROFIT     = "25514697"; // Mid-size; hospodářský výsledek missing
export const DEMO_ICO_FULL_DATA     = "63999498"; // Small; all available data present (happy path)

/** Ordered list for seed enumeration. First entry = cookie-default on cold load. */
export const DEMO_ICOS_ORDERED = [
  DEMO_ICO_MISSING_DATA,
  DEMO_ICO_NO_EMPLOYEES,
  DEMO_ICO_NO_PROFIT,
  DEMO_ICO_FULL_DATA,
] as const;

/** The IČO that loads when no sr_active_ico cookie is present. */
export const DEMO_DEFAULT_ICO = DEMO_ICOS_ORDERED[0];

/**
 * Hardcoded SectorProfile for the demo owner (v0.2 fallback).
 * Shape matches SectorProfile from src/lib/profiles.ts.
 * NACE 31 = furniture manufacturing (matches v0.2 brief seed).
 * consent_event_id is a dummy UUID — never written to DB.
 *
 * Used as a fallback when cohort_companies is not yet available
 * (Track B hasn't shipped or DB is unreachable).
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
 * Returns the demo owner's hardcoded profile as a resolved Promise.
 * Async signature matches getProfileByUserId() so callers can substitute
 * with a conditional without changing their await pattern.
 *
 * v0.3: prefer getDemoOwnerProfileForIco() when the active IČO is known,
 * as it reads the real NACE/size/region from cohort_companies.
 */
export async function getDemoOwnerProfile(): Promise<SectorProfile> {
  return DEMO_OWNER_PROFILE;
}
