/**
 * PulzOboruSection — server component, Section 2 of the v0.3 dashboard.
 *
 * Positioned between:
 *   Section 1 — Vaše pozice v kohortě (cohort tile grid)
 *   Section 3 — Analýzy (briefs list)
 *
 * Fetches the current Pulz oboru analysis for the active demo owner's NACE
 * division via getCurrentPulzAnalysisForNace(). Renders:
 *   - Default state:  StaleWarningBadge (if stale) + publication-date subline +
 *                     3-tile grid + SummaryTextBlock + PdfLink + ActionBox
 *   - Empty state:    EmptyStateCard
 *   - Error state:    ErrorCard (error is scoped to this section only)
 *
 * Error boundary: any throw from getCurrentPulzAnalysisForNace() is caught
 * here and renders the ErrorCard. The cohort tiles (Section 1) and briefs
 * list (Section 3) are not affected.
 *
 * Privacy: reads brief lane only. No user_contributed, rm_visible, or
 * credit_risk reads in this component or its children.
 *
 * Stale threshold: 91 days from published_at (PM §4.5 / OQ-080 resolved).
 *
 * Design spec: docs/design/pulz-oboru.md §4.1
 * PM spec: docs/product/pulz-oboru.md §3
 */

import { getCurrentPulzAnalysisForNace } from "@/lib/pulz-analyses";
import { ChartTile } from "./ChartTile";
import { SummaryTextBlock } from "./SummaryTextBlock";
import { PdfLink } from "./PdfLink";
import { ActionBox } from "./ActionBox";
import { StaleWarningBadge } from "./StaleWarningBadge";
import { EmptyStateCard } from "./EmptyStateCard";
import { ErrorCard } from "./ErrorCard";

/** 91 days in milliseconds — PM §4.5 / Q-PO-008 resolved. */
const STALE_THRESHOLD_MS = 91 * 24 * 60 * 60 * 1000;

export async function PulzOboruSection({ naceDivision }: { naceDivision: string }) {
  // ── Section wrapper styles ────────────────────────────────────────────────
  const sectionStyle: React.CSSProperties = {
    paddingTop: "24px",
    paddingBottom: "32px",
  };

  const headingStyle: React.CSSProperties = {
    fontSize: "22px",
    fontWeight: 700,
    color: "#0a285c",
    margin: "0 0 16px 0",
    lineHeight: "1.35",
  };

  // ── Fetch ─────────────────────────────────────────────────────────────────
  let analysis;
  let fetchError = false;

  try {
    analysis = await getCurrentPulzAnalysisForNace(naceDivision);
  } catch {
    fetchError = true;
  }

  // ── Error state ───────────────────────────────────────────────────────────
  if (fetchError) {
    return (
      <section style={sectionStyle} aria-labelledby="pulz-section-heading">
        <h2 id="pulz-section-heading" style={headingStyle}>
          Pulz oboru
        </h2>
        <ErrorCard />
      </section>
    );
  }

  // ── Empty state ───────────────────────────────────────────────────────────
  if (!analysis) {
    return (
      <section style={sectionStyle} aria-labelledby="pulz-section-heading">
        <h2 id="pulz-section-heading" style={headingStyle}>
          Pulz oboru
        </h2>
        <EmptyStateCard />
      </section>
    );
  }

  // ── Stale check ───────────────────────────────────────────────────────────
  const now = Date.now();
  const publishedAtMs = new Date(analysis.publishedAt).getTime();
  const isStale = now - publishedAtMs > STALE_THRESHOLD_MS;

  // ── Default / stale state ─────────────────────────────────────────────────
  return (
    <section style={sectionStyle} aria-labelledby="pulz-section-heading">
      <h2 id="pulz-section-heading" style={headingStyle}>
        Pulz oboru
      </h2>

      {/* Stale warning badge — rendered between heading and publication-date subline */}
      {isStale && <StaleWarningBadge publishedAt={analysis.publishedAt} />}

      {/* Publication-date subline */}
      <p
        style={{
          fontSize: "13px",
          color: "#537090",
          margin: "0 0 20px 0",
        }}
      >
        Analýza pro {analysis.naceLabelCzech} · {analysis.publicationPeriod}
      </p>

      {/* Block 1 — 3 chart tiles */}
      {/* id="pulz-chart-grid" is required by the responsive <style> block below */}
      <div
        id="pulz-chart-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "16px",
          marginBottom: "16px",
        }}
      >
        {analysis.charts.map((chart) => (
          <ChartTile key={chart.slotIndex} chart={chart} />
        ))}
      </div>

      {/* Block 2 — Summary text */}
      <SummaryTextBlock text={analysis.summaryText} />

      {/* Block 3 — Optional PDF link */}
      <PdfLink
        pdfUrl={analysis.pdfUrl}
        pdfSourceLabel={analysis.pdfSourceLabel}
        publicationPeriod={analysis.publicationPeriod}
      />

      {/* Block 4 — Action box */}
      <ActionBox actions={analysis.actions} />

      {/* Responsive grid collapse: 1 column on ≤ 600 px */}
      <style>{`
        @media (max-width: 600px) {
          #pulz-chart-grid {
            grid-template-columns: 1fr !important;
            gap: 12px !important;
          }
        }
      `}</style>
    </section>
  );
}
