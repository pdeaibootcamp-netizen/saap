/**
 * POST /api/admin/briefs/from-n8n — n8n callback endpoint
 *
 * Called by the n8n workflow after completing (or failing) a publication analysis.
 * 1. Verifies HMAC-SHA256 signature using N8N_CALLBACK_SECRET.
 * 2. Validates the payload shape (manual validation — zod not yet a dependency;
 *    logged as OQ-C-01 in docs/project/open-questions.md).
 * 3. On status='done': inserts a draft brief row, updates analysis_jobs.
 * 4. On status='failed': marks job failed.
 *
 * This is a machine-to-machine endpoint — no admin session cookie required.
 * Auth is entirely by HMAC signature.
 *
 * docs/engineering/n8n-integration.md §5
 * docs/data/analysis-pipeline-data.md §3
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import type { BriefContent, ContentSection, Observation, ClosingAction } from "@/lib/briefs";

// ── Supabase REST client ─────────────────────────────────────────────────────
// Use the REST/HTTPS client because the developer's network blocks outbound
// TCP 5432/6543 to the Supabase pooler (well-established constraint, see
// src/scripts/ingest-industry-data.ts header comment). Service role key is
// required because this route is a machine-to-machine endpoint authenticated
// by HMAC, not by user session.
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("[from-n8n] Supabase env vars not configured");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

// ── HMAC verification ─────────────────────────────────────────────────────────

/**
 * Verify the X-Signature-256 header against the raw request body.
 * Returns true only when the HMAC matches.
 * Constant-time comparison prevents timing attacks.
 */
async function verifyHmac(req: NextRequest, secret: string): Promise<boolean> {
  const sigHeader = req.headers.get("x-signature-256") ?? "";
  if (!sigHeader.startsWith("sha256=")) return false;

  const receivedHex = sigHeader.slice("sha256=".length);

  // Read raw body bytes for HMAC computation
  const rawBody = await req.text();
  const computedHex = crypto
    .createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("hex");

  // Timing-safe compare requires equal-length buffers
  if (receivedHex.length !== computedHex.length) return false;

  try {
    return crypto.timingSafeEqual(
      Buffer.from(receivedHex, "hex"),
      Buffer.from(computedHex, "hex")
    );
  } catch {
    return false;
  }
}

// ── Payload types (mirrors n8n-integration.md §5 contract) ───────────────────

interface N8nObservation {
  headline: string;
  body: string;
  time_horizon: "Okamžitě" | "Do 3 měsíců" | "Do 12 měsíců" | "Více než rok";
  is_email_teaser: boolean;
}

interface N8nClosingAction {
  action_text: string;
  time_horizon: "Okamžitě" | "Do 3 měsíců" | "Do 12 měsíců" | "Více než rok";
  paired_observation_index?: number;
  category?: string;
}

interface N8nPublicationBlock {
  heading: string;
  opener_markdown: string;
  full_text_markdown: string;
  source: string;
}

interface N8nDraft {
  title: string;
  publication_month: string;
  publication: N8nPublicationBlock;
  observations: N8nObservation[];
  closing_actions: N8nClosingAction[];
}

/**
 * v0.3 (D-029, Model B) per-NACE content bundle. n8n emits one of these per
 * NACE the publication is relevant for. The relevance gate may exclude some
 * NACEs entirely (they don't appear in `naceSectors` or `perNaceContent`).
 */
interface N8nPerNaceContent {
  observations: N8nObservation[];
  closing_actions: N8nClosingAction[];
}

interface N8nCallbackPayload {
  jobId: string;
  status: "done" | "failed";
  error?: string;

  // ── v0.1/v0.2 single-NACE shape (legacy, manual-test workflow still uses this) ──
  draft?: N8nDraft;
  naceDivision?: string;

