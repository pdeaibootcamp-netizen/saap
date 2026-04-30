/**
 * briefs.ts — Typed CRUD for the brief lane
 *
 * Covers: briefs table + brief_deliveries table.
 * Lane: brief (ADR-0002-C). Uses sql from db.ts (brief_lane_role).
 *
 * Privacy invariant: this module never queries sector_profiles or
 * consent_events via the brief lane connection. Consent status is
 * checked via a read-only SELECT on consent_events (permitted by RLS).
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { PublishState, DeliveryFormat } from "../types/data-lanes";

// ─── Supabase REST client ────────────────────────────────────────────────────
// Replaces the postgres TCP library because the developer's network blocks
// outbound 5432/6543 to the Supabase pooler. Same constraint we worked around
// in scripts/ingest-industry-data.ts and app/api/admin/briefs/from-n8n/route.ts.
// Service role key bypasses RLS, which is fine because all callers here are
// either admin-authenticated routes or the server-rendered owner dashboard
// running under the demo-owner bypass (lane separation enforced at the route
// boundary, not at the connection level).

let _client: SupabaseClient | null = null;
function db(): SupabaseClient {
  if (_client) return _client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("[briefs] NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY must be set");
  }
  _client = createClient(url, key, { auth: { persistSession: false } });
  return _client;
}

const BRIEF_COLUMNS =
  "id, nace_sector, nace_sectors, primary_nace, publish_state, version, author_id, created_at, published_at, content_sections, benchmark_snippet";

const DELIVERY_COLUMNS =
  "id, brief_id, brief_version, recipient_id, format, delivered_at";


// ─── Types ───────────────────────────────────────────────────────────────────

export interface Brief {
  id: string;
  /**
   * Legacy single-NACE field. Always equals `nace_sectors[0]`. Kept for
   * backward compatibility with v0.1/v0.2 callers; new code should use
   * `nace_sectors` for filter / display logic. (Migration 0011.)
   */
  nace_sector: string;
  /**
   * v0.3+ multi-NACE field. Full list of NACE divisions this brief covers.
   * The customer-facing dashboard filter is `WHERE active_firm_nace = ANY(nace_sectors)`.
   * For v0.1/v0.2 briefs this is `[nace_sector]`. (Migration 0011, Model B.)
   */
  nace_sectors: string[];
  /**
   * v0.4+ primary-NACE tag. The NACE division the publication is primarily
   * ABOUT (chosen by the analyst at upload time). Used by the dashboard's
   * Pulz oboru section to surface only the brief whose primary topic matches
   * the active firm's NACE — cross-relevance briefs (in nace_sectors but not
   * primary) still appear in the Section (v) Analýzy list. Nullable for
   * legacy v0.1/v0.2/v0.3 briefs that pre-date the column. (Migration 0014.)
   */
  primary_nace: string | null;
  publish_state: PublishState;
  version: number;
  author_id: string;
  created_at: string;
  published_at: string | null;
  content_sections: ContentSection[];
  benchmark_snippet: BenchmarkSnippet | null;
}

export interface ContentSection {
  section_id: string;
  heading: string;
  body: string;
  order: number;
}

export interface Observation {
  headline: string;
  body: string;
  time_horizon: string; // one of the TIME_HORIZON values
  is_email_teaser: boolean;
}

export interface ClosingAction {
  action_text: string;
  time_horizon: string;
  category: string; // one of the four D-011 category IDs
  /**
   * Optional index into BriefContent.observations. When set, the action is
   * rendered immediately after the observation it refers to (paired layout).
   * When null/undefined, the action is an orphan and renders under
   * "Další doporučené kroky". Additive to v0.1 — v0.1 briefs without this
   * field treat all actions as orphans (v0.1 flat-list fallback).
   * Introduced in v0.2 per D-020.
   */
  paired_observation_index?: number | null;
}

export interface BenchmarkMetric {
  metric_id: string;
  metric_label: string;
  quartile_label: string | null;
  percentile: number | null;
  verdict_text: string | null;
  confidence_state: "valid" | "below-floor" | "empty";
  rung_footnote: string | null;
  is_email_teaser_snippet: boolean;
}

