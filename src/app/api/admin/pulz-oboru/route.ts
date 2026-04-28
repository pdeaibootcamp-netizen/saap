/**
 * /api/admin/pulz-oboru — Pulz oboru upload/publish API
 *
 * POST  — Create a new analysis (draft or publish)
 * PUT   — Update an existing analysis (draft or publish)
 * DELETE — Delete a draft analysis (published rows cannot be deleted via this API)
 *
 * Multipart form data. Validates all server-side invariants before writing:
 *   - nace_division: valid 2-digit NACE code
 *   - publication_period: non-empty, max 100 chars
 *   - chart_tiles: exactly 3, each with verdict + image + alt_text (>= 30 chars,
 *     not matching /^\s*graf\.?\s*$/i) + optional caption
 *   - uses_cs_internal_data = true → caption required
 *   - summary_text: non-empty, max 4000 chars
 *   - pdf: optional, application/pdf only, max 20 MB; if present → pdf_source_label required
 *   - actions: 1–3, each with valid time_horizon enum value + non-empty action_text
 *
 * Supersession: on publish, checks for an existing is_current = true row for the
 * same (nace_division, publication_period). Returns 409 if found and ?supersede != "true".
 * If ?supersede=true, inserts the new row and marks the prior row as superseded in a
 * logical two-step (REST has no server-side atomic multi-table transaction; the
 * application-level steps are: insert new row → update prior row).
 *
 * Privacy lane: brief only. No user_db, cohort_companies, consent_events reads/writes.
 *
 * See docs/data/analyses-schema.md §3.4 (publish-time invariants)
 * and docs/design/pulz-oboru-admin.md §5 (validation rules).
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { NACE_SECTORS } from "@/lib/nace";
import {
  uploadChartImage,
  uploadPdf,
  deleteAnalysisStorageObjects,
  mimeToExt,
} from "@/lib/pulz-storage";
import { findPublishedConflict } from "@/lib/pulz-analyses";

// ── Constants ─────────────────────────────────────────────────────────────────

const VALID_TIME_HORIZONS = new Set([
  "Okamžitě",
  "Do 3 měsíců",
  "Do 12 měsíců",
  "Více než rok",
]);

const VALID_NACE_CODES = new Set(NACE_SECTORS.map((s) => s.code));

const ALT_TEXT_MIN_CHARS = 30;
const GENERIC_ALT_REGEX = /^\s*graf\.?\s*$/i;
const CHART_MAX_BYTES = 2 * 1024 * 1024;
const PDF_MAX_BYTES = 20 * 1024 * 1024;
const ALLOWED_CHART_MIMES = new Set(["image/png", "image/svg+xml", "image/webp"]);

// ── Supabase service-role client ──────────────────────────────────────────────

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env vars");
  return createClient(url, key, { auth: { persistSession: false } });
}

// ── Field parsing ─────────────────────────────────────────────────────────────

interface ParsedTile {
  verdict: string;
  imageFile: File | null;
  imageStoragePath: string | null;
  imageMimeType: string | null;
  altText: string;
  caption: string;
  usesCsInternalData: boolean;
}

interface ParsedAction {
  timeHorizon: string;
  actionText: string;
}

interface ParsedPayload {
  id: string | null;
  status: "draft" | "published";
  naceDivision: string;
  publicationPeriod: string;
  summaryText: string;
  pdfFile: File | null;
  pdfStoragePath: string | null;
  pdfSourceLabel: string;
  tiles: [ParsedTile, ParsedTile, ParsedTile];
  actions: ParsedAction[];
}

function parseFormData(fd: FormData): ParsedPayload {
  const id = (fd.get("id") as string | null) ?? null;
  const status = (fd.get("status") as string) === "published" ? "published" : "draft";
  const naceDivision = (fd.get("naceDivision") as string) ?? "";
  const publicationPeriod = (fd.get("publicationPeriod") as string) ?? "";
  const summaryText = (fd.get("summaryText") as string) ?? "";
  const pdfFile = fd.get("pdfFile") instanceof File ? (fd.get("pdfFile") as File) : null;
  const pdfStoragePath = (fd.get("pdfStoragePath") as string | null) ?? null;
  const pdfSourceLabel =
    (fd.get("pdfSourceLabel") as string) ||
    "Ekonomické a strategické analýzy České spořitelny";

  const actionsCountRaw = fd.get("actionsCount");
  const actionsCount = actionsCountRaw ? parseInt(actionsCountRaw as string, 10) : 1;

  const tiles: [ParsedTile, ParsedTile, ParsedTile] = [1, 2, 3].map((slot) => {
    const imageField = fd.get(`tile${slot}_image`);
    const imageFile = imageField instanceof File && imageField.size > 0 ? imageField : null;
    return {
      verdict: (fd.get(`tile${slot}_verdict`) as string) ?? "",
      imageFile,
      imageStoragePath:
        imageFile === null
          ? ((fd.get(`tile${slot}_imageStoragePath`) as string | null) ?? null)
          : null,
      imageMimeType: (fd.get(`tile${slot}_imageMimeType`) as string | null) ?? null,
      altText: (fd.get(`tile${slot}_altText`) as string) ?? "",
      caption: (fd.get(`tile${slot}_caption`) as string) ?? "",
      usesCsInternalData: fd.get(`tile${slot}_usesCsInternalData`) === "true",
    };
  }) as [ParsedTile, ParsedTile, ParsedTile];

  const actions: ParsedAction[] = [];
  for (let i = 1; i <= Math.min(actionsCount, 3); i++) {
    actions.push({
      timeHorizon: (fd.get(`action${i}_timeHorizon`) as string) ?? "",
      actionText: (fd.get(`action${i}_actionText`) as string) ?? "",
    });
  }

  return {
    id,
    status,
    naceDivision,
    publicationPeriod,
    summaryText,
    pdfFile,
    pdfStoragePath,
    pdfSourceLabel,
    tiles,
    actions,
  };
}

// ── Server-side validation ────────────────────────────────────────────────────

function validatePayload(payload: ParsedPayload, forPublish: boolean): string[] {
  const errors: string[] = [];

  if (!VALID_NACE_CODES.has(payload.naceDivision))
    errors.push("Vyberte prosím obor NACE.");

  if (!payload.publicationPeriod.trim() || payload.publicationPeriod.length > 100)
    errors.push("Zadejte prosím období analýzy (např. '2. čtvrtletí 2026').");

  // On publish, chart validation is mandatory. On draft, allow partial saves.
  if (forPublish) {
    for (let i = 0; i < 3; i++) {
      const t = payload.tiles[i];
      const slot = i + 1;

      if (!t.verdict.trim())
        errors.push(`Výrok nesmí být prázdný (Graf ${slot}).`);
      if (t.verdict.length > 500)
        errors.push(`Výrok grafu ${slot} je příliš dlouhý.`);

      if (!t.imageFile && !t.imageStoragePath)
        errors.push(`Nahrajte prosím graf (Graf ${slot}).`);

      if (t.imageFile) {
        if (t.imageMimeType && !ALLOWED_CHART_MIMES.has(t.imageMimeType))
          errors.push(`Graf ${slot}: Podporujeme PNG a SVG. Jiné formáty nejsou povoleny.`);
        if (t.imageFile.size > CHART_MAX_BYTES)
          errors.push(`Graf ${slot}: Soubor přesahuje 2 MB.`);
      }

      if (!t.altText.trim())
        errors.push(`Popis grafu pro čtečky obrazovky je povinný (Graf ${slot}).`);
      else if (GENERIC_ALT_REGEX.test(t.altText.trim()))
        errors.push(`Popis musí říkat, co graf zobrazuje — ne jen 'graf' (Graf ${slot}).`);
      else if (t.altText.trim().length < ALT_TEXT_MIN_CHARS)
        errors.push(`Popis je příliš krátký — napište alespoň ${ALT_TEXT_MIN_CHARS} znaků (Graf ${slot}).`);

      if (t.usesCsInternalData && !t.caption.trim())
        errors.push(
          `Pokud graf vychází z dat České spořitelny, uveďte zdroj (Graf ${slot}).`
        );
    }

    if (!payload.summaryText.trim())
      errors.push("Shrnutí je povinné.");
    if (payload.summaryText.length > 4000)
      errors.push("Shrnutí překračuje maximální délku 4000 znaků.");

    if (payload.pdfFile) {
      if (payload.pdfFile.type !== "application/pdf")
        errors.push("Podporujeme jen formát PDF.");
      if (payload.pdfFile.size > PDF_MAX_BYTES)
        errors.push("Soubor přesahuje 20 MB.");
    }
    if ((payload.pdfFile || payload.pdfStoragePath) && !payload.pdfSourceLabel.trim())
      errors.push("Zadejte prosím označení zdroje PDF.");

    if (payload.actions.length < 1 || payload.actions.length > 3)
      errors.push("Analýza musí mít 1–3 doporučené kroky.");

    for (let i = 0; i < payload.actions.length; i++) {
      const a = payload.actions[i];
      if (!VALID_TIME_HORIZONS.has(a.timeHorizon))
        errors.push(`Vyberte prosím časový horizont (Krok ${i + 1}).`);
      if (!a.actionText.trim())
        errors.push(`Text akce nesmí být prázdný (Krok ${i + 1}).`);
      if (a.actionText.length > 600)
        errors.push(`Text akce je příliš dlouhý (Krok ${i + 1}).`);
    }
  }

  return errors;
}

// ── POST — create ─────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  return handleWrite(request, null);
}

// ── PUT — update ──────────────────────────────────────────────────────────────

export async function PUT(request: Request) {
  let fd: FormData;
  try {
    fd = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  }
  const id = fd.get("id") as string | null;
  if (!id)
    return NextResponse.json({ error: "Missing id for update." }, { status: 400 });
  return handleWrite(request, id, fd);
}

// ── DELETE — delete draft ─────────────────────────────────────────────────────

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id)
    return NextResponse.json({ error: "Missing id." }, { status: 400 });

  const client = db();

  // Only drafts can be deleted via this endpoint
  const { data: row, error: rowError } = await client
    .from("pulz_analyses")
    .select("id, status, pdf_storage_path")
    .eq("id", id)
    .maybeSingle();

  if (rowError || !row)
    return NextResponse.json({ error: "Analýza nenalezena." }, { status: 404 });

  if ((row as { status: string }).status === "published")
    return NextResponse.json(
      { error: "Publikované analýzy nelze smazat touto cestou." },
      { status: 403 }
    );

  // Get chart paths for storage cleanup
  const { data: charts } = await client
    .from("pulz_analysis_charts")
    .select("image_storage_path")
    .eq("analysis_id", id);

  const chartPaths = (charts ?? []).map(
    (c: { image_storage_path: string }) => c.image_storage_path
  );

  // Delete storage objects (best-effort — ignore errors)
  await deleteAnalysisStorageObjects({
    analysisId: id,
    chartSlotPaths: chartPaths,
    pdfStoragePath: (row as { pdf_storage_path: string | null }).pdf_storage_path,
  }).catch(() => {/* ignore storage cleanup errors */});

  // Delete the DB row (CASCADE removes child rows)
  const { error: deleteError } = await client
    .from("pulz_analyses")
    .delete()
    .eq("id", id);

  if (deleteError)
    return NextResponse.json({ error: deleteError.message }, { status: 500 });

  return NextResponse.json({ success: true });
}

