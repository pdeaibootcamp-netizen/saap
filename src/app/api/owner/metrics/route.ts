/**
 * GET /api/owner/metrics
 *
 * Returns the composed owner snapshot: 8 metric rows, each with metric_id,
 * raw_value, percentile, quartile_label, confidence_state.
 *
 * Resolves the active demo owner from the sr_user_id cookie.
 * Resolves the active firm from the sr_active_ico cookie for NACE lookup.
 *
 * Privacy: reads from user_contributed lane only (owner_metrics table via
 * service-role key in the lib). Does not write to any other lane.
 *
 * owner-metrics-api.md §2 / §5
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getOwnerMetrics } from "@/lib/owner-metrics";
import { DEMO_OWNER_USER_ID, DEMO_ACTIVE_ICO_COOKIE, DEMO_DEFAULT_ICO } from "@/lib/demo-owner";

export async function GET(_request: NextRequest): Promise<NextResponse> {
  const cookieStore = cookies();
  const userId = cookieStore.get("sr_user_id")?.value ?? DEMO_OWNER_USER_ID;
  const activeIco = cookieStore.get(DEMO_ACTIVE_ICO_COOKIE)?.value ?? DEMO_DEFAULT_ICO;

  // Derive NACE division from cohort_companies if Track B has shipped;
  // otherwise default to "49" (NACE 49.41 — the v0.3 demo NACE).
  // Graceful: if cohort_companies lookup fails, "49" keeps tiles rendering.
  let naceDivision = "49";
  try {
    const cohortModule = await import("@/lib/cohort-data").catch(() => null);
    if (cohortModule && typeof cohortModule.getNaceDivisionByIco === "function") {
      const nace = await cohortModule.getNaceDivisionByIco(activeIco);
      if (nace) naceDivision = nace;
    }
  } catch {
    // Track B not shipped yet — use default
  }

  const metrics = await getOwnerMetrics(userId, naceDivision);

  return NextResponse.json(metrics);
}