  // ── v0.3 multi-NACE shape (D-029, Model B — new analysis pipeline) ──
  /**
   * Array of 2-digit NACE divisions this brief covers. Non-empty.
   * Customer dashboard filter: `WHERE active_firm_nace = ANY(naceSectors)`.
   */
  naceSectors?: string[];
  /**
   * v0.4 (D-033) primary-NACE tag — analyst-chosen main topic of the
   * publication. n8n echoes it back from the upload webhook payload so
   * from-n8n can write briefs.primary_nace. When absent, falls back to
   * naceSectors[0] (best-effort for legacy n8n workflows).
   */
  primaryNace?: string;
  /** Czech month-year string like "Duben 2026". */
  publicationMonth?: string;
  /** ISO month like "2026-04". */
  publicationMonthIso?: string;
  /** Brief title (no NACE in title for multi-NACE briefs). */
  title?: string;
  /** Shared publication block (opener + full text + source). */
  publication?: N8nPublicationBlock;
  /** Per-NACE insights + actions, keyed by 2-digit NACE division. */
  perNaceContent?: Record<string, N8nPerNaceContent>;
}

// ── Payload validation (manual, no zod) ───────────────────────────────────────

const VALID_TIME_HORIZONS = [
  "Okamžitě",
  "Do 3 měsíců",
  "Do 12 měsíců",
  "Více než rok",
] as const;

const VALID_CATEGORIES = [
  "ziskovost",
  "naklady-produktivita",
  "efektivita-kapitalu",
  "rust-trzni-pozice",
] as const;

function validateObservations(arr: unknown, path: string): string | null {
  if (!Array.isArray(arr)) return `${path} must be an array`;
  if (arr.length < 1) return `${path} must contain at least one entry`;
  for (let i = 0; i < arr.length; i++) {
    const obs = arr[i] as Record<string, unknown>;
    if (typeof obs.headline !== "string" || !obs.headline) return `${path}[${i}].headline must be a non-empty string`;
    if (typeof obs.body !== "string") return `${path}[${i}].body must be a string`;
    if (!VALID_TIME_HORIZONS.includes(obs.time_horizon as (typeof VALID_TIME_HORIZONS)[number])) {
      return `${path}[${i}].time_horizon is invalid: '${String(obs.time_horizon)}'`;
    }
    if (typeof obs.is_email_teaser !== "boolean") return `${path}[${i}].is_email_teaser must be a boolean`;
  }
  return null;
}

function validateClosingActions(arr: unknown, observationsCount: number, path: string): string | null {
  if (!Array.isArray(arr)) return `${path} must be an array`;
  if (arr.length < 1) return `${path} must contain at least one entry`;
  for (let i = 0; i < arr.length; i++) {
    const act = arr[i] as Record<string, unknown>;
    if (typeof act.action_text !== "string" || !act.action_text) return `${path}[${i}].action_text must be a non-empty string`;
    if (!VALID_TIME_HORIZONS.includes(act.time_horizon as (typeof VALID_TIME_HORIZONS)[number])) {
      return `${path}[${i}].time_horizon is invalid: '${String(act.time_horizon)}'`;
    }
    if (act.paired_observation_index !== undefined && act.paired_observation_index !== null) {
      const idx = act.paired_observation_index;
      if (typeof idx !== "number" || !Number.isInteger(idx) || idx < 0 || idx >= observationsCount) {
        return `${path}[${i}].paired_observation_index is out of range`;
      }
    }
  }
  return null;
}

