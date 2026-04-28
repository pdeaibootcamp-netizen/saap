/**
 * pulz-storage.ts — Storage helpers for Pulz oboru chart images and PDFs
 *
 * Wraps Supabase Storage upload + signed-URL minting for the two private buckets:
 *   - pulz-charts  (chart tile images: PNG / SVG / WebP, max 2 MB)
 *   - pulz-pdfs    (optional full-publication PDFs, max 20 MB)
 *
 * Path layout:
 *   pulz-charts/{analysis_id}/slot-{slotIndex}.{ext}
 *   pulz-pdfs/{analysis_id}/publication.pdf
 *
 * Signed URL TTL: 1 hour (3600 s), matching the n8n signed-URL TTL convention
 * from analysis-pipeline-data.md §1.
 *
 * Lane: brief only. No per-owner data flows through these helpers.
 * Privacy: signed URLs expire in 1 hour; no public URLs are ever returned.
 *
 * See docs/data/analyses-schema.md §4 for the storage contract spec.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// ── Bucket names ──────────────────────────────────────────────────────────────

export const PULZ_CHARTS_BUCKET = "pulz-charts" as const;
export const PULZ_PDFS_BUCKET = "pulz-pdfs" as const;

// ── Signed URL TTL ────────────────────────────────────────────────────────────

export const SIGNED_URL_TTL_SECONDS = 3600; // 1 hour

// ── MIME type allow-list ──────────────────────────────────────────────────────

export const CHART_MIME_ALLOW_LIST = [
  "image/png",
  "image/svg+xml",
  "image/webp",
] as const;

export type ChartMimeType = (typeof CHART_MIME_ALLOW_LIST)[number];

export const CHART_MAX_BYTES = 2 * 1024 * 1024;   // 2 MB
export const PDF_MAX_BYTES   = 20 * 1024 * 1024;  // 20 MB

// ── Client (service-role) ─────────────────────────────────────────────────────

let _client: SupabaseClient | null = null;

function storageClient(): SupabaseClient {
  if (_client) return _client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "[pulz-storage] NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY must be set"
    );
  }
  _client = createClient(url, key, { auth: { persistSession: false } });
  return _client;
}

// ── Path helpers ──────────────────────────────────────────────────────────────

/**
 * Returns the storage path for a chart image inside the pulz-charts bucket.
 *
 * @param analysisId  UUID of the parent pulz_analyses row.
 * @param slotIndex   Chart slot 1–3.
 * @param ext         File extension without leading dot (e.g. "png", "svg", "webp").
 */
export function chartStoragePath(
  analysisId: string,
  slotIndex: 1 | 2 | 3,
  ext: string
): string {
  return `${analysisId}/slot-${slotIndex}.${ext}`;
}

/**
 * Returns the storage path for a publication PDF inside the pulz-pdfs bucket.
 *
 * @param analysisId  UUID of the parent pulz_analyses row.
 */
export function pdfStoragePath(analysisId: string): string {
  return `${analysisId}/publication.pdf`;
}

/**
 * Derives the file extension from a MIME type.
 * Falls back to "bin" for unknown types (upload validation will reject them before
 * this fallback is ever reached in production).
 */
export function mimeToExt(mimeType: string): string {
  const map: Record<string, string> = {
    "image/png": "png",
    "image/svg+xml": "svg",
    "image/webp": "webp",
    "application/pdf": "pdf",
  };
  return map[mimeType] ?? "bin";
}

// ── Upload helpers ────────────────────────────────────────────────────────────

/**
 * Upload a chart image to the pulz-charts bucket.
 *
 * Validates MIME type and size client-side before calling Storage.
 * Returns the storage path on success.
 *
 * @throws on MIME type violation, size violation, or Supabase Storage error.
 */
