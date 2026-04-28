/**
 * ChartTile — one analyst-selected chart tile inside the Pulz oboru section.
 *
 * Layout (top-to-bottom):
 *   1. Verdict sentence — always visible above the chart.
 *   2. Horizontal divider.
 *   3. Static <img> chart (100% width, max 180 px height).
 *   4. Optional caption / source attribution.
 *
 * Verdict leads; chart is the visual proof. Per PRD §7.2 (verdicts not datasets).
 *
 * OQ-080 fix: caption text uses #666 (5.74:1 on white) rather than #888 (3.54:1).
 * Design spec: docs/design/pulz-oboru.md §4.2
 *
 * SVG security note (Q-POAL-007 / OQ-085): charts are rendered via a static
 * <img> tag, not inline SVG. SVG scripts are inert inside <img> — safe.
 * See docs/engineering/pulz-oboru.md §3 ADR-PO-002.
 */

import type { PulzChartView } from "@/lib/pulz-analyses";

export function ChartTile({ chart }: { chart: PulzChartView }) {
  return (
    <div
      role="region"
      aria-label={chart.verdict}
      style={{
        background: "#fafafa",
        border: "1px solid #e0e0e0",
        borderRadius: "8px",
        padding: "16px",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Verdict — always visible, always first */}
      <p
        style={{
          fontSize: "15px",
          fontWeight: 600,
          color: "#1a1a1a",
          margin: "0 0 12px 0",
          lineHeight: "1.5",
        }}
      >
        {chart.verdict}
      </p>

      {/* Divider between verdict and chart */}
      <div
        aria-hidden="true"
        style={{ borderTop: "1px solid #f0f0f0", marginBottom: "12px" }}
      />

      {/* Chart image — static <img>, SVG scripts are inert here */}
      <img
        src={chart.imageUrl}
        alt={chart.altText}
        style={{
          width: "100%",
          height: "auto",
          maxHeight: "180px",
          objectFit: "contain",
          display: "block",
        }}
        onError={(e) => {
          // Replace broken image with a muted placeholder text.
          // This mirrors the "Image load error" state from design §4.2.
          const img = e.currentTarget;
          img.style.display = "none";
          const placeholder = document.createElement("p");
          placeholder.textContent = "Graf není k dispozici.";
          placeholder.style.cssText =
            "font-size:13px;color:#666;margin:0;padding:16px 0;text-align:center;";
          img.parentNode?.insertBefore(placeholder, img.nextSibling);
        }}
      />

      {/* Caption / source attribution (optional) */}
      {chart.caption && (
        <p
          style={{
            fontSize: "12px",
            fontWeight: 400,
            /* OQ-080: #666 (5.74:1) instead of #888 (3.54:1) */
            color: "#666",
            margin: "8px 0 0 0",
            lineHeight: "1.4",
          }}
        >
          {chart.caption}
        </p>
      )}
    </div>
  );
}
