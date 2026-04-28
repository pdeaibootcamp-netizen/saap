/**
 * MetricTile — Dashboard benchmark tile (client component for ask state)
 *
 * Renders one benchmark metric tile in one of five states:
 *   valid       — quartile-coloured tile with raw value + quartile pill
 *   below-floor — uncoloured tile, em-dash raw value, graceful-degradation copy
 *   empty       — uncoloured tile, em-dash, "not applicable" copy
 *   loading     — skeleton bars
 *   ask         — CTA tile with prompt + inline numeric input + Uložit button (v0.3)
 *
 * Visual spec: docs/design/dashboard-v0-2/tile-states.md + docs/design/in-tile-prompts.md
 * Copy: docs/product/in-tile-prompts.md §4, §5, §6
 * Accessibility: design/in-tile-prompts.md §6
 *
 * GDS token migration (docs/engineering/gds-token-migration.md):
 *   Hardcoded hex in inline styles — CSS vars not reliable in this context.
 *
 * "ask" state uses 'use client' for form interactivity. The valid/below-floor/empty
 * states could be server-rendered but we keep a single unified component.
 */

"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { METRIC_BOUNDS, type OwnerMetricId } from "../../types/data-lanes";

// ─── Palette (hardcoded hex — CSS vars not reliable in inline styles) ─────────

type QuartileLabel =
  | "horní čtvrtina"
  | "třetí čtvrtina"
  | "druhá čtvrtina"
  | "spodní čtvrtina";

interface BadgeStyle {
  background: string;
  color: string;
}

// ─── Quintile colour system (main branch, approved 2026-04-27) ────────────────
// Accent stripe and badge colours driven by percentile band, not quartile label.

interface QuintileStyle {
  accentHex: string;
  badgeStyle: BadgeStyle;
}

const QUINTILE_STYLES: Record<1 | 2 | 3 | 4 | 5, QuintileStyle> = {
  5: { accentHex: "#1565C0", badgeStyle: { background: "#E3F2FD", color: "#1565C0" } }, // 80–100. p
  4: { accentHex: "#2E7D32", badgeStyle: { background: "#E8F5E9", color: "#2E7D32" } }, // 60–79. p
  3: { accentHex: "#E65100", badgeStyle: { background: "#FFF3E0", color: "#E65100" } }, // 40–59. p
  2: { accentHex: "#BF360C", badgeStyle: { background: "#FBE9E7", color: "#BF360C" } }, // 20–39. p
  1: { accentHex: "#C62828", badgeStyle: { background: "#FFEBEE", color: "#C62828" } }, // 0–19. p
};

const NODATA_STYLE: QuintileStyle = {
  accentHex: "#455A64",
  badgeStyle: { background: "#F5F5F5", color: "#757575" },
};

// Fallback mapping when percentile is unavailable — skips Q3 intentionally
// (quartile labels map to Q1/Q2/Q4/Q5, never Q3 — no "middle" quartile label).
const QUARTILE_TO_QUINTILE: Record<QuartileLabel, number> = {
  "spodní čtvrtina": 1,
  "druhá čtvrtina":  2,
  "třetí čtvrtina":  4,
  "horní čtvrtina":  5,
};

const QUINTILE_LABELS = ["spodní pětina", "druhá pětina", "třetí pětina", "čtvrtá pětina", "horní pětina"];

function percentileToQuintile(p: number): number {
  if (p <= 20) return 1;
  if (p <= 40) return 2;
  if (p <= 60) return 3;
  if (p <= 80) return 4;
  return 5;
}

function getQuintileLabel(percentile: number | null, quartile: QuartileLabel): string {
  const q = percentile !== null ? percentileToQuintile(percentile) : QUARTILE_TO_QUINTILE[quartile];
  return QUINTILE_LABELS[q - 1];
}