export interface BenchmarkCategory {
  category_id: string;
  category_label: string;
  metrics: BenchmarkMetric[];
}

export interface BenchmarkSnippet {
  cohort_id: string;
  resolved_at: string;
  categories: BenchmarkCategory[];
}

/**
 * Sector publication block added in v0.2 (D-020).
 * Optional — v0.1 briefs without this field render without the
 * "Sektorová analýza" block and still load without error.
 * opener_markdown: always-visible layperson opener (200–400 words).
 * full_text_markdown: full ČS publication body, collapsed by default.
 * Source: brief-page-v0-2.md §5.2 / §6.4.
 *
 * Rendering note (v0.2): both fields are split on double-newline and
 * rendered as <p> blocks. No markdown library is imported at v0.2 (plain-text
 * paragraph rendering is sufficient for the PoC). Upgrade to remark/rehype
 * for v0.3 when table + list rendering in the full analyst text is needed.
 */
export interface BriefPublication {
  heading: string;              // e.g. "Sektorová analýza"
  opener_markdown: string;      // layperson opener — always visible
  full_text_markdown: string;   // full ČS publication — collapsed
  source: string;               // attribution line
}

/**
 * Per-NACE insights + actions bundle (v0.3, D-029, Model B).
 * One entry per NACE division this brief covers. The brief page renders
 * `per_nace_content[active_firm_nace]` for the customer; the analyst edit
 * page (v0.4) will render all entries side-by-side.
 */
export interface PerNaceContent {
  observations: Observation[];
  closing_actions: ClosingAction[];
}

/** Structured content model stored in content_sections */
export interface BriefContent {
  title: string;
  publication_month: string; // e.g. "Duben 2026"
  opening_summary: string;
  /**
   * Optional sector publication block (v0.2, D-020). When absent the
   * Sektorová analýza block is silently omitted; the page opens with
   * opening_summary (if present) then the observations/actions section.
   */
  publication?: BriefPublication;
  /**
   * Top-level observations array (v0.1/v0.2 single-NACE briefs).
   * For v0.3+ multi-NACE briefs (D-029), this is set to the FIRST NACE's
   * observations as a backward-compat fallback; the per-NACE map is the
   * authoritative source.
   */
  observations: Observation[];
  /**
   * Top-level closing actions (v0.1/v0.2 single-NACE briefs).
   * Same v0.3+ fallback semantics as `observations`.
   */
  closing_actions: ClosingAction[];
  /**
   * v0.3+ multi-NACE content map (D-029, Model B). When present and the
   * customer's active NACE is a key, the brief page renders these instead
   * of the top-level `observations`/`closing_actions` arrays. Absent on
   * v0.1/v0.2 briefs.
   */
  per_nace_content?: Record<string, PerNaceContent>;
  benchmark_categories: BenchmarkCategory[];
  pdf_footer_text: string; // For the Zápatí section
  email_teaser_observation_index: number; // index into observations array
}

export interface BriefDelivery {
  id: string;
  brief_id: string;
  brief_version: number;
  recipient_id: string;
  format: DeliveryFormat;
  delivered_at: string;
}

// ─── Brief CRUD ──────────────────────────────────────────────────────────────

/** List all briefs, most recent first. Analyst dashboard. */
export async function listBriefs(): Promise<Brief[]> {
  const { data, error } = await db()
    .from("briefs")
    .select(BRIEF_COLUMNS)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`[briefs] listBriefs: ${error.message}`);
  return (data ?? []) as unknown as Brief[];
}

/** Get a single brief by ID. Returns null if not found. */
export async function getBriefById(id: string): Promise<Brief | null> {
  const { data, error } = await db()
    .from("briefs")
    .select(BRIEF_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`[briefs] getBriefById: ${error.message}`);
  return (data ?? null) as unknown as Brief | null;
}

