/**
 * POST /api/admin/publications/upload
 *
 * Accepts a multipart form upload of a PDF or DOCX publication file,
 * stores it in Supabase Storage (bucket: publications), creates an
 * analysis_jobs row, and fires the n8n webhook.
 *
 * Auth: requires analyst session cookie (isAdminAuthenticated).
 * Lane: brief (analysis_jobs is brief-lane; file is brief-lane artifact).
 * Privacy: ownerMetricSnapshot (when useSnapshot=true) is composed
 *   from user_contributed lane at request time and passed to n8n
 *   in-process only — not stored in analysis_jobs (ADR-N8N-03).
 *
 * docs/engineering/n8n-integration.md §4, §5
 * docs/data/analysis-pipeline-data.md §3, §5
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { isAdminAuthenticated } from "@/lib/auth";
import { sql } from "@/lib/db";

// ── Helpers ───────────────────────────────────────────────────────────────────

function unauthorized() {
  return NextResponse.json({ error: "Neautorizováno." }, { status: 401 });
}

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env vars not configured");
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * Compose the ownerMetricSnapshot from the active demo owner's metrics.
 * Returns null if Track A tables don't exist yet or if no data is available.
 * Per docs/data/analysis-pipeline-data.md §5:
 *   - Read metric_id + percentile + quartile_label from owner_metrics
 *   - Never include raw_value (ADR-N8N-03)
 */
async function composeOwnerSnapshot(): Promise<
  Array<{ metric_id: string; percentile: number | null; quartile_label: string | null }> | undefined
> {
  try {
    // Try to read from cohort_aggregates / owner_metrics.
    // If Track A tables don't exist yet, catch the error and return undefined.
    const rows = await sql<
      Array<{ metric_id: string; percentile: number | null; quartile_label: string | null }>
    >`
      SELECT
        metric_id,
        percentile,
        quartile_label
      FROM owner_metrics
      LIMIT 8
    `;
    if (rows.length === 0) return undefined;
    return rows;
  } catch (err) {
    console.warn(
      "[upload] owner_metrics table not available (Track A may not be deployed yet):",
      err instanceof Error ? err.message : err
    );
    return undefined;
  }
}

/**
 * Compute HMAC-SHA256 over a body string.
 * Returns header value in the format: sha256=<hexdigest>
 */
