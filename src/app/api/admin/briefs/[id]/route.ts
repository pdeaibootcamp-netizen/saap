/**
 * /api/admin/briefs/[id] — Get and update a single brief
 *
 * GET — fetch brief by ID
 * PUT — update content sections (save draft)
 *
 * Auth: requires sr_admin_session cookie (ADR-0001-D).
 */

import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { getBriefById, updateBriefContent } from "@/lib/briefs";
import type { ContentSection } from "@/lib/briefs";

function unauthorized() {
  return NextResponse.json({ error: "Neautorizováno." }, { status: 401 });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!isAdminAuthenticated()) return unauthorized();

  try {
    const brief = await getBriefById(params.id);
    if (!brief) {
      return NextResponse.json({ error: "Přehled nebyl nalezen." }, { status: 404 });
    }
    return NextResponse.json(brief);
  } catch (err) {
    console.error(`[api/admin/briefs/${params.id}] GET error:`, err);
    return NextResponse.json(
      { error: "Nepodařilo se načíst přehled." },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!isAdminAuthenticated()) return unauthorized();

  let body: { content_sections?: ContentSection[] };
  try {
    body = (await req.json()) as { content_sections?: ContentSection[] };
  } catch {
    return NextResponse.json({ error: "Neplatný požadavek." }, { status: 400 });
  }

  const { content_sections } = body;
  if (!content_sections) {
    return NextResponse.json(
      { error: "Obsah přehledu je povinný." },
      { status: 400 }
    );
  }

  // Only allow updating drafts
  try {
    const existing = await getBriefById(params.id);
    if (!existing) {
      return NextResponse.json({ error: "Přehled nebyl nalezen." }, { status: 404 });
    }
    if (existing.publish_state !== "draft") {
      return NextResponse.json(
        { error: "Publikovaný přehled nelze upravovat tímto způsobem. Vytvořte novou verzi." },
        { status: 409 }
      );
    }

    const updated = await updateBriefContent(params.id, content_sections);
    return NextResponse.json(updated);
  } catch (err) {
    console.error(`[api/admin/briefs/${params.id}] PUT error:`, err);
    return NextResponse.json(
      { error: "Uložení se nezdařilo. Zkuste to prosím znovu." },
      { status: 500 }
    );
  }
}
