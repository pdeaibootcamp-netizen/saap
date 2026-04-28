/**
 * pulz-analyses.ts — Read API for the Pulz oboru rendering layer
 *
 * Lane: brief only. Reads pulz_analyses + pulz_analysis_charts +
 * pulz_analysis_actions via the service-role REST connection (same pattern
 * as briefs.ts — TCP 5432/6543 blocked in the dev network).
 *
 * Privacy invariant: this module never queries user_db, cohort_companies,
 * consent_events, owner_metrics, or any user_contributed / rm_visible /
 * credit_risk table. All reads are from brief-lane tables only.
 *
 * See docs/data/analyses-schema.md §6 for the full API contract spec.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { signChartUrl, signPdfUrl } from "./pulz-storage";

// ── Supabase REST client ──────────────────────────────────────────────────────

let _client: SupabaseClient | null = null;

function db(): SupabaseClient {
  if (_client) return _client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "[pulz-analyses] NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY must be set"
    );
  }
  _client = createClient(url, key, { auth: { persistSession: false } });
  return _client;
}

// ── View types (what the rendering layer receives) ────────────────────────────

export interface PulzChartView {
  slotIndex: 1 | 2 | 3;
  verdict: string;
  /** 1-hour signed URL for the chart image. */
  imageUrl: string;
  altText: string;
  caption: string | null;
  usesCsInternalData: boolean;
}

export interface PulzActionView {
  slotIndex: 1 | 2 | 3;
  actionText: string;
  timeHorizon: "Okamžitě" | "Do 3 měsíců" | "Do 12 měsíců" | "Více než rok";
}

export interface PulzAnalysisView {
  id: string;
  naceDivision: string;
  naceLabelCzech: string;
  publicationPeriod: string;
  /** ISO 8601 string. The rendering layer formats Czech month names from this. */
  publishedAt: string;
  summaryText: string;
  /** 1-hour signed URL; null when no PDF is attached. */
  pdfUrl: string | null;
  pdfSourceLabel: string | null;
  /** Exactly 3 chart views, ordered by slot_index. */
  charts: [PulzChartView, PulzChartView, PulzChartView];
  /** 1–3 action views, ordered by slot_index. */
  actions: PulzActionView[];
}

// ── Raw DB row shapes ─────────────────────────────────────────────────────────

interface RawAnalysis {
  id: string;
  nace_division: string;
  nace_label_czech: string;
  publication_period: string;
  published_at: string;
  summary_text: string;
  pdf_storage_path: string | null;
  pdf_source_label: string | null;
}

interface RawChart {
  slot_index: number;
  verdict: string;
  image_storage_path: string;
  alt_text: string;
  caption: string | null;
  uses_cs_internal_data: boolean;
}

interface RawAction {
  slot_index: number;
  action_text: string;
  time_horizon: string;
}

// ── Main read function ────────────────────────────────────────────────────────

/**
 * Fetch the current Pulz oboru analysis for a NACE division.
 *
 * Performs three REST reads (analysis header + charts + actions) and mints
 * 1-hour signed URLs for all binary assets at fetch time.
 *
 * Returns null when no current (is_current = true) analysis exists for the
 * NACE — the rendering layer interprets null as the EmptyStateCard.
 *
 * Throws on transport / DB / Storage error — the rendering layer catches and
 * renders the ErrorCard.
 *
 * @param naceDivision  2-digit NACE division code, e.g. "31" or "49".
 */
