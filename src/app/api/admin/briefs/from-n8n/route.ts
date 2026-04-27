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
import { sql } from "@/lib/db";
import type { BriefContent, ContentSection } from "@/lib/briefs";

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

  // ── Lookup analysis_jobs row ──
  const jobRows = await sql<
    Array<{ id: string; status: string; nace_division: string }>
  >`
    SELECT id, status, nace_division
    FROM analysis_jobs
    WHERE id = ${payload.jobId}::uuid
    LIMIT 1
  `.catch((err) => {
    console.error("[from-n8n] DB lookup error:", err);
    return null;
  });

  if (!jobRows || jobRows.length === 0) {
    return NextResponse.json({ error: "Job not found." }, { status: 404 });
  }

  const job = jobRows[0];

  // ── Handle failed status ──
  if (payload.status === "failed") {
    await sql`
      UPDATE analysis_jobs
      SET
        status = 'failed',
        error = ${payload.error ?? "n8n reported failure"},
        completed_at = now()
      WHERE id = ${payload.jobId}::uuid
    `.catch((err) => console.error("[from-n8n] Failed to update job (failed):", err));

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

  // Insert brief in draft state
  let briefId: string;
  try {
    const briefRows = await sql<Array<{ id: string }>>`
      INSERT INTO briefs (nace_sector, author_id, content_sections, publish_state, data_lane)
      VALUES (
        ${job.nace_division},
        'n8n-generated',
        ${JSON.stringify([contentSection])}::jsonb,
        'draft',
        'brief'
      )
      RETURNING id
    `;
    if (!briefRows[0]?.id) throw new Error("INSERT returned no id");
    briefId = briefRows[0].id;
  } catch (err) {
    console.error("[from-n8n] Failed to insert brief:", err);
    // Mark job failed so polling surface shows failure
    await sql`
      UPDATE analysis_jobs
      SET status = 'failed', error = 'brief insert failed', completed_at = now()
      WHERE id = ${payload.jobId}::uuid
    `.catch(() => {});
    return NextResponse.json(
      { error: "Failed to create brief." },
      { status: 500 }
    );
  }

  // Update analysis_jobs row
  await sql`
    UPDATE analysis_jobs
    SET
      status = 'done',
      brief_id = ${briefId}::uuid,
      completed_at = now()
    WHERE id = ${payload.jobId}::uuid
  `.catch((err) => console.error("[from-n8n] Failed to update job (done):", err));

  return NextResponse.json({ briefId }, { status: 200 });
}
