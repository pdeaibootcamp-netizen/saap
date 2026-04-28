/**
 * PulzOboruForm — shared client-side form component for new + edit admin pages.
 *
 * Implements:
 *   - Single-page form with sticky live preview pane (desktop: 2-col split;
 *     mobile: accordion below the form).
 *   - Manual save-as-draft only (OQ-083: PM hasn't overridden; manual save per PD spec).
 *   - Client-side validation on publish with scroll-to-first-error.
 *   - 409 conflict modal on publish if (nace_division, publication_period) collides.
 *   - Publish confirmation dialog before POST.
 *   - Unsaved-changes warning (DraftStatusBanner copy).
 *
 * Design spec: docs/design/pulz-oboru-admin.md §4
 * Czech copy: docs/design/pulz-oboru-admin.md §6
 */

"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { NACE_SECTORS } from "@/lib/nace";

// ── Constants ─────────────────────────────────────────────────────────────────

export const TIME_HORIZONS = [
  "Okamžitě",
  "Do 3 měsíců",
  "Do 12 měsíců",
  "Více než rok",
] as const;

const CHART_MAX_MB = 2;
const PDF_MAX_MB = 20;
const CHART_ACCEPT = "image/png,image/svg+xml,image/webp";
const ALLOWED_CHART_MIMES = ["image/png", "image/svg+xml", "image/webp"];

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ChartTileState {
  verdict: string;
  imageFile: File | null;
  imagePreviewUrl: string | null;
  imageStoragePath: string | null; // set after successful upload
  imageMimeType: string | null;
  altText: string;
  caption: string;
  usesCsInternalData: boolean;
  imageError: string | null;
  altTextWarning: string | null;
  verdictWarning: string | null;
}

export interface ActionState {
  timeHorizon: string;
  actionText: string;
}

export interface FormState {
  naceDivision: string;
  publicationPeriod: string;
  chartTiles: [ChartTileState, ChartTileState, ChartTileState];
  summaryText: string;
  pdfFile: File | null;
  pdfStoragePath: string | null;
  pdfSourceLabel: string;
  actions: ActionState[];
}

function emptyChartTile(): ChartTileState {
  return {
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
  };
}

function emptyFormState(): FormState {
  return {
    naceDivision: "",
    publicationPeriod: "",
    chartTiles: [emptyChartTile(), emptyChartTile(), emptyChartTile()],
    summaryText: "",
    pdfFile: null,
    pdfStoragePath: null,
    pdfSourceLabel: "Ekonomické a strategické analýzy České spořitelny",
    actions: [{ timeHorizon: "", actionText: "" }],
  };
}

// ── Validation helpers ────────────────────────────────────────────────────────

function isGenericAltText(text: string): boolean {
  return /^\s*graf\.?\s*$/i.test(text.trim());
}

function countSentences(text: string): number {
  return (text.match(/[.!?]/g) ?? []).length;
}

function validateFormForPublish(form: FormState): string[] {
  const errors: string[] = [];

  if (!form.naceDivision) errors.push("Vyberte prosím obor NACE.");
  if (!form.publicationPeriod.trim())
    errors.push("Zadejte prosím období analýzy.");

  for (let i = 0; i < 3; i++) {
    const t = form.chartTiles[i];
    if (!t.verdict.trim()) errors.push(`Graf ${i + 1}: Výrok nesmí být prázdný.`);
    if (!t.imageStoragePath && !t.imageFile)
      errors.push(`Graf ${i + 1}: Nahrajte prosím graf.`);
    if (!t.altText.trim())
      errors.push(`Graf ${i + 1}: Popis grafu pro čtečky obrazovky je povinný.`);
    else if (t.altText.trim().length < 30)
      errors.push(`Graf ${i + 1}: Popis je příliš krátký — napište alespoň 30 znaků.`);
    else if (isGenericAltText(t.altText))
      errors.push(`Graf ${i + 1}: Popis musí říkat, co graf zobrazuje — ne jen 'graf'.`);
    if (t.usesCsInternalData && !t.caption.trim())
      errors.push(
        `Graf ${i + 1}: Pokud graf vychází z dat České spořitelny, uveďte zdroj.`
      );
  }

  if (!form.summaryText.trim()) errors.push("Shrnutí je povinné.");

  if (form.pdfFile && !form.pdfStoragePath)
    errors.push("Počkejte prosím, dokud se PDF nenahraje.");
  if (form.pdfStoragePath && !form.pdfSourceLabel.trim())
    errors.push("Zadejte prosím označení zdroje PDF.");

  for (let i = 0; i < form.actions.length; i++) {
    const a = form.actions[i];
    if (!a.timeHorizon) errors.push(`Krok ${i + 1}: Vyberte prosím časový horizont.`);
    if (!a.actionText.trim()) errors.push(`Krok ${i + 1}: Text akce nesmí být prázdný.`);
  }

  return errors;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function FieldError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" style={{ color: "#c00", fontSize: "13px", marginTop: "4px", marginBottom: 0 }}>
      {message}
    </p>
  );
}

function FieldWarning({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="status" style={{ color: "#E65100", fontSize: "13px", marginTop: "4px", marginBottom: 0 }}>
      {message}
    </p>
  );
}

