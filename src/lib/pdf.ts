/**
 * pdf.ts — Puppeteer-based PDF generation + local-filesystem storage
 *
 * ADR-0001-C: Server-side Puppeteer renders /brief/[id]?format=pdf to PDF.
 * ADR-0002-F: PDFs stored as briefs/{id}/v{n}.pdf.
 *
 * Storage: local filesystem for the trial (OQ-010 — @sparticuz/chromium Vercel
 * compatibility unconfirmed). In production: Vercel Blob per ADR-0002-F.
 * Trial posture: store in /tmp/pdf-cache/ and serve via /api/pdf/[briefId].
 *
 * ADR-0001-F consequence: Puppeteer on Vercel needs @sparticuz/chromium.
 * For local dev, uses system Chromium. Logs a clear error if unavailable.
 *
 * Signed URL: stubbed for trial — returns a plain local path URL.
 * TTL: 1 hour (ADR-0002-F). Stub: no enforcement for local dev.
 *
 * Privacy: PDFs are brief-lane data. No per-user financial data in the content.
 * PDF key scheme: briefs/{briefId}/v{version}.pdf
 */

import path from "path";
import fs from "fs/promises";
import { existsSync, mkdirSync } from "fs";

// ─── Storage paths ────────────────────────────────────────────────────────────

const PDF_CACHE_DIR = process.env.PDF_CACHE_DIR ?? "/tmp/strategy-radar-pdfs";

function getPdfPath(briefId: string, version: number): string {
  return path.join(PDF_CACHE_DIR, "briefs", briefId, `v${version}.pdf`);
}

/** Return a signed (stubbed) download URL for a PDF. TTL is 1 hour. */
export function getSignedPdfUrl(briefId: string, version: number): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  // Stub: plain URL — no TTL enforcement in trial. Production: Vercel Blob signed URL.
  const expires = Date.now() + 3600 * 1000; // 1 hour TTL (informational only at trial)
  return `${appUrl}/api/pdf/${briefId}?version=${version}&expires=${expires}`;
}

/** Check whether a PDF artifact exists for a given brief+version. */
export async function pdfExists(briefId: string, version: number): Promise<boolean> {
  const filePath = getPdfPath(briefId, version);
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/** Read PDF bytes from local storage. Returns null if not found. */
export async function readPdfBytes(briefId: string, version: number): Promise<Buffer | null> {
  const filePath = getPdfPath(briefId, version);
  try {
    return await fs.readFile(filePath);
  } catch {
    return null;
  }
}

// ─── PDF generation ───────────────────────────────────────────────────────────

export interface GeneratePdfParams {
  briefId: string;
  version: number;
  appUrl?: string;
}

/**
 * Generate a PDF for a brief by rendering /brief/[id]?format=pdf via Puppeteer.
 * Stores the result in local filesystem under PDF_CACHE_DIR.
 *
 * Returns the local file path.
 *
 * OQ-010: @sparticuz/chromium Vercel compatibility not yet confirmed.
 * Falls back to graceful error log + stub PDF for trial when Puppeteer unavailable.
 */
export async function generatePdf(params: GeneratePdfParams): Promise<string> {
  const appUrl = params.appUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const briefUrl = `${appUrl}/brief/${params.briefId}?format=pdf`;
  const outputPath = getPdfPath(params.briefId, params.version);

  // Ensure output directory exists
  const outputDir = path.dirname(outputPath);
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  console.log(`[pdf] Generating PDF for brief=${params.briefId} version=${params.version}`);
  console.log(`[pdf] Source URL: ${briefUrl}`);

  try {
    // Dynamic import — Puppeteer may not be installed for trial
    const puppeteer = await import("puppeteer").catch(() => null);

    if (!puppeteer) {
      // Stub: write a placeholder PDF file
      console.warn("[pdf][STUB] Puppeteer not available. Writing placeholder PDF.");
      const stubContent = `%PDF-1.4 stub — brief ${params.briefId} v${params.version}`;
      await fs.writeFile(outputPath, stubContent, "utf-8");
      return outputPath;
    }

    const browser = await puppeteer.default.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });

    try {
      const page = await browser.newPage();
      await page.setViewport({ width: 794, height: 1123 }); // A4 at 96dpi
      await page.goto(briefUrl, { waitUntil: "networkidle2", timeout: 30000 });

      const pdfBuffer = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: { top: "20mm", bottom: "20mm", left: "20mm", right: "20mm" },
      });

      await fs.writeFile(outputPath, pdfBuffer);
      console.log(`[pdf] Generated: ${outputPath} (${pdfBuffer.length} bytes)`);
      return outputPath;
    } finally {
      await browser.close();
    }
  } catch (err) {
    console.error("[pdf] Generation error:", err);
    // Write a stub placeholder so the pipeline can continue
    const stubContent = `%PDF-1.4 error-stub — brief ${params.briefId} v${params.version}`;
    await fs.writeFile(outputPath, stubContent, "utf-8");
    return outputPath;
  }
}
