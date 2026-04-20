/**
 * POST /api/admin/briefs/[id]/publish — Trigger the publish pipeline
 *
 * Validates the publish-gate checklist affirmation, then calls publishBrief().
 * Synchronous pipeline per ADR-0002-E.
 *
 * Body: { checklist_affirmed_by: string; checklist_version: string }
 *
 * Auth: requires sr_admin_session cookie (ADR-0001-D).
 */

import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { publishBrief } from "@/lib/publish";

function unauthorized() {
  return NextResponse.json({ error: "Neautorizováno." }, { status: 401 });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!isAdminAuthenticated()) return unauthorized();

  let body: { checklist_affirmed_by?: string; checklist_version?: string };
  try {
    body = (await req.json()) as {
      checklist_affirmed_by?: string;
      checklist_version?: string;
    };
  } catch {
    return NextResponse.json({ error: "Neplatný požadavek." }, { status: 400 });
  }

  const { checklist_affirmed_by, checklist_version } = body;
  if (!checklist_affirmed_by || !checklist_version) {
    return NextResponse.json(
      { error: "Potvrzení kontrolního seznamu je povinné." },
      { status: 400 }
    );
  }

  try {
    console.log(`[api/admin/briefs/${params.id}/publish] Starting publish pipeline`);
    const result = await publishBrief(params.id, {
      checklist_affirmed_by,
      checklist_version,
    });

    console.log(`[api/admin/briefs/${params.id}/publish] Complete:`, JSON.stringify(result));
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Publikování selhalo.";
    console.error(`[api/admin/briefs/${params.id}/publish] Error:`, err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