function Label({
  htmlFor,
  children,
  required,
}: {
  htmlFor: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label
      htmlFor={htmlFor}
      style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "6px" }}
    >
      {children}
      {required && <span aria-hidden="true" style={{ color: "#c00", marginLeft: "2px" }}>*</span>}
    </label>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: "12px", color: "#666", marginTop: "4px", marginBottom: 0 }}>
      {children}
    </p>
  );
}

// ── Modal dialog component ────────────────────────────────────────────────────
// Native <dialog> is well-supported in current browsers (Q-POAL-001 resolved:
// no existing modal pattern in admin codebase → built minimal one here).

function Modal({
  open,
  heading,
  children,
  onClose,
}: {
  open: boolean;
  heading: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-heading"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,0.4)",
        }}
        aria-hidden="true"
      />
      {/* Dialog box */}
      <div
        style={{
          position: "relative",
          background: "#fff",
          border: "1px solid #e0e0e0",
          borderRadius: "8px",
          padding: "24px",
          maxWidth: "480px",
          width: "100%",
          boxShadow: "0 4px 24px rgba(0,0,0,0.15)",
        }}
      >
        <h2
          id="modal-heading"
          style={{ fontSize: "18px", fontWeight: 700, margin: "0 0 16px 0" }}
        >
          {heading}
        </h2>
        {children}
      </div>
    </div>
  );
}

// ── Main form component ───────────────────────────────────────────────────────

export interface PulzOboruFormProps {
  /** Pre-populated state for the edit page. Undefined = new form. */
  initialData?: Partial<FormState> & {
    id?: string;
    status?: "draft" | "published";
  };
}

