/**
 * /admin/briefs/[id]/edit — Full brief editor
 *
 * Six structured sections per design/monthly-briefing-generation.md §4.2:
 *   1. Záhlaví (Brief header — title + publication month)
 *   2. Úvodní přehled (Opening summary)
 *   3. Pozorování (Observations, 2–4)
 *   4. Srovnávací přehled (Benchmark categories, D-011)
 *   5. Doporučené kroky (Closing actions, 2–4)
 *   6. Zápatí (PDF footer text)
 *
 * Client component — uses auto-save (5s interval), manual save, and
 * publish-gate checklist modal (PublishGateChecklist per design §4.7).
 *
 * Time-horizon enum per D-015 (frozen):
 *   Okamžitě / Do 3 měsíců / Do 12 měsíců / Více než rok
 *
 * Category IDs per D-011:
 *   ziskovost / naklady-produktivita / efektivita-kapitalu / rust-trzni-pozice
 *
 * Czech copy throughout. Formal register.
 */
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { BriefContent, Observation, ClosingAction, BenchmarkCategory, BenchmarkMetric } from "@/lib/briefs";

// ─── Constants ────────────────────────────────────────────────────────────────

const TIME_HORIZONS = [
  { value: "Okamžitě", label: "Okamžitě" },
  { value: "Do 3 měsíců", label: "Do 3 měsíců" },
  { value: "Do 12 měsíců", label: "Do 12 měsíců" },
  { value: "Více než rok", label: "Více než rok" },
] as const;

const D011_CATEGORIES = [
  { id: "ziskovost", label: "Ziskovost" },
  { id: "naklady-produktivita", label: "Náklady a produktivita" },
  { id: "efektivita-kapitalu", label: "Efektivita kapitálu" },
  { id: "rust-trzni-pozice", label: "Růst a tržní pozice" },
] as const;

// Metrics per category (D-011). Fixed set — analyst cannot add or move metrics.
const CATEGORY_METRICS: Record<string, { id: string; label: string }[]> = {
  "ziskovost": [
    { id: "gross_margin", label: "Hrubá marže" },
    { id: "ebitda_margin", label: "EBITDA marže" },
  ],
  "naklady-produktivita": [
    { id: "labor_cost_ratio", label: "Podíl mzdových nákladů" },
    { id: "revenue_per_employee", label: "Tržby na zaměstnance" },
  ],
  "efektivita-kapitalu": [
    { id: "working_capital_cycle", label: "Obratový cyklus" },
    { id: "roce", label: "ROCE" },
  ],
  "rust-trzni-pozice": [
    { id: "revenue_growth", label: "Růst tržeb" },
    { id: "roe", label: "ROE" },
  ],
};

const CHECKLIST_VERSION = "v1.0-2026-04";
const CHECKLIST_ITEMS = [
  "Každé pozorování končí verdiktem, ne holým číslem.",
  "Každý doporučený krok obsahuje konkrétní sloveso, kontext a časový horizont.",
  "V textech určených čtenáři přehledu se nevyskytuje statistická notace (σ, p-hodnota, percentil ve tvaru \u201Ep=\u201C).",
];

// ─── Helper — empty observation ───────────────────────────────────────────────

function emptyObservation(): Observation {
  return { headline: "", body: "", time_horizon: "", is_email_teaser: false };
}

function emptyAction(): ClosingAction {
  return { action_text: "", time_horizon: "", category: "" };
}

function emptyCategories(): BenchmarkCategory[] {
  return D011_CATEGORIES.map((cat) => ({
    category_id: cat.id,
    category_label: cat.label,
    metrics: CATEGORY_METRICS[cat.id].map((m) => ({
      metric_id: m.id,
      metric_label: m.label,
      quartile_label: null,
      percentile: null,
      verdict_text: null,
      confidence_state: "valid" as const,
      rung_footnote: null,
      is_email_teaser_snippet: false,
    })),
  }));
}

// ─── Inline error component ───────────────────────────────────────────────────

function FieldError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <span
      role="alert"
      style={{ display: "block", color: "#c00", fontSize: "12px", marginTop: "4px" }}
    >
      {message}
    </span>
  );
}

// ─── ObservationAuthoringCard ─────────────────────────────────────────────────

interface ObsCardProps {
  index: number;
  obs: Observation;
  totalCount: number;
  emailTeaserIndex: number | null;
  onUpdate: (idx: number, fields: Partial<Observation>) => void;
  onSetEmailTeaser: (idx: number) => void;
  onRemove: (idx: number) => void;
  showErrors: boolean;
}

