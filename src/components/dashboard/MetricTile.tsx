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
 * GDS token migration (docs/engineering/gds-token-migration.md):
 *   QUARTILE_STYLES now references CSS custom properties from globals.css.
 *   Top-border accent (4px) is the primary quartile signal per screenshot.
 *   Badge bg = quartile colour at 12% opacity (rgba approach on hex vars).
 *
 * No client-side interactivity. No click handlers, no tooltips (deferred per
 * OQ-DV02-02). Tiles are role="region" (informational, not interactive).
 */

// ─── Palette (CSS vars from globals.css :root) ────────────────────────────────
// tile-states.md §4.2 (tile border / text) and §4.3 (pill bg / pill text).

type QuartileLabel =
  | "horní čtvrtina"
  | "třetí čtvrtina"
  | "druhá čtvrtina"
  | "spodní čtvrtina";

interface QuartileStyle {
  /** CSS var string for the top-border accent and badge text colour */
  accentVar: string;
  /** Hex value matching the CSS var — used only for the accent stripe */
  accentHex: string;
}

interface BadgeStyle {
  background: string;
  color: string;
}

// Exact badge colours per spec (screenshot-matched).
// Separate from QUARTILE_STYLES — accent stripe keeps accentHex unchanged.
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

// Maps each quartile label to its GDS colour var + hex for rgba opacity trick.
// accentHex values match the visual spec from the reference screenshot.
const QUARTILE_STYLES: Record<QuartileLabel, QuartileStyle> = {
  "horní čtvrtina": {
    accentVar: "var(--gds-quartile-top)",
    accentHex: "#1565C0",
  },
  "třetí čtvrtina": {
    accentVar: "var(--gds-quartile-third)",
    accentHex: "#2E7D32",
  },
  "druhá čtvrtina": {
    accentVar: "var(--gds-quartile-second)",
    accentHex: "#E65100",
  },
  "spodní čtvrtina": {
    accentVar: "var(--gds-quartile-bottom)",
    accentHex: "#C62828",
  },
};

// Fallback: quartile → quintile fill when percentile unavailable
const QUARTILE_TO_QUINTILE: Record<QuartileLabel, number> = {
  "spodní čtvrtina": 1,
  "druhá čtvrtina":  2,
  "třetí čtvrtina":  4,
  "horní čtvrtina":  5,
};

function percentileToQuintile(p: number): number {
  if (p <= 20) return 1;
  if (p <= 40) return 2;
  if (p <= 60) return 3;
  if (p <= 80) return 4;
  return 5;
}

function QuartileBar({ quartile, percentile, accentHex }: { quartile: QuartileLabel; percentile: number | null; accentHex: string }) {
  const filled = percentile !== null
    ? percentileToQuintile(percentile)
    : QUARTILE_TO_QUINTILE[quartile];
  const radius = (i: number): string => {
    if (i === 1) return "3px 0 0 3px";
    if (i === 5) return "0 3px 3px 0";
    return "0";
  };
  return (
    <div style={{ display: "flex", gap: 2, width: "100%", marginTop: 8 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          style={{
            flex: 1,
            height: 6,
            borderRadius: radius(i),
            backgroundColor: i <= filled ? accentHex : "#e4eaf0",
          }}
        />
      ))}
    </div>
  );
}

