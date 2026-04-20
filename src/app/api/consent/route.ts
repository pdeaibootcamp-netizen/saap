/**
 * POST /api/consent — Grant or revoke consent
 *
 * Body: { action: 'grant' | 'revoke'; token?: string }
 *
 * Grant: writes a consent_events row (user_contributed lane, via Supabase admin).
 * Returns { consent_event_id: string }.
 *
 * Revoke: writes a revoke event referencing the prior grant (D-012 stop-flow-only).
 * Returns { ok: true }.
 *
 * The token (George JWT) identifies the user. If absent, falls back to
 * Supabase session (OQ-050 stub).
 */

import { NextRequest, NextResponse } from "next/server";
import { grantConsent, revokeConsent, getCurrentConsent } from "@/lib/consent";
import { verifyGeorgeToken } from "@/lib/auth";

async function resolveUserIdFromRequest(req: NextRequest): Promise<string | null> {
  let body: { action?: string; token?: string };
  try {
    body = (await req.clone().json()) as { action?: string; token?: string };
  } catch {
    return null;
  }

  if (body.token) {
    return verifyGeorgeToken(body.token);
  }

  // OQ-050: direct sign-up path stub — return null for now
  return null;
}

export async function POST(req: NextRequest) {
  let body: { action?: string; token?: string };
  try {
    body = (await req.json()) as { action?: string; token?: string };
  } catch {
    return NextResponse.json({ error: "Neplatný požadavek." }, { status: 400 });
  }

  const { action, token } = body;

  if (!action || !["grant", "revoke"].includes(action)) {
    return NextResponse.json(
      { error: "Akce musí být 'grant' nebo 'revoke'." },
      { status: 400 }
    );
  }

  // Resolve user ID
  let userId: string | null = null;
  if (token) {
    userId = await verifyGeorgeToken(token);
  }
  if (!userId) {
    // Dev stub: accept a fixed user ID if no token (OQ-050)
    userId = "stub-user-direct-signup";
  }

  const ipPrefix =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim().slice(0, 15) ?? "0.0.0.0";

  // Derive channel from how the user arrived: George JWT present → George embed; otherwise direct.
  const channel = token ? "rm-referred-george-embed" : "direct-signup";

  try {
    if (action === "grant") {
      const consentEventId = await grantConsent({
        user_id: userId,
        surface: "onboarding-screen",
        channel,
        ip_prefix: ipPrefix,
      });
      return NextResponse.json({ ok: true, consent_event_id: consentEventId });
    }

    if (action === "revoke") {
      // Find the existing active consent
      const current = await getCurrentConsent(userId);
      if (!current || current.latest_event_type !== "grant") {
        return NextResponse.json(
          { error: "Žádný aktivní souhlas ke zrušení." },
          { status: 404 }
        );
      }

      await revokeConsent({
        user_id: userId,
        surface: "onboarding-screen",
        channel,
        ip_prefix: ipPrefix,
      });
      return NextResponse.json({ ok: true });
    }
  } catch (err) {
    console.error("[api/consent] Error:", err);
    return NextResponse.json(
      { error: "Nepodařilo se zaznamenat souhlas. Zkuste to prosím znovu." },
      { status: 500 }
    );
  }

  return NextResponse.json({ error: "Neplatná akce." }, { status: 400 });
}