export async function uploadChartImage(params: {
  analysisId: string;
  slotIndex: 1 | 2 | 3;
  file: Buffer | Uint8Array;
  mimeType: string;
  fileSizeBytes: number;
}): Promise<string> {
  const { analysisId, slotIndex, file, mimeType, fileSizeBytes } = params;

  if (!(CHART_MIME_ALLOW_LIST as readonly string[]).includes(mimeType)) {
    throw new Error(
      `[pulz-storage] uploadChartImage: MIME type '${mimeType}' is not permitted. ` +
        `Allowed: ${CHART_MIME_ALLOW_LIST.join(", ")}`
    );
  }

  if (fileSizeBytes > CHART_MAX_BYTES) {
    throw new Error(
      `[pulz-storage] uploadChartImage: file size ${fileSizeBytes} B exceeds the 2 MB cap.`
    );
  }

  const ext = mimeToExt(mimeType);
  const path = chartStoragePath(analysisId, slotIndex, ext);

  const { error } = await storageClient()
    .storage
    .from(PULZ_CHARTS_BUCKET)
    .upload(path, file, { contentType: mimeType, upsert: true });

  if (error) {
    throw new Error(`[pulz-storage] uploadChartImage: ${error.message}`);
  }

  return path;
}

/**
 * Upload a publication PDF to the pulz-pdfs bucket.
 *
 * @throws on MIME type violation, size violation, or Supabase Storage error.
 */
export async function uploadPdf(params: {
  analysisId: string;
  file: Buffer | Uint8Array;
  mimeType: string;
  fileSizeBytes: number;
}): Promise<string> {
  const { analysisId, file, mimeType, fileSizeBytes } = params;

  if (mimeType !== "application/pdf") {
    throw new Error(
      `[pulz-storage] uploadPdf: MIME type '${mimeType}' is not permitted. Expected 'application/pdf'.`
    );
  }

  if (fileSizeBytes > PDF_MAX_BYTES) {
    throw new Error(
      `[pulz-storage] uploadPdf: file size ${fileSizeBytes} B exceeds the 20 MB cap.`
    );
  }

  const path = pdfStoragePath(analysisId);

  const { error } = await storageClient()
    .storage
    .from(PULZ_PDFS_BUCKET)
    .upload(path, file, { contentType: "application/pdf", upsert: true });

  if (error) {
    throw new Error(`[pulz-storage] uploadPdf: ${error.message}`);
  }

  return path;
}

// ── Signed URL minting ────────────────────────────────────────────────────────

/**
 * Mint a 1-hour signed URL for a chart image.
 *
 * @param storagePath  The value stored in pulz_analysis_charts.image_storage_path.
 * @returns A signed URL string. Never a public URL.
 * @throws on Supabase Storage error.
 */
export async function signChartUrl(storagePath: string): Promise<string> {
  const { data, error } = await storageClient()
    .storage
    .from(PULZ_CHARTS_BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    throw new Error(
      `[pulz-storage] signChartUrl('${storagePath}'): ${error?.message ?? "no URL returned"}`
    );
  }

  return data.signedUrl;
}

/**
 * Mint a 1-hour signed URL for a publication PDF.
 *
 * @param storagePath  The value stored in pulz_analyses.pdf_storage_path.
 * @returns A signed URL string. Never a public URL.
 * @throws on Supabase Storage error.
 */
export async function signPdfUrl(storagePath: string): Promise<string> {
  const { data, error } = await storageClient()
    .storage
    .from(PULZ_PDFS_BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    throw new Error(
      `[pulz-storage] signPdfUrl('${storagePath}'): ${error?.message ?? "no URL returned"}`
    );
  }

  return data.signedUrl;
}

/**
 * Delete storage objects for a given analysis (used when hard-deleting a draft).
 * Charts: all three slots (attempts each; ignores "not found" errors).
 * PDF: single object (ignores "not found" error).
 *
 * NOTE: This is called explicitly by the DELETE handler — Supabase Storage does
 * not cascade-delete when the Postgres row is deleted.
 * See docs/data/analyses-schema.md §4.2 (orphan-bucket cleanup note).
 */
export async function deleteAnalysisStorageObjects(params: {
  analysisId: string;
  chartSlotPaths: string[];   // image_storage_path values from the DB rows
  pdfStoragePath: string | null;
}): Promise<void> {
  const client = storageClient();

  if (params.chartSlotPaths.length > 0) {
    // Best-effort removal; ignore errors (objects may not exist yet for drafts)
    await client.storage.from(PULZ_CHARTS_BUCKET).remove(params.chartSlotPaths);
  }

  if (params.pdfStoragePath) {
    await client.storage.from(PULZ_PDFS_BUCKET).remove([params.pdfStoragePath]);
  }
}