function ObservationCard({
  index,
  obs,
  totalCount,
  emailTeaserIndex,
  onUpdate,
  onSetEmailTeaser,
  onRemove,
  showErrors,
}: ObsCardProps) {
  const isTeaser = emailTeaserIndex === index;

  return (
    <div
      style={{
        border: `1px solid ${isTeaser ? "#1a1a1a" : "#e0e0e0"}`,
        borderRadius: "6px",
        padding: "16px",
        marginBottom: "12px",
        backgroundColor: isTeaser ? "#f8f8f8" : "#fff",
        position: "relative",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "12px",
        }}
      >
        <span style={{ fontWeight: "600", fontSize: "14px" }}>
          Pozorování {index + 1}
          {isTeaser && (
            <span
              style={{
                marginLeft: "8px",
                backgroundColor: "#1a1a1a",
                color: "#fff",
                fontSize: "11px",
                padding: "2px 6px",
                borderRadius: "10px",
                fontWeight: "600",
              }}
            >
              E-mail teaser
            </span>
          )}
        </span>
        {totalCount > 2 && (
          <button
            type="button"
            onClick={() => onRemove(index)}
            aria-label={`Odebrat pozorování ${index + 1}`}
            style={{
              background: "none",
              border: "none",
              color: "#999",
              fontSize: "13px",
              cursor: "pointer",
              textDecoration: "underline",
            }}
          >
            Odebrat
          </button>
        )}
      </div>

      {/* Headline */}
      <div style={{ marginBottom: "10px" }}>
        <label
          htmlFor={`obs-headline-${index}`}
          style={{ display: "block", fontSize: "13px", fontWeight: "500", marginBottom: "4px" }}
        >
          Nadpis pozorování
        </label>
        <input
          id={`obs-headline-${index}`}
          type="text"
          value={obs.headline}
          onChange={(e) => onUpdate(index, { headline: e.target.value })}
          style={{
            width: "100%",
            padding: "8px 10px",
            border: `1px solid ${showErrors && !obs.headline ? "#c00" : "#d0d0d0"}`,
            borderRadius: "4px",
            fontSize: "14px",
            boxSizing: "border-box",
          }}
          aria-describedby={showErrors && !obs.headline ? `obs-headline-err-${index}` : undefined}
        />
        {showErrors && !obs.headline && (
          <FieldError message="Nadpis pozorování je povinný." />
        )}
      </div>

      {/* Body */}
      <div style={{ marginBottom: "10px" }}>
        <label
          htmlFor={`obs-body-${index}`}
          style={{ display: "block", fontSize: "13px", fontWeight: "500", marginBottom: "4px" }}
        >
          Doplňující text
        </label>
        <textarea
          id={`obs-body-${index}`}
          value={obs.body}
          onChange={(e) => onUpdate(index, { body: e.target.value })}
          rows={3}
          style={{
            width: "100%",
            padding: "8px 10px",
            border: "1px solid #d0d0d0",
            borderRadius: "4px",
            fontSize: "14px",
            boxSizing: "border-box",
            resize: "vertical",
          }}
        />
      </div>

      {/* Time horizon */}
      <div style={{ marginBottom: "10px" }}>
        <label
          htmlFor={`obs-horizon-${index}`}
          style={{ display: "block", fontSize: "13px", fontWeight: "500", marginBottom: "4px" }}
        >
          Časový horizont
        </label>
        <select
          id={`obs-horizon-${index}`}
          value={obs.time_horizon}
          onChange={(e) => onUpdate(index, { time_horizon: e.target.value })}
          style={{
            width: "100%",
            padding: "8px 10px",
            border: `1px solid ${showErrors && !obs.time_horizon ? "#c00" : "#d0d0d0"}`,
            borderRadius: "4px",
            fontSize: "14px",
            boxSizing: "border-box",
            backgroundColor: "#fff",
          }}
          aria-describedby={showErrors && !obs.time_horizon ? `obs-horizon-err-${index}` : undefined}
        >
          <option value="">— Vyberte —</option>
          {TIME_HORIZONS.map((h) => (
            <option key={h.value} value={h.value}>
              {h.label}
            </option>
          ))}
        </select>
        {showErrors && !obs.time_horizon && (
          <FieldError message="Zvolte časový horizont tohoto pozorování." />
        )}
      </div>

      {/* Email teaser radio */}
      <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
        <legend style={{ fontSize: "13px", fontWeight: "500", marginBottom: "4px" }}>
          E-mail teaser
        </legend>
        <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", cursor: "pointer" }}>
          <input
            type="radio"
            name="email-teaser-obs"
            checked={isTeaser}
            onChange={() => onSetEmailTeaser(index)}
          />
          Označit jako e-mail teaser
        </label>
      </fieldset>
    </div>
  );
}

// ─── ActionAuthoringCard ──────────────────────────────────────────────────────

interface ActionCardProps {
  index: number;
  action: ClosingAction;
  totalCount: number;
  onUpdate: (idx: number, fields: Partial<ClosingAction>) => void;
  onRemove: (idx: number) => void;
  showErrors: boolean;
}

