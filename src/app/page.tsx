/**
 * Root page — v0.2 customer-testing PoC dashboard scaffold.
 *
 * Phase 2.2.a + 2.2.c implementation:
 *   - Server component.
 *   - On first visit (no sr_user_id cookie), sets sr_user_id=DEMO_OWNER_USER_ID
 *     so subsequent navigations to /brief/[id] are recognised as the demo owner.
 *   - Renders the header band, tile-section placeholder (Phase 2.2.b), and
 *     the real brief list (Phase 2.2.c).
 *
 * Copy: docs/product/dashboard-v0-2.md §5 (canonical).
 * Layout tokens: docs/design/dashboard-v0-2/layout.md §5 + §6.
 * Identity bypass: docs/engineering/v0-2-identity-bypass.md §3–§5.
 * Brief list spec: docs/design/dashboard-v0-2/brief-list-item.md
 */

// Cookie-setting moved to src/middleware.ts — Next.js 14 App Router forbids
// cookies().set() from a server component (it's only allowed in Server Actions
// and Route Handlers). The middleware runs before this page renders and sets
// sr_user_id=DEMO_OWNER_USER_ID if it's missing.

import { listPublishedBriefsByNace } from "@/lib/briefs";
import type { Brief, BriefContent } from "@/lib/briefs";
import {
  BriefListItem,
  formatPublicationMonth,
} from "@/components/dashboard/BriefListItem";
import { DEMO_OWNER_USER_ID, isDemoOwner, DEMO_OWNER_PROFILE } from "@/lib/demo-owner";
import { getOwnerMetrics } from "@/lib/owner-metrics";
import MetricTile from "@/components/dashboard/MetricTile";
import type { MetricTileProps } from "@/components/dashboard/MetricTile";

// ─── Tile helpers ─────────────────────────────────────────────────────────────

// Canonical D-015 / D-011 category order — layout.md §7.2.
const CATEGORY_ORDER = [
  "ziskovost",
  "naklady-produktivita",
  "efektivita-kapitalu",
  "rust-trzni-pozice",
] as const;

/** Map D-011 category_id to frozen Czech label for the tile Row A badge. */
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

