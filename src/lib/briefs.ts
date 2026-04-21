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

import { sql } from "./db";
import type { PublishState, DeliveryFormat } from "../types/data-lanes";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Brief {
  id: string;
  nace_sector: string;
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
  observations: Observation[];
  closing_actions: ClosingAction[];
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
  const rows = await sql<Brief[]>`
    SELECT
      id,
      nace_sector,
      publish_state,
      version,
      author_id,
      created_at,
      published_at,
      content_sections,
      benchmark_snippet
    FROM briefs
    ORDER BY created_at DESC
  `;
  return rows;
}

/** Get a single brief by ID. Returns null if not found. */
export async function getBriefById(id: string): Promise<Brief | null> {
  const rows = await sql<Brief[]>`
    SELECT
      id,
      nace_sector,
      publish_state,
      version,
      author_id,
      created_at,
      published_at,
      content_sections,
      benchmark_snippet
    FROM briefs
    WHERE id = ${id}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

/** Get the most recently published brief for a given NACE sector. */
export async function getPublishedBriefByNace(naceSector: string): Promise<Brief | null> {
  const rows = await sql<Brief[]>`
    SELECT
      id,
      nace_sector,
      publish_state,
      version,
      author_id,
      created_at,
      published_at,
      content_sections,
      benchmark_snippet
    FROM briefs
    WHERE nace_sector = ${naceSector}
      AND publish_state = 'published'
    ORDER BY published_at DESC
    LIMIT 1
  `;
  return rows[0] ?? null;
}

/**
 * List all published briefs for a given NACE sector, ordered most-recent first.
 * Lane: brief (ADR-0002-C). Capped at 20 results for safety.
 * Used by the v0.2 dashboard briefs list (dashboard-v0-2.md §7).
 */
export async function listPublishedBriefsByNace(naceSector: string): Promise<Brief[]> {
  const rows = await sql<Brief[]>`
    SELECT
      id,
      nace_sector,
      publish_state,
      version,
      author_id,
      created_at,
      published_at,
      content_sections,
      benchmark_snippet
    FROM briefs
    WHERE nace_sector = ${naceSector}
      AND publish_state = 'published'
    ORDER BY published_at DESC, created_at DESC, id DESC
    LIMIT 20
  `;
  return rows;
}

/** Create a new brief draft. Returns the new brief. */
export async function createDraftBrief(params: {
  nace_sector: string;
  author_id: string;
}): Promise<Brief> {
  const rows = await sql<Brief[]>`
    INSERT INTO briefs (nace_sector, author_id, content_sections, publish_state)
    VALUES (
      ${params.nace_sector},
      ${params.author_id},
      ${sql.json([] as unknown as never)}::jsonb,
      'draft'
    )
    RETURNING
      id, nace_sector, publish_state, version, author_id,
      created_at, published_at, content_sections, benchmark_snippet
  `;
  return rows[0];
}

/** Update a brief's content sections. Increments version. */
export async function updateBriefContent(
  id: string,
  content_sections: ContentSection[],
  benchmark_snapshot?: BenchmarkSnippet
): Promise<Brief> {
  const rows = await sql<Brief[]>`
    UPDATE briefs
    SET
      content_sections = ${sql.json(content_sections as unknown as never)}::jsonb,
      benchmark_snippet = COALESCE(${benchmark_snapshot ? sql.json(benchmark_snapshot as unknown as never) : null}::jsonb, benchmark_snippet),
      version = version + 1
    WHERE id = ${id}
    RETURNING
      id, nace_sector, publish_state, version, author_id,
      created_at, published_at, content_sections, benchmark_snippet
  `;
  if (!rows[0]) throw new Error(`Brief ${id} not found`);
  return rows[0];
}

/** Mark a brief as published. Sets published_at and publish_state. */
export async function publishBriefRecord(
  id: string,
  benchmarkSnapshot: BenchmarkSnippet,
  checklist_affirmed_by: string,
  checklist_version: string
): Promise<Brief> {
  // content_sections is a JSONB array; append a metadata element rather than
  // using jsonb_set with a string path (which errors on arrays — the path
  // element at position 1 must be an integer index, not a key name).
  const publishMetaSection = {
    section_id: "_publish_meta",
    heading: "_publish_meta",
    body: JSON.stringify({
      affirmed_by: checklist_affirmed_by,
      checklist_version,
      affirmed_at: new Date().toISOString(),
    }),
    order: 9999,
  };

  const rows = await sql<Brief[]>`
    UPDATE briefs
    SET
      publish_state = 'published',
      published_at = now(),
      benchmark_snippet = ${sql.json(benchmarkSnapshot as unknown as never)}::jsonb,
      version = version + 1,
      content_sections = content_sections || ${sql.json([publishMetaSection] as unknown as never)}::jsonb
    WHERE id = ${id}
      AND publish_state = 'draft'
    RETURNING
      id, nace_sector, publish_state, version, author_id,
      created_at, published_at, content_sections, benchmark_snippet
  `;
  if (!rows[0]) throw new Error(`Brief ${id} not found or already published`);
  return rows[0];
}

// ─── Brief Deliveries ────────────────────────────────────────────────────────

/** Record a brief delivery event. */
export async function recordDelivery(params: {
  brief_id: string;
  brief_version: number;
  recipient_id: string;
  format: DeliveryFormat;
}): Promise<BriefDelivery> {
  const rows = await sql<BriefDelivery[]>`
    INSERT INTO brief_deliveries (brief_id, brief_version, recipient_id, format)
    VALUES (${params.brief_id}, ${params.brief_version}, ${params.recipient_id}, ${params.format})
    RETURNING id, brief_id, brief_version, recipient_id, format, delivered_at
  `;
  return rows[0];
}

/** List all deliveries for a brief. */
export async function listDeliveriesForBrief(brief_id: string): Promise<BriefDelivery[]> {
  return sql<BriefDelivery[]>`
    SELECT id, brief_id, brief_version, recipient_id, format, delivered_at
    FROM brief_deliveries
    WHERE brief_id = ${brief_id}
    ORDER BY delivered_at DESC
  `;
}

/** Check whether a web delivery record exists for this brief+recipient. */
export async function hasWebDelivery(brief_id: string, recipient_id: string): Promise<boolean> {
  const rows = await sql<{ count: string }[]>`
    SELECT COUNT(*)::text AS count
    FROM brief_deliveries
    WHERE brief_id = ${brief_id}
      AND recipient_id = ${recipient_id}
      AND format = 'web'
    LIMIT 1
  `;
  return parseInt(rows[0]?.count ?? "0", 10) > 0;
}
