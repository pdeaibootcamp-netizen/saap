/**
 * Root page — v0.3 customer-testing PoC dashboard.
 *
 * v0.3 changes from v0.2:
 *   - getOwnerMetrics() now reads from owner_metrics DB table
 *     (when USE_REAL_OWNER_METRICS=true) instead of the v0.2 fixture.
 *   - MetricTile gains "ask" state for null owner metrics.
 *   - IcoSwitcher is rendered in the header band (right side, moderator-only).
 *   - ?saved=<metricId> query param drives the just-saved pulse class on
 *     the matching tile (design/in-tile-prompts.md §4.2).
 *
 * Copy: docs/product/dashboard-v0-2.md §5 (canonical).
 * Layout tokens: docs/design/dashboard-v0-2/layout.md §5 + §6.
 * Identity bypass: docs/engineering/v0-2-identity-bypass.md §3–§5.
 * In-tile prompts: docs/design/in-tile-prompts.md + docs/product/in-tile-prompts.md.
 *
 * ?saved mechanic (OQ-073 / design §9 Q-TBD-ITP-003):
 *   The MetricTile "ask" form submits via fetch PATCH, then calls
 *   router.push("/?saved=<metricId>") on success. On page reload, this
 *   server component reads searchParams.saved, finds the matching tile, and
 *   passes justSaved=true to it. MetricTile applies the "mt-just-saved" CSS
 *   class from globals.css (1 s box-shadow pulse). There is no client JS
 *   to strip the class after 1.5 s; the CSS animation is one-shot (forwards)
 *   and self-terminates. The param remains in the URL until the user navigates,
 *   but the tile no longer pulses (animation is done). This is the simplest
 *   correct approach; a Server Action redirect would not carry the param.
 */

import { listPublishedBriefsByNace } from "@/lib/briefs";
import type { Brief, BriefContent } from "@/lib/briefs";
import {
  BriefListItem,
  formatPublicationMonth,
} from "@/components/dashboard/BriefListItem";
import {
  DEMO_OWNER_USER_ID,
  isDemoOwner,
  DEMO_OWNER_PROFILE,
  DEMO_ACTIVE_ICO_COOKIE,
  DEMO_DEFAULT_ICO,
} from "@/lib/demo-owner";
import { getOwnerMetrics } from "@/lib/owner-metrics";
import MetricTile from "@/components/dashboard/MetricTile";
import type { MetricTileProps } from "@/components/dashboard/MetricTile";
import IcoSwitcher from "@/components/dashboard/IcoSwitcher";
import { cookies } from "next/headers";
import { METRIC_BOUNDS, type OwnerMetricId } from "@/types/data-lanes";

// ─── Tile helpers ─────────────────────────────────────────────────────────────

const CATEGORY_ORDER = [
  "ziskovost",
  "naklady-produktivita",
  "efektivita-kapitalu",
  "rust-trzni-pozice",
] as const;

function categoryLabelFor(categoryId: string): string {
  const labels: Record<string, string> = {
    "ziskovost": "Ziskovost",
    "naklady-produktivita": "Náklady a produktivita",
    "efektivita-kapitalu": "Efektivita kapitálu",
    "rust-trzni-pozice": "Růst a tržní pozice",
  };
  return labels[categoryId] ?? categoryId;
}

// ─── Brief helpers ────────────────────────────────────────────────────────────

