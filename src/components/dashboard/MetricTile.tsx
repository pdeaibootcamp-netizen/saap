/**
 * MetricTile — Dashboard benchmark tile (server component)
 *
 * Renders one benchmark metric tile in one of four states:
 *   valid       — quartile-coloured tile with raw value + quartile pill
 *   below-floor — uncoloured tile, em-dash raw value, graceful-degradation copy
 *   empty       — uncoloured tile, em-dash, "not applicable" copy
 *   loading     — skeleton bars (not used in v0.2 since data is synchronous)
 *
 * Visual spec: docs/design/dashboard-v0-2/tile-states.md
 * Copy: docs/product/dashboard-v0-2.md §5.2
 * Accessibility: tile-states.md §9; WCAG AA contrast verified in §4.2 / §4.3
 *
 * No client-side interactivity. No click handlers, no tooltips (deferred per
 * OQ-DV02-02). Tiles are role="region" (informational, not interactive).
 *
 * Design-system note (tile-states.md §10): MetricTile is a new component.
 * Colour tokens are inlined (not yet in a token file); consolidation is a v0.3
 * engineering task per layout.md §11.
 *
 * Accessibility: the percentile numeric sub-label inside the pill is
 * aria-hidden="true" so the screen reader does not double-announce it
 * (tile-states.md Q-TBD-D-007 implementation decision).
 */

// ─── Palette ─────────────────────────────────────────────────────────────────
// tile-states.md §4.2 (tile bg / text) and §4.3 (pill bg / pill text).
// Non-colour signal: Czech quartile label text inside the pill (§5).

type QuartileLabel =
  | "horní čtvrtina"
  | "třetí čtvrtina"
  | "druhá čtvrtina"
  | "spodní čtvrtina";

interface QuartileStyle {
  tileBg: string;
  tileText: string;
  pillBg: string;
  pillText: string;
}

const QUARTILE_STYLES: Record<QuartileLabel, QuartileStyle> = {
  "horní čtvrtina": {
    tileBg: "#e6f0f5",
    tileText: "#1a4a5a",
    pillBg: "#1a4a5a",
    pillText: "#ffffff",
  },
  "třetí čtvrtina": {
    tileBg: "#eaf4ec",
    tileText: "#1e4a2a",
    pillBg: "#1e4a2a",
    pillText: "#ffffff",
  },
  "druhá čtvrtina": {
    tileBg: "#f5f0e6",
    tileText: "#4a3a1a",
    pillBg: "#4a3a1a",
    pillText: "#ffffff",
  },
  "spodní čtvrtina": {
    tileBg: "#f0ede8",
    tileText: "#3a3530",
    pillBg: "#3a3530",
    pillText: "#ffffff",
  },
};

const SURFACE_CARD = "#fafafa";
const INK_PRIMARY = "#1a1a1a";
// Category badge text: #666 for WCAG AA compliance (5.74:1) per tile-states.md
// Q-TBD-D-006 recommendation — using #666 (--color-ink-tertiary).
const INK_TERTIARY = "#666";

// ─── Props ───────────────────────────────────────────────────────────────────

