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

  // Look up the firm in cohort_companies — fetch all the fields we need to
  // populate the demo owner snapshot for this firm.
  let naceDivision = "49";
  let firmFound = true;
  let firmRow: {
    nace_division: string;
    size_band: string | null;
    cz_region: string | null;
    revenue_per_employee: number | null;
    net_margin: number | null;
    name: string | null;
  } | null = null;

  try {
    // `name` was added in migration 0009; tolerate its absence in older DBs
    // by retrying without it on a "column does not exist" error.
    let queryRes = await supabase
      .from("cohort_companies")
      .select("ico, nace_division, size_band, cz_region, revenue_per_employee, net_margin, name")
      .eq("ico", ico)
      .maybeSingle();
    if (
      queryRes.error &&
      (queryRes.error.code === "42703" ||
        queryRes.error.message?.includes("column") ||
        queryRes.error.message?.includes("does not exist"))
    ) {
      queryRes = await supabase
        .from("cohort_companies")
        .select("ico, nace_division, size_band, cz_region, revenue_per_employee, net_margin")
        .eq("ico", ico)
        .maybeSingle();
    }
    const { data, error } = queryRes;

    if (error) {
      if (
        error.message?.includes("does not exist") ||
        error.code === "42P01" ||
        error.message?.includes("relation")
      ) {
        // cohort_companies table doesn't exist yet — accept the IčO and skip the snapshot rewrite.
        firmFound = true;
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
      firmRow = {
        nace_division: data.nace_division ?? "49",
        size_band: data.size_band ?? null,
        cz_region: data.cz_region ?? null,
        revenue_per_employee: data.revenue_per_employee ?? null,
        net_margin: data.net_margin ?? null,
        name: ("name" in data ? (data.name as string | null) : null) ?? null,
      };
      naceDivision = firmRow.nace_division;
    }
  } catch (err) {
    console.error("[demo/switch] unexpected error:", err);
    firmFound = true;
  }

  if (!firmFound) {
    return NextResponse.json(
      { error: "Tuto firmu v datech nemáme. Zkuste prosím jiné IČO." },
      { status: 404 }
    );
  }

  // Replace the demo owner's owner_metrics snapshot with this firm's data.
  // The cohort_companies row may have revenue_per_employee and net_margin
  // already computed at ingest time; the other 6 metrics (gross_margin,
  // ebitda_margin, labor_cost_ratio, working_capital_cycle, revenue_growth,
  // pricing_power) are not in the source Excel and stay null — driving the
  // "ask" state for those tiles. The user can fill them in via the in-tile form.
  //
  // Strategy: DELETE existing rows for this user, INSERT 8 fresh ones. This
  // means switching IčO discards any user-entered values from the previous
  // firm — which is the right behaviour for a moderator demo.
  try {
    const { data: consentRow } = await supabase
      .from("consent_events")
      .select("consent_event_id")
      .eq("user_id", DEMO_OWNER_USER_ID)
      .eq("event_type", "grant")
      .order("ts", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (consentRow) {
      // Wipe existing rows
      await supabase
        .from("owner_metrics")
        .delete()
        .eq("user_id", DEMO_OWNER_USER_ID);

      // Build the 8-row payload from the firm's data + nulls for non-derivable metrics.
      const formatPercent = (n: number) =>
        new Intl.NumberFormat("cs-CZ", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(n) + " %";
      const formatThousandsCzk = (n: number) =>
        new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 0 }).format(Math.round(n)) + " tis. Kč";

      const rev_per_emp = firmRow?.revenue_per_employee != null
        ? Number(firmRow.revenue_per_employee)
        : null;
      const net_margin = firmRow?.net_margin != null
        ? Number(firmRow.net_margin)
        : null;

      const rows = [
        { metric_id: "gross_margin",          raw_value: null, raw_value_display: null },
        { metric_id: "ebitda_margin",         raw_value: null, raw_value_display: null },
        { metric_id: "net_margin",
          raw_value: net_margin,
          raw_value_display: net_margin !== null ? formatPercent(net_margin) : null },
        { metric_id: "labor_cost_ratio",      raw_value: null, raw_value_display: null },
        { metric_id: "revenue_per_employee",
          // cohort_companies.revenue_per_employee is in CZK per FTE; the metric is in CZK,
          // we display in thousands for legibility.
          raw_value: rev_per_emp,
          raw_value_display: rev_per_emp !== null ? formatThousandsCzk(rev_per_emp) : null },
        { metric_id: "working_capital_cycle", raw_value: null, raw_value_display: null },
        { metric_id: "revenue_growth",        raw_value: null, raw_value_display: null },
        { metric_id: "pricing_power",         raw_value: null, raw_value_display: null },
      ];

      const insertPayload = rows.map((r) => ({
        user_id: DEMO_OWNER_USER_ID,
        metric_id: r.metric_id,
        raw_value: r.raw_value,
        raw_value_display: r.raw_value_display,
        source: r.raw_value !== null ? "prepopulated_excel" : "demo_seed",
        consent_event_id: consentRow.consent_event_id,
        data_lane: "user_contributed",
      }));

      const { error: insertErr } = await supabase
        .from("owner_metrics")
        .insert(insertPayload);
      if (insertErr) {
        console.error("[demo/switch] owner_metrics insert error:", insertErr.message);
      }
    }
  } catch (err) {
    // Non-fatal: snapshot rewrite failure doesn't block the switch
    console.error("[demo/switch] snapshot rewrite error (non-fatal):", err);
  }

  // Set the sr_active_ico cookie. Also set sr_active_size and sr_active_region
  // so the dashboard can read the firm's cohort cell without a second DB lookup.
  const sizeBand = firmRow?.size_band ?? "";
  const region = firmRow?.cz_region ?? "";
  const name = firmRow?.name ?? "";
  const response = NextResponse.json({ ico, naceDivision, sizeBand, region, name });
  const cookieOpts = {
    path: "/",
    sameSite: "lax" as const,
    httpOnly: false,
    maxAge: 60 * 60 * 24 * 7,
  };
  response.cookies.set(DEMO_ACTIVE_ICO_COOKIE, ico, cookieOpts);
  response.cookies.set("sr_active_size", sizeBand, cookieOpts);
  response.cookies.set("sr_active_region", region, cookieOpts);
  response.cookies.set("sr_active_nace", naceDivision, cookieOpts);
  // Encode the firm name so non-ASCII chars survive cookie transport.
  response.cookies.set("sr_active_name", encodeURIComponent(name), cookieOpts);

  return response;
}