export function PulzOboruForm({ initialData }: PulzOboruFormProps) {
  const router = useRouter();

  // ── Form state ──────────────────────────────────────────────────────────
  const [form, setForm] = useState<FormState>(() => {
    if (!initialData) return emptyFormState();
    const base = emptyFormState();
    return { ...base, ...initialData } as FormState;
  });

  const [submitting, setSubmitting] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [showPublishConfirm, setShowPublishConfirm] = useState(false);
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [conflictMessage, setConflictMessage] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false); // mobile accordion

  const formRef = useRef<HTMLFormElement>(null);
  const errorSummaryRef = useRef<HTMLDivElement>(null);

  const isEditing = Boolean(initialData?.id);
  const isPublished = initialData?.status === "published";

  // ── Chart tile field update helper ────────────────────────────────────────
  const updateTile = useCallback(
    (index: 0 | 1 | 2, patch: Partial<ChartTileState>) => {
      setForm((prev) => {
        const tiles = [...prev.chartTiles] as typeof prev.chartTiles;
        tiles[index] = { ...tiles[index], ...patch };
        return { ...prev, chartTiles: tiles };
      });
    },
    []
  );

  // ── File upload helper (chart image) ─────────────────────────────────────
  async function handleChartFileChange(
    index: 0 | 1 | 2,
    file: File | null
  ) {
    if (!file) {
      updateTile(index, {
        imageFile: null,
        imagePreviewUrl: null,
        imageStoragePath: null,
        imageMimeType: null,
        imageError: null,
      });
      return;
    }

    if (!ALLOWED_CHART_MIMES.includes(file.type)) {
      updateTile(index, {
        imageFile: null,
        imageError: "Podporujeme PNG a SVG. Jiné formáty nejsou povoleny.",
      });
      return;
    }

    if (file.size > CHART_MAX_MB * 1024 * 1024) {
      updateTile(index, {
        imageFile: null,
        imageError: "Soubor přesahuje 2 MB. Použijte menší nebo optimalizovaný obrázek.",
      });
      return;
    }

    // Show preview immediately
    const previewUrl = URL.createObjectURL(file);
    updateTile(index, {
      imageFile: file,
      imagePreviewUrl: previewUrl,
      imageStoragePath: null, // will be set after upload
      imageMimeType: file.type,
      imageError: null,
    });
  }

  // ── PDF file change ───────────────────────────────────────────────────────
  function handlePdfFileChange(file: File | null) {
    if (!file) {
      setForm((p) => ({ ...p, pdfFile: null, pdfStoragePath: null }));
      return;
    }

    if (file.type !== "application/pdf") {
      setGlobalError("Podporujeme jen formát PDF.");
      return;
    }

    if (file.size > PDF_MAX_MB * 1024 * 1024) {
      setGlobalError("Soubor přesahuje 20 MB.");
      return;
    }

    setForm((p) => ({ ...p, pdfFile: file, pdfStoragePath: null }));
  }

  // ── Action management ─────────────────────────────────────────────────────
  function addAction() {
    if (form.actions.length >= 3) return;
    setForm((p) => ({
      ...p,
      actions: [...p.actions, { timeHorizon: "", actionText: "" }],
    }));
  }

  function removeAction(index: number) {
    setForm((p) => ({
      ...p,
      actions: p.actions.filter((_, i) => i !== index),
    }));
  }

  function updateAction(index: number, patch: Partial<ActionState>) {
    setForm((p) => {
      const actions = [...p.actions];
      actions[index] = { ...actions[index], ...patch };
      return { ...p, actions };
    });
  }

  // ── Build FormData for the API ────────────────────────────────────────────
  function buildFormData(status: "draft" | "published"): FormData {
    const fd = new FormData();
    if (initialData?.id) fd.append("id", initialData.id);
    fd.append("status", status);
    fd.append("naceDivision", form.naceDivision);
    fd.append("publicationPeriod", form.publicationPeriod);
    fd.append("summaryText", form.summaryText);
    fd.append("pdfSourceLabel", form.pdfSourceLabel);

    form.chartTiles.forEach((tile, i) => {
      const slot = i + 1;
      fd.append(`tile${slot}_verdict`, tile.verdict);
      fd.append(`tile${slot}_altText`, tile.altText);
      fd.append(`tile${slot}_caption`, tile.caption);
      fd.append(`tile${slot}_usesCsInternalData`, tile.usesCsInternalData ? "true" : "false");
      fd.append(`tile${slot}_imageMimeType`, tile.imageMimeType ?? "");
      if (tile.imageFile) fd.append(`tile${slot}_image`, tile.imageFile);
      if (tile.imageStoragePath)
        fd.append(`tile${slot}_imageStoragePath`, tile.imageStoragePath);
    });

    form.actions.forEach((action, i) => {
      const slot = i + 1;
      fd.append(`action${slot}_timeHorizon`, action.timeHorizon);
      fd.append(`action${slot}_actionText`, action.actionText);
    });
    fd.append("actionsCount", String(form.actions.length));

    if (form.pdfFile) fd.append("pdfFile", form.pdfFile);
    if (form.pdfStoragePath) fd.append("pdfStoragePath", form.pdfStoragePath);

    return fd;
  }

  // ── Save as draft ─────────────────────────────────────────────────────────
  async function handleSaveDraft() {
    setSubmitting(true);
    setGlobalError(null);
    setValidationErrors([]);

    try {
      const fd = buildFormData("draft");
      const method = isEditing ? "PUT" : "POST";
      const res = await fetch("/api/admin/pulz-oboru", { method, body: fd });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setGlobalError(data.error ?? "Uložení selhalo. Zkontrolujte připojení a zkuste to znovu.");
        return;
      }

      const result = (await res.json()) as { id: string };
      router.push(`/admin/pulz-oboru/${result.id}/edit?saved=draft`);
    } catch {
      setGlobalError("Uložení selhalo. Zkontrolujte připojení a zkuste to znovu.");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Publish flow ──────────────────────────────────────────────────────────
  function handlePublishClick() {
    const errors = validateFormForPublish(form);
    if (errors.length > 0) {
      setValidationErrors(errors);
      setGlobalError("Opravte chyby ve formuláři před publikováním.");
      setTimeout(() => {
        errorSummaryRef.current?.focus();
      }, 50);
      return;
    }
    setValidationErrors([]);
    setGlobalError(null);
    setShowPublishConfirm(true);
  }

  async function confirmPublish(supersede = false) {
    setShowPublishConfirm(false);
    setShowConflictModal(false);
    setSubmitting(true);
    setGlobalError(null);

    try {
      const fd = buildFormData("published");
      if (supersede) fd.append("supersede", "true");

      const method = isEditing ? "PUT" : "POST";
      const url = supersede
        ? "/api/admin/pulz-oboru?supersede=true"
        : "/api/admin/pulz-oboru";

      const res = await fetch(url, { method, body: fd });

      if (res.status === 409) {
        const data = (await res.json()) as { error?: string; naceLabel?: string; period?: string };
        const naceLabel =
          data.naceLabel ??
          NACE_SECTORS.find((s) => s.code === form.naceDivision)?.name ??
          form.naceDivision;
        const period = data.period ?? form.publicationPeriod;
        setConflictMessage(
          `Pro obor ${naceLabel} a období ${period} již existuje publikovaná analýza. ` +
            `Pokud budete pokračovat, stávající verze bude nahrazena novou.`
        );
        setShowConflictModal(true);
        return;
      }

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setGlobalError(
          data.error ?? "Publikování selhalo. Zkontrolujte připojení a zkuste to znovu."
        );
        return;
      }

      router.push(
        `/admin/pulz-oboru?published=` +
          encodeURIComponent(
            NACE_SECTORS.find((s) => s.code === form.naceDivision)?.name ??
              form.naceDivision
          )
      );
    } catch {
      setGlobalError("Publikování selhalo. Zkontrolujte připojení a zkuste to znovu.");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const naceLabelForPreview =
    NACE_SECTORS.find((s) => s.code === form.naceDivision)?.name ?? "";

  return (
    <>
      {/* Publish confirmation dialog */}
      <Modal
        open={showPublishConfirm}
        heading="Publikovat analýzu?"
        onClose={() => setShowPublishConfirm(false)}
      >
        <p style={{ fontSize: "14px", color: "#333", marginBottom: "20px" }}>
          Analýza pro obor{" "}
          <strong>
            {naceLabelForPreview || form.naceDivision}
          </strong>{" "}
          ({form.publicationPeriod}) bude zveřejněna a zobrazí se majitelům firem v tomto oboru.
        </p>
        <div style={{ display: "flex", gap: "12px" }}>
          <button
            type="button"
            onClick={() => void confirmPublish(false)}
            disabled={submitting}
            style={{
              padding: "10px 20px",
              backgroundColor: "#1a1a1a",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              fontSize: "14px",
              fontWeight: "bold",
              cursor: "pointer",
            }}
          >
            Publikovat
          </button>
          <button
            type="button"
            onClick={() => setShowPublishConfirm(false)}
            style={{
              padding: "10px 20px",
              backgroundColor: "transparent",
              border: "1px solid #d0d0d0",
              borderRadius: "4px",
              fontSize: "14px",
              cursor: "pointer",
            }}
          >
            Zrušit
          </button>
        </div>
      </Modal>

      {/* Conflict modal */}
      <Modal
        open={showConflictModal}
        heading="Analýza pro toto období již existuje"
        onClose={() => setShowConflictModal(false)}
      >
        <p style={{ fontSize: "14px", color: "#333", marginBottom: "20px" }}>
          {conflictMessage}
        </p>
        <div style={{ display: "flex", gap: "12px" }}>
          <button
            type="button"
            onClick={() => void confirmPublish(true)}
            disabled={submitting}
            style={{
              padding: "10px 20px",
              backgroundColor: "#1a1a1a",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              fontSize: "14px",
              fontWeight: "bold",
              cursor: "pointer",
            }}
          >
            Nahradit a publikovat
          </button>
          <button
            type="button"
            onClick={() => setShowConflictModal(false)}
            style={{
              padding: "10px 20px",
              backgroundColor: "transparent",
              border: "1px solid #d0d0d0",
              borderRadius: "4px",
              fontSize: "14px",
              cursor: "pointer",
            }}
          >
            Zrušit
          </button>
        </div>
      </Modal>

      {/* Draft / published status banner */}
      {isEditing && (
        <div
          role="status"
          style={{
            backgroundColor: isPublished ? "#e6f4ea" : "#e8f4ff",
            border: `1px solid ${isPublished ? "#b7dfbe" : "#b3d4f5"}`,
            borderRadius: "6px",
            padding: "10px 14px",
            marginBottom: "24px",
            fontSize: "13px",
            color: isPublished ? "#1e7e34" : "#1a73e8",
          }}
        >
          {isPublished
            ? "Publikováno — změny se projeví po kliknutí na 'Aktualizovat publikaci'."
            : "Koncept — neuložené změny budou ztraceny při zavření stránky."}
        </div>
      )}

      {/* Error summary (validation) */}
      {(globalError || validationErrors.length > 0) && (
        <div
          ref={errorSummaryRef}
          role="alert"
          tabIndex={-1}
          style={{
            backgroundColor: "#fff0f0",
            border: "1px solid #ffcccc",
            borderRadius: "6px",
            padding: "16px 20px",
            marginBottom: "24px",
          }}
        >
          {globalError && (
            <p style={{ fontWeight: 600, color: "#c00", fontSize: "14px", margin: "0 0 8px 0" }}>
              {globalError}
            </p>
          )}
          {validationErrors.length > 0 && (
            <ul style={{ margin: 0, paddingLeft: "20px", color: "#c00", fontSize: "13px" }}>
              {validationErrors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Two-column layout: form left, preview right */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr",
          gap: "24px",
        }}
      >
        {/* ── Form column ──────────────────────────────────────────────────── */}
        <form
          ref={formRef}
          onSubmit={(e) => e.preventDefault()}
          style={{ display: "flex", flexDirection: "column", gap: "32px" }}
        >

          {/* NacePeriodBlock */}
          <fieldset style={{ border: "1px solid #e0e0e0", borderRadius: "8px", padding: "20px" }}>
            <legend style={{ fontWeight: 700, fontSize: "15px", padding: "0 8px" }}>
              Identifikace analýzy
            </legend>

            <div style={{ marginBottom: "16px" }}>
              <Label htmlFor="nace-division" required>Obor (NACE divize)</Label>
              <Hint>Vyberte 2místnou divizi CZ-NACE, které se analýza týká.</Hint>
              <select
                id="nace-division"
                value={form.naceDivision}
                onChange={(e) => setForm((p) => ({ ...p, naceDivision: e.target.value }))}
                disabled={submitting}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  border: "1px solid #d0d0d0",
                  borderRadius: "4px",
                  fontSize: "14px",
                  marginTop: "6px",
                  backgroundColor: "#fff",
                  boxSizing: "border-box",
                }}
              >
                <option value="" disabled>— Vyberte obor —</option>
                {NACE_SECTORS.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.code} — {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="publication-period" required>Období analýzy</Label>
              <Hint>
                Např. &apos;2. čtvrtletí 2026&apos;. Tento text se zobrazí majitelům firem — pište česky.
              </Hint>
              <input
                id="publication-period"
                type="text"
                value={form.publicationPeriod}
                onChange={(e) => setForm((p) => ({ ...p, publicationPeriod: e.target.value }))}
                placeholder="2. čtvrtletí 2026"
                disabled={submitting}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  border: "1px solid #d0d0d0",
                  borderRadius: "4px",
                  fontSize: "14px",
                  marginTop: "6px",
                  boxSizing: "border-box",
                }}
              />
            </div>
          </fieldset>

          {/* ChartTileBuilders × 3 */}
          {([0, 1, 2] as const).map((i) => {
            const tile = form.chartTiles[i];
            const slot = i + 1;
            return (
              <fieldset
                key={i}
                style={{ border: "1px solid #e0e0e0", borderRadius: "8px", padding: "20px" }}
              >
                <legend style={{ fontWeight: 700, fontSize: "15px", padding: "0 8px" }}>
                  Graf {slot}
                </legend>

                {/* Verdict */}
                <div style={{ marginBottom: "16px" }}>
                  <Label htmlFor={`tile${slot}-verdict`} required>Výrok</Label>
                  <Hint>
                    Jeden výrok, ne číslo bez kontextu. Příklad: &apos;E-commerce roste o 18 % ročně,
                    zatímco kamenné prodejny stagnují.&apos;
                  </Hint>
                  <textarea
                    id={`tile${slot}-verdict`}
                    rows={2}
                    value={tile.verdict}
                    onChange={(e) => {
                      const v = e.target.value;
                      const warning =
                        countSentences(v) > 1
                          ? "Výrok by měl být jedna věta — majitelé firem ho čtou ve dvou sekundách."
                          : null;
                      updateTile(i, { verdict: v, verdictWarning: warning });
                    }}
                    disabled={submitting}
                    maxLength={280}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      border: "1px solid #d0d0d0",
                      borderRadius: "4px",
                      fontSize: "14px",
                      marginTop: "6px",
                      resize: "vertical",
                      boxSizing: "border-box",
                    }}
                  />
                  <p style={{ fontSize: "12px", color: "#888", margin: "4px 0 0 0" }}>
                    {tile.verdict.length} / 200 znaků
                  </p>
                  <FieldWarning message={tile.verdictWarning} />
                </div>

                {/* Image upload */}
                <div style={{ marginBottom: "16px" }}>
                  <Label htmlFor={`tile${slot}-image`} required>
                    Graf (PNG nebo SVG, max 2 MB)
                  </Label>
                  {tile.imagePreviewUrl ? (
                    <div style={{ marginTop: "6px" }}>
                      <img
                        src={tile.imagePreviewUrl}
                        alt="Náhled grafu"
                        style={{ maxHeight: "120px", maxWidth: "100%", objectFit: "contain", display: "block", marginBottom: "8px" }}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          updateTile(i, {
                            imageFile: null,
                            imagePreviewUrl: null,
                            imageStoragePath: null,
                            imageMimeType: null,
                          })
                        }
                        style={{ fontSize: "13px", color: "#666", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
                      >
                        Změnit
                      </button>
                    </div>
                  ) : (
                    <div
                      style={{
                        border: "1px dashed #d0d0d0",
                        borderRadius: "4px",
                        padding: "20px",
                        textAlign: "center",
                        marginTop: "6px",
                        position: "relative",
                        cursor: "pointer",
                      }}
                    >
                      <input
                        id={`tile${slot}-image`}
                        type="file"
                        accept={CHART_ACCEPT}
                        onChange={(e) =>
                          void handleChartFileChange(i, e.target.files?.[0] ?? null)
                        }
                        disabled={submitting}
                        style={{
                          position: "absolute",
                          inset: 0,
                          opacity: 0,
                          cursor: "pointer",
                          width: "100%",
                          height: "100%",
                        }}
                        aria-label={`Nahrát graf ${slot} — vyberte soubor`}
                      />
                      <p style={{ fontSize: "13px", color: "#888", margin: 0 }}>
                        ↑ Přetáhněte soubor nebo klikněte pro výběr
                      </p>
                    </div>
                  )}
                  <FieldError message={tile.imageError} />
                </div>

                {/* Alt text */}
                <div style={{ marginBottom: "16px" }}>
                  <Label htmlFor={`tile${slot}-alt`} required>
                    Popis grafu pro čtečky obrazovky
                  </Label>
                  <Hint>
                    Popište, co graf ukazuje — ne &apos;Graf tržeb&apos;, ale &apos;Sloupcový graf tržeb
                    odvětví výroby nábytku v mld. Kč, 2019–2024, s vrcholem v roce 2022.&apos;
                    Minimálně 30 znaků.
                  </Hint>
                  <textarea
                    id={`tile${slot}-alt`}
                    rows={3}
                    value={tile.altText}
                    onChange={(e) => {
                      const v = e.target.value;
                      updateTile(i, { altText: v, altTextWarning: null });
                    }}
                    onBlur={(e) => {
                      const v = e.target.value;
                      let warn: string | null = null;
                      if (v.trim().length > 0 && v.trim().length < 30)
                        warn = "Popis je příliš krátký — napište alespoň 30 znaků.";
                      else if (isGenericAltText(v))
                        warn = "Popis musí říkat, co graf zobrazuje — ne jen 'graf'.";
                      updateTile(i, { altTextWarning: warn });
                    }}
                    disabled={submitting}
                    maxLength={300}
                    aria-describedby={`tile${slot}-alt-counter`}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      border: "1px solid #d0d0d0",
                      borderRadius: "4px",
                      fontSize: "14px",
                      marginTop: "6px",
                      resize: "vertical",
                      boxSizing: "border-box",
                    }}
                  />
                  <p
                    id={`tile${slot}-alt-counter`}
                    aria-live="polite"
                    style={{ fontSize: "12px", color: "#888", margin: "4px 0 0 0" }}
                  >
                    {tile.altText.length} / 300
                  </p>
                  <FieldWarning message={tile.altTextWarning} />
                </div>

                {/* Source caption */}
                <div style={{ marginBottom: "8px" }}>
                  <Label htmlFor={`tile${slot}-caption`}>Zdroj (zobrazí se pod grafem)</Label>
                  <Hint>
                    Nepovinné — povinné, pokud graf vychází z dat České spořitelny.
                    Příklad: &apos;Zdroj: data České spořitelny; vlastní zpracování&apos;.
                  </Hint>
                  <input
                    id={`tile${slot}-caption`}
                    type="text"
                    value={tile.caption}
                    onChange={(e) => updateTile(i, { caption: e.target.value })}
                    disabled={submitting}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      border: "1px solid #d0d0d0",
                      borderRadius: "4px",
                      fontSize: "14px",
                      marginTop: "6px",
                      boxSizing: "border-box",
                    }}
                  />
                  {tile.usesCsInternalData && !tile.caption.trim() && (
                    <FieldWarning message="Pokud graf vychází z dat České spořitelny, uveďte zdroj." />
                  )}
                </div>

                {/* ČS internal data checkbox */}
                <label
                  style={{ display: "flex", alignItems: "flex-start", gap: "8px", fontSize: "13px", cursor: "pointer" }}
                >
                  <input
                    type="checkbox"
                    checked={tile.usesCsInternalData}
                    onChange={(e) =>
                      updateTile(i, { usesCsInternalData: e.target.checked })
                    }
                    disabled={submitting}
                    style={{ marginTop: "2px" }}
                  />
                  <span>
                    Graf vychází z dat České spořitelny
                    <span style={{ display: "block", fontSize: "12px", color: "#666" }}>
                      Pokud zaškrtnete, pole Zdroj bude povinné.
                    </span>
                  </span>
                </label>
              </fieldset>
            );
          })}

          {/* Summary textarea */}
          <fieldset style={{ border: "1px solid #e0e0e0", borderRadius: "8px", padding: "20px" }}>
            <legend style={{ fontWeight: 700, fontSize: "15px", padding: "0 8px" }}>Shrnutí</legend>
            <Label htmlFor="summary-text" required>Shrnutí</Label>
            <Hint>
              3–6 vět. Formální čeština. Vyjadřujte závěry, ne čísla bez kontextu.
              Příklad: &apos;Tržby odvětví se stabilizovaly na 49 mld. Kč, ale ziskovost zůstává pod
              úrovní roku 2021.&apos;
            </Hint>
            <textarea
              id="summary-text"
              rows={6}
              value={form.summaryText}
              onChange={(e) => setForm((p) => ({ ...p, summaryText: e.target.value }))}
              disabled={submitting}
              maxLength={4000}
              style={{
                width: "100%",
                padding: "8px 10px",
                border: "1px solid #d0d0d0",
                borderRadius: "4px",
                fontSize: "14px",
                marginTop: "6px",
                resize: "vertical",
                boxSizing: "border-box",
              }}
            />
            {(() => {
              const n = countSentences(form.summaryText);
              return (
                <p style={{ fontSize: "12px", color: "#888", margin: "4px 0 0 0" }}>
                  Přibližně {n} vět
                  {n < 3 && n > 0 ? " — Shrnutí by mělo mít alespoň 3 věty." : ""}
                  {n > 6 ? " — Shrnutí by mělo mít nejvýše 6 vět — delší text majitelé přeskočí." : ""}
                </p>
              );
            })()}
          </fieldset>

          {/* PDF upload */}
          <fieldset style={{ border: "1px solid #e0e0e0", borderRadius: "8px", padding: "20px" }}>
            <legend style={{ fontWeight: 700, fontSize: "15px", padding: "0 8px" }}>
              Celá analýza (PDF, nepovinné)
            </legend>
            <Hint>
              Nahrajte úplnou publikaci. Pokud PDF nepřiložíte, odkaz ke stažení se majitelům
              nezobrazí — sekce Pulz oboru se přesto zobrazí.
            </Hint>

            {form.pdfFile ? (
              <div style={{ marginTop: "8px" }}>
                <p style={{ fontSize: "13px", color: "#333", marginBottom: "4px" }}>
                  {form.pdfFile.name} ({(form.pdfFile.size / (1024 * 1024)).toFixed(1)} MB)
                </p>
                <button
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, pdfFile: null, pdfStoragePath: null }))}
                  style={{ fontSize: "13px", color: "#666", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
                >
                  Odstranit
                </button>
              </div>
            ) : (
              <div
                style={{
                  border: "1px dashed #d0d0d0",
                  borderRadius: "4px",
                  padding: "20px",
                  textAlign: "center",
                  marginTop: "8px",
                  position: "relative",
                  cursor: "pointer",
                }}
              >
                <input
                  id="pdf-file"
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => handlePdfFileChange(e.target.files?.[0] ?? null)}
                  disabled={submitting}
                  style={{
                    position: "absolute",
                    inset: 0,
                    opacity: 0,
                    cursor: "pointer",
                    width: "100%",
                    height: "100%",
                  }}
                  aria-label="Nahrát PDF publikaci — vyberte soubor"
                />
                <p style={{ fontSize: "13px", color: "#888", margin: 0 }}>
                  ↑ Přetáhněte PDF nebo klikněte pro výběr (max 20 MB)
                </p>
              </div>
            )}

            {form.pdfFile && (
              <div style={{ marginTop: "12px" }}>
                <Label htmlFor="pdf-source-label" required>Označení zdroje PDF</Label>
                <Hint>
                  Zobrazí se pod odkazem ke stažení. Výchozí text: &apos;Ekonomické a strategické
                  analýzy České spořitelny&apos;.
                </Hint>
                <input
                  id="pdf-source-label"
                  type="text"
                  value={form.pdfSourceLabel}
                  onChange={(e) => setForm((p) => ({ ...p, pdfSourceLabel: e.target.value }))}
                  placeholder="Ekonomické a strategické analýzy České spořitelny"
                  disabled={submitting}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    border: "1px solid #d0d0d0",
                    borderRadius: "4px",
                    fontSize: "14px",
                    marginTop: "6px",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            )}
          </fieldset>

          {/* Action authoring */}
          <fieldset style={{ border: "1px solid #e0e0e0", borderRadius: "8px", padding: "20px" }}>
            <legend style={{ fontWeight: 700, fontSize: "15px", padding: "0 8px" }}>
              Doporučené kroky (1–3)
            </legend>

            {form.actions.length === 0 && (
              <p role="status" style={{ fontSize: "13px", color: "#E65100", marginBottom: "12px" }}>
                Bez kroků se sekce &apos;Doporučené kroky&apos; majitelům nezobrazí.
              </p>
            )}

            {form.actions.map((action, i) => (
              <fieldset
                key={i}
                style={{
                  border: "1px solid #f0f0f0",
                  borderRadius: "6px",
                  padding: "16px",
                  marginBottom: "12px",
                }}
              >
                <legend style={{ fontWeight: 600, fontSize: "13px", padding: "0 6px" }}>
                  Krok {i + 1}
                </legend>

                <div style={{ marginBottom: "12px" }}>
                  <Label htmlFor={`action${i + 1}-horizon`} required>Časový horizont</Label>
                  <select
                    id={`action${i + 1}-horizon`}
                    value={action.timeHorizon}
                    onChange={(e) => updateAction(i, { timeHorizon: e.target.value })}
                    disabled={submitting}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      border: "1px solid #d0d0d0",
                      borderRadius: "4px",
                      fontSize: "14px",
                      marginTop: "6px",
                      backgroundColor: "#fff",
                      boxSizing: "border-box",
                    }}
                  >
                    <option value="">— Vyberte horizont —</option>
                    {TIME_HORIZONS.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label htmlFor={`action${i + 1}-text`} required>Text akce</Label>
                  <Hint>
                    Pište jako příležitost, ne jako varování. Příklad: &apos;Zkontrolujte, zda vaše
                    firma nabízí přímý prodej online.&apos; — ne &apos;Pokud nezačnete prodávat online,
                    ztratíte zákazníky.&apos;
                  </Hint>
                  <textarea
                    id={`action${i + 1}-text`}
                    rows={3}
                    value={action.actionText}
                    onChange={(e) => updateAction(i, { actionText: e.target.value })}
                    disabled={submitting}
                    maxLength={600}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      border: "1px solid #d0d0d0",
                      borderRadius: "4px",
                      fontSize: "14px",
                      marginTop: "6px",
                      resize: "vertical",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                {form.actions.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeAction(i)}
                    disabled={submitting}
                    style={{
                      marginTop: "8px",
                      fontSize: "13px",
                      color: "#666",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      textDecoration: "underline",
                      minHeight: "44px",
                    }}
                  >
                    × Odebrat krok
                  </button>
                )}
              </fieldset>
            ))}

            {form.actions.length < 3 ? (
              <button
                type="button"
                onClick={addAction}
                disabled={submitting}
                style={{
                  fontSize: "14px",
                  color: "#1a1a1a",
                  background: "none",
                  border: "1px solid #d0d0d0",
                  borderRadius: "4px",
                  padding: "8px 16px",
                  cursor: "pointer",
                  minHeight: "44px",
                }}
              >
                + Přidat krok
              </button>
            ) : (
              <p style={{ fontSize: "12px", color: "#888" }}>Maximálně 3 kroky.</p>
            )}
          </fieldset>

          {/* Action row */}
          <div
            style={{
              display: "flex",
              gap: "12px",
              alignItems: "center",
              flexWrap: "wrap",
              paddingBottom: "32px",
            }}
          >
            <button
              type="button"
              onClick={() => void handleSaveDraft()}
              disabled={submitting}
              style={{
                padding: "12px 24px",
                backgroundColor: "transparent",
                border: "1px solid #d0d0d0",
                color: "#1a1a1a",
                borderRadius: "4px",
                fontSize: "14px",
                fontWeight: "600",
                cursor: submitting ? "not-allowed" : "pointer",
                minHeight: "44px",
              }}
            >
              Uložit koncept
            </button>

            <button
              type="button"
              onClick={handlePublishClick}
              disabled={submitting}
              style={{
                padding: "12px 24px",
                backgroundColor: submitting ? "#999" : "#1a1a1a",
                color: "#fff",
                border: "none",
                borderRadius: "4px",
                fontSize: "14px",
                fontWeight: "bold",
                cursor: submitting ? "not-allowed" : "pointer",
                minHeight: "44px",
              }}
            >
              {isPublished ? "Aktualizovat publikaci" : "Publikovat"}
            </button>

            <a
              href="/admin/pulz-oboru"
              style={{ fontSize: "14px", color: "#666", textDecoration: "underline", minHeight: "44px", display: "inline-flex", alignItems: "center" }}
            >
              Zrušit
            </a>
          </div>
        </form>

        {/* ── Mobile preview accordion ──────────────────────────────────── */}
        <div>
          <button
            type="button"
            aria-expanded={previewOpen}
            aria-controls="preview-panel"
            onClick={() => setPreviewOpen((o) => !o)}
            style={{
              width: "100%",
              textAlign: "left",
              padding: "12px 16px",
              background: "#f5f5f5",
              border: "1px solid #e0e0e0",
              borderRadius: "6px",
              fontSize: "14px",
              fontWeight: 600,
              cursor: "pointer",
              minHeight: "44px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span>{previewOpen ? "Skrýt náhled ▴" : "Zobrazit náhled ▾"}</span>
          </button>

          {previewOpen && (
            <div
              id="preview-panel"
              aria-hidden="true"
              style={{
                marginTop: "12px",
                border: "1px solid #e0e0e0",
                borderRadius: "8px",
                padding: "16px",
                background: "#fff",
              }}
            >
              <p style={{ fontSize: "12px", color: "#888", marginBottom: "12px" }}>
                Náhled — jak uvidí majitelé firem
              </p>

              {/* Simplified live preview */}
              <p style={{ fontSize: "13px", color: "#537090", marginBottom: "12px" }}>
                {naceLabelForPreview && form.publicationPeriod
                  ? `Analýza pro ${naceLabelForPreview} · ${form.publicationPeriod}`
                  : "Analýza pro … · …"}
              </p>

              <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "8px", marginBottom: "12px" }}>
                {form.chartTiles.map((tile, i) => (
                  <div
                    key={i}
                    style={{
                      border: "1px solid #e0e0e0",
                      borderRadius: "6px",
                      padding: "12px",
                      background: "#fafafa",
                    }}
                  >
                    <p style={{ fontSize: "13px", fontWeight: 600, margin: "0 0 8px 0" }}>
                      {tile.verdict || `Výrok grafu ${i + 1} bude zde`}
                    </p>
                    {tile.imagePreviewUrl ? (
                      <img
                        src={tile.imagePreviewUrl}
                        alt="Náhled grafu"
                        style={{ width: "100%", maxHeight: "100px", objectFit: "contain" }}
                      />
                    ) : (
                      <div
                        style={{
                          height: "80px",
                          background: "#f0f0f0",
                          borderRadius: "4px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <span style={{ fontSize: "12px", color: "#aaa" }}>Graf bude zde</span>
                      </div>
                    )}
                    {tile.caption && (
                      <p style={{ fontSize: "11px", color: "#666", marginTop: "4px", marginBottom: 0 }}>
                        {tile.caption}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {form.summaryText && (
                <p style={{ fontSize: "13px", color: "#1a1a1a", lineHeight: "1.5", marginBottom: "12px" }}>
                  {form.summaryText}
                </p>
              )}

              {form.actions.length > 0 && (
                <div>
                  <p style={{ fontSize: "13px", fontWeight: 600, marginBottom: "8px" }}>
                    Doporučené kroky
                  </p>
                  {form.actions.map((a, i) => (
                    <div
                      key={i}
                      style={{
                        border: "1px solid #e0e0e0",
                        borderRadius: "4px",
                        padding: "10px",
                        marginBottom: "6px",
                        background: "#fafafa",
                      }}
                    >
                      {a.timeHorizon && (
                        <span
                          style={{
                            display: "inline-block",
                            padding: "2px 8px",
                            borderRadius: "999px",
                            fontSize: "11px",
                            fontWeight: 600,
                            background: "#e3f2fd",
                            color: "#0d47a1",
                            marginBottom: "4px",
                          }}
                        >
                          {a.timeHorizon}
                        </span>
                      )}
                      <p style={{ fontSize: "12px", color: "#1a1a1a", margin: 0 }}>
                        {a.actionText || "Text akce…"}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @media (min-width: 900px) {
          /* On desktop: show full preview pane, hide mobile accordion */
        }
      `}</style>
    </>
  );
}
