/**
 * POST /api/consent/revoke
 *
 * Records a consent revocation for the authenticated user.
 * D-012 Option A: appends a 'revoke' consent event — no row deletion.
 *
 * Authentication:
 *   - Reads the sr_user_id cookie set by /onboarding or /consent flows.
 *   - Falls back to George JWT in Authorization header (Bearer <token>).
 *   - OQ-050: direct sign-up path still stubbed.
 *
 * On success: returns { ok: true }
 * On error:   returns { error: "<message>" } with appropriate HTTP status
 *
 * Called by: src/app/settings/soukromi/page.tsx client action.
 */

import { NextRequest, NextResponse } from "next/server";
import { revokeConsent, getCurrentConsent } from "@/lib/consent";
import { verifyGeorgeToken } from "@/lib/auth";
import { cookies } from "next/headers";

async function resolveUserId(req: NextRequest): Promise<string | null> {
  // 1. Check the sr_user_id cookie (set after onboarding/consent grant).
  const cookieStore = cookies();
  const userIdCookie = cookieStore.get("sr_user_id");
  if (userIdCookie?.value) {
    return userIdCookie.value;
  }

  // 2. Fall back to George JWT Bearer token.
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice(7);
    return verifyGeorgeToken(token);
  }

  // OQ-050: direct sign-up Supabase session not yet implemented.
  return null;
}

export async function POST(req: NextRequest) {
  const userId = await resolveUserId(req);

  if (!userId) {
    return NextResponse.json(
      { error: "Nepodařilo se ověřit vaši identitu. Přihlaste se prosím znovu." },
      { status: 401 }
    );
  }

  try {
    // Verify active consent exists before attempting revocation.
    const current = await getCurrentConsent(userId);
    if (!current || current.latest_event_type !== "grant") {
      return NextResponse.json(
        { error: "Žádný aktivní souhlas ke zrušení." },
        { status: 404 }
      );
    }

    await revokeConsent({
      user_id: userId,
      surface: "settings-soukromi",
      channel: "rm-referred-george-embed",
      ip_prefix: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim().slice(0, 15) ?? undefined,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/consent/revoke] Error:", err);
    return NextResponse.json(
      { error: "Odvolání souhlasu se nepodařilo. Zkuste to prosím znovu." },
      { status: 500 }
    );
  }
}
