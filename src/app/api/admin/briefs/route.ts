/**
 * /api/admin/briefs — List and create briefs
 *
 * GET  — list all briefs (analyst dashboard)
 * POST — create a new draft brief for a given NACE sector
 *
 * Auth: requires sr_admin_session cookie (ADR-0001-D).
 */

import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { listBriefs, createDraftBrief } from "@/lib/briefs";

function unauthorized() {
  return NextResponse.json({ error: "Neautorizováno." }, { status: 401 });
}

export async function GET() {
  if (!isAdminAuthenticated()) return unauthorized();

  try {
    const briefs = await listBriefs();
    return NextResponse.json(briefs);
  } catch (err) {
    console.error("[api/admin/briefs] GET error:", err);
    return NextResponse.json(
      { error: "Nepodařilo se načíst seznam přehledů." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  if (!isAdminAuthenticated()) return unauthorized();

  let body: { nace_sector?: string };
  try {
    body = (await req.json()) as { nace_sector?: string };
  } catch {
    return NextResponse.json({ error: "Neplatný požadavek." }, { status: 400 });
  }

  const { nace_sector } = body;
  if (!nace_sector) {
    return NextResponse.json({ error: "Kód NACE je povinný." }, { status: 400 });
  }

  // Validate that the sector has a seed cohort (D-001)
  const VALID_NACE_SECTORS = ["10", "41", "46", "62"];
  if (!VALID_NACE_SECTORS.includes(nace_sector)) {
    return NextResponse.json(
      { error: "Pro tento sektor nejsou k dispozici dostatečná data kohorty." },
      { status: 400 }
    );
  }

  try {
    // author_id: stub at MVP — in production this comes from the analyst's
    // authenticated identity. For trial, use a fixed analyst ID.
    const author_id = "analyst-stub";
    const brief = await createDraftBrief({ nace_sector, author_id });
    return NextResponse.json({ id: brief.id }, { status: 201 });
  } catch (err) {
    console.error("[api/admin/briefs] POST error:", err);
    return NextResponse.json(
      { error: "Nepodařilo se vytvořit přehled." },
      { status: 500 }
    );
  }
}