function getQuintileStyle(percentile: number | null, quartileLabel: QuartileLabel): QuintileStyle {
  const q = percentile !== null ? percentileToQuintile(percentile) : QUARTILE_TO_QUINTILE[quartileLabel];
  return QUINTILE_STYLES[q as 1 | 2 | 3 | 4 | 5] ?? NODATA_STYLE;
}

function QuintileBar({ quartile, percentile, accentHex }: { quartile: QuartileLabel; percentile: number | null; accentHex: string }) {
  const filled = percentile !== null ? percentileToQuintile(percentile) : QUARTILE_TO_QUINTILE[quartile];
  const radius = (i: number): string => {
    if (i === 1) return "3px 0 0 3px";
    if (i === 5) return "0 3px 3px 0";
    return "0";
  };
  return (
    <div
      title={percentile !== null ? `${percentile}. percentil` : undefined}
      style={{ display: "flex", gap: 4, width: "100%", marginTop: 8, cursor: "default" }}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} style={{ flex: 1, height: 6, borderRadius: radius(i), backgroundColor: i <= filled ? accentHex : "#e4eaf0" }} />
      ))}
    </div>
  );
}

// ask state uses neutral blue-grey — distinct from any quartile colour and
// non-alarming (the tile is asking for input, not flagging a problem).
// Was amber #E65100 — flagged in user testing as too close to druhá čtvrtina + alarming.
const CTA_ACCENT_HEX = "#78909C";

// ─── Props ───────────────────────────────────────────────────────────────────