const NACE_LABELS: Record<string, string> = {
  "31": "Výroba nábytku",
  "49": "Silniční nákladní doprava",
};

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function extractTitle(brief: Brief): string {
  const section = brief.content_sections?.find(
    (s) => s.section_id === "brief_content"
  );
  if (!section?.body) return `Přehled ${brief.id}`;
  try {
    const parsed = JSON.parse(section.body) as BriefContent;
    return parsed.title ?? `Přehled ${brief.id}`;
  } catch {
    return `Přehled ${brief.id}`;
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  // ── Identity (v0-2-identity-bypass.md §4.4) ───────────────────────────────
  const userId = DEMO_OWNER_USER_ID;
  void isDemoOwner; // used as type-guard elsewhere

  // ── Active IČO cookie (v0.3 IčO switcher, ADR-OM-02) ────────────────────
  const cookieStore = cookies();
  const activeIco = cookieStore.get(DEMO_ACTIVE_ICO_COOKIE)?.value ?? DEMO_DEFAULT_ICO;

  // ── just-saved metric ID (from ?saved=<metricId> post-PATCH redirect) ────
  // Used to apply the mt-just-saved CSS pulse class to the matching tile.
  const savedParam = searchParams?.saved;
  const justSavedMetricId = typeof savedParam === "string" ? savedParam : null;

  // ── Metric tiles ────────────────────────────────────────────────────────────
  // Reads from owner_metrics DB table (when USE_REAL_OWNER_METRICS=true).
  // Falls back to fixture on DB error. Never throws.
  const ownerMetrics = await getOwnerMetrics(userId);

  // Sort into D-011 category order
  const sortedMetrics = [...ownerMetrics].sort((a, b) => {
    const ai = CATEGORY_ORDER.indexOf(
      a.category_id as (typeof CATEGORY_ORDER)[number]
    );
    const bi = CATEGORY_ORDER.indexOf(
      b.category_id as (typeof CATEGORY_ORDER)[number]
    );
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  const tileProps: MetricTileProps[] = sortedMetrics.map((m) => {
    const metricId = m.metric_id as OwnerMetricId;
    const bounds = METRIC_BOUNDS[metricId];

    // Map OwnerMetric confidence_state to MetricTileProps confidenceState.
    // "ask" is the new v0.3 state — null owner value.
    let confidenceState: MetricTileProps["confidenceState"];
    if (m.confidence_state === "valid") {
      confidenceState = "valid";
    } else if (m.confidence_state === "below-floor") {
      confidenceState = "below-floor";
    } else if (m.confidence_state === "ask") {
      confidenceState = "ask";
    } else {
      confidenceState = "empty";
    }

    const isJustSaved = justSavedMetricId === m.metric_id;

    const baseProps: MetricTileProps = {
      metricId: m.metric_id,
      metricLabel: m.metric_label,
      categoryLabel: categoryLabelFor(m.category_id),
      rawValue: m.raw_value_display ?? null,
      quartileLabel: (m.quartile_label as MetricTileProps["quartileLabel"]) ?? null,
      percentile: m.percentile,
      confidenceState,
      justSaved: isJustSaved,
    };

    // Add ask-state props for tiles in "ask" state
    if (confidenceState === "ask" && bounds) {
      return {
        ...baseProps,
        promptHelpText: m.prompt_help_text,
        unitSuffix: m.unit_suffix,
        plausibilityMin: bounds.min,
        plausibilityMax: bounds.max,
        plausibilityDecimals: bounds.decimalPlaces,
        errorCopyOutOfBounds: bounds.errorCopy,
      };
    }

    return baseProps;
  });

  // ── Briefs ─────────────────────────────────────────────────────────────────
  // Fail-safe: on DB error, render empty state
  let briefs: Brief[] = [];
  try {
    briefs = await listPublishedBriefsByNace(DEMO_OWNER_PROFILE.nace_sector);
  } catch {
    briefs = [];
  }

  const now = Date.now();

  // ── Layout ────────────────────────────────────────────────────────────────

  const dashboardCss = `
        /* Dashboard layout — v0.3 */
        /* GDS hex values inlined — globals.css vars not reliable in inline <style> */

        .db-page {
          min-height: 100vh;
          background: #eef0f4;
          font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          color: #1a1a1a;
        }

        /* Header band — GDS primary blue bg */
        .db-header {
          height: 48px;
          background: #135ee2;
          display: flex;
          align-items: center;
          justify-content: space-between;
          position: relative;
          padding: 0 16px;
        }
        @media (min-width: 601px) {
          .db-header { height: 56px; padding: 0 24px; }
        }
        @media (max-width: 600px) {
          .db-header {
            flex-wrap: wrap;
            height: auto;
            min-height: 48px;
            padding: 8px 16px;
            gap: 8px;
          }
        }

        .db-wordmark {
          font-size: 17px;
          font-weight: 700;
          color: #ffffff;
          line-height: 1.3;
          margin: 0;
          flex-shrink: 0;
        }

        /* IčO switcher wrapper — right-side of header */
        .db-ico-switcher-wrap {
          display: flex;
          align-items: center;
        }

        .db-content {
          width: 100%;
          max-width: 100%;
          margin: 0 auto;
          padding: 0 16px;
          box-sizing: border-box;
        }
        @media (min-width: 601px) {
          .db-content { padding: 0 24px; }
        }
        @media (min-width: 1025px) {
          .db-content { max-width: 960px; padding: 0; }
        }

        .db-section-heading {
          font-size: 22px;
          font-weight: 700;
          color: #0a285c;
          margin: 0 0 16px 0;
          line-height: 1.35;
        }

        .db-tile-section {
          padding-top: 24px;
          padding-bottom: 32px;
        }

        .db-tile-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
        }
        @media (min-width: 601px) {
          .db-tile-grid {
            grid-template-columns: repeat(4, 1fr);
            gap: 16px;
          }
        }
        @media (min-width: 1025px) {
          .db-tile-grid {
            grid-template-columns: repeat(4, 1fr);
            gap: 20px;
          }
        }

        .db-divider {
          border: none;
          border-top: 1px solid #e4eaf0;
          margin: 0;
        }

        .db-brief-section {
          padding-top: 24px;
          padding-bottom: 48px;
        }

        .bli-row:hover {
          background-color: #eef0f4 !important;
        }
        @media (prefers-reduced-motion: reduce) {
          .bli-row { transition: none !important; }
        }
        .bli-row:focus-visible {
          outline: 3px solid #135ee2;
          outline-offset: -3px;
        }
        .bli-row:active {
          background-color: #e4eaf0 !important;
        }

        .db-brief-list li:last-child {
          border-bottom: none;
        }

        .db-brief-empty {
          padding: 24px 0;
        }
        .db-brief-empty-heading {
          font-size: 15px;
          font-weight: 600;
          color: #1a1a1a;
          margin: 0 0 8px 0;
        }
        .db-brief-empty-body {
          font-size: 12px;
          color: #537090;
          margin: 0;
          line-height: 1.5;
        }
      `;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: dashboardCss }} />

      <div className="db-page">

        {/* Header band — D-018: wordmark left, IčO switcher right */}
        <header role="banner" className="db-header">
          <h1 className="db-wordmark" aria-label="Strategy Radar">
            Strategy Radar
          </h1>

          {/* IčO switcher — moderator-only (design/in-tile-prompts.md §4.3) */}
          {/* Visible only when DEMO_MODE=true per ADR-OM-03 */}
          {process.env.DEMO_MODE === "true" && (
            <div className="db-ico-switcher-wrap">
              <IcoSwitcher activeIco={activeIco} />
            </div>
          )}
        </header>

        <main>
          <div className="db-content">

            {/* Section 1 — Tile grid */}
            <section className="db-tile-section" aria-labelledby="tile-section-heading">
              <h2 id="tile-section-heading" className="db-section-heading">
                Vaše pozice v kohortě
              </h2>

              {tileProps.length > 0 ? (
                <div className="db-tile-grid">
                  {tileProps.map((props) => (
                    <MetricTile key={props.metricId} {...props} />
                  ))}
                </div>
              ) : (
                <p style={{ color: "#888", fontSize: "15px" }}>
                  Pro váš obor zatím nejsou k dispozici žádné ukazatele.
                </p>
              )}
            </section>

            <hr className="db-divider" aria-hidden="true" />

            {/* Section 2 — Briefs list */}
            <section className="db-brief-section" aria-labelledby="brief-section-heading">
              <h2 id="brief-section-heading" className="db-section-heading" style={{ marginTop: "24px" }}>
                Analýzy
              </h2>

              {briefs.length === 0 ? (
                <div className="db-brief-empty">
                  <p className="db-brief-empty-heading">Zatím žádné přehledy</p>
                  <p className="db-brief-empty-body">
                    Pro váš obor zatím nejsou k dispozici žádné přehledy.
                    Jakmile nějaký připravíme, objeví se zde.
                  </p>
                </div>
              ) : (
                <ul
                  role="list"
                  className="db-brief-list"
                  style={{ listStyle: "none", margin: 0, padding: 0 }}
                  aria-label="Seznam analýz"
                >
                  {briefs.map((brief) => {
                    const title = extractTitle(brief);
                    const publicationMonth = formatPublicationMonth(brief.published_at);
                    const isNew = brief.published_at
                      ? now - new Date(brief.published_at).getTime() < THIRTY_DAYS_MS
                      : false;
                    return (
                      <BriefListItem
                        key={brief.id}
                        briefId={brief.id}
                        title={title}
                        publicationMonth={publicationMonth}
                        naceCode={brief.nace_sector}
                        naceName={NACE_LABELS[brief.nace_sector] ?? null}
                        isNew={isNew}
                      />
                    );
                  })}
                </ul>
              )}
            </section>

          </div>
        </main>

        {/* AI disclaimer — mandatory per agent system instructions */}
        <footer style={{ textAlign: "center", padding: "24px 16px 32px", color: "#9E9E9E", fontSize: "13px" }}>
          Tento prototyp byl vygenerován pomocí AI.
        </footer>

      </div>
    </>
  );
}