function ActionCard({ index, action, totalCount, onUpdate, onRemove, showErrors }: ActionCardProps) {
  return (
    <div
      style={{
        border: "1px solid #e0e0e0",
        borderRadius: "6px",
        padding: "16px",
        marginBottom: "12px",
        backgroundColor: "#fff",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "12px",
        }}
      >
        <span style={{ fontWeight: "600", fontSize: "14px" }}>
          Doporučený krok {index + 1}
        </span>
        {totalCount > 2 && (
          <button
            type="button"
            onClick={() => onRemove(index)}
            aria-label={`Odebrat doporučený krok ${index + 1}`}
            style={{
              background: "none",
              border: "none",
              color: "#999",
              fontSize: "13px",
              cursor: "pointer",
              textDecoration: "underline",
            }}
          >
            Odebrat
          </button>
        )}
      </div>

      {/* Action text */}
      <div style={{ marginBottom: "10px" }}>
        <label
          htmlFor={`action-text-${index}`}
          style={{ display: "block", fontSize: "13px", fontWeight: "500", marginBottom: "4px" }}
        >
          Text doporučení (sloveso + kontext)
        </label>
        <textarea
          id={`action-text-${index}`}
          value={action.action_text}
          onChange={(e) => onUpdate(index, { action_text: e.target.value })}
          rows={2}
          style={{
            width: "100%",
            padding: "8px 10px",
            border: `1px solid ${showErrors && !action.action_text ? "#c00" : "#d0d0d0"}`,
            borderRadius: "4px",
            fontSize: "14px",
            boxSizing: "border-box",
            resize: "vertical",
          }}
          aria-describedby={showErrors && !action.action_text ? `action-text-err-${index}` : undefined}
        />
        {showErrors && !action.action_text && (
          <FieldError message="Text doporučeného kroku je povinný." />
        )}
      </div>

      {/* Time horizon */}
      <div style={{ marginBottom: "10px" }}>
        <label
          htmlFor={`action-horizon-${index}`}
          style={{ display: "block", fontSize: "13px", fontWeight: "500", marginBottom: "4px" }}
        >
          Časový horizont
        </label>
        <select
          id={`action-horizon-${index}`}
          value={action.time_horizon}
          onChange={(e) => onUpdate(index, { time_horizon: e.target.value })}
          style={{
            width: "100%",
            padding: "8px 10px",
            border: `1px solid ${showErrors && !action.time_horizon ? "#c00" : "#d0d0d0"}`,
            borderRadius: "4px",
            fontSize: "14px",
            boxSizing: "border-box",
            backgroundColor: "#fff",
          }}
        >
          <option value="">— Vyberte —</option>
          {TIME_HORIZONS.map((h) => (
            <option key={h.value} value={h.value}>
              {h.label}
            </option>
          ))}
        </select>
        {showErrors && !action.time_horizon && (
          <FieldError message="Zvolte časový horizont tohoto kroku." />
        )}
      </div>

      {/* Category */}
      <div>
        <label
          htmlFor={`action-cat-${index}`}
          style={{ display: "block", fontSize: "13px", fontWeight: "500", marginBottom: "4px" }}
        >
          Kategorie
        </label>
        <select
          id={`action-cat-${index}`}
          value={action.category}
          onChange={(e) => onUpdate(index, { category: e.target.value })}
          style={{
            width: "100%",
            padding: "8px 10px",
            border: `1px solid ${showErrors && !action.category ? "#c00" : "#d0d0d0"}`,
            borderRadius: "4px",
            fontSize: "14px",
            boxSizing: "border-box",
            backgroundColor: "#fff",
          }}
        >
          <option value="">— Vyberte —</option>
          {D011_CATEGORIES.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.label}
            </option>
          ))}
        </select>
        {showErrors && !action.category && (
          <FieldError message="Zvolte kategorii tohoto doporučeného kroku." />
        )}
      </div>
    </div>
  );
}

// ─── CategoryGroupingControl ──────────────────────────────────────────────────

interface CategoryGroupProps {
  categories: BenchmarkCategory[];
  emailTeaserSnippetId: string | null;
  onUpdate: (
    catIdx: number,
    metricIdx: number,
    fields: Partial<BenchmarkMetric>
  ) => void;
  onSetEmailTeaserSnippet: (metricId: string | null) => void;
  showErrors: boolean;
}

