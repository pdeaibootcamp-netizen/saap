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
import type { BriefContent, ContentSection } from "@/lib/briefs";

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

interface N8nDraft {
  title: string;
  publication_month: string;
  publication: {
    heading: string;
    opener_markdown: string;
    full_text_markdown: string;
    source: string;
  };
  observations: N8nObservation[];
  closing_actions: N8nClosingAction[];
}

interface N8nCallbackPayload {
  jobId: string;
  status: "done" | "failed";
  draft?: N8nDraft;
  error?: string;
  /**
   * Optional top-level nace_division. Required for MCP/Claude-Code origin
   * (no analysis_jobs row to read it from). Falls back to the job's
   * nace_division when present, then to "31" as a last resort.
   */
  naceDivision?: string;
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

/** Returns null if valid, or an error string describing the first problem. */
function validatePayload(raw: unknown): string | null {
  if (typeof raw !== "object" || raw === null) return "payload must be an object";
  const p = raw as Record<string, unknown>;

  if (typeof p.jobId !== "string" || !p.jobId) return "jobId must be a non-empty string";
  if (p.status !== "done" && p.status !== "failed") {
    return `status must be 'done' or 'failed', got '${String(p.status)}'`;
  }

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

    if (!Array.isArray(d.observations)) return "draft.observations must be an array";
    if (d.observations.length < 1) return "draft.observations must contain at least one entry";
    for (let i = 0; i < d.observations.length; i++) {
      const obs = d.observations[i] as Record<string, unknown>;
      if (typeof obs.headline !== "string" || !obs.headline) {
        return `draft.observations[${i}].headline must be a non-empty string`;
      }
      if (typeof obs.body !== "string") {
        return `draft.observations[${i}].body must be a string`;
      }
      if (!VALID_TIME_HORIZONS.includes(obs.time_horizon as (typeof VALID_TIME_HORIZONS)[number])) {
        return `draft.observations[${i}].time_horizon is invalid: '${String(obs.time_horizon)}'`;
      }
      if (typeof obs.is_email_teaser !== "boolean") {
        return `draft.observations[${i}].is_email_teaser must be a boolean`;
      }
    }

    if (!Array.isArray(d.closing_actions)) return "draft.closing_actions must be an array";
    if (d.closing_actions.length < 1) return "draft.closing_actions must contain at least one entry";
    for (let i = 0; i < d.closing_actions.length; i++) {
      const act = d.closing_actions[i] as Record<string, unknown>;
      if (typeof act.action_text !== "string" || !act.action_text) {
        return `draft.closing_actions[${i}].action_text must be a non-empty string`;
      }
      if (!VALID_TIME_HORIZONS.includes(act.time_horizon as (typeof VALID_TIME_HORIZONS)[number])) {
        return `draft.closing_actions[${i}].time_horizon is invalid: '${String(act.time_horizon)}'`;
      }
      if (
        act.paired_observation_index !== undefined &&
        act.paired_observation_index !== null
      ) {
        const idx = act.paired_observation_index;
        if (
          typeof idx !== "number" ||
          !Number.isInteger(idx) ||
          idx < 0 ||
          idx >= (d.observations as unknown[]).length
        ) {
          return `draft.closing_actions[${i}].paired_observation_index is out of range`;
        }
      }
    }
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

  // Resolve nace_division: prefer the job row, then the payload top-level,
  // then a "31" fallback so a malformed payload still produces a brief
  // rather than a 500.
  const naceDivision =
    job?.nace_division ?? payload.naceDivision ?? "31";

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
  const draft = payload.draft!;

  // Map n8n draft to BriefContent
  const briefContent: BriefContent = {
    title: draft.title,
    publication_month: draft.publication_month,
    opening_summary: "",
    publication: {
      heading: draft.publication.heading,
      opener_markdown: draft.publication.opener_markdown,
      full_text_markdown: draft.publication.full_text_markdown,
      source: draft.publication.source,
    },
    observations: draft.observations.map((o) => ({
      headline: o.headline,
      body: o.body,
      time_horizon: o.time_horizon,
      is_email_teaser: o.is_email_teaser,
    })),
    closing_actions: draft.closing_actions.map((a) => ({
      action_text: a.action_text,
      time_horizon: a.time_horizon,
      category: a.category ?? "ziskovost",
      paired_observation_index:
        a.paired_observation_index !== undefined ? a.paired_observation_index : null,
    })),
    benchmark_categories: [],
    pdf_footer_text: "Strategy Radar · Česká spořitelna",
    email_teaser_observation_index: 0,
  };

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