/** Get the most recently published brief for a given NACE sector. */
export async function getPublishedBriefByNace(naceSector: string): Promise<Brief | null> {
  const { data, error } = await db()
    .from("briefs")
    .select(BRIEF_COLUMNS)
    .contains("nace_sectors", [naceSector])
    .eq("publish_state", "published")
    .order("published_at", { ascending: false })
    .limit(1);
  if (error) throw new Error(`[briefs] getPublishedBriefByNace: ${error.message}`);
  return ((data ?? [])[0] ?? null) as unknown as Brief | null;
}

/**
 * List all published briefs for a given NACE sector, ordered most-recent first.
 * Lane: brief (ADR-0002-C). Capped at 20 results for safety.
 * Used by the v0.2 dashboard briefs list (dashboard-v0-2.md §7).
 *
 * v0.3 (D-029, Model B): filters on `nace_sectors @> ARRAY[naceSector]` so
 * multi-NACE briefs surface for any covered NACE. v0.1/v0.2 single-NACE briefs
 * still match because migration 0011 backfilled `nace_sectors` from
 * `nace_sector` for those rows.
 */
export async function listPublishedBriefsByNace(naceSector: string): Promise<Brief[]> {
  // v0.4 (D-033): include general briefs (primary_nace IS NULL) regardless of
  // nace_sectors — they surface to every firm in the Analýzy list. NACE-tagged
  // briefs still filter by nace_sectors @> ARRAY[$1] (cross-relevance).
  const { data, error } = await db()
    .from("briefs")
    .select(BRIEF_COLUMNS)
    .or(`primary_nace.is.null,nace_sectors.cs.{${naceSector}}`)
    .eq("publish_state", "published")
    .order("published_at", { ascending: false })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(20);
  if (error) throw new Error(`[briefs] listPublishedBriefsByNace: ${error.message}`);
  return (data ?? []) as unknown as Brief[];
}

/**
 * Latest published brief whose primary_nace == naceSector (v0.4, migration 0014).
 * Powers the dashboard's Pulz oboru section so cross-relevance briefs (in
 * nace_sectors[] but not primary) don't surface as the firm's "main brief."
 *
 * Returns null when no brief has been published with this primary NACE yet.
 * The Section (v) Analýzy list keeps using listPublishedBriefsByNace so
 * cross-relevance briefs still appear there with their primary_nace label.
 */
export async function getLatestBriefByPrimaryNace(naceSector: string): Promise<Brief | null> {
  const { data, error } = await db()
    .from("briefs")
    .select(BRIEF_COLUMNS)
    .eq("primary_nace", naceSector)
    .eq("publish_state", "published")
    .order("published_at", { ascending: false })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(1);
  if (error) throw new Error(`[briefs] getLatestBriefByPrimaryNace: ${error.message}`);
  return ((data ?? [])[0] ?? null) as unknown as Brief | null;
}

/**
 * Create a new brief draft. Returns the new brief.
 *
 * v0.3 (D-029, Model B): also populates `nace_sectors` with `[nace_sector]`
 * so the legacy single-NACE manual-create path produces rows discoverable
 * via the new array-containment filter.
 */
export async function createDraftBrief(params: {
  nace_sector: string;
  author_id: string;
}): Promise<Brief> {
  const { data, error } = await db()
    .from("briefs")
    .insert({
      nace_sector: params.nace_sector,
      nace_sectors: [params.nace_sector],
      author_id: params.author_id,
      content_sections: [],
      publish_state: "draft",
    })
    .select(BRIEF_COLUMNS)
    .single();
  if (error || !data) throw new Error(`[briefs] createDraftBrief: ${error?.message ?? "no row"}`);
  return data as unknown as Brief;
}

/** Update a brief's content sections. Increments version. */
export async function updateBriefContent(
  id: string,
  content_sections: ContentSection[],
  benchmark_snapshot?: BenchmarkSnippet
): Promise<Brief> {
  // Read current version + benchmark_snippet (REST has no atomic increment / COALESCE)
  const { data: cur, error: curErr } = await db()
    .from("briefs")
    .select("version, benchmark_snippet")
    .eq("id", id)
    .maybeSingle();
  if (curErr) throw new Error(`[briefs] updateBriefContent (read): ${curErr.message}`);
  if (!cur) throw new Error(`Brief ${id} not found`);
  const update: Record<string, unknown> = {
    content_sections,
    version: (cur as { version: number }).version + 1,
  };
  if (benchmark_snapshot !== undefined) {
    update.benchmark_snippet = benchmark_snapshot;
  }
  const { data, error } = await db()
    .from("briefs")
    .update(update)
    .eq("id", id)
    .select(BRIEF_COLUMNS)
    .single();
  if (error || !data) throw new Error(`[briefs] updateBriefContent (write): ${error?.message ?? "no row"}`);
  return data as unknown as Brief;
}