export interface MetricTileProps {
  metricId: string;
  metricLabel: string;
  categoryLabel: string;
  rawValue: string | null;
  quartileLabel: QuartileLabel | null;
  percentile: number | null;
  confidenceState: "valid" | "below-floor" | "empty" | "loading" | "ask";
  // ask-state props (design/in-tile-prompts.md §4.1)
  promptHelpText?: string;
  unitSuffix?: string;
  plausibilityMin?: number;
  plausibilityMax?: number;
  plausibilityDecimals?: number;
  errorCopyOutOfBounds?: string;
  // just-saved pulse (applied when ?saved=<metricId> matches this tile)
  justSaved?: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function hexToRgba(hex: string, opacity: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function MetricTile({
  metricId,
  metricLabel,
  categoryLabel,
  rawValue,
  quartileLabel,
  percentile,
  confidenceState,
  promptHelpText,
  unitSuffix,
  plausibilityMin,
  plausibilityMax,
  plausibilityDecimals = 1,
  errorCopyOutOfBounds,
  justSaved = false,
}: MetricTileProps) {
  const router = useRouter();

  // ask-state form state
  const [inputValue, setInputValue] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [patchError, setPatchError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Two-step ask flow: tile starts collapsed (button only), expands on click.
  // Less aggressive than always showing the input — the form appears only
  // when the moderator/owner deliberately chooses to fill that metric.
  const [expanded, setExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // When the user clicks "Doplnit hodnotu", focus the input on the next render.
  useEffect(() => {
    if (confidenceState === "ask" && expanded && inputRef.current) {
      inputRef.current.focus();
    }
  }, [confidenceState, expanded]);

  // ── Derive visual style ─────────────────────────────────────────────────────
  const isValid = confidenceState === "valid" && quartileLabel !== null;
  const quintileStyle: QuintileStyle =
    isValid && quartileLabel ? getQuintileStyle(percentile, quartileLabel) : NODATA_STYLE;
  const accentHex = confidenceState === "ask" ? CTA_ACCENT_HEX : quintileStyle.accentHex;
  const badgeStyle: BadgeStyle = quintileStyle.badgeStyle;

  // ── Accessible name ─────────────────────────────────────────────────────────
  let ariaLabel: string;
  if (confidenceState === "valid" && quartileLabel && percentile !== null) {
    ariaLabel = `${metricLabel} — ${getQuintileLabel(percentile, quartileLabel)}, ${percentile}. percentil`;
  } else if (confidenceState === "below-floor") {
    ariaLabel = `${metricLabel} — zatím nedostatek dat pro srovnání`;
  } else if (confidenceState === "empty") {
    ariaLabel = `${metricLabel} — neuplatňuje se pro váš obor`;
  } else if (confidenceState === "ask") {
    ariaLabel = `${metricLabel} — vyplňte prosím hodnotu`;
  } else {
    ariaLabel = metricLabel;
  }

  // ── Tile base style ─────────────────────────────────────────────────────────
  const tileStyle: React.CSSProperties = {
    position: "relative",
    overflow: "hidden",
    backgroundColor: "#ffffff",
    color: "#1a1a1a",
    border: "1px solid #e4eaf0",
    borderRadius: "12px",
    padding: "16px",
    minHeight: confidenceState === "ask" ? "240px" : "130px",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    boxSizing: "border-box",
  };

  // ── Validation ──────────────────────────────────────────────────────────────

  function parseInput(val: string): number {
    const stripped = val.replace(/[\s  ]/g, "").replace(",", ".");
    return parseFloat(stripped);
  }

  function validateInput(val: string): string | null {
    const num = parseInput(val);
    if (isNaN(num) || !isFinite(num)) {
      return "Uveďte prosím číselnou hodnotu.";
    }
    if (plausibilityMin !== undefined && num < plausibilityMin) {
      return errorCopyOutOfBounds ?? "Tato hodnota se zdá být mimo obvyklý rozsah. Zkontrolujte prosím zadání.";
    }
    if (plausibilityMax !== undefined && num > plausibilityMax) {
      return errorCopyOutOfBounds ?? "Tato hodnota se zdá být mimo obvyklý rozsah. Zkontrolujte prosím zadání.";
    }
    void plausibilityDecimals; // decimal check could be added here if needed
    return null;
  }

  // ── Submit handler ──────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setValidationError(null);
    setPatchError(null);

    const error = validateInput(inputValue);
    if (error) {
      setValidationError(error);
      inputRef.current?.focus();
      return;
    }

    const numericValue = parseInput(inputValue);
    setIsSubmitting(true);

    try {
      const resp = await fetch(`/api/owner/metrics/${metricId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw_value: numericValue }),
      });

      if (!resp.ok) {
        const data = await resp.json().catch(() => ({})) as Record<string, unknown>;
        setPatchError((data.error as string) ?? "Hodnotu se nepodařilo uložit. Zkuste to prosím znovu.");
        inputRef.current?.focus();
        return;
      }

      // Full page reload with ?saved=<metricId> for the just-saved pulse
      // Implementation choice (OQ-073 / design §9 Q-TBD-ITP-003):
      // We use a URL query param on the router.push rather than Server Action,
      // because form submission via fetch + router.push preserves the param on
      // the redirect. Server Actions via redirect() do not guarantee the param
      // survives the redirect. Cookie flash would also work but adds a server
      // round-trip; URL param is simpler and aligns with the design spec intent.
      router.push(`/?saved=${encodeURIComponent(metricId)}`);
    } catch {
      setPatchError("Hodnotu se nepodařilo uložit. Zkuste to prosím znovu.");
      inputRef.current?.focus();
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setInputValue("");
      setValidationError(null);
      setPatchError(null);
    }
  }

  // ── Loading state ────────────────────────────────────────────────────────────

  if (confidenceState === "loading") {
    return (
      <div role="region" aria-label={metricLabel} aria-busy="true" style={tileStyle}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: "#e4eaf0", borderRadius: 0 }} />
        <style dangerouslySetInnerHTML={{ __html: skeletonCss }} />
        <div className="mt-skeleton mt-skeleton-short" style={{ marginTop: 4 }} />
        <div className="mt-skeleton mt-skeleton-medium" />
        <div className="mt-skeleton mt-skeleton-long" />
      </div>
    );
  }

  // ── Valid state ──────────────────────────────────────────────────────────────

  if (isValid && quartileLabel) {
    return (
      <div
        role="region"
        aria-label={ariaLabel}
        style={tileStyle}
        className={justSaved ? "mt-just-saved" : undefined}
      >
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: accentHex, borderRadius: 0 }} />

        <span style={{ fontSize: 15, fontWeight: 600, color: "#1a1a1a", lineHeight: 1.3, marginTop: 4 }}>
          {metricLabel}
        </span>

        <span style={{
          display: "inline-block", alignSelf: "flex-start", padding: "2px 10px",
          borderRadius: 999, fontSize: 12, fontWeight: 500,
          backgroundColor: badgeStyle.background, color: badgeStyle.color, lineHeight: 1.6,
        }}>
          {categoryLabel}
        </span>

        <div style={{ flex: 1 }} />

        <span style={{ fontSize: 26, fontWeight: 700, lineHeight: 1.2, color: "#1a1a1a" }}>
          {rawValue}
        </span>

        <div
          aria-label={percentile !== null ? `${getQuintileLabel(percentile, quartileLabel)}, ${percentile}. percentil` : getQuintileLabel(null, quartileLabel)}
          style={{ display: "flex", flexDirection: "column", gap: 5 }}
        >
          <QuintileBar quartile={quartileLabel} percentile={percentile} accentHex={accentHex} />
          <span style={{ fontWeight: 600, color: "#333333", fontSize: 13 }}>
            {getQuintileLabel(percentile, quartileLabel)}
          </span>
        </div>
      </div>
    );
  }

  // ── Ask state (v0.3 new) ─────────────────────────────────────────────────────

  if (confidenceState === "ask") {
    const errorMsg = validationError ?? patchError;
    const hasError = errorMsg !== null;

    // Collapsed view: greyed-out tile with metric name + help text + button.
    // Only on click does the form expand to show the input.
    // Tile keeps a smaller min-height when collapsed (130px, same as no-data state)
    // and grows to ~240px when expanded.
    const collapsedTileStyle: React.CSSProperties = {
      ...tileStyle,
      minHeight: 130,
      backgroundColor: "#f5f6f8", // subtle grey wash distinguishes from valid tiles
    };

    if (!expanded) {
      return (
        <div
          role="region"
          aria-label={ariaLabel}
          style={collapsedTileStyle}
        >
          {/* Subtle grey accent stripe — "action available", not alarming */}
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: CTA_ACCENT_HEX, borderRadius: 0 }} />

          {/* Metric name (slightly muted) */}
          <span style={{ fontSize: 15, fontWeight: 600, color: "#374151", lineHeight: 1.3, marginTop: 4 }}>
            {metricLabel}
          </span>

          {/* Empty-state copy — shorter than the help text */}
          <span style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.4 }}>
            Hodnota zatím nezadána
          </span>

          {/* Spacer to push button to bottom */}
          <div style={{ flexGrow: 1 }} />

          {/* "Doplnit hodnotu" link/button */}
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="gds-btn-secondary"
            style={{ width: "100%" }}
          >
            Doplnit hodnotu
          </button>
        </div>
      );
    }

    // Expanded view: full form (input + unit + Uložit / Zrušit).
    return (
      <div
        role="region"
        aria-label={ariaLabel}
        style={tileStyle}
      >
        {/* Accent stripe */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: CTA_ACCENT_HEX, borderRadius: 0 }} />

        {/* Metric name */}
        <span style={{ fontSize: 15, fontWeight: 600, color: "#1a1a1a", lineHeight: 1.3, marginTop: 4 }}>
          {metricLabel}
        </span>

        {/* marginTop:auto pushes this block to the card bottom — no dead space below buttons */}
        <div style={{ marginTop: "auto", display: "flex", flexDirection: "column" }}>
        {promptHelpText && (
          <span
            id={`${metricId}-help`}
            style={{ fontSize: 13, color: "#616161", lineHeight: 1.45 }}
          >
            {promptHelpText}
          </span>
        )}

        <form onSubmit={handleSubmit} noValidate>
          {/* Input row: pill container + unit suffix */}
          <div
            className={`gds-input-group${hasError ? " gds-input-group--error" : ""}`}
            style={{ marginTop: 4 }}
          >
            <input
              ref={inputRef}
              id={`${metricId}-input`}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                setValidationError(null);
                setPatchError(null);
              }}
              onKeyDown={handleKeyDown}
              aria-label={`${metricLabel}, hodnota${unitSuffix ? " v " + unitSuffix : ""}`}
              aria-describedby={[
                promptHelpText ? `${metricId}-help` : "",
                hasError ? `${metricId}-error` : "",
              ].filter(Boolean).join(" ") || undefined}
              aria-invalid={hasError}
            />
            {unitSuffix && (
              <span aria-hidden="true" className="gds-input-group__unit">
                {unitSuffix}
              </span>
            )}
          </div>

          {/* Error message */}
          {hasError && (
            <span
              id={`${metricId}-error`}
              role="alert"
              aria-live="polite"
              style={{ fontSize: 12, color: "#C62828", display: "block", marginTop: 4 }}
            >
              {errorMsg}
            </span>
          )}

          {/* Buttons — Zrušit left, Uložit right (per GDS button-system.md) */}
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button
              type="button"
              onClick={() => {
                setInputValue("");
                setValidationError(null);
                setPatchError(null);
                setExpanded(false);
              }}
              className="gds-btn-secondary"
            >
              Zrušit
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="gds-btn-primary"
            >
              {isSubmitting ? "Ukládám…" : "Uložit"}
            </button>
          </div>
        </form>
        </div>{/* end marginTop:auto wrapper */}
      </div>
    );
  }

  // ── No-data state (below-floor / empty) ──────────────────────────────────────

  const nodataAccentHex = NODATA_STYLE.accentHex;
  const nodataBadgeStyle = NODATA_STYLE.badgeStyle;

  return (
    <div role="region" aria-label={ariaLabel} style={tileStyle}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: nodataAccentHex, borderRadius: 0 }} />

      <span style={{ fontSize: 15, fontWeight: 600, color: "#1a1a1a", marginTop: 4 }}>
        {metricLabel}
      </span>

      <span style={{
        display: "inline-block", alignSelf: "flex-start", padding: "2px 10px",
        borderRadius: 999, fontSize: 12, fontWeight: 500,
        backgroundColor: nodataBadgeStyle.background, color: nodataBadgeStyle.color, lineHeight: 1.6,
      }}>
        {categoryLabel}
      </span>

      <div style={{ flex: 1 }} />

      <span style={{ fontSize: 22, color: nodataAccentHex, fontWeight: 700 }}>—</span>

      <span style={{ fontSize: 13, color: "#9E9E9E" }}>
        {confidenceState === "below-floor"
          ? "Nedostatek dat pro srovnání."
          : "Neuplatňuje se pro váš obor."}
      </span>
    </div>
  );
}

// ─── Skeleton CSS (loading state) ─────────────────────────────────────────────

const skeletonCss = `
  .mt-skeleton {
    background: #e4eaf0;
    border-radius: 4px;
    animation: mt-shimmer 1.4s ease-in-out infinite;
  }
  .mt-skeleton-short  { height: 12px; width: 40%; }
  .mt-skeleton-medium { height: 14px; width: 65%; margin-top: 6px; }
  .mt-skeleton-long   { height: 24px; width: 80%; margin-top: 8px; }
  @keyframes mt-shimmer {
    0%   { opacity: 1; }
    50%  { opacity: 0.4; }
    100% { opacity: 1; }
  }
  @media (prefers-reduced-motion: reduce) {
    .mt-skeleton { animation: none; opacity: 0.5; }
  }
`;
