/**
 * POST /api/owner/demo/switch  [DEMO_MODE=true only]
 *
 * Body: { ico: string }
 *
 * Looks up the IČO in cohort_companies (Track B's table).
 * On success: sets the sr_active_ico cookie and returns 200 { ico, naceDivision }.
 * On IČO format error: 422 with Czech error.
 * On not found: 404 with Czech error.
 *
 * Degrades gracefully if cohort_companies does not exist yet (Track B not shipped):
 * returns 200 with the supplied IČO and naceDivision="49" (the demo NACE).
 *
 * Also seeds owner_metrics null rows for the new IČO if not already seeded,
 * so the dashboard shows 8 tiles in ask state on first switch.
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

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!DEMO_MODE) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "IČO má 8 číslic. Zkontrolujte prosím zadání." },
      { status: 422 }
    );
  }

  const ico = String(body.ico ?? "").trim();

  // IČO format validation: exactly 8 digits
  if (!/^\d{8}$/.test(ico)) {
    return NextResponse.json(
      { error: "IČO má 8 číslic. Zkontrolujte prosím zadání." },
      { status: 422 }
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Graceful degradation: if DB is not configured, accept any 8-digit IČO
  // with NACE 49 as the default. This lets demo sessions proceed even without DB.
  if (!supabaseUrl || !serviceKey) {
    const cookieStore = cookies();
    const response = NextResponse.json({ ico, naceDivision: "49" });
    response.cookies.set(DEMO_ACTIVE_ICO_COOKIE, ico, {
      path: "/",
      sameSite: "lax",
      httpOnly: false,
      maxAge: 60 * 60 * 24 * 7,
    });
    void cookieStore;
    return response;
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  // Look up the firm in cohort_companies (Track B's table).
  // If the table doesn't exist yet, degrade gracefully with NACE "49".
  let naceDivision = "49";
  let firmFound = true;

  try {
    const { data, error } = await supabase
      .from("cohort_companies")
      .select("ico, nace_division")
      .eq("ico", ico)
      .maybeSingle();

    if (error) {
      // Table might not exist yet (Track B not shipped) — degrade gracefully
      if (
        error.message?.includes("does not exist") ||
        error.code === "42P01" ||
        error.message?.includes("relation")
      ) {
        // cohort_companies table doesn't exist; accept any valid IČO format
        firmFound = true;
        naceDivision = "49";
      } else {
        console.error("[demo/switch] cohort_companies lookup error:", error.message);
        return NextResponse.json(
          { error: "Přepnutí se nezdařilo. Zkuste to prosím znovu." },
          { status: 500 }
        );
      }
    } else if (!data) {
      firmFound = false;
    } else {
      naceDivision = data.nace_division ?? "49";
    }
  } catch (err) {
    console.error("[demo/switch] unexpected error:", err);
    // Degrade gracefully
    firmFound = true;
    naceDivision = "49";
  }

  if (!firmFound) {
    return NextResponse.json(
      { error: "Tuto firmu v datech nemáme. Zkuste prosím jiné IČO." },
      { status: 404 }
    );
  }

  // Seed owner_metrics null rows for this new IČO's user_id.
  // The demo user_id is always DEMO_OWNER_USER_ID (ADR-OM-02).
  // Null seeding: we insert rows with raw_value = NULL so the dashboard
  // renders "ask" state tiles on first load after switching.
  // We do NOT overwrite existing rows that have values (source=user_entered).
  try {
    // Resolve active consent event
    const { data: consentRow } = await supabase
      .from("consent_events")
      .select("consent_event_id")
      .eq("user_id", DEMO_OWNER_USER_ID)
      .eq("event_type", "grant")
      .order("ts", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (consentRow) {
      const FROZEN_METRIC_IDS = [
        "gross_margin", "ebitda_margin", "net_margin", "labor_cost_ratio",
        "revenue_per_employee", "working_capital_cycle", "revenue_growth", "pricing_power",
      ];

      for (const metricId of FROZEN_METRIC_IDS) {
        // Only insert if no row exists — don't overwrite user_entered values.
        const { data: existing } = await supabase
          .from("owner_metrics")
          .select("metric_id")
          .eq("user_id", DEMO_OWNER_USER_ID)
          .eq("metric_id", metricId)
          .maybeSingle();

        if (!existing) {
          await supabase.from("owner_metrics").insert({
            user_id: DEMO_OWNER_USER_ID,
            metric_id: metricId,
            raw_value: null,
            raw_value_display: null,
            source: "demo_seed",
            consent_event_id: consentRow.consent_event_id,
            data_lane: "user_contributed",
          });
        }
      }
    }
  } catch (err) {
    // Non-fatal: seeding failure doesn't block the switch
    console.error("[demo/switch] null-seed error (non-fatal):", err);
  }

  // Set the sr_active_ico cookie
  const response = NextResponse.json({ ico, naceDivision });
  response.cookies.set(DEMO_ACTIVE_ICO_COOKIE, ico, {
    path: "/",
    sameSite: "lax",
    httpOnly: false,
    maxAge: 60 * 60 * 24 * 7, // 7 days — covers a full demo session
  });

  return response;
}