/** Mark a brief as published. Sets published_at and publish_state. */
export async function publishBriefRecord(
  id: string,
  benchmarkSnapshot: BenchmarkSnippet,
  checklist_affirmed_by: string,
  checklist_version: string
): Promise<Brief> {
  // Append a publish-meta section to content_sections (REST has no || operator).
  const publishMetaSection: ContentSection = {
    section_id: "_publish_meta",
    heading: "_publish_meta",
    body: JSON.stringify({
      affirmed_by: checklist_affirmed_by,
      checklist_version,
      affirmed_at: new Date().toISOString(),
    }),
    order: 9999,
  };

  // Read current content_sections + version + state
  const { data: cur, error: curErr } = await db()
    .from("briefs")
    .select("version, publish_state, content_sections")
    .eq("id", id)
    .maybeSingle();
  if (curErr) throw new Error(`[briefs] publishBriefRecord (read): ${curErr.message}`);
  if (!cur) throw new Error(`Brief ${id} not found`);
  const curRow = cur as { version: number; publish_state: string; content_sections: ContentSection[] };
  if (curRow.publish_state !== "draft") {
    throw new Error(`Brief ${id} not found or already published`);
  }

  const newSections = [...(curRow.content_sections ?? []), publishMetaSection];

  const { data, error } = await db()
    .from("briefs")
    .update({
      publish_state: "published",
      published_at: new Date().toISOString(),
      benchmark_snippet: benchmarkSnapshot,
      version: curRow.version + 1,
      content_sections: newSections,
    })
    .eq("id", id)
    .eq("publish_state", "draft")
    .select(BRIEF_COLUMNS)
    .single();
  if (error || !data) throw new Error(`[briefs] publishBriefRecord (write): ${error?.message ?? "no row"}`);
  return data as unknown as Brief;
}

// ─── Brief Deliveries ────────────────────────────────────────────────────────

/** Record a brief delivery event. */
export async function recordDelivery(params: {
  brief_id: string;
  brief_version: number;
  recipient_id: string;
  format: DeliveryFormat;
}): Promise<BriefDelivery> {
  const { data, error } = await db()
    .from("brief_deliveries")
    .insert({
      brief_id: params.brief_id,
      brief_version: params.brief_version,
      recipient_id: params.recipient_id,
      format: params.format,
    })
    .select(DELIVERY_COLUMNS)
    .single();
  if (error || !data) throw new Error(`[briefs] recordDelivery: ${error?.message ?? "no row"}`);
  return data as unknown as BriefDelivery;
}

/** List all deliveries for a brief. */
export async function listDeliveriesForBrief(brief_id: string): Promise<BriefDelivery[]> {
  const { data, error } = await db()
    .from("brief_deliveries")
    .select(DELIVERY_COLUMNS)
    .eq("brief_id", brief_id)
    .order("delivered_at", { ascending: false });
  if (error) throw new Error(`[briefs] listDeliveriesForBrief: ${error.message}`);
  return (data ?? []) as unknown as BriefDelivery[];
}

/** Check whether a web delivery record exists for this brief+recipient. */
export async function hasWebDelivery(brief_id: string, recipient_id: string): Promise<boolean> {
  const { count, error } = await db()
    .from("brief_deliveries")
    .select("id", { count: "exact", head: true })
    .eq("brief_id", brief_id)
    .eq("recipient_id", recipient_id)
    .eq("format", "web");
  if (error) throw new Error(`[briefs] hasWebDelivery: ${error.message}`);
  return (count ?? 0) > 0;
}
