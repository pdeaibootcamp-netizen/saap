/**
 * /admin/pulz-oboru/[id]/edit — Edit an existing Pulz oboru analysis.
 *
 * Loads the existing analysis and pre-fills the PulzOboruForm.
 * Shows a DraftStatusBanner (via PulzOboruForm's isEditing logic) based on status.
 *
 * If the record is not found, redirects to the list page with a 404 note.
 *
 * Czech copy per D-004. Formal register.
 * Design: docs/design/pulz-oboru-admin.md §3 (edit page)
 */

import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import {
  getPulzAnalysisById,
} from "@/lib/pulz-analyses";
import { PulzOboruForm } from "../../PulzOboruForm";
import type { FormState } from "../../PulzOboruForm";

// Fetch chart tiles and actions for the edit page pre-fill.
// We need raw DB paths, not signed URLs.
async function loadEditData(id: string) {
  const analysis = await getPulzAnalysisById(id);
  if (!analysis) return null;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const client = createClient(url, key, { auth: { persistSession: false } });

  const [chartsResult, actionsResult] = await Promise.all([
    client
      .from("pulz_analysis_charts")
      .select("slot_index, verdict, image_storage_path, alt_text, caption, uses_cs_internal_data")
      .eq("analysis_id", id)
      .order("slot_index", { ascending: true }),
    client
      .from("pulz_analysis_actions")
      .select("slot_index, action_text, time_horizon")
      .eq("analysis_id", id)
      .order("slot_index", { ascending: true }),
  ]);

  return { analysis, charts: chartsResult.data ?? [], actions: actionsResult.data ?? [] };
}

export default async function EditPulzOboruPage({
  params,
}: {
  params: { id: string };
}) {
  const data = await loadEditData(params.id);

  if (!data) {
    redirect("/admin/pulz-oboru?notfound=1");
  }

  const { analysis, charts, actions } = data;

  // Build the initial form state from DB data.
  // Images are pre-existing (storage paths set); no image File objects to pre-fill.
  type ChartInit = FormState["chartTiles"][0];
  const chartTiles: [ChartInit, ChartInit, ChartInit] = [
    {
      verdict: "",
      imageFile: null,
      imagePreviewUrl: null,
      imageStoragePath: null,
      imageMimeType: null,
      altText: "",
      caption: "",
      usesCsInternalData: false,
      imageError: null,
      altTextWarning: null,
      verdictWarning: null,
    },
    {
      verdict: "",
      imageFile: null,
      imagePreviewUrl: null,
      imageStoragePath: null,
      imageMimeType: null,
      altText: "",
      caption: "",
      usesCsInternalData: false,
      imageError: null,
      altTextWarning: null,
      verdictWarning: null,
    },
    {
      verdict: "",
      imageFile: null,
      imagePreviewUrl: null,
      imageStoragePath: null,
      imageMimeType: null,
      altText: "",
      caption: "",
      usesCsInternalData: false,
      imageError: null,
      altTextWarning: null,
      verdictWarning: null,
    },
  ];

  charts.forEach((c) => {
    const idx = (c.slot_index as number) - 1 as 0 | 1 | 2;
    if (idx >= 0 && idx <= 2) {
      chartTiles[idx] = {
        verdict: c.verdict ?? "",
        imageFile: null,
        imagePreviewUrl: null, // existing images shown via storage path, not preview
        imageStoragePath: c.image_storage_path ?? null,
        imageMimeType: null,
        altText: c.alt_text ?? "",
        caption: c.caption ?? "",
        usesCsInternalData: c.uses_cs_internal_data ?? false,
        imageError: null,
        altTextWarning: null,
        verdictWarning: null,
      };
    }
  });

  const actionState = actions.map((a) => ({
    timeHorizon: a.time_horizon ?? "",
    actionText: a.action_text ?? "",
  }));

  const initialData: Partial<FormState> & { id: string; status: "draft" | "published" } = {
    id: analysis.id,
    status: analysis.status as "draft" | "published",
    naceDivision: analysis.nace_division,
    publicationPeriod: analysis.publication_period,
    summaryText: analysis.summary_text,
    pdfFile: null,
    pdfStoragePath: analysis.pdf_storage_path,
    pdfSourceLabel:
      analysis.pdf_source_label ??
      "Ekonomické a strategické analýzy České spořitelny",
    chartTiles,
    actions: actionState.length > 0
      ? actionState
      : [{ timeHorizon: "", actionText: "" }],
  };

  const isPublished = analysis.status === "published";

  return (
    <main style={{ minHeight: "100vh", backgroundColor: "#f5f5f5", fontFamily: "system-ui, sans-serif" }}>
      <header
        style={{
          backgroundColor: "#1a1a1a",
          color: "#fff",
          padding: "16px 24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <a href="/admin/pulz-oboru" style={{ color: "#aaa", fontSize: "13px", textDecoration: "none" }}>
          ← Zpět na přehledy
        </a>
        <span style={{ fontWeight: "bold", fontSize: "16px" }}>
          Strategy Radar — Upravit analýzu Pulz oboru
        </span>
      </header>

      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "40px 24px" }}>
        <h1 style={{ fontSize: "22px", fontWeight: "bold", marginBottom: "8px" }}>
          Upravit analýzu Pulz oboru
        </h1>
        <p style={{ fontSize: "14px", color: "#666", marginBottom: "24px" }}>
          {isPublished
            ? `Publikováno — ${analysis.nace_label_czech}, ${analysis.publication_period}.`
            : `Koncept — ${analysis.nace_label_czech}, ${analysis.publication_period}.`}
        </p>

        <PulzOboruForm initialData={initialData} />
      </div>

      <footer style={{ textAlign: "center", padding: "24px 16px 32px", color: "#9E9E9E", fontSize: "13px" }}>
        Tento prototyp byl vygenerován pomocí AI.
      </footer>
    </main>
  );
}
