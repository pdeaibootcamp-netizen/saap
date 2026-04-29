/**
 * POST /api/admin/publications/upload
 *
 * Accepts a multipart form upload of a publication file (PDF, DOCX, MD, TXT),
 * stores it in Supabase Storage (bucket: publications), and fires the n8n
 * webhook that runs the multi-NACE analysis pipeline.
 *
 * v0.3 changes (D-029, Model B + D-030 relevance gate):
 *   - File-only upload — no NACE selector. The n8n workflow fans out to all
 *     four NACE branches and runs a relevance gate per NACE; the resulting
 *     brief is tagged with whichever NACEs were marked relevant.
 *   - No analysis_jobs row written. The TCP-postgres path is blocked in this
 *     dev environment (same constraint as elsewhere this session). The
 *     /api/admin/briefs/from-n8n route already handles missing job rows
 *     gracefully (jobless mode).
 *   - ownerMetricSnapshot deferred to OQ-075. The webhook payload doesn't
 *     include it for v0.3; if/when re-enabled it would carry only
 *     percentile + quartile (no raw values, ADR-N8N-03).
 *
 * Auth: requires analyst session cookie (isAdminAuthenticated).
 *
 * docs/engineering/n8n-integration.md §4, §5 (legacy spec — superseded by
 * D-029/D-030 for v0.3 multi-NACE flow).
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { isAdminAuthenticated } from "@/lib/auth";

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
 * Compute HMAC-SHA256 over a body string.
 * Returns header value in the format: sha256=<hexdigest>
 */
function computeHmac(body: string, secret: string): string {
  const sig = crypto.createHmac("sha256", secret).update(body, "utf8").digest("hex");
  return `sha256=${sig}`;
}

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_EXTENSIONS = [".pdf", ".docx", ".doc", ".md", ".txt"];

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

  // ── Validate file ──
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "Soubor je povinný." }, { status: 400 });
  }
  const f = file as File;

  const name = f.name.toLowerCase();
  if (!ALLOWED_EXTENSIONS.some((ext) => name.endsWith(ext))) {
    return NextResponse.json(
      { error: "Tento formát zatím nepodporujeme. Nahrajte prosím PDF, DOCX, MD nebo TXT." },
      { status: 400 }
    );
  }

  if (f.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "Soubor přesahuje 10 MB. Použijte zhuštěnější verzi a zkuste to znovu." },
      { status: 400 }
    );
  }

  // ── Generate job ID ──
  // Storage path uses only the UUID + extension — original filename can
  // contain non-ASCII chars (Czech diacritics) which Supabase Storage
  // rejects with "Invalid key". The original filename isn't needed
  // downstream; the n8n workflow detects file type from URL extension.
  const jobId = crypto.randomUUID();
  const lowerName = f.name.toLowerCase();
  const matchedExt = ALLOWED_EXTENSIONS.find((ext) => lowerName.endsWith(ext)) ?? ".bin";
  const storagePath = `${jobId}${matchedExt}`;

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

  // ── Determine callback URL (where n8n POSTs the bundled draft back) ──
  const host =
    req.headers.get("x-forwarded-host") ||
    req.headers.get("host") ||
    "localhost:3000";
  const protocol =
    req.headers.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const callbackUrl = `${protocol}://${host}/api/admin/briefs/from-n8n`;

  // ── Build n8n webhook payload ──
  // v0.3 minimal shape: { jobId, callbackUrl, publicationFileUrl }.
  // No naceDivision (multi-NACE fan-out is automatic per D-029/D-030).
  // No ownerMetricSnapshot (deferred per OQ-075).
  const webhookPayload = {
    jobId,
    callbackUrl,
    publicationFileUrl,
  };

  // ── Fire n8n webhook ──
  const webhookUrl = process.env.N8N_WEBHOOK_URL;
  const webhookSecret = process.env.N8N_WEBHOOK_SECRET;

  if (!webhookUrl) {
    // Feature flag: if N8N_WEBHOOK_URL is not set, disable the trigger
    return NextResponse.json(
      { error: "Analýza není momentálně k dispozici. (N8N_WEBHOOK_URL není nakonfigurovaná.)" },
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
  let webhookErrorDetail: string | undefined;
  try {
    const webhookRes = await fetch(webhookUrl, {
      method: "POST",
      headers,
      body: bodyStr,
    });
    webhookOk = webhookRes.ok;
    if (!webhookOk) {
      webhookErrorDetail = await webhookRes.text().catch(() => "");
      console.error(
        "[upload] n8n webhook returned non-2xx:",
        webhookRes.status,
        webhookErrorDetail
      );
    }
  } catch (fetchErr) {
    webhookErrorDetail = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
    console.error("[upload] n8n webhook fetch error:", fetchErr);
  }

  if (!webhookOk) {
    return NextResponse.json(
      {
        error: "Spuštění analýzy selhalo. Zkontrolujte nastavení n8n a zkuste to znovu.",
        detail: webhookErrorDetail,
      },
      { status: 502 }
    );
  }

  return NextResponse.json({ jobId }, { status: 200 });
}
