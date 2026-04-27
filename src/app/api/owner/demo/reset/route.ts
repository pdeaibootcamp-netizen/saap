/**
 * POST /api/owner/demo/reset  [DEMO_MODE=true only]
 *
 * Clears the sr_active_ico cookie and deletes all owner_metrics rows for
 * the active sr_user_id (DEMO_OWNER_USER_ID at v0.3). Used by moderators
 * to reset entered values between demo sessions.
 *
 * Returns 200 { deleted: number }.
 *
 * Gated by DEMO_MODE === 'true'. Returns 404 in production.
 *
 * ADR-OM-03 / owner-metrics-api.md §2
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import {
  DEMO_OWNER_USER_ID,
  DEMO_ACTIVE_ICO_COOKIE,
} from "@/lib/demo-owner";

const DEMO_MODE = process.env.DEMO_MODE === "true";

export async function POST(_request: NextRequest): Promise<NextResponse> {
  if (!DEMO_MODE) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const cookieStore = cookies();
  const userId = cookieStore.get("sr_user_id")?.value ?? DEMO_OWNER_USER_ID;

  let deleted = 0;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (supabaseUrl && serviceKey) {
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    const { data, error } = await supabase
      .from("owner_metrics")
      .delete()
      .eq("user_id", userId)
      .select("metric_id");

    if (error) {
      console.error("[demo/reset] delete error:", error.message);
      return NextResponse.json(
        { error: "Reset se nepodařil. Zkuste to prosím znovu." },
        { status: 500 }
      );
    }

    deleted = data?.length ?? 0;
  }

  // Clear the sr_active_ico cookie
  const response = NextResponse.json({ deleted });
  response.cookies.set(DEMO_ACTIVE_ICO_COOKIE, "", {
    path: "/",
    sameSite: "lax",
    httpOnly: false,
    maxAge: 0, // Expire immediately
  });

  return response;
}