/** NACE 31 display label — brief-list-item.md §6.1 (Q-TBD-D-008 resolved: include it) */
const NACE_LABELS: Record<string, string> = {
  "31": "Výroba nábytku",
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

export default async function DashboardPage() {
  // ── Identity (v0-2-identity-bypass.md §4.4) ───────────────────────────────
  // DEMO_OWNER_USER_ID is always used at PoC; userId is retained for the
  // isDemoOwner guard that short-circuits getProfileByUserId.
  const userId = DEMO_OWNER_USER_ID;
  // Suppress unused-variable warning — isDemoOwner is used as type-guard below.
  void isDemoOwner;

  // ── Metric tiles (Phase 2.2.b) ────────────────────────────────────────────
  // Joins OwnerMetric fixture with getBenchmarkSnapshot('31') on metric_id.
  // Returns [] for non-demo userId; never throws.
  const ownerMetrics = await getOwnerMetrics(userId);

  // Sort into D-011 category order (fixture is already ordered; this is
  // defensive against future fixture reordering).
  const sortedMetrics = [...ownerMetrics].sort((a, b) => {
    const ai = CATEGORY_ORDER.indexOf(
      a.category_id as (typeof CATEGORY_ORDER)[number]
    );
    const bi = CATEGORY_ORDER.indexOf(
      b.category_id as (typeof CATEGORY_ORDER)[number]
    );
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  const tileProps: MetricTileProps[] = sortedMetrics.map((m) => ({
    metricId: m.metric_id,
    metricLabel: m.metric_label,
    categoryLabel: categoryLabelFor(m.category_id),
    rawValue: m.raw_value_display,
    quartileLabel:
      (m.quartile_label as MetricTileProps["quartileLabel"]) ?? null,
    percentile: m.percentile,
    confidenceState:
      m.confidence_state === "valid"
        ? "valid"
        : m.confidence_state === "below-floor"
        ? "below-floor"
        : "empty",
  }));

  // ── Briefs (Phase 2.2.c) ──────────────────────────────────────────────────
  // Fetch published briefs for the demo owner's NACE sector.
  // Fail-safe: on DB error, render empty state rather than crash.
  let briefs: Brief[] = [];
  try {
    briefs = await listPublishedBriefsByNace(DEMO_OWNER_PROFILE.nace_sector);
  } catch {
    // DB unreachable — render empty state per dashboard-v0-2.md §5.3
    briefs = [];
  }

  const now = Date.now();

  // ── Layout ───────────────────────────────────────────────────────────────────
  // Tokens from docs/design/dashboard-v0-2/layout.md §5.
  // Breakpoints applied via inline style + media queries in a <style> tag.

  // Inline stylesheet is injected via dangerouslySetInnerHTML to sidestep a
  // React hydration mismatch: when a <style>{`...`}</style> contains straight
  // quotes, the server-rendered HTML encodes them as &quot; while the client
  // decodes them on hydration, and React flags the delta. dangerouslySetInnerHTML
  // makes React skip the child-content comparison.
  const dashboardCss = `
        /* Dashboard layout — v0.2 PoC */
        /* docs/design/dashboard-v0-2/layout.md §4.2 max-width + breakpoints */

        .db-page {
          min-height: 100vh;
          background: #ffffff;
          font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          color: #1a1a1a;
        }

        /* Header band — layout.md §6 */
        .db-header {
          height: 48px;
          background: #ffffff;
          border-bottom: 1px solid #e0e0e0;
          display: flex;
          align-items: center;
          padding: 0 16px;
        }
        @media (min-width: 601px) {
          .db-header { height: 56px; padding: 0 24px; }
        }

        .db-wordmark {
          font-size: 15px;
          font-weight: 700;
          color: #1a1a1a;
          line-height: 1.3;
          margin: 0;
        }

        /* Content container — layout.md §4.2 */
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

        /* Section headings — layout.md §7.1, §8.1 */
        .db-section-heading {
          font-size: 18px;
          font-weight: 700;
          color: #1a1a1a;
          margin: 0 0 16px 0;
          line-height: 1.35;
        }

        /* Tile section — layout.md §7 */
        .db-tile-section {
          padding-top: 24px;
          padding-bottom: 32px;
        }

        /* Tile grid — layout.md §7.2 */
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

        /* Section divider — layout.md §4.3 */
        .db-divider {
          border: none;
          border-top: 1px solid #e0e0e0;
          margin: 0;
        }

        /* Briefs list section — layout.md §8 */
        .db-brief-section {
          padding-top: 24px;
          padding-bottom: 48px;
        }

        /* Placeholder blocks */
        .db-placeholder {
          border: 1px dashed #e0e0e0;
          border-radius: 4px;
          padding: 24px 16px;
          color: #888;
          font-size: 15px;
          line-height: 1.5;
          text-align: center;
        }

        /* Brief list rows — brief-list-item.md §3 hover/focus/pressed states */
        .bli-row:hover {
          background-color: #fafafa !important;
        }
        @media (prefers-reduced-motion: reduce) {
          .bli-row { transition: none !important; }
        }
        .bli-row:focus-visible {
          outline: 3px solid #1a1a1a;
          outline-offset: -3px;
        }
        .bli-row:active {
          background-color: #f0f0f0 !important;
        }

        /* Brief list last-row: no bottom divider — brief-list-item.md §4.1 */
        .db-brief-list li:last-child {
          border-bottom: none;
        }

        /* Empty state — brief-list-item.md §4.3 */
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
          color: #757575;
          margin: 0;
          line-height: 1.5;
        }
      `;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: dashboardCss }} />

      <div className="db-page">

        {/* Header band — D-018: "Česká Spořitelna · Strategy Radar" */}
        {/* layout.md §6: wordmark, no nav links */}
        <header role="banner" className="db-header">
          {/* Accessible h1 per layout.md §6 accessibility note */}
          <h1
            className="db-wordmark"
            aria-label="Strategy Radar"
          >
            Česká Spořitelna · Strategy Radar
          </h1>
        </header>

        <main>
          <div className="db-content">

            {/* Section 1 — Tile grid (placeholder for Phase 2.2.b) */}
            {/* Copy: dashboard-v0-2.md §5.2 section header */}
            <section className="db-tile-section" aria-labelledby="tile-section-heading">
              <h2 id="tile-section-heading" className="db-section-heading">
                Vaše pozice v kohortě
              </h2>
              <div className="db-placeholder" aria-label="Ukazatele budou doplněny">
                Ukazatele budou doplněny v dalším kroku
              </div>
            </section>

            {/* Section divider — layout.md §4.3 */}
            <hr className="db-divider" aria-hidden="true" />

            {/* Section 2 — Briefs list (Phase 2.2.c) */}
            {/* Copy: dashboard-v0-2.md §5.3; heading "Analýzy" per D-019 */}
            <section className="db-brief-section" aria-labelledby="brief-section-heading">
              <h2 id="brief-section-heading" className="db-section-heading" style={{ marginTop: "24px" }}>
                Analýzy
              </h2>

              {briefs.length === 0 ? (
                /* Empty state — dashboard-v0-2.md §5.3, brief-list-item.md §4.3 */
                <div className="db-brief-empty">
                  <p className="db-brief-empty-heading">Zatím žádné přehledy</p>
                  <p className="db-brief-empty-body">
                    Pro váš obor zatím nejsou k dispozici žádné přehledy.
                    Jakmile nějaký připravíme, objeví se zde.
                  </p>
                </div>
              ) : (
                /* Brief list — brief-list-item.md §4.1 */
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

      </div>
    </>
  );
}