// ── Shared write handler ──────────────────────────────────────────────────────

async function handleWrite(
  request: Request,
  existingId: string | null,
  preParsedFd?: FormData
): Promise<Response> {
  let fd: FormData;
  try {
    fd = preParsedFd ?? (await request.formData());
  } catch {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  }

  const payload = parseFormData(fd);
  const { searchParams } = new URL(request.url);
  const supersede = searchParams.get("supersede") === "true";
  const forPublish = payload.status === "published";

  // ── Validation ──────────────────────────────────────────────────────────
  const errors = validatePayload(payload, forPublish);
  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join(" "), errors }, { status: 422 });
  }

  // ── Conflict check (on publish) ─────────────────────────────────────────
  if (forPublish && !supersede) {
    const conflictId = await findPublishedConflict({
      naceDivision: payload.naceDivision,
      publicationPeriod: payload.publicationPeriod,
      excludeId: existingId ?? undefined,
    }).catch(() => null);

    if (conflictId) {
      const naceSector = NACE_SECTORS.find((s) => s.code === payload.naceDivision);
      return NextResponse.json(
        {
          error: "Pro tento obor a období již existuje publikovaná analýza.",
          conflict: true,
          naceLabel: naceSector?.name ?? payload.naceDivision,
          period: payload.publicationPeriod,
        },
        { status: 409 }
      );
    }
  }

  // ── Generate or reuse analysis ID ────────────────────────────────────────
  // For a new draft, we need the ID before uploading images (paths include the ID).
  // Strategy: insert the parent row first, then upload images, then insert child rows.
  const client = db();

  // ── Resolve NACE label ────────────────────────────────────────────────────
  const naceSector = NACE_SECTORS.find((s) => s.code === payload.naceDivision);
  const naceLabelCzech = naceSector?.name ?? payload.naceDivision;

  let analysisId: string;

  if (existingId) {
    analysisId = existingId;
  } else {
    // Insert parent row to get the UUID
    const { data: newRow, error: insertError } = await client
      .from("pulz_analyses")
      .insert({
        nace_division: payload.naceDivision,
        nace_label_czech: naceLabelCzech,
        publication_period: payload.publicationPeriod,
        summary_text: payload.summaryText || " ", // placeholder; updated below
        pdf_source_label: payload.pdfSourceLabel || null,
        created_by: "admin",
        status: "draft",
        is_current: false, // not current until published
        data_lane: "brief",
      })
      .select("id")
      .single();

    if (insertError || !newRow)
      return NextResponse.json({ error: insertError?.message ?? "Insert failed." }, { status: 500 });

    analysisId = (newRow as { id: string }).id;
  }

  // ── Upload chart images ───────────────────────────────────────────────────
  const chartStoragePaths: Array<string | null> = [null, null, null];

  for (let i = 0; i < 3; i++) {
    const tile = payload.tiles[i];
    if (tile.imageFile) {
      const mimeType =
        tile.imageMimeType ??
        (tile.imageFile.type !== "" ? tile.imageFile.type : "image/png");
      const buf = Buffer.from(await tile.imageFile.arrayBuffer());
      try {
        const path = await uploadChartImage({
          analysisId,
          slotIndex: (i + 1) as 1 | 2 | 3,
          file: buf,
          mimeType,
          fileSizeBytes: tile.imageFile.size,
        });
        chartStoragePaths[i] = path;
      } catch (err) {
        return NextResponse.json(
          { error: `Nahrávání selhalo (Graf ${i + 1}): ${(err as Error).message}` },
          { status: 500 }
        );
      }
    } else if (tile.imageStoragePath) {
      chartStoragePaths[i] = tile.imageStoragePath;
    }
  }

  // ── Upload PDF ────────────────────────────────────────────────────────────
  let pdfPath: string | null = payload.pdfStoragePath;

  if (payload.pdfFile) {
    const pdfBuf = Buffer.from(await payload.pdfFile.arrayBuffer());
    try {
      pdfPath = await uploadPdf({
        analysisId,
        file: pdfBuf,
        mimeType: "application/pdf",
        fileSizeBytes: payload.pdfFile.size,
      });
    } catch (err) {
      return NextResponse.json(
        { error: `Nahrávání PDF selhalo: ${(err as Error).message}` },
        { status: 500 }
      );
    }
  }

  // ── Supersede prior current row (if publishing) ───────────────────────────
  if (forPublish) {
    const priorConflictId = await findPublishedConflict({
      naceDivision: payload.naceDivision,
      publicationPeriod: payload.publicationPeriod,
      excludeId: existingId ?? undefined,
    }).catch(() => null);

    if (priorConflictId) {
      // Flip the prior row: is_current = false, superseded_at = now()
      await client
        .from("pulz_analyses")
        .update({
          is_current: false,
          superseded_at: new Date().toISOString(),
          superseded_by: analysisId,
        })
        .eq("id", priorConflictId);
    }
  }

  // Also flip any other is_current = true row for this NACE when publishing
  if (forPublish) {
    await client
      .from("pulz_analyses")
      .update({
        is_current: false,
        superseded_at: new Date().toISOString(),
        superseded_by: analysisId,
      })
      .eq("nace_division", payload.naceDivision)
      .eq("is_current", true)
      .neq("id", analysisId);
  }

  // ── Update analysis header row ────────────────────────────────────────────
  const { error: updateError } = await client
    .from("pulz_analyses")
    .update({
      nace_division: payload.naceDivision,
      nace_label_czech: naceLabelCzech,
      publication_period: payload.publicationPeriod,
      summary_text: payload.summaryText,
      pdf_storage_path: pdfPath,
      pdf_source_label: pdfPath ? payload.pdfSourceLabel : null,
      status: payload.status,
      is_current: forPublish ? true : false,
      published_at: forPublish ? new Date().toISOString() : undefined,
      data_lane: "brief",
    })
    .eq("id", analysisId);

  if (updateError)
    return NextResponse.json({ error: updateError.message }, { status: 500 });

  // ── Upsert chart rows ─────────────────────────────────────────────────────
  for (let i = 0; i < 3; i++) {
    const tile = payload.tiles[i];
    const storagePath = chartStoragePaths[i];
    if (!storagePath) continue;

    const mimeType =
      tile.imageMimeType ??
      (tile.imageFile ? tile.imageFile.type : null) ??
      (storagePath.endsWith(".svg") ? "image/svg+xml" : "image/png");

    const { error: chartError } = await client
      .from("pulz_analysis_charts")
      .upsert(
        {
          analysis_id: analysisId,
          slot_index: i + 1,
          verdict: tile.verdict,
          image_storage_path: storagePath,
          image_mime_type: mimeType,
          alt_text: tile.altText,
          caption: tile.caption || null,
          uses_cs_internal_data: tile.usesCsInternalData,
          data_lane: "brief",
        },
        { onConflict: "analysis_id,slot_index" }
      );

    if (chartError)
      return NextResponse.json({ error: chartError.message }, { status: 500 });
  }

  // ── Upsert action rows ────────────────────────────────────────────────────
  // Delete existing action rows first, then re-insert.
  await client.from("pulz_analysis_actions").delete().eq("analysis_id", analysisId);

  for (let i = 0; i < payload.actions.length; i++) {
    const action = payload.actions[i];
    const { error: actionError } = await client.from("pulz_analysis_actions").insert({
      analysis_id: analysisId,
      slot_index: i + 1,
      action_text: action.actionText,
      time_horizon: action.timeHorizon,
      data_lane: "brief",
    });

    if (actionError)
      return NextResponse.json({ error: actionError.message }, { status: 500 });
  }

  return NextResponse.json({ id: analysisId, status: payload.status }, { status: existingId ? 200 : 201 });
}
