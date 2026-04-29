/**
 * GET /api/owner/metrics
 *
 * Returns the composed owner snapshot: 8 metric rows, each with metric_id,
 * raw_value, percentile, quartile_label, confidence_state.
 *
 * Resolves the active demo owner from the sr_user_id cookie.
 * The active IČO (sr_active_ico) is read for potential future use in
 * NACE lookup; at v0.3, naceDivision defaults to "49" (NACE 49.41)
 * since cohort_companies lookup is a Track B concern.
 *
 * Privacy: reads from user_contributed lane only. Does not write to any other lane.
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

  // Read active IČO from cookie (set by POST /api/owner/demo/switch).
  // At v0.3, NACE division is always "49" (NACE 49.41 Silniční nákladní doprava).
  // When Track B ships cohort_companies, derive naceDivision from the firm row.
  const _activeIco = cookieStore.get(DEMO_ACTIVE_ICO_COOKIE)?.value ?? DEMO_DEFAULT_ICO;
  void _activeIco; // reserved for Track B NACE lookup

  const naceDivision = "49";

  const metrics = await getOwnerMetrics(userId, naceDivision);

  return NextResponse.json(metrics);
}
