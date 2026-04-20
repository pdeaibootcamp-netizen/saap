/**
 * profiles.ts — CRUD for sector_profiles + sector_profile_history
 *
 * Lane: user_contributed. Uses sqlUser from db-user.ts.
 *
 * Privacy invariant: this module never queries the briefs table.
 * The sector_profile contains only NACE, size_band, region — no financial data.
 *
 * Write-ordering constraint (sector-profile-configuration.md §3.1):
 * The consent event MUST be committed before any sector_profile write.
 * Application callers must call grantConsent() first and pass the returned
 * consent_event_id here.
 *
 * D-012: profile rows are never deleted on revocation — consent.ts handles
 * stop-flow; this module only reads/writes profile rows.
 */

import { sqlUser } from "./db-user";
import type { SizeBand, CzRegion } from "../types/data-lanes";

// ─── Types ───────────────────────────────────────────────────────────────────

export type ProfileSource = "user_entered" | "prepopulated" | "user_correction";

export interface SectorProfile {
  id: string;
  user_id: string;
  nace_sector: string;
  size_band: SizeBand;
  region: CzRegion;
  source: ProfileSource;
  consent_event_id: string;
  created_at: string;
  updated_at: string;
}

export interface SectorProfileHistory extends SectorProfile {
  superseded_at: string;
}

// ─── Reads ───────────────────────────────────────────────────────────────────

/** Get the active sector profile for a user. Returns null if none exists. */
export async function getProfileByUserId(userId: string): Promise<SectorProfile | null> {
  const rows = await sqlUser<SectorProfile[]>`
    SELECT
      id, user_id, nace_sector, size_band, region, source,
      consent_event_id, created_at, updated_at
    FROM sector_profiles
    WHERE user_id = ${userId}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

/** Get all owners with active profiles for a given NACE sector.
 *  Used by the publish pipeline to find recipients.
 *  Returns user_id only — no financial data. */
export async function getUserIdsByNace(naceSector: string): Promise<string[]> {
  const rows = await sqlUser<{ user_id: string }[]>`
    SELECT sp.user_id
    FROM sector_profiles sp
    WHERE sp.nace_sector = ${naceSector}
  `;
  return rows.map((r) => r.user_id);
}

/** Get profile history for a user (audit trail). */
export async function getProfileHistory(userId: string): Promise<SectorProfileHistory[]> {
  // sector_profile_history table: see migration 0005_profile_history.sql (created below)
  const rows = await sqlUser<SectorProfileHistory[]>`
    SELECT
      id, user_id, nace_sector, size_band, region, source,
      consent_event_id, created_at, updated_at, superseded_at
    FROM sector_profile_history
    WHERE user_id = ${userId}
    ORDER BY superseded_at DESC
  `;
  return rows;
}

// ─── Writes ──────────────────────────────────────────────────────────────────

/**
 * Create or update a sector_profile row.
 * If a profile already exists for this user_id, moves the current row to
 * history before upserting (edit history per sector-profile-configuration.md §3.3).
 *
 * REQUIRES: consent event must already be committed (write-ordering constraint).
 */
export async function upsertProfile(params: {
  user_id: string;
  nace_sector: string;
  size_band: SizeBand;
  region: CzRegion;
  source: ProfileSource;
  consent_event_id: string;
}): Promise<SectorProfile> {
  // Check for existing profile to snapshot to history
  const existing = await getProfileByUserId(params.user_id);

  if (existing) {
    // Move current row to history before update
    await sqlUser`
      INSERT INTO sector_profile_history
        (id, user_id, nace_sector, size_band, region, source, consent_event_id,
         created_at, updated_at, superseded_at)
      VALUES
        (${existing.id}, ${existing.user_id}, ${existing.nace_sector},
         ${existing.size_band}, ${existing.region}, ${existing.source},
         ${existing.consent_event_id}, ${existing.created_at}, ${existing.updated_at}, now())
    `;

    // Update existing row
    const rows = await sqlUser<SectorProfile[]>`
      UPDATE sector_profiles
      SET
        nace_sector = ${params.nace_sector},
        size_band = ${params.size_band},
        region = ${params.region},
        source = ${params.source},
        consent_event_id = ${params.consent_event_id},
        updated_at = now()
      WHERE user_id = ${params.user_id}
      RETURNING
        id, user_id, nace_sector, size_band, region, source,
        consent_event_id, created_at, updated_at
    `;
    console.log(`[profiles] Updated profile for user=${params.user_id}`);
    return rows[0];
  } else {
    // Create new profile row
    const rows = await sqlUser<SectorProfile[]>`
      INSERT INTO sector_profiles
        (user_id, nace_sector, size_band, region, source, consent_event_id, data_lane)
      VALUES
        (${params.user_id}, ${params.nace_sector}, ${params.size_band},
         ${params.region}, ${params.source}, ${params.consent_event_id}, 'user_contributed')
      RETURNING
        id, user_id, nace_sector, size_band, region, source,
        consent_event_id, created_at, updated_at
    `;
    console.log(`[profiles] Created profile for user=${params.user_id}`);
    return rows[0];
  }
}