function CategoryGroupingControl({
  categories,
  emailTeaserSnippetId,
  onUpdate,
  onSetEmailTeaserSnippet,
  showErrors,
}: CategoryGroupProps) {
  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({});

  function toggleCat(catId: string) {
    setExpandedCats((prev) => ({ ...prev, [catId]: !prev[catId] }));
  }

  return (
    <div>
      {categories.map((cat, catIdx) => {
        const isExpanded = !!expandedCats[cat.category_id];
        const hasValidMetrics = cat.metrics.some(
          (m) => m.confidence_state === "valid"
        );

        return (
          <div
            key={cat.category_id}
            style={{
              border: "1px solid #e0e0e0",
              borderRadius: "6px",
              marginBottom: "8px",
              overflow: "hidden",
            }}
          >
            {/* Accordion header */}
            <button
              type="button"
              onClick={() => toggleCat(cat.category_id)}
              aria-expanded={isExpanded}
              style={{
                width: "100%",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "12px 16px",
                background: "#f8f8f8",
                border: "none",
                cursor: "pointer",
                textAlign: "left",
                fontSize: "14px",
                fontWeight: "600",
              }}
            >
              <span>{cat.category_label}</span>
              <span style={{ fontSize: "12px", color: "#666" }}>
                {isExpanded ? "▲ Sbalit" : "▼ Rozbalit"}
              </span>
            </button>

            {/* Expanded content */}
            {isExpanded && (
              <div style={{ padding: "16px", backgroundColor: "#fff" }}>
                {cat.metrics.length === 0 && (
                  <p style={{ fontSize: "13px", color: "#666" }}>
                    Žádné ukazatele v této kategorii
                  </p>
                )}

                {/* Email-teaser snippet legend */}
                {hasValidMetrics && (
                  <fieldset style={{ border: "none", padding: 0, margin: "0 0 12px 0" }}>
                    <legend style={{ fontSize: "12px", fontWeight: "600", color: "#555", marginBottom: "4px" }}>
                      E-mail snippet
                    </legend>
                    {cat.metrics.map((m, mIdx) => {
                      if (m.confidence_state !== "valid") return null;
                      return (
                        <label
                          key={m.metric_id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            fontSize: "12px",
                            marginBottom: "4px",
                            cursor: "pointer",
                          }}
                        >
                          <input
                            type="radio"
                            name="email-teaser-snippet"
                            checked={emailTeaserSnippetId === m.metric_id}
                            onChange={() =>
                              onSetEmailTeaserSnippet(
                                emailTeaserSnippetId === m.metric_id ? null : m.metric_id
                              )
                            }
                          />
                          Označit jako e-mail snippet: {m.metric_label}
                        </label>
                      );
                    })}
                  </fieldset>
                )}

                {!hasValidMetrics && (
                  <p style={{ fontSize: "12px", color: "#888", marginBottom: "12px" }}>
                    Žádný ukazatel nemá dostatečnou důvěryhodnost dat pro e-mail snippet.
                    Snippet bude v e-mailu vynechán.
                  </p>
                )}

                {cat.metrics.map((m, mIdx) => (
                  <div
                    key={m.metric_id}
                    style={{
                      padding: "12px",
                      border: "1px solid #f0f0f0",
                      borderRadius: "4px",
                      marginBottom: "8px",
                      backgroundColor: "#fafafa",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        marginBottom: "8px",
                      }}
                    >
                      <div>
                        <span style={{ fontWeight: "600", fontSize: "13px" }}>
                          {m.metric_label}
                        </span>
                        {m.confidence_state !== "valid" && (
                          <span
                            style={{
                              marginLeft: "8px",
                              backgroundColor: "#fff3e0",
                              color: "#e65100",
                              fontSize: "11px",
                              padding: "2px 6px",
                              borderRadius: "10px",
                              fontWeight: "600",
                            }}
                          >
                            Nedostatek firem v kohortě pro tento ukazatel
                          </span>
                        )}
                      </div>
                      <label
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          fontSize: "12px",
                          cursor: "pointer",
                          flexShrink: 0,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={m.verdict_text !== null || m.quartile_label !== null}
                          onChange={(e) => {
                            if (!e.target.checked) {
                              onUpdate(catIdx, mIdx, {
                                quartile_label: null,
                                verdict_text: null,
                                is_email_teaser_snippet: false,
                              });
                              if (emailTeaserSnippetId === m.metric_id) {
                                onSetEmailTeaserSnippet(null);
                              }
                            } else {
                              onUpdate(catIdx, mIdx, {
                                quartile_label: "",
                                verdict_text: "",
                              });
                            }
                          }}
                        />
                        Zahrnout do přehledu
                      </label>
                    </div>

                    {/* Fields when metric is included */}
                    {(m.verdict_text !== null || m.quartile_label !== null) && (
                      <>
                        <div style={{ marginBottom: "8px" }}>
                          <label
                            htmlFor={`metric-quartile-${cat.category_id}-${m.metric_id}`}
                            style={{
                              display: "block",
                              fontSize: "12px",
                              fontWeight: "500",
                              marginBottom: "3px",
                            }}
                          >
                            Kvartilová pozice (např. „druhý kvartil")
                          </label>
                          <input
                            id={`metric-quartile-${cat.category_id}-${m.metric_id}`}
                            type="text"
                            value={m.quartile_label ?? ""}
                            onChange={(e) =>
                              onUpdate(catIdx, mIdx, { quartile_label: e.target.value || null })
                            }
                            style={{
                              width: "100%",
                              padding: "6px 8px",
                              border: `1px solid ${
                                showErrors && m.quartile_label === "" ? "#c00" : "#d0d0d0"
                              }`,
                              borderRadius: "4px",
                              fontSize: "13px",
                              boxSizing: "border-box",
                            }}
                          />
                          {showErrors && m.quartile_label === "" && (
                            <FieldError message="Vyplňte kvartilovou pozici pro tento ukazatel." />
                          )}
                        </div>
                        <div>
                          <label
                            htmlFor={`metric-verdict-${cat.category_id}-${m.metric_id}`}
                            style={{
                              display: "block",
                              fontSize: "12px",
                              fontWeight: "500",
                              marginBottom: "3px",
                            }}
                          >
                            Text verdiktu (jeden srozumitelný závěr)
                          </label>
                          <textarea
                            id={`metric-verdict-${cat.category_id}-${m.metric_id}`}
                            value={m.verdict_text ?? ""}
                            onChange={(e) =>
                              onUpdate(catIdx, mIdx, { verdict_text: e.target.value || null })
                            }
                            rows={2}
                            style={{
                              width: "100%",
                              padding: "6px 8px",
                              border: `1px solid ${
                                showErrors && m.verdict_text === "" ? "#c00" : "#d0d0d0"
                              }`,
                              borderRadius: "4px",
                              fontSize: "13px",
                              boxSizing: "border-box",
                              resize: "vertical",
                            }}
                          />
                          {showErrors && m.verdict_text === "" && (
                            <FieldError message="Vyplňte text verdiktu pro tento ukazatel." />
                          )}
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── PublishGateChecklist modal ───────────────────────────────────────────────

interface ChecklistProps {
  checked: boolean[];
  onToggle: (idx: number) => void;
  onPublish: () => void;
  onBack: () => void;
  publishing: boolean;
  error: string | null;
}

function PublishGateChecklist({
  checked,
  onToggle,
  onPublish,
  onBack,
  publishing,
  error,
}: ChecklistProps) {
  const allChecked = checked.every(Boolean);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Kontrola před publikováním"
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "24px",
      }}
    >
      <div
        style={{
          backgroundColor: "#fff",
          borderRadius: "8px",
          padding: "32px",
          maxWidth: "540px",
          width: "100%",
          boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
        }}
      >
        <h2 style={{ fontSize: "20px", fontWeight: "bold", marginBottom: "12px" }}>
          Kontrola před publikováním
        </h2>
        <p style={{ fontSize: "14px", color: "#555", marginBottom: "24px" }}>
          Před publikováním přehledu potvrďte, že jsou splněny všechny níže
          uvedené podmínky. Vaše potvrzení bude zaznamenáno.
        </p>

        <div style={{ marginBottom: "24px" }}>
          {CHECKLIST_ITEMS.map((item, idx) => (
            <label
              key={idx}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "10px",
                marginBottom: "16px",
                cursor: publishing ? "not-allowed" : "pointer",
                fontSize: "14px",
              }}
            >
              <input
                type="checkbox"
                checked={checked[idx]}
                onChange={() => !publishing && onToggle(idx)}
                disabled={publishing}
                style={{ marginTop: "2px", flexShrink: 0 }}
              />
              <span>{item}</span>
            </label>
          ))}
        </div>

        {error && (
          <div
            role="alert"
            style={{
              backgroundColor: "#fff0f0",
              border: "1px solid #ffcccc",
              borderRadius: "4px",
              padding: "10px 14px",
              color: "#c00",
              fontSize: "14px",
              marginBottom: "16px",
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <button
            type="button"
            onClick={() => { void onPublish(); }}
            disabled={!allChecked || publishing}
            aria-disabled={!allChecked || publishing}
            title={!allChecked ? "Potvrďte všechny body před publikováním." : undefined}
            style={{
              padding: "12px 24px",
              backgroundColor: allChecked && !publishing ? "#1a1a1a" : "#999",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              fontSize: "14px",
              fontWeight: "bold",
              cursor: allChecked && !publishing ? "pointer" : "not-allowed",
            }}
          >
            {publishing ? "Publikuji…" : "Potvrdit a publikovat"}
          </button>
          {!publishing && (
            <button
              type="button"
              onClick={onBack}
              style={{
                background: "none",
                border: "none",
                color: "#666",
                fontSize: "14px",
                cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              Zpět do editoru
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main editor page ─────────────────────────────────────────────────────────

interface BriefEditorPageProps {
  params: { id: string };
}

export default function BriefEditorPage({ params }: BriefEditorPageProps) {
  const router = useRouter();
  const briefId = params.id;

  // ── State ──
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [naceSector, setNaceSector] = useState("");

  // Section 1: Header
  const [title, setTitle] = useState("");
  const [publicationMonth, setPublicationMonth] = useState("");

  // Section 2: Opening summary
  const [openingSummary, setOpeningSummary] = useState("");

  // Section 3: Observations
  const [observations, setObservations] = useState<Observation[]>([
    emptyObservation(),
    emptyObservation(),
  ]);
  const [emailTeaserObsIndex, setEmailTeaserObsIndex] = useState<number | null>(null);

  // Section 4: Benchmark categories
  const [categories, setCategories] = useState<BenchmarkCategory[]>(emptyCategories());
  const [emailTeaserSnippetId, setEmailTeaserSnippetId] = useState<string | null>(null);

  // Section 5: Closing actions
  const [actions, setActions] = useState<ClosingAction[]>([
    emptyAction(),
    emptyAction(),
  ]);

  // Section 6: PDF footer
  const [pdfFooterText, setPdfFooterText] = useState("");

  // Save state
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [autoSaveError, setAutoSaveError] = useState(false);

  // Publish gate
  const [showPublishGate, setShowPublishGate] = useState(false);
  const [checklistChecked, setChecklistChecked] = useState([false, false, false]);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  // Validation display
  const [showErrors, setShowErrors] = useState(false);

  // ── Load brief on mount ──
  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(`/api/admin/briefs/${briefId}`);
        if (!res.ok) {
          setLoadError("Nepodařilo se načíst přehled. Zkuste to znovu.");
          return;
        }
        const brief = await res.json() as {
          nace_sector: string;
          content_sections: Array<{ section_id: string; body: string; heading: string; order: number }>;
        };

        setNaceSector(brief.nace_sector);

        // Parse content from the brief_content section
        const contentSection = brief.content_sections?.find(
          (s: { section_id: string }) => s.section_id === "brief_content"
        );
        if (contentSection?.body) {
          try {
            const content = JSON.parse(contentSection.body) as BriefContent;
            setTitle(content.title ?? "");
            setPublicationMonth(content.publication_month ?? "");
            setOpeningSummary(content.opening_summary ?? "");
            if (content.observations && content.observations.length > 0) {
              setObservations(content.observations);
              const teaserIdx = content.observations.findIndex((o) => o.is_email_teaser);
              if (teaserIdx >= 0) setEmailTeaserObsIndex(teaserIdx);
            }
            if (content.benchmark_categories && content.benchmark_categories.length > 0) {
              setCategories(content.benchmark_categories);
              // Find existing email teaser snippet
              for (const cat of content.benchmark_categories) {
                const teaserMetric = cat.metrics.find((m) => m.is_email_teaser_snippet);
                if (teaserMetric) {
                  setEmailTeaserSnippetId(teaserMetric.metric_id);
                  break;
                }
              }
            }
            if (content.closing_actions && content.closing_actions.length > 0) {
              setActions(content.closing_actions);
            }
            setPdfFooterText(content.pdf_footer_text ?? "");
          } catch {
            // New brief — start empty
          }
        }
      } catch {
        setLoadError("Nepodařilo se načíst přehled. Zkuste to znovu.");
      } finally {
        setLoading(false);
      }
    })();
  }, [briefId]);

  // ── Build content object ──
  const buildContent = useCallback((): BriefContent => {
    const obsWithTeaser = observations.map((o, idx) => ({
      ...o,
      is_email_teaser: emailTeaserObsIndex === idx,
    }));

    const catsWithSnippet = categories.map((cat) => ({
      ...cat,
      metrics: cat.metrics.map((m) => ({
        ...m,
        is_email_teaser_snippet: emailTeaserSnippetId === m.metric_id,
      })),
    }));

    return {
      title,
      publication_month: publicationMonth,
      opening_summary: openingSummary,
      observations: obsWithTeaser,
      closing_actions: actions,
      benchmark_categories: catsWithSnippet,
      pdf_footer_text: pdfFooterText,
      email_teaser_observation_index: emailTeaserObsIndex ?? 0,
    };
  }, [
    title,
    publicationMonth,
    openingSummary,
    observations,
    emailTeaserObsIndex,
    actions,
    categories,
    emailTeaserSnippetId,
    pdfFooterText,
  ]);

  // ── Save function ──
  const save = useCallback(
    async (silent = false) => {
      if (!silent) setSaveState("saving");

      const content = buildContent();
      const contentSection = {
        section_id: "brief_content",
        heading: "Obsah přehledu",
        body: JSON.stringify(content),
        order: 0,
      };

      try {
        const res = await fetch(`/api/admin/briefs/${briefId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content_sections: [contentSection] }),
        });

        if (!res.ok) {
          if (!silent) setSaveState("error");
          if (silent) setAutoSaveError(true);
          return false;
        }

        setSaveState("saved");
        setLastSavedAt(new Date());
        setAutoSaveError(false);
        return true;
      } catch {
        if (!silent) setSaveState("error");
        if (silent) setAutoSaveError(true);
        return false;
      }
    },
    [briefId, buildContent]
  );

  // ── Auto-save every 5 seconds ──
  const saveRef = useRef(save);
  saveRef.current = save;

  useEffect(() => {
    if (loading) return;
    const interval = setInterval(() => {
      void saveRef.current(true);
    }, 5000);
    return () => clearInterval(interval);
  }, [loading]);

  // ── Validation ──
  function validate(): string[] {
    const errors: string[] = [];
    if (observations.length < 2) errors.push("Přidejte alespoň 2 pozorování před publikováním.");
    if (observations.length > 4) errors.push("Maximální počet pozorování je 4.");
    observations.forEach((o, i) => {
      if (!o.headline) errors.push(`Pozorování ${i + 1}: nadpis je povinný.`);
      if (!o.time_horizon) errors.push(`Pozorování ${i + 1}: zvolte časový horizont.`);
    });
    if (emailTeaserObsIndex === null) errors.push("Označte jedno pozorování jako e-mail teaser.");
    if (actions.length < 2) errors.push("Přidejte alespoň 2 doporučené kroky před publikováním.");
    if (actions.length > 4) errors.push("Maximální počet doporučených kroků je 4.");
    actions.forEach((a, i) => {
      if (!a.action_text) errors.push(`Doporučený krok ${i + 1}: text je povinný.`);
      if (!a.time_horizon) errors.push(`Doporučený krok ${i + 1}: zvolte časový horizont.`);
      if (!a.category) errors.push(`Doporučený krok ${i + 1}: zvolte kategorii.`);
    });
    return errors;
  }

  const validationErrors = validate();
  const isValid = validationErrors.length === 0;

  // ── Publish ──
  async function handlePublish() {
    setPublishing(true);
    setPublishError(null);

    try {
      const res = await fetch(`/api/admin/briefs/${briefId}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checklist_affirmed_by: "analyst-stub",
          checklist_version: CHECKLIST_VERSION,
        }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setPublishError(data.error ?? "Publikování se nezdařilo. Zkuste to prosím znovu.");
        return;
      }

      router.push("/admin?published=1");
    } catch {
      setPublishError("Publikování se nezdařilo. Zkuste to prosím znovu.");
    } finally {
      setPublishing(false);
    }
  }

  // ── Observation helpers ──
  function updateObs(idx: number, fields: Partial<Observation>) {
    setObservations((prev) => prev.map((o, i) => (i === idx ? { ...o, ...fields } : o)));
  }
  function addObs() {
    if (observations.length >= 4) return;
    setObservations((prev) => [...prev, emptyObservation()]);
  }
  function removeObs(idx: number) {
    setObservations((prev) => prev.filter((_, i) => i !== idx));
    if (emailTeaserObsIndex === idx) setEmailTeaserObsIndex(null);
    else if (emailTeaserObsIndex !== null && emailTeaserObsIndex > idx) {
      setEmailTeaserObsIndex(emailTeaserObsIndex - 1);
    }
  }

  // ── Action helpers ──
  function updateAction(idx: number, fields: Partial<ClosingAction>) {
    setActions((prev) => prev.map((a, i) => (i === idx ? { ...a, ...fields } : a)));
  }
  function addAction() {
    if (actions.length >= 4) return;
    setActions((prev) => [...prev, emptyAction()]);
  }
  function removeAction(idx: number) {
    setActions((prev) => prev.filter((_, i) => i !== idx));
  }

  // ── Category helpers ──
  function updateMetric(catIdx: number, mIdx: number, fields: Partial<BenchmarkMetric>) {
    setCategories((prev) =>
      prev.map((cat, ci) =>
        ci !== catIdx
          ? cat
          : {
              ...cat,
              metrics: cat.metrics.map((m, mi) => (mi !== mIdx ? m : { ...m, ...fields })),
            }
      )
    );
  }

  // ── Render ──
  if (loading) {
    return (
      <main style={{ minHeight: "100vh", backgroundColor: "#f5f5f5", fontFamily: "system-ui, sans-serif", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "#666" }}>Načítám přehled…</p>
      </main>
    );
  }

  if (loadError) {
    return (
      <main style={{ minHeight: "100vh", backgroundColor: "#f5f5f5", fontFamily: "system-ui, sans-serif", padding: "40px 24px" }}>
        <div role="alert" style={{ color: "#c00", fontSize: "16px" }}>{loadError}</div>
        <Link href="/admin" style={{ color: "#666", fontSize: "14px" }}>← Zpět na přehledy</Link>
      </main>
    );
  }

  const sectorLabels: Record<string, string> = {
    "10": "Výroba potravinářských výrobků",
    "41": "Výstavba budov",
    "46": "Velkoobchod (kromě motorových vozidel)",
    "62": "Činnosti v oblasti informačních technologií",
  };
  const sectorName = sectorLabels[naceSector] ?? `NACE ${naceSector}`;

  const saveLabel =
    saveState === "saving"
      ? "Ukládám…"
      : saveState === "saved" && lastSavedAt
      ? `Uloženo ${lastSavedAt.toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" })}`
      : saveState === "error"
      ? "Uložení se nezdařilo"
      : "Uložit koncept";

  return (
    <>
      {/* Publish-gate modal */}
      {showPublishGate && (
        <PublishGateChecklist
          checked={checklistChecked}
          onToggle={(idx) =>
            setChecklistChecked((prev) => prev.map((v, i) => (i === idx ? !v : v)))
          }
          onPublish={() => { void handlePublish(); }}
          onBack={() => {
            setShowPublishGate(false);
            setPublishError(null);
          }}
          publishing={publishing}
          error={publishError}
        />
      )}

      <main
        style={{
          minHeight: "100vh",
          backgroundColor: "#f5f5f5",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {/* Header */}
        <header
          style={{
            backgroundColor: "#1a1a1a",
            color: "#fff",
            padding: "12px 24px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            position: "sticky",
            top: 0,
            zIndex: 100,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <Link
              href="/admin"
              style={{ color: "#aaa", fontSize: "13px", textDecoration: "none" }}
            >
              ← Zpět na přehledy
            </Link>
            <span style={{ color: "#555" }}>|</span>
            <span style={{ fontSize: "14px", fontWeight: "500" }}>
              Přehled — {sectorName}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            {/* Auto-save error toast */}
            {autoSaveError && (
              <span
                role="status"
                aria-live="polite"
                style={{ fontSize: "12px", color: "#ffaa44" }}
              >
                Automatické uložení se nezdařilo. Uložte přehled ručně.
              </span>
            )}
            {/* Save indicator */}
            <span style={{ fontSize: "12px", color: saveState === "error" ? "#ff6666" : "#aaa" }}>
              {saveLabel}
            </span>
            <button
              type="button"
              onClick={() => { void save(false); }}
              disabled={saveState === "saving"}
              style={{
                padding: "8px 16px",
                backgroundColor: "transparent",
                color: "#fff",
                border: "1px solid #555",
                borderRadius: "4px",
                fontSize: "13px",
                cursor: "pointer",
              }}
            >
              Uložit koncept
            </button>
            <button
              type="button"
              onClick={() => {
                setShowErrors(true);
                if (isValid) {
                  setShowPublishGate(true);
                }
              }}
              disabled={!isValid}
              aria-disabled={!isValid}
              title={!isValid ? "Vyřešte označené chyby před publikováním." : undefined}
              style={{
                padding: "8px 16px",
                backgroundColor: isValid ? "#fff" : "#555",
                color: isValid ? "#1a1a1a" : "#999",
                border: "none",
                borderRadius: "4px",
                fontSize: "13px",
                fontWeight: "bold",
                cursor: isValid ? "pointer" : "not-allowed",
              }}
            >
              Publikovat
            </button>
          </div>
        </header>

        <div style={{ maxWidth: "800px", margin: "0 auto", padding: "32px 24px" }}>
          {/* Sector lock notice */}
          <p style={{ fontSize: "13px", color: "#888", marginBottom: "24px" }}>
            Sektor: <strong>{sectorName} (NACE {naceSector})</strong> — sektor nelze po vytvoření přehledu změnit.
          </p>

          {/* Validation summary */}
          {showErrors && validationErrors.length > 0 && (
            <div
              role="alert"
              style={{
                backgroundColor: "#fff0f0",
                border: "1px solid #ffcccc",
                borderRadius: "4px",
                padding: "12px 16px",
                marginBottom: "24px",
              }}
            >
              <strong style={{ fontSize: "14px", color: "#c00" }}>
                Přehled nelze publikovat — vyřešte tyto chyby:
              </strong>
              <ul style={{ margin: "8px 0 0 0", paddingLeft: "20px" }}>
                {validationErrors.map((e, i) => (
                  <li key={i} style={{ fontSize: "13px", color: "#c00", marginBottom: "4px" }}>
                    {e}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Ready badge */}
          {isValid && (
            <div
              style={{
                backgroundColor: "#e6f4ea",
                border: "1px solid #b7dfbe",
                borderRadius: "4px",
                padding: "10px 16px",
                marginBottom: "24px",
                fontSize: "14px",
                color: "#1e7e34",
                fontWeight: "500",
              }}
            >
              Přehled je připraven k publikování
            </div>
          )}

          {/* ── Section 1: Záhlaví ── */}
          <section style={{ marginBottom: "32px" }}>
            <h2 style={{ fontSize: "18px", fontWeight: "bold", marginBottom: "16px", borderBottom: "1px solid #e0e0e0", paddingBottom: "8px" }}>
              1. Záhlaví
            </h2>
            <div style={{ marginBottom: "12px" }}>
              <label htmlFor="brief-title" style={{ display: "block", fontSize: "13px", fontWeight: "500", marginBottom: "4px" }}>
                Název přehledu
              </label>
              <input
                id="brief-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="např. Přehled sektoru — Duben 2026"
                style={{ width: "100%", padding: "8px 10px", border: "1px solid #d0d0d0", borderRadius: "4px", fontSize: "14px", boxSizing: "border-box" }}
              />
            </div>
            <div>
              <label htmlFor="brief-month" style={{ display: "block", fontSize: "13px", fontWeight: "500", marginBottom: "4px" }}>
                Měsíc publikace
              </label>
              <input
                id="brief-month"
                type="text"
                value={publicationMonth}
                onChange={(e) => setPublicationMonth(e.target.value)}
                placeholder="např. Duben 2026"
                style={{ width: "100%", padding: "8px 10px", border: "1px solid #d0d0d0", borderRadius: "4px", fontSize: "14px", boxSizing: "border-box" }}
              />
            </div>
          </section>

          {/* ── Section 2: Úvodní přehled ── */}
          <section style={{ marginBottom: "32px" }}>
            <h2 style={{ fontSize: "18px", fontWeight: "bold", marginBottom: "16px", borderBottom: "1px solid #e0e0e0", paddingBottom: "8px" }}>
              2. Úvodní přehled
            </h2>
            <label htmlFor="opening-summary" style={{ display: "block", fontSize: "13px", fontWeight: "500", marginBottom: "4px" }}>
              Text úvodního přehledu
            </label>
            <p style={{ fontSize: "12px", color: "#888", marginBottom: "6px" }}>
              2–4 věty popisující situaci v sektoru tímto měsícem. Bez statistické notace, bez holých čísel.
            </p>
            <textarea
              id="opening-summary"
              value={openingSummary}
              onChange={(e) => setOpeningSummary(e.target.value)}
              rows={4}
              style={{ width: "100%", padding: "8px 10px", border: "1px solid #d0d0d0", borderRadius: "4px", fontSize: "14px", boxSizing: "border-box", resize: "vertical" }}
            />
          </section>

          {/* ── Section 3: Pozorování ── */}
          <section style={{ marginBottom: "32px" }}>
            <h2 style={{ fontSize: "18px", fontWeight: "bold", marginBottom: "16px", borderBottom: "1px solid #e0e0e0", paddingBottom: "8px" }}>
              3. Pozorování
            </h2>

            {showErrors && observations.length < 2 && (
              <div role="alert" style={{ color: "#c00", fontSize: "13px", marginBottom: "12px" }}>
                Přidejte alespoň 2 pozorování před publikováním.
              </div>
            )}
            {showErrors && emailTeaserObsIndex === null && (
              <div role="alert" style={{ color: "#c00", fontSize: "13px", marginBottom: "12px" }}>
                Označte jedno pozorování jako e-mail teaser.
              </div>
            )}

            {observations.map((obs, idx) => (
              <ObservationCard
                key={idx}
                index={idx}
                obs={obs}
                totalCount={observations.length}
                emailTeaserIndex={emailTeaserObsIndex}
                onUpdate={updateObs}
                onSetEmailTeaser={(i) => setEmailTeaserObsIndex(i)}
                onRemove={removeObs}
                showErrors={showErrors}
              />
            ))}

            {observations.length < 4 && (
              <button
                type="button"
                onClick={addObs}
                style={{
                  padding: "8px 16px",
                  backgroundColor: "transparent",
                  border: "1px dashed #aaa",
                  borderRadius: "4px",
                  color: "#555",
                  fontSize: "14px",
                  cursor: "pointer",
                  width: "100%",
                }}
              >
                + Přidat pozorování
              </button>
            )}
          </section>

          {/* ── Section 4: Srovnávací přehled ── */}
          <section style={{ marginBottom: "32px" }}>
            <h2 style={{ fontSize: "18px", fontWeight: "bold", marginBottom: "16px", borderBottom: "1px solid #e0e0e0", paddingBottom: "8px" }}>
              4. Srovnávací přehled
            </h2>
            <CategoryGroupingControl
              categories={categories}
              emailTeaserSnippetId={emailTeaserSnippetId}
              onUpdate={updateMetric}
              onSetEmailTeaserSnippet={setEmailTeaserSnippetId}
              showErrors={showErrors}
            />
          </section>

          {/* ── Section 5: Doporučené kroky ── */}
          <section style={{ marginBottom: "32px" }}>
            <h2 style={{ fontSize: "18px", fontWeight: "bold", marginBottom: "16px", borderBottom: "1px solid #e0e0e0", paddingBottom: "8px" }}>
              5. Doporučené kroky
            </h2>

            {showErrors && actions.length < 2 && (
              <div role="alert" style={{ color: "#c00", fontSize: "13px", marginBottom: "12px" }}>
                Přidejte alespoň 2 doporučené kroky před publikováním.
              </div>
            )}

            {actions.map((action, idx) => (
              <ActionCard
                key={idx}
                index={idx}
                action={action}
                totalCount={actions.length}
                onUpdate={updateAction}
                onRemove={removeAction}
                showErrors={showErrors}
              />
            ))}

            {actions.length < 4 && (
              <button
                type="button"
                onClick={addAction}
                style={{
                  padding: "8px 16px",
                  backgroundColor: "transparent",
                  border: "1px dashed #aaa",
                  borderRadius: "4px",
                  color: "#555",
                  fontSize: "14px",
                  cursor: "pointer",
                  width: "100%",
                }}
              >
                + Přidat doporučený krok
              </button>
            )}
          </section>

          {/* ── Section 6: Zápatí ── */}
          <section style={{ marginBottom: "48px" }}>
            <h2 style={{ fontSize: "18px", fontWeight: "bold", marginBottom: "16px", borderBottom: "1px solid #e0e0e0", paddingBottom: "8px" }}>
              6. Zápatí
            </h2>
            <label htmlFor="pdf-footer" style={{ display: "block", fontSize: "13px", fontWeight: "500", marginBottom: "4px" }}>
              Text zápatí (výzva k akci pro čtenáře)
            </label>
            <textarea
              id="pdf-footer"
              value={pdfFooterText}
              onChange={(e) => setPdfFooterText(e.target.value)}
              rows={3}
              placeholder="např. Chcete probrat výsledky s vaším bankovním poradcem? Kontaktujte nás."
              style={{ width: "100%", padding: "8px 10px", border: "1px solid #d0d0d0", borderRadius: "4px", fontSize: "14px", boxSizing: "border-box", resize: "vertical" }}
            />
          </section>
        </div>
      </main>
    </>
  );
}
