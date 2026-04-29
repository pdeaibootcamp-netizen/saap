/**
 * PATCH /api/owner/metrics/[metric_id]
 *
 * Body: { raw_value: number }
 *
 * Validates metric_id against the frozen 8 (D-024) → 404 if unknown.
 * Validates raw_value against PM plausibility bounds (METRIC_BOUNDS) → 422 + Czech error.
 * Upserts to owner_metrics (user_contributed lane) with last-write-wins semantics.
 *
 * Returns 200 with the updated MetricSnapshot row, or error JSON.
 *
 * owner-metrics-api.md §2 / §4 / §5
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import {
  OWNER_METRIC_ID,
  METRIC_BOUNDS,
  type OwnerMetricId,
} from "@/types/data-lanes";
import { DEMO_OWNER_USER_ID } from "@/lib/demo-owner";
import { formatDisplay } from "@/lib/owner-metrics";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Parse and normalise a raw_value from the request body.
 *  Handles Czech decimal comma → period, strips thousands separators.
 *  Returns NaN if the result is not a finite number.
 */
function parseRawValue(val: unknown): number {
  if (typeof val === "number") return val;
  if (typeof val === "string") {
    // Strip thousands separators (space, non-breaking space, thin space)
    const stripped = val.replace(/[\s  ]/g, "").replace(",", ".");
    return parseFloat(stripped);
  }
  return NaN;
}

/** Validate a numeric value against METRIC_BOUNDS for the given metricId.
 *  Returns null on success, Czech error string on failure.
 */
function validateBounds(metricId: OwnerMetricId, value: number): string | null {
  if (!isFinite(value)) {
    return "Uveďte prosím číselnou hodnotu.";
  }
  const bounds = METRIC_BOUNDS[metricId];
  if (value < bounds.min || value > bounds.max) {
    return bounds.errorCopy;
  }
  return null;
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: { metric_id: string } }
): Promise<NextResponse> {
  const { metric_id } = params;

  // Validate metric_id is in the frozen D-024 set
  const validMetricIds = Object.values(OWNER_METRIC_ID) as string[];
  if (!validMetricIds.includes(metric_id)) {
    return NextResponse.json(
      { error: "Metrika nenalezena." },
      { status: 404 }
    );
  }

  const metricId = metric_id as OwnerMetricId;

  // Parse body
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Uveďte prosím číselnou hodnotu." },
      { status: 422 }
    );
  }

  const parsedValue = parseRawValue(body.raw_value);

  // Non-numeric guard
  if (!isFinite(parsedValue)) {
    return NextResponse.json(
      { error: "Uveďte prosím číselnou hodnotu." },
      { status: 422 }
    );
  }

  // Plausibility bounds
  const boundsError = validateBounds(metricId, parsedValue);
  if (boundsError) {
    return NextResponse.json({ error: boundsError }, { status: 422 });
  }

  // Resolve user identity from cookie
  const cookieStore = cookies();
  const userId = cookieStore.get("sr_user_id")?.value ?? DEMO_OWNER_USER_ID;

  // DB write
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json(
      { error: "Hodnotu se nepodařilo uložit. Zkuste to prosím znovu." },
      { status: 503 }
    );
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  // Resolve the latest active consent event for this user.
  // The API MUST NOT mint a consent event if none exists (owner-metrics-api.md §4).
  const { data: consentRow, error: consentError } = await supabase
    .from("consent_events")
    .select("consent_event_id")
    .eq("user_id", userId)
    .eq("event_type", "grant")
    .order("ts", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (consentError || !consentRow) {
    return NextResponse.json(
      { error: "Souhlas nebyl zaznamenán." },
      { status: 409 }
    );
  }

  const consentEventId = consentRow.consent_event_id;
  const displayValue = formatDisplay(metricId, parsedValue);

  // Upsert — last-write-wins (owner-metrics-schema.md §5.3)
  const { error: upsertError } = await supabase
    .from("owner_metrics")
    .upsert(
      {
        user_id: userId,
        metric_id: metricId,
        raw_value: parsedValue,
        raw_value_display: displayValue,
        source: "user_entered",
        consent_event_id: consentEventId,
        data_lane: "user_contributed",
        captured_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "user_id,metric_id",
        ignoreDuplicates: false,
      }
    );

  if (upsertError) {
    console.error("[PATCH owner/metrics] upsert error:", upsertError.message);
    return NextResponse.json(
      { error: "Hodnotu se nepodařilo uložit. Zkuste to prosím znovu." },
      { status: 500 }
    );
  }

  // Return updated snapshot
  return NextResponse.json({
    metric_id: metricId,
    raw_value: parsedValue,
    raw_value_display: displayValue,
    confidence_state: "below-floor", // will resolve on page reload via getOwnerMetrics
    percentile: null,
    quartile_label: null,
    source: "user_entered",
  });
}