function computeHmac(body: string, secret: string): string {
  const sig = crypto.createHmac("sha256", secret).update(body, "utf8").digest("hex");
  return `sha256=${sig}`;
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (!isAdminAuthenticated()) return unauthorized();

  // ── Parse multipart form ──
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Neplatný formulář." }, { status: 400 });
  }

  const file = formData.get("file");
  const naceDivision = (formData.get("naceDivision") as string) ?? "";
  const useSnapshot = formData.get("useSnapshot") === "true";

  // ── Validate file ──
  if (!file || typeof file === "string") {
    return NextResponse.json(
      { error: "Soubor je povinný." },
      { status: 400 }
    );
  }
  const f = file as File;

  const name = f.name.toLowerCase();
  if (!name.endsWith(".pdf") && !name.endsWith(".docx")) {
    return NextResponse.json(
      {
        error:
          "Tento formát zatím nepodporujeme. Nahrajte prosím PDF nebo DOCX.",
      },
      { status: 400 }
    );
  }

  const MAX_BYTES = 10 * 1024 * 1024;
  if (f.size > MAX_BYTES) {
    return NextResponse.json(
      {
        error:
          "Soubor přesahuje 10 MB. Použijte zhuštěnější verzi a zkuste to znovu.",
      },
      { status: 400 }
    );
  }

  // ── Validate NACE ──
  if (!naceDivision || !/^\d{2}$/.test(naceDivision)) {
    return NextResponse.json(
      { error: "Neplatný kód NACE. Zadejte dvouciferný kód, např. '49'." },
      { status: 400 }
    );
  }

  // ── Generate job ID ──
  const jobId = crypto.randomUUID();
  const storagePath = `${jobId}-${f.name}`;

  // ── Upload to Supabase Storage ──
  const supabase = getSupabaseClient();
  const bytes = await f.arrayBuffer();

  const { error: storageError } = await supabase.storage
    .from("publications")
    .upload(storagePath, bytes, {
      contentType: f.type || "application/octet-stream",
      upsert: false,
    });

  if (storageError) {
    console.error("[upload] Supabase Storage error:", storageError);
    return NextResponse.json(
      { error: "Nahrávání selhalo. Zkontrolujte připojení a zkuste to znovu." },
      { status: 500 }
    );
  }

  // ── Generate signed URL (1h TTL per ADR-N8N-02) ──
  const { data: signedUrlData, error: signedUrlError } = await supabase.storage
    .from("publications")
    .createSignedUrl(storagePath, 3600);

  if (signedUrlError || !signedUrlData?.signedUrl) {
    console.error("[upload] Signed URL error:", signedUrlError);
    return NextResponse.json(
      { error: "Nepodařilo se připravit soubor ke zpracování. Zkuste to znovu." },
      { status: 500 }
    );
  }

  const publicationFileUrl = signedUrlData.signedUrl;

  // ── Optionally compose owner snapshot ──
  let ownerMetricSnapshot: Array<{
    metric_id: string;
    percentile: number | null;
    quartile_label: string | null;
  }> | undefined = undefined;

  if (useSnapshot) {
    ownerMetricSnapshot = await composeOwnerSnapshot();
    if (!ownerMetricSnapshot) {
      console.warn(
        "[upload] useSnapshot=true but no owner metrics available; proceeding without snapshot"
      );
    }
  }

  // ── Create analysis_jobs row (status='queued') ──
  try {
    await sql`
      INSERT INTO analysis_jobs (id, status, file_path, nace_division, snapshot_used, data_lane)
      VALUES (
        ${jobId}::uuid,
        'queued',
        ${storagePath},
        ${naceDivision},
        ${useSnapshot},
        'brief'
      )
    `;
  } catch (dbErr) {
    console.error("[upload] DB insert error:", dbErr);
    return NextResponse.json(
      { error: "Nepodařilo se vytvořit záznam úlohy. Zkuste to znovu." },
      { status: 500 }
    );
  }

  // ── Determine callback URL ──
  const host =
    req.headers.get("x-forwarded-host") ||
    req.headers.get("host") ||
    "localhost:3000";
  const protocol =
    req.headers.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const callbackUrl = `${protocol}://${host}/api/admin/briefs/from-n8n`;

  // ── Build n8n webhook payload ──
  const webhookPayload: {
    jobId: string;
    callbackUrl: string;
    publicationFileUrl: string;
    naceDivision: string;
    ownerMetricSnapshot?: typeof ownerMetricSnapshot;
  } = {
    jobId,
    callbackUrl,
    publicationFileUrl,
    naceDivision,
  };
  if (ownerMetricSnapshot) {
    webhookPayload.ownerMetricSnapshot = ownerMetricSnapshot;
  }

  // ── Fire n8n webhook ──
  const webhookUrl = process.env.N8N_WEBHOOK_URL;
  const webhookSecret = process.env.N8N_WEBHOOK_SECRET;

  if (!webhookUrl) {
    // Feature flag: if N8N_WEBHOOK_URL is not set, disable the trigger
    await sql`
      UPDATE analysis_jobs
      SET status = 'failed', error = 'N8N_WEBHOOK_URL not configured', completed_at = now()
      WHERE id = ${jobId}::uuid
    `;
    return NextResponse.json(
      { error: "Analýza není momentálně k dispozici." },
      { status: 503 }
    );
  }

  const bodyStr = JSON.stringify(webhookPayload);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (webhookSecret) {
    headers["X-Signature-256"] = computeHmac(bodyStr, webhookSecret);
  }

  let webhookOk = false;
  try {
    const webhookRes = await fetch(webhookUrl, {
      method: "POST",
      headers,
      body: bodyStr,
    });
    webhookOk = webhookRes.ok;
    if (!webhookOk) {
      console.error(
        "[upload] n8n webhook returned non-2xx:",
        webhookRes.status,
        await webhookRes.text().catch(() => "")
      );
    }
  } catch (fetchErr) {
    console.error("[upload] n8n webhook fetch error:", fetchErr);
  }

  if (!webhookOk) {
    // Mark job failed
    await sql`
      UPDATE analysis_jobs
      SET status = 'failed', error = 'n8n webhook call failed', completed_at = now()
      WHERE id = ${jobId}::uuid
    `.catch((e) => console.error("[upload] failed to mark job as failed:", e));

    return NextResponse.json(
      {
        error:
          "Spuštění analýzy selhalo. Zkontrolujte nastavení n8n a zkuste to znovu.",
      },
      { status: 502 }
    );
  }

  return NextResponse.json({ jobId }, { status: 200 });
}