/** Convert a 6-digit hex to an rgba() string with the given opacity (0–1). */
function hexToRgba(hex: string, opacity: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

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

  // No-data / below-floor / empty: neutral dark-blue-gray accent
  const accentVar = style?.accentVar ?? "var(--gds-quartile-nodata)";
  const accentHex = style?.accentHex ?? "#455A64";

  // Badge style: flat colours from BADGE_STYLES (not derived from accent hex)
  const badgeStyle: BadgeStyle =
    isValid && quartileLabel ? BADGE_STYLES[quartileLabel] : BADGE_STYLES.nodata;

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

  // ── Tile base style ───────────────────────────────────────────────────────
  // borderTop is NOT used for the accent stripe — it would get border-radius on
  // the top corners. Instead an absolutely-positioned div is used (see render).
  const tileStyle: React.CSSProperties = {
    position: "relative",
    overflow: "hidden",
    backgroundColor: "#ffffff",
    color: "#1a1a1a",
    border: "1px solid #e4eaf0",
    borderRadius: "8px",
    padding: "16px",
    minHeight: "130px",
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
        style={tileStyle}
      >
        {/* Accent stripe — no border-radius */}
        <div style={{
          position: "absolute",
          top: 0, left: 0, right: 0,
          height: 4,
          background: "#e4eaf0",
          borderRadius: 0,
        }} />
        <style dangerouslySetInnerHTML={{ __html: skeletonCss }} />
        <div className="mt-skeleton mt-skeleton-short" style={{ marginTop: 4 }} />
        <div className="mt-skeleton mt-skeleton-medium" />
        <div className="mt-skeleton mt-skeleton-long" />
      </div>
    );
  }

  // ── Valid state ───────────────────────────────────────────────────────────
  if (isValid && style && quartileLabel) {
    return (
      <div role="region" aria-label={ariaLabel} style={tileStyle}>
        {/* Accent stripe — absolutely positioned, no border-radius (sharp corners) */}
        <div style={{
          position: "absolute",
          top: 0, left: 0, right: 0,
          height: 4,
          background: accentHex,
          borderRadius: 0,
        }} />

        {/* Row A — metric name (tile-states.md §2.3 — name is primary) */}
        <span style={{
          fontSize: 15,
          fontWeight: 600,
          color: "#1a1a1a",
          lineHeight: 1.3,
          marginTop: 4,
        }}>
          {metricLabel}
        </span>

        {/* Row B — category badge — under the metric name */}
        <span style={{
          display: "inline-block",
          alignSelf: "flex-start",
          padding: "2px 10px",
          borderRadius: 999,
          fontSize: 12,
          fontWeight: 500,
          backgroundColor: badgeStyle.background,
          color: badgeStyle.color,
          lineHeight: 1.6,
        }}>
          {categoryLabel}
        </span>

        {/* Flex spacer */}
        <div style={{ flex: 1 }} />

        {/* Row C — raw value */}
        <span style={{
          fontSize: 26,
          fontWeight: 700,
          lineHeight: 1.2,
          color: "#1a1a1a",
        }}>
          {rawValue}
        </span>

        {/* Row D — quartile bar + label */}
        <div
          aria-label={percentile !== null ? `${quartileLabel}, ${percentile}. percentil` : quartileLabel}
          style={{ display: "flex", flexDirection: "column", gap: 5 }}
        >
          <QuartileBar quartile={quartileLabel} percentile={percentile} accentHex={accentHex} />
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <span style={{ fontWeight: 600, color: "#333333" }}>{quartileLabel}</span>
            {percentile !== null && (
              <span aria-hidden="true" style={{ color: "#9E9E9E" }}>{percentile}.&nbsp;p.</span>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── No-data state (below-floor / empty) ───────────────────────────────────
  const nodataAccentHex = "#455A64";
  const nodataBadgeStyle = BADGE_STYLES.nodata;

  return (
    <div role="region" aria-label={ariaLabel} style={tileStyle}>
      {/* Accent stripe — no-data grey, no border-radius */}
      <div style={{
        position: "absolute",
        top: 0, left: 0, right: 0,
        height: 4,
        background: nodataAccentHex,
        borderRadius: 0,
      }} />

      {/* Metric name */}
      <span style={{ fontSize: 15, fontWeight: 600, color: "#1a1a1a", marginTop: 4 }}>
        {metricLabel}
      </span>

      {/* Category badge */}
      <span style={{
        display: "inline-block",
        alignSelf: "flex-start",
        padding: "2px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 500,
        backgroundColor: nodataBadgeStyle.background,
        color: nodataBadgeStyle.color,
        lineHeight: 1.6,
      }}>
        {categoryLabel}
      </span>

      {/* Flex spacer */}
      <div style={{ flex: 1 }} />

      {/* Em-dash value */}
      <span style={{ fontSize: 22, color: nodataAccentHex, fontWeight: 700 }}>—</span>

      {/* Degraded copy */}
      <span style={{ fontSize: 13, color: "#9E9E9E" }}>
        {confidenceState === "below-floor"
          ? "Nedostatek dat pro srovnání."
          : "Neuplatňuje se pro váš obor."}
      </span>
    </div>
  );
}

// ─── Skeleton CSS (loading state) ─────────────────────────────────────────────
// tile-states.md §3 State 4. CSS-only @keyframes shimmer.
// prefers-reduced-motion: static fill per spec.

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
