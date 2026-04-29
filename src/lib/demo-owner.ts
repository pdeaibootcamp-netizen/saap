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
 *
 * Reconciled 2026-04-27 with the actual cohort_companies rows after Track B
 * ingest of `nace-4941-silnicni-nakladni-doprava-2026-02.xlsx` (3,579 firms).
 * Each constant points to a real Czech firm whose ingested data shape matches
 * the demo category's missing-field profile (in-tile-prompts.md §9.2).
 *
 * Selection criteria:
 *   DEMO_ICO_MISSING_DATA  — large firm; employee count AND profit missing → ~6 ask tiles
 *   DEMO_ICO_NO_EMPLOYEES  — employee count missing → Tržby/zaměstnance ask
 *   DEMO_ICO_NO_PROFIT     — profit missing → Čistá marže ask
 *   DEMO_ICO_FULL_DATA     — all available data populated → happy path
 *
 * Default (cookie-default) = DEMO_ICO_MISSING_DATA — the PoC's central probe
 * is the in-tile prompt UX. A happy-path first impression undersells the give-to-get
 * mechanic the test is designed to surface (in-tile-prompts.md §9.2, last para).
 *
 * The firm name shown in the switcher comes from cohort_companies.name (added
 * in migration 0009); these labels are kept here only as a documentation aid
 * and a fallback if the DB lookup fails.
 */
export const DEMO_ICO_MISSING_DATA  = "03846415"; // Nuoro Truck s.r.o.       — S3, no employees, no profit
export const DEMO_ICO_NO_EMPLOYEES  = "29133513"; // Gargitrans s.r.o.        — S3 (bucketed), employee_count null, profit present
export const DEMO_ICO_NO_PROFIT     = "27567711"; // Bera Transport s.r.o.    — S2, 30 employees, profit_czk null
export const DEMO_ICO_FULL_DATA     = "26393913"; // TOP TRANS LINE s.r.o.    — S1, 14 employees, all derived metrics present

/**
 * Static IčO → firm name map. Used as a fallback for the IčO switcher when
 * the cohort_companies lookup is unavailable. Keep in sync with the constants
 * above. Once migration 0009 is in production, the runtime path reads
 * cohort_companies.name and this map only matters for offline / first-render
 * display before the switch endpoint has answered.
 */
export const DEMO_ICO_NAMES: Record<string, string> = {
  [DEMO_ICO_MISSING_DATA]: "Nuoro Truck s.r.o.",
  [DEMO_ICO_NO_EMPLOYEES]: "Gargitrans s.r.o.",
  [DEMO_ICO_NO_PROFIT]:    "Bera Transport s.r.o.",
  [DEMO_ICO_FULL_DATA]:    "TOP TRANS LINE s.r.o.",
};

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
 * NACE 49 = Silniční nákladní doprava (road freight transport) — the v0.3
 * demo NACE per the user's industry-data Excel hand-off (Phase 3.0).
 * v0.2 NACE 31 (furniture) stays on `main` for customer-testing continuity;
 * v0.3 swaps to 49 because that's the NACE where we have real industry data
 * + synth quintiles loaded.
 * consent_event_id is a dummy UUID — never written to DB.
 *
 * Used as a fallback when cohort_companies is not yet available
 * (Track B's ingest hasn't been run by the user yet, or DB is unreachable).
 */
export const DEMO_OWNER_PROFILE: SectorProfile = {
  id: "00000000-5eed-0000-0000-000000000001",
  user_id: DEMO_OWNER_USER_ID,
  nace_sector: "49",
  size_band: "S2",
  region: "Praha",
  source: "prepopulated",
  consent_event_id: "00000000-5eed-0000-0000-c0n5en7e0001",
  created_at: "2026-04-27T00:00:00.000Z",
  updated_at: "2026-04-27T00:00:00.000Z",
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
