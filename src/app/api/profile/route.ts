/**
 * POST /api/profile — Create or update the owner's sector profile
 *
 * Body: { nace_sector: string; size_band: 'S1'|'S2'|'S3'; region: string; token?: string }
 *
 * Write order per sector-profile-configuration.md §3.1:
 *   1. Check that active consent exists (fail if not — consent must precede profile write)
 *   2. Upsert profile row in user_contributed lane
 *
 * The consent_event_id is fetched from the active consent row.
 * Token (George JWT) identifies the user. If absent, uses stub user ID (OQ-050).
 *
 * Privacy: profile writes use sqlUser (user_contributed_lane_role).
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyGeorgeToken } from "@/lib/auth";
import { hasActiveConsent, getCurrentConsent } from "@/lib/consent";
import { upsertProfile } from "@/lib/profiles";
import type { SizeBand, CzRegion } from "@/types/data-lanes";

export async function POST(req: NextRequest) {
  let body: {
    nace_sector?: string;
    size_band?: string;
    region?: string;
    token?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Neplatný požadavek." }, { status: 400 });
  }

  const { nace_sector, size_band, region, token } = body;

  if (!nace_sector || !size_band || !region) {
    return NextResponse.json(
      { error: "Obor, velikost firmy a region jsou povinné." },
      { status: 400 }
    );
  }

  // Validate enums
  const validSizeBands = ["S1", "S2", "S3"] as const;
  if (!validSizeBands.includes(size_band as SizeBand)) {
    return NextResponse.json({ error: "Neplatná hodnota velikosti firmy." }, { status: 400 });
  }

  // Resolve user ID
  let userId: string | null = null;
  if (token) {
    userId = await verifyGeorgeToken(token);
  }
  if (!userId) {
    userId = "stub-user-direct-signup"; // OQ-050: direct sign-up stub
  }

  // Check active consent before any write (sector-profile-configuration.md §3.1)
  try {
    const active = await hasActiveConsent(userId);
    if (!active) {
      return NextResponse.json(
        { error: "Souhlas je nutný před uložením profilu." },
        { status: 403 }
      );
    }
  } catch (err) {
    console.error("[api/profile] Consent check failed:", err);
    return NextResponse.json(
      { error: "Nepodařilo se ověřit souhlas. Zkuste to prosím znovu." },
      { status: 500 }
    );
  }

  // Get consent event ID for reference
  let consentEventId: string;
  try {
    const current = await getCurrentConsent(userId);
    if (!current) {
      return NextResponse.json(
        { error: "Souhlas nebyl nalezen." },
        { status: 403 }
      );
    }
    consentEventId = current.id;
  } catch (err) {
    console.error("[api/profile] Failed to fetch consent event:", err);
    return NextResponse.json(
      { error: "Nepodařilo se načíst souhlas." },
      { status: 500 }
    );
  }

  // Upsert profile
  try {
    await upsertProfile({
      user_id: userId,
      nace_sector,
      size_band: size_band as SizeBand,
      region: region as CzRegion,
      source: "user_ingest_direct",
      consent_event_id: consentEventId,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/profile] Upsert failed:", err);
    return NextResponse.json(
      { error: "Nepodařilo se uložit váš profil. Zkuste to prosím znovu." },
      { status: 500 }
    );
  }
}
