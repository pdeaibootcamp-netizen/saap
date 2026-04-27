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

interface QuartileStyle {
  accentVar: string;
  accentHex: string;
}

interface BadgeStyle {
  background: string;
  color: string;
}

const BADGE_STYLES: Record<
  "horní čtvrtina" | "třetí čtvrtina" | "druhá čtvrtina" | "spodní čtvrtina" | "nodata",
  BadgeStyle
> = {
  "horní čtvrtina":  { background: "#E3F2FD", color: "#1565C0" },
  "třetí čtvrtina":  { background: "#E8F5E9", color: "#2E7D32" },
  "druhá čtvrtina":  { background: "#FFF3E0", color: "#E65100" },
  "spodní čtvrtina": { background: "#FFEBEE", color: "#C62828" },
  nodata:            { background: "#F5F5F5", color: "#757575" },
};

const QUARTILE_STYLES: Record<QuartileLabel, QuartileStyle> = {
  "horní čtvrtina": { accentVar: "var(--gds-quartile-top)", accentHex: "#1565C0" },
  "třetí čtvrtina": { accentVar: "var(--gds-quartile-third)", accentHex: "#2E7D32" },
  "druhá čtvrtina": { accentVar: "var(--gds-quartile-second)", accentHex: "#E65100" },
  "spodní čtvrtina": { accentVar: "var(--gds-quartile-bottom)", accentHex: "#C62828" },
};

// ask state uses amber — same hex as druhá čtvrtina but semantically "action available"
const CTA_ACCENT_HEX = "#E65100";

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
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when tile enters ask state (accessibility: design §6)
  useEffect(() => {
    if (confidenceState === "ask" && inputRef.current) {
      // Don't autofocus on initial load — only when explicitly activated
      // (The tile renders in ask state from page load; autofocus would move
      // focus to the first ask tile, which is acceptable per design spec §6)
    }
  }, [confidenceState]);

  // ── Derive visual style ─────────────────────────────────────────────────────
  const isValid = confidenceState === "valid" && quartileLabel !== null;
  const style = isValid && quartileLabel ? QUARTILE_STYLES[quartileLabel] : null;
  const accentHex = confidenceState === "ask"
    ? CTA_ACCENT_HEX
    : (style?.accentHex ?? "#455A64");
  const badgeStyle: BadgeStyle =
    isValid && quartileLabel ? BADGE_STYLES[quartileLabel] : BADGE_STYLES.nodata;

  // ── Accessible name ─────────────────────────────────────────────────────────
  let ariaLabel: string;
  if (confidenceState === "valid" && quartileLabel && percentile !== null) {
    ariaLabel = `${metricLabel} — ${quartileLabel}, ${percentile}. percentil`;
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
    borderRadius: "8px",
    padding: "16px",
    minHeight: confidenceState === "ask" ? "180px" : "130px",
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

  if (isValid && style && quartileLabel) {
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
          style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}
          aria-label={percentile !== null ? `${quartileLabel}, ${percentile}. percentil` : quartileLabel}
        >
          <span style={{ fontWeight: 600, color: "#333333" }}>{quartileLabel}</span>
          {percentile !== null && (
            <span aria-hidden="true" style={{ color: "#9E9E9E" }}>{percentile}.&nbsp;p.</span>
          )}
        </div>
      </div>
    );
  }

  // ── Ask state (v0.3 new) ─────────────────────────────────────────────────────

  if (confidenceState === "ask") {
    const errorMsg = validationError ?? patchError;
    const hasError = errorMsg !== null;

    return (
      <div
        role="region"
        aria-label={ariaLabel}
        style={tileStyle}
      >
        {/* Amber accent stripe — "action available", not quartile meaning */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: CTA_ACCENT_HEX, borderRadius: 0 }} />

        {/* Metric name */}
        <span style={{ fontSize: 15, fontWeight: 600, color: "#1a1a1a", lineHeight: 1.3, marginTop: 4 }}>
          {metricLabel}
        </span>

        {/* Help text — always visible, never placeholder-only (design §4.1) */}
        {promptHelpText && (
          <span
            id={`${metricId}-help`}
            style={{ fontSize: 13, color: "#616161", lineHeight: 1.45 }}
          >
            {promptHelpText}
          </span>
        )}

        <form onSubmit={handleSubmit} noValidate>
          {/* Input row: field + unit suffix */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
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
              style={{
                flex: 1,
                height: 40,
                fontSize: 16,
                fontWeight: 400,
                color: "#1a1a1a",
                border: hasError ? "2px solid #C62828" : "1px solid #9E9E9E",
                borderRadius: 4,
                padding: "0 8px",
                outline: "none",
                fontFamily: "inherit",
                boxSizing: "border-box",
              }}
              onFocus={(e) => {
                if (!hasError) {
                  (e.target as HTMLInputElement).style.border = "2px solid #1a1a1a";
                }
              }}
              onBlur={(e) => {
                if (!hasError) {
                  (e.target as HTMLInputElement).style.border = "1px solid #9E9E9E";
                }
              }}
            />
            {unitSuffix && (
              <span aria-hidden="true" style={{ fontSize: 13, color: "#616161", whiteSpace: "nowrap" }}>
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

          {/* Buttons */}
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                backgroundColor: "#1565C0",
                color: "#ffffff",
                border: "none",
                borderRadius: 4,
                height: 36,
                padding: "0 16px",
                fontSize: 14,
                fontWeight: 600,
                cursor: isSubmitting ? "not-allowed" : "pointer",
                opacity: isSubmitting ? 0.7 : 1,
                fontFamily: "inherit",
              }}
            >
              {isSubmitting ? "Ukládám…" : "Uložit"}
            </button>
            <button
              type="button"
              onClick={() => {
                setInputValue("");
                setValidationError(null);
                setPatchError(null);
              }}
              style={{
                backgroundColor: "transparent",
                color: "#1565C0",
                border: "none",
                borderRadius: 4,
                height: 36,
                padding: "0 8px",
                fontSize: 14,
                fontWeight: 400,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Zrušit
            </button>
          </div>
        </form>
      </div>
    );
  }

  // ── No-data state (below-floor / empty) ──────────────────────────────────────

  const nodataAccentHex = "#455A64";
  const nodataBadgeStyle = BADGE_STYLES.nodata;

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