/** Returns null if valid, or an error string describing the first problem. */
function validatePayload(raw: unknown): string | null {
  if (typeof raw !== "object" || raw === null) return "payload must be an object";
  const p = raw as Record<string, unknown>;

  if (typeof p.jobId !== "string" || !p.jobId) return "jobId must be a non-empty string";
  if (p.status !== "done" && p.status !== "failed") {
    return `status must be 'done' or 'failed', got '${String(p.status)}'`;
  }
  if (p.status !== "done") return null; // 'failed' has no further required fields

  // ── v0.3 multi-NACE shape (D-029) takes precedence when present ──
  if (Array.isArray(p.naceSectors) && p.perNaceContent && typeof p.perNaceContent === "object") {
    if (p.naceSectors.length < 1) return "naceSectors must be a non-empty array";
    for (const s of p.naceSectors) {
      if (typeof s !== "string" || !/^\d{2}$/.test(s)) {
        return `naceSectors entry '${String(s)}' must be a 2-digit string`;
      }
    }
    if (!p.publication || typeof p.publication !== "object") return "publication is required";
    const pub = p.publication as Record<string, unknown>;
    for (const f of ["heading", "opener_markdown", "full_text_markdown", "source"]) {
      if (typeof pub[f] !== "string") return `publication.${f} must be a string`;
    }
    const perNace = p.perNaceContent as Record<string, unknown>;
    for (const nace of p.naceSectors) {
      const entry = perNace[nace];
      if (!entry || typeof entry !== "object") return `perNaceContent['${nace}'] is missing`;
      const e = entry as Record<string, unknown>;
      const obsErr = validateObservations(e.observations, `perNaceContent['${nace}'].observations`);
      if (obsErr) return obsErr;
      const obsArr = e.observations as unknown[];
      const actErr = validateClosingActions(e.closing_actions, obsArr.length, `perNaceContent['${nace}'].closing_actions`);
      if (actErr) return actErr;
    }
    return null;
  }

  // ── v0.1/v0.2 single-NACE shape (legacy, manual-test workflow) ──
  if (p.status === "done") {
    if (!p.draft || typeof p.draft !== "object") return "draft is required when status is 'done'";
    const d = p.draft as Record<string, unknown>;

    if (typeof d.title !== "string" || !d.title) return "draft.title must be a non-empty string";
    if (typeof d.publication_month !== "string" || !d.publication_month) {
      return "draft.publication_month must be a non-empty string";
    }
    if (!d.publication || typeof d.publication !== "object") {
      return "draft.publication must be an object";
    }
    const pub = d.publication as Record<string, unknown>;
    for (const field of ["heading", "opener_markdown", "full_text_markdown", "source"]) {
      if (typeof pub[field] !== "string") {
        return `draft.publication.${field} must be a string`;
      }
    }

    const obsErr = validateObservations(d.observations, "draft.observations");
    if (obsErr) return obsErr;
    const obsCount = (d.observations as unknown[]).length;
    const actErr = validateClosingActions(d.closing_actions, obsCount, "draft.closing_actions");
    if (actErr) return actErr;
  }

  return null;
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const secret = process.env.N8N_CALLBACK_SECRET;

  if (!secret) {
    console.error("[from-n8n] N8N_CALLBACK_SECRET not configured");
    return NextResponse.json(
      { error: "Server configuration error." },
      { status: 500 }
    );
  }

  // ── Verify HMAC ──
  // We must read body text for HMAC, then re-parse as JSON.
  // Next.js Request body can only be read once; use .text() → JSON.parse.
  const rawBodyText = await req.text();
  const sigHeader = req.headers.get("x-signature-256") ?? "";

  if (!sigHeader.startsWith("sha256=")) {
    return NextResponse.json(
      { error: "Missing X-Signature-256 header." },
      { status: 401 }
    );
  }

  const receivedHex = sigHeader.slice("sha256=".length);
  const computedHex = crypto
    .createHmac("sha256", secret)
    .update(rawBodyText, "utf8")
    .digest("hex");

  let hmacValid = false;
  if (receivedHex.length === computedHex.length) {
    try {
      hmacValid = crypto.timingSafeEqual(
        Buffer.from(receivedHex, "hex"),
        Buffer.from(computedHex, "hex")
      );
    } catch {
      hmacValid = false;
    }
  }

  if (!hmacValid) {
    console.warn("[from-n8n] HMAC signature mismatch — rejecting request");
    console.warn("[from-n8n] DIAGNOSTIC:", {
      secretLength: secret.length,
      secretFirst8: secret.slice(0, 8),
      secretLast8: secret.slice(-8),
      bodyLength: rawBodyText.length,
      bodyFirst120: rawBodyText.slice(0, 120),
      bodyLast80: rawBodyText.slice(-80),
      receivedHex,
      computedHex,
    });
    return NextResponse.json(
      { error: "Signature mismatch." },
      { status: 401 }
    );
  }

  // ── Parse JSON ──
  let raw: unknown;
  try {
    raw = JSON.parse(rawBodyText);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 422 });
  }

  // ── Validate payload ──
  const validationError = validatePayload(raw);
  if (validationError) {
    console.warn("[from-n8n] Payload validation failed:", validationError);
    return NextResponse.json(
      { error: `Invalid payload: ${validationError}` },
      { status: 422 }
    );
  }

  const payload = raw as N8nCallbackPayload;

  // ── Optional analysis_jobs lookup (Supabase REST) ──
  // The original /admin/publications/new flow creates an analysis_jobs row
  // before firing the webhook; the n8n callback can find it by jobId. The
  // newer MCP/Claude-Code flow has NO such row — jobId is just an opaque
  // correlation label. Make the lookup optional: if the row exists we link
  // the brief to it; if not we proceed jobless.
  //
  // Job lookup uses `.eq("id", jobId)` only when jobId is a valid UUID.
  // Non-UUID jobIds (mcp-..., manual-...) skip the lookup entirely.
  const supabase = getSupabase();

  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      payload.jobId
    );

  let job: { id: string; status: string; nace_division: string } | null = null;
  if (isUuid) {
    const { data, error: jobErr } = await supabase
      .from("analysis_jobs")
      .select("id, status, nace_division")
      .eq("id", payload.jobId)
      .maybeSingle();
    if (jobErr) {
      console.warn(
        "[from-n8n] analysis_jobs lookup error (proceeding jobless):",
        jobErr.message
      );
    } else if (data) {
      job = data as { id: string; status: string; nace_division: string };
    }
  }

  // ── Resolve target NACE list for this brief (D-029, Model B) ──
  // v0.3 multi-NACE shape: payload.naceSectors carries the relevance set
  // (already filtered to relevant NACEs by the n8n relevance gate).
  // v0.1/v0.2 single-NACE shape: derived from payload.naceDivision or job row.
  const isMultiNace =
    Array.isArray(payload.naceSectors) &&
    payload.naceSectors.length > 0 &&
    payload.perNaceContent !== undefined;

  const naceSectors: string[] = isMultiNace
    ? (payload.naceSectors as string[])
    : [(job?.nace_division ?? payload.naceDivision ?? "31")];
  const naceDivision = naceSectors[0]; // legacy column = first (or only) NACE

  // v0.4 (D-033): primary-NACE tag from upload-time analyst pick.
  // Resolution: callback payload → naceSectors[0] fallback. Must be in the
  // relevance set or DB CHECK constraint will reject the insert; if the
  // analyst's pick somehow dropped out of the relevance gate, fall back.
  const primaryNaceCandidate =
    typeof payload.primaryNace === "string" && payload.primaryNace.length > 0
      ? payload.primaryNace
      : naceDivision;
  const primaryNace = naceSectors.includes(primaryNaceCandidate)
    ? primaryNaceCandidate
    : naceDivision;

  // ── Handle failed status ──
  if (payload.status === "failed") {
    if (job) {
      const { error: updErr } = await supabase
        .from("analysis_jobs")
        .update({
          status: "failed",
          error: payload.error ?? "n8n reported failure",
          completed_at: new Date().toISOString(),
        })
        .eq("id", payload.jobId);
      if (updErr) {
        console.error(
          "[from-n8n] Failed to update job (failed):",
          updErr.message
        );
      }
    }
    return NextResponse.json({}, { status: 200 });
  }

  // ── Handle done status — insert brief ──
  // Build BriefContent. Two paths:
  //   (a) v0.3 multi-NACE shape: per_nace_content map populated; top-level
  //       observations/closing_actions backfilled from the FIRST NACE for
  //       v0.1/v0.2 callers that don't know about per_nace_content.
  //   (b) v0.1/v0.2 single-NACE shape: top-level arrays populated; no per_nace map.
  const mapObservation = (o: N8nObservation): Observation => ({
    headline: o.headline,
    body: o.body,
    time_horizon: o.time_horizon,
    is_email_teaser: o.is_email_teaser,
  });
  const mapAction = (a: N8nClosingAction): ClosingAction => ({
    action_text: a.action_text,
    time_horizon: a.time_horizon,
    category: a.category ?? "ziskovost",
    paired_observation_index:
      a.paired_observation_index !== undefined ? a.paired_observation_index : null,
  });

  let briefContent: BriefContent;

  if (isMultiNace) {
    const pub = payload.publication!;
    const perNace = payload.perNaceContent!;
    const perNaceContent: BriefContent["per_nace_content"] = {};
    for (const nace of naceSectors) {
      const entry = perNace[nace];
      perNaceContent![nace] = {
        observations: entry.observations.map(mapObservation),
        closing_actions: entry.closing_actions.map(mapAction),
      };
    }
    // Top-level fallback = first NACE's content (v0.1/v0.2 reader compat)
    const firstNace = naceSectors[0];
    const first = perNaceContent![firstNace];

    briefContent = {
      title: payload.title ?? `Sektorová analýza — ${payload.publicationMonth ?? ""}`.trim(),
      publication_month: payload.publicationMonthIso ?? "",
      opening_summary: pub.opener_markdown,
      observations: first.observations,
      closing_actions: first.closing_actions,
      per_nace_content: perNaceContent,
      benchmark_categories: [],
      pdf_footer_text: "Strategy Radar · Česká spořitelna",
      email_teaser_observation_index: 0,
    };
  } else {
    const draft = payload.draft!;
    briefContent = {
      title: draft.title,
      publication_month: draft.publication_month,
      opening_summary: "",
      publication: {
        heading: draft.publication.heading,
        opener_markdown: draft.publication.opener_markdown,
        full_text_markdown: draft.publication.full_text_markdown,
        source: draft.publication.source,
      },
      observations: draft.observations.map(mapObservation),
      closing_actions: draft.closing_actions.map(mapAction),
      benchmark_categories: [],
      pdf_footer_text: "Strategy Radar · Česká spořitelna",
      email_teaser_observation_index: 0,
    };
  }

  const contentSection: ContentSection = {
    section_id: "brief_content",
    heading: "Obsah přehledu",
    body: JSON.stringify(briefContent),
    order: 0,
  };

  // Insert brief in draft state via Supabase REST
  let briefId: string;
  try {
    const { data: briefRow, error: insertErr } = await supabase
      .from("briefs")
      .insert({
        nace_sector: naceDivision,
        nace_sectors: naceSectors,
        primary_nace: primaryNace,
        author_id: "n8n-generated",
        content_sections: [contentSection],
        publish_state: "draft",
        data_lane: "brief",
      })
      .select("id")
      .single();

    if (insertErr || !briefRow?.id) {
      throw new Error(insertErr?.message ?? "INSERT returned no id");
    }
    briefId = briefRow.id;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[from-n8n] Failed to insert brief:", msg);
    // Mark job failed (only if a real job row exists)
    if (job) {
      await supabase
        .from("analysis_jobs")
        .update({
          status: "failed",
          error: "brief insert failed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", payload.jobId);
    }
    return NextResponse.json(
      { error: "Failed to create brief.", detail: msg },
      { status: 500 }
    );
  }

  // Update analysis_jobs row (only when a real job row exists)
  if (job) {
    const { error: doneErr } = await supabase
      .from("analysis_jobs")
      .update({
        status: "done",
        brief_id: briefId,
        completed_at: new Date().toISOString(),
      })
      .eq("id", payload.jobId);
    if (doneErr) {
      console.error(
        "[from-n8n] Failed to update job (done):",
        doneErr.message
      );
    }
  }

  return NextResponse.json({ briefId }, { status: 200 });
}