export interface MetricTileProps {
  metricId: string;
  metricLabel: string;
  categoryLabel: string;
  rawValue: string | null;
  quartileLabel: QuartileLabel | null;
  percentile: number | null;
  confidenceState: "valid" | "below-floor" | "empty" | "loading";
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function MetricTile({
  metricLabel,
  categoryLabel,
  rawValue,
  quartileLabel,
  percentile,
  confidenceState,
}: MetricTileProps) {
  // ── Derive visual style based on state + quartile ──────────────────────────
  const isValid = confidenceState === "valid" && quartileLabel !== null;
  const style =
    isValid && quartileLabel ? QUARTILE_STYLES[quartileLabel] : null;

  const tileBg = style?.tileBg ?? SURFACE_CARD;
  const tileText = style?.tileText ?? INK_PRIMARY;

  // ── Accessible name for the tile region ───────────────────────────────────
  // tile-states.md §6.4
  let ariaLabel: string;
  if (confidenceState === "valid" && quartileLabel && percentile !== null) {
    ariaLabel = `${metricLabel} — ${quartileLabel}, ${percentile}. percentil`;
  } else if (confidenceState === "below-floor") {
    ariaLabel = `${metricLabel} — zatím nedostatek dat pro srovnání`;
  } else if (confidenceState === "empty") {
    ariaLabel = `${metricLabel} — neuplatňuje se pro váš obor`;
  } else {
    ariaLabel = metricLabel;
  }

  // ── Inline styles (tokens not yet in a CSS file — v0.3 task) ─────────────
  const tileStyle: React.CSSProperties = {
    backgroundColor: tileBg,
    color: tileText,
    border: "1px solid #e0e0e0",
    borderRadius: "6px",
    padding: "12px",
    minHeight: "120px",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    boxSizing: "border-box",
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (confidenceState === "loading") {
    return (
      <div
        role="region"
        aria-label={metricLabel}
        aria-busy="true"
        style={{ ...tileStyle, backgroundColor: SURFACE_CARD }}
      >
        <style dangerouslySetInnerHTML={{ __html: skeletonCss }} />
        <div className="mt-skeleton mt-skeleton-short" />
        <div className="mt-skeleton mt-skeleton-medium" />
        <div className="mt-skeleton mt-skeleton-long" />
      </div>
    );
  }

  return (
    <div role="region" aria-label={ariaLabel} style={tileStyle}>
      {/* Row A — category badge (tile-states.md §2.3) */}
      <span
        style={{
          fontSize: "12px",
          fontWeight: 600,
          color: INK_TERTIARY,
          lineHeight: "1.4",
        }}
      >
        {categoryLabel}
      </span>

      {/* Row B — metric name */}
      <span
        style={{
          fontSize: "13px",
          fontWeight: 600,
          lineHeight: "1.3",
          color: tileText,
        }}
      >
        {metricLabel}
      </span>

      {/* Row C — raw value or em-dash */}
      <span
        style={{
          fontSize: "15px",
          fontWeight: 600,
          lineHeight: "1.4",
          color: tileText,
        }}
        aria-label={
          confidenceState !== "valid" ? "není k dispozici" : undefined
        }
      >
        {confidenceState === "valid" && rawValue ? rawValue : "\u2014"}
      </span>

      {/* Row D — quartile pill (valid) or degraded copy (below-floor / empty) */}
      {confidenceState === "valid" && style && quartileLabel && (
        <div
          style={{
            marginTop: "auto",
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
            backgroundColor: style.pillBg,
            color: style.pillText,
            borderRadius: "4px",
            padding: "3px 8px",
            fontSize: "12px",
            fontWeight: 600,
            lineHeight: "1.4",
            alignSelf: "flex-start",
          }}
          aria-label={
            percentile !== null
              ? `${quartileLabel}, ${percentile}. percentil`
              : quartileLabel
          }
        >
          {quartileLabel}
          {percentile !== null && (
            <span
              aria-hidden="true"
              style={{ fontWeight: 400, opacity: 0.85 }}
            >
              &nbsp;{percentile}.&nbsp;p.
            </span>
          )}
        </div>
      )}

      {confidenceState === "below-floor" && (
        // tile-states.md §6.1 — short variant for tile space constraint
        // dashboard-v0-2.md §5.2 — PM canonical copy
        <span
          style={{
            marginTop: "auto",
            fontSize: "12px",
            lineHeight: "1.4",
            color: INK_TERTIARY,
          }}
        >
          Zatím nedostatek dat pro srovnání.
        </span>
      )}

      {confidenceState === "empty" && (
        // tile-states.md §6.2
        <span
          style={{
            marginTop: "auto",
            fontSize: "12px",
            lineHeight: "1.4",
            color: INK_TERTIARY,
          }}
        >
          Neuplatňuje se pro váš obor.
        </span>
      )}
    </div>
  );
}

// ─── Skeleton CSS (loading state) ─────────────────────────────────────────────
// tile-states.md §3 State 4. CSS-only @keyframes shimmer.
// prefers-reduced-motion: static fill per spec.

const skeletonCss = `
  .mt-skeleton {
    background: #e0e0e0;
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