export async function getCurrentPulzAnalysisForNace(
  naceDivision: string
): Promise<PulzAnalysisView | null> {
  // ── 1. Fetch the current analysis header ──────────────────────────────────
  const { data: analysisRows, error: analysisError } = await db()
    .from("pulz_analyses")
    .select(
      "id, nace_division, nace_label_czech, publication_period, published_at, " +
        "summary_text, pdf_storage_path, pdf_source_label"
    )
    .eq("nace_division", naceDivision)
    .eq("is_current", true)
    .eq("status", "published")
    .limit(1);

  if (analysisError) {
    throw new Error(
      `[pulz-analyses] getCurrentPulzAnalysisForNace: ${analysisError.message}`
    );
  }

  if (!analysisRows || analysisRows.length === 0) {
    return null; // EmptyStateCard path
  }

  const analysis = analysisRows[0] as RawAnalysis;

  // ── 2. Fetch charts + actions in parallel ─────────────────────────────────
  const [chartsResult, actionsResult] = await Promise.all([
    db()
      .from("pulz_analysis_charts")
      .select(
        "slot_index, verdict, image_storage_path, alt_text, caption, uses_cs_internal_data"
      )
      .eq("analysis_id", analysis.id)
      .order("slot_index", { ascending: true }),

    db()
      .from("pulz_analysis_actions")
      .select("slot_index, action_text, time_horizon")
      .eq("analysis_id", analysis.id)
      .order("slot_index", { ascending: true }),
  ]);

  if (chartsResult.error) {
    throw new Error(
      `[pulz-analyses] getCurrentPulzAnalysisForNace (charts): ${chartsResult.error.message}`
    );
  }

  if (actionsResult.error) {
    throw new Error(
      `[pulz-analyses] getCurrentPulzAnalysisForNace (actions): ${actionsResult.error.message}`
    );
  }

  const rawCharts = (chartsResult.data ?? []) as RawChart[];
  const rawActions = (actionsResult.data ?? []) as RawAction[];

  // ── 3. Mint signed URLs for chart images ──────────────────────────────────
  const chartViews = await Promise.all(
    rawCharts.map(async (c): Promise<PulzChartView> => {
      const imageUrl = await signChartUrl(c.image_storage_path);
      return {
        slotIndex: c.slot_index as 1 | 2 | 3,
        verdict: c.verdict,
        imageUrl,
        altText: c.alt_text,
        caption: c.caption,
        usesCsInternalData: c.uses_cs_internal_data,
      };
    })
  );

  // Sort by slot_index (DB returns them ordered but be explicit)
  chartViews.sort((a, b) => a.slotIndex - b.slotIndex);

  if (chartViews.length !== 3) {
    // Publish-invariant violated — treat as error so the ErrorCard renders
    // rather than silently producing a broken tile row.
    throw new Error(
      `[pulz-analyses] getCurrentPulzAnalysisForNace: expected 3 charts, got ${chartViews.length} for analysis ${analysis.id}`
    );
  }

  // ── 4. Mint signed URL for PDF (if present) ───────────────────────────────
  let pdfUrl: string | null = null;
  if (analysis.pdf_storage_path) {
    pdfUrl = await signPdfUrl(analysis.pdf_storage_path);
  }

  // ── 5. Map actions ────────────────────────────────────────────────────────
  const actionViews: PulzActionView[] = rawActions.map((a) => ({
    slotIndex: a.slot_index as 1 | 2 | 3,
    actionText: a.action_text,
    timeHorizon: a.time_horizon as PulzActionView["timeHorizon"],
  }));

  return {
    id: analysis.id,
    naceDivision: analysis.nace_division,
    naceLabelCzech: analysis.nace_label_czech,
    publicationPeriod: analysis.publication_period,
    publishedAt: analysis.published_at,
    summaryText: analysis.summary_text,
    pdfUrl,
    pdfSourceLabel: analysis.pdf_source_label,
    charts: chartViews as [PulzChartView, PulzChartView, PulzChartView],
    actions: actionViews,
  };
}

// ── Admin helpers (used by the upload API) ────────────────────────────────────

/**
 * Fetch a single analysis by ID (any status, any is_current value).
 * Used by the admin edit page and the PUT/DELETE handlers.
 * Returns null if not found.
 */
export async function getPulzAnalysisById(id: string): Promise<{
  id: string;
  nace_division: string;
  nace_label_czech: string;
  publication_period: string;
  published_at: string;
  is_current: boolean;
  status: string;
  summary_text: string;
  pdf_storage_path: string | null;
  pdf_source_label: string | null;
  created_by: string;
  created_at: string;
} | null> {
  const { data, error } = await db()
    .from("pulz_analyses")
    .select(
      "id, nace_division, nace_label_czech, publication_period, published_at, " +
        "is_current, status, summary_text, pdf_storage_path, pdf_source_label, " +
        "created_by, created_at"
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`[pulz-analyses] getPulzAnalysisById: ${error.message}`);
  }

  return data ?? null;
}

/**
 * List all pulz_analyses rows (all NACEs, all statuses), most recent first.
 * Used by the admin list page.
 */
export async function listPulzAnalyses(): Promise<
  Array<{
    id: string;
    nace_division: string;
    nace_label_czech: string;
    publication_period: string;
    published_at: string;
    is_current: boolean;
    status: string;
    created_at: string;
  }>
> {
  const { data, error } = await db()
    .from("pulz_analyses")
    .select(
      "id, nace_division, nace_label_czech, publication_period, published_at, " +
        "is_current, status, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    throw new Error(`[pulz-analyses] listPulzAnalyses: ${error.message}`);
  }

  return (data ?? []) as ReturnType<typeof listPulzAnalyses> extends Promise<infer T> ? T : never;
}

/**
 * Check whether a published row for (nace_division, publication_period) already exists.
 * Used by the publish endpoint to detect 409 conflicts.
 * Returns the conflicting row ID if found, null otherwise.
 */
export async function findPublishedConflict(params: {
  naceDivision: string;
  publicationPeriod: string;
  excludeId?: string; // exclude the row being updated (edit flow)
}): Promise<string | null> {
  let query = db()
    .from("pulz_analyses")
    .select("id")
    .eq("nace_division", params.naceDivision)
    .eq("publication_period", params.publicationPeriod)
    .eq("status", "published")
    .eq("is_current", true)
    .limit(1);

  if (params.excludeId) {
    query = query.neq("id", params.excludeId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`[pulz-analyses] findPublishedConflict: ${error.message}`);
  }

  return (data ?? [])[0]?.id ?? null;
}
