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
  DEMO_ICO_NAMES,
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

  // ── Active firm's cohort cell (set by /api/owner/demo/switch) ────────────
  // When the moderator switches firms, the demo/switch route writes these
  // cookies so the dashboard can compute percentiles against the firm's
  // actual NACE × size × region cell. If unset, fall back to DEMO_OWNER_PROFILE.
  const activeNace =
    cookieStore.get("sr_active_nace")?.value || DEMO_OWNER_PROFILE.nace_sector;
  const activeSize =
    cookieStore.get("sr_active_size")?.value || DEMO_OWNER_PROFILE.size_band;
  const activeRegion =
    cookieStore.get("sr_active_region")?.value || DEMO_OWNER_PROFILE.region;

  // Active firm name — set by /api/owner/demo/switch (URL-encoded so non-ASCII
  // chars survive cookie transport). Falls back to the static DEMO_ICO_NAMES
  // map if the switcher hasn't run yet (cold-load before re-ingest with
  // migration 0009 has populated cohort_companies.name).
  const rawNameCookie = cookieStore.get("sr_active_name")?.value;
  const cookieName = rawNameCookie ? decodeURIComponent(rawNameCookie) : "";
  const activeName = cookieName || DEMO_ICO_NAMES[activeIco] || "";

  // ── just-saved metric ID (from ?saved=<metricId> post-PATCH redirect) ────
  // Used to apply the mt-just-saved CSS pulse class to the matching tile.
  const savedParam = searchParams?.saved;
  const justSavedMetricId = typeof savedParam === "string" ? savedParam : null;

  // ── Metric tiles ────────────────────────────────────────────────────────────
  // Reads from owner_metrics DB table (when USE_REAL_OWNER_METRICS=true).
  // Falls back to fixture on DB error. Never throws.
  const ownerMetrics = await getOwnerMetrics(userId, activeNace, activeSize, activeRegion);

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
    briefs = await listPublishedBriefsByNace(activeNace);
  } catch (err) {
    // DB unreachable — render empty state per dashboard-v0-2.md §5.3
    console.error("[dashboard] briefs fetch failed:", err);
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
          justify-content: center;
          position: relative;
          padding: 0 16px;
        }
        @media (min-width: 601px) {
          .db-header { height: 56px; padding: 0 24px; }
        }
        @media (max-width: 600px) {
          .db-header {
            justify-content: space-between;
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
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .db-demo-badge {
          display: inline-block;
          font-size: 10px;
          font-weight: 700;
          color: #E65100;
          background-color: #FFF3E0;
          border-radius: 999px;
          padding: 2px 6px;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          vertical-align: middle;
          line-height: 1.4;
        }

        /* IčO switcher wrapper — absolute right in header */
        .db-ico-switcher-wrap {
          position: absolute;
          right: 16px;
          top: 50%;
          transform: translateY(-50%);
          display: flex;
          align-items: center;
        }
        @media (min-width: 601px) {
          .db-ico-switcher-wrap { right: 24px; }
        }
        @media (max-width: 600px) {
          .db-ico-switcher-wrap {
            position: static;
            transform: none;
          }
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

        /* Tile grid — mobile-first responsive
           xs (<500 px):    1 sloupec — full-width karty na úzkých phonech
           medium (500–899): 2 sloupce — wide phone / tablet portrait
           large (≥900):    4 sloupce — tablet landscape + desktop
           xl (≥1025):      4 sloupce + větší gap */
        .db-tile-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 12px;
        }
        @media (min-width: 500px) {
          .db-tile-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        @media (min-width: 900px) {
          .db-tile-grid {
            grid-template-columns: repeat(4, 1fr);
            gap: 16px;
          }
        }
        @media (min-width: 1025px) {
          .db-tile-grid { gap: 20px; }
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

        /* Placeholder blocks */
        .db-placeholder {
          border: 1px dashed #e4eaf0;
          border-radius: 4px;
          padding: 24px 16px;
          color: #537090;
          font-size: 15px;
          line-height: 1.5;
          text-align: center;
        }

        /* Brief list rows — hover/focus/pressed states */
        .bli-row:hover {
          background-color: #e8f0fd !important;
        }
        @media (prefers-reduced-motion: reduce) {
          .bli-row { transition: none !important; }
        }
        .bli-row:focus-visible {
          outline: 3px solid #135ee2;
          outline-offset: -3px;
        }
        .bli-row:active {
          background-color: #d6e4fb !important;
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

        /* ── Pulz oboru / Ranní restart / Živé setkání (hardcoded demo) ── */
        .db-section-block {
          padding-top: 24px;
        }
        .db-section-heading-date {
          font-size: 14px;
          font-weight: 400;
          color: #666;
          margin-left: 8px;
        }
        .db-restart-card {
          background: #ffffff;
          border: 1px solid #e4eaf0;
          border-radius: 12px;
          padding: 20px 24px;
          position: relative;
        }
        .db-restart-card-time {
          position: absolute;
          top: 16px;
          right: 20px;
          font-size: 11px;
          color: #888;
          font-weight: 500;
        }
        .db-restart-card-text {
          font-size: 15px;
          color: #1a1a1a;
          line-height: 1.65;
          margin: 0;
          padding-right: 80px;
        }
        .db-event-card {
          display: flex;
          gap: 24px;
          background: #fafafa;
          border: 1px solid #e4eaf0;
          border-radius: 12px;
          padding: 24px;
          align-items: flex-start;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
        }
        .db-event-speaker {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          min-width: 110px;
          text-align: center;
          flex-shrink: 0;
        }
        .db-event-avatar {
          width: 72px;
          height: 72px;
          border-radius: 50%;
          background: #1F4FB6;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ffffff;
          font-size: 22px;
          font-weight: 700;
          letter-spacing: -0.02em;
        }
        .db-event-speaker-name {
          font-size: 13px;
          font-weight: 600;
          color: #1a1a1a;
          line-height: 1.3;
        }
        .db-event-speaker-role {
          font-size: 12px;
          color: #666;
          line-height: 1.4;
        }
        .db-event-body { flex: 1; }
        .db-event-title {
          font-size: 18px;
          font-weight: 700;
          color: #1a1a1a;
          margin: 0 0 8px;
          letter-spacing: -0.01em;
        }
        .db-event-teaser {
          font-size: 14px;
          color: #333;
          line-height: 1.55;
          margin: 0 0 16px;
        }
        .db-event-meta {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
          margin-bottom: 18px;
        }
        .db-event-date {
          font-size: 13px;
          font-weight: 600;
          color: #1a1a1a;
          background: #f0f4ff;
          border: 1px solid #c7d7f5;
          border-radius: 6px;
          padding: 4px 10px;
        }
        .db-event-pill {
          font-size: 11px;
          font-weight: 600;
          border-radius: 999px;
          padding: 3px 10px;
          background: #E8F0FF;
          color: #2256C9;
        }
        .db-event-cta {
          display: inline-block;
          background: #1F4FB6;
          color: #ffffff;
          font-size: 14px;
          font-weight: 600;
          padding: 10px 20px;
          border-radius: 8px;
          text-decoration: none;
          cursor: pointer;
          border: none;
          font-family: inherit;
        }
        .db-event-cta:hover { opacity: 0.88; }
        .db-event-note {
          margin-top: 12px;
          font-size: 13px;
          color: #666;
        }
        .db-pulz-empty {
          border: 1px dashed #d0d6dc;
          border-radius: 12px;
          padding: 32px 16px;
          color: #888;
          font-size: 13px;
          text-align: center;
          background: #fafafa;
        }
      `;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: dashboardCss }} />

      <div className="db-page">

        {/* Header band — wordmark centred, DEMO badge inline, IčO switcher absolute right */}
        <header role="banner" className="db-header">
          <h1 className="db-wordmark" aria-label="Strategy Radar — demo prostředí">
            Strategy Radar
            <span className="db-demo-badge" aria-hidden="true">DEMO</span>
          </h1>

          <div className="db-ico-switcher-wrap">
            <IcoSwitcher activeIco={activeIco} activeName={activeName} />
          </div>
        </header>

        <main>
          <div className="db-content">

            {/* Section 1 — Tile grid */}
            <section className="db-tile-section" aria-labelledby="tile-section-heading">
              <h2 id="tile-section-heading" className="db-section-heading">
                Vaše pozice v kohortě{activeName ? ` – ${activeName}` : ""}
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

            {/* Section 2 — Pulz oboru (placeholder, intentionally empty) */}
            <section className="db-section-block" aria-labelledby="pulz-section-heading">
              <h2 id="pulz-section-heading" className="db-section-heading">
                Pulz oboru
              </h2>
              <div className="db-pulz-empty">Sekce Pulz oboru — obsah bude doplněn.</div>
            </section>

            <hr className="db-divider" aria-hidden="true" />

            {/* Section 3 — Ranní restart (hardcoded demo content) */}
            <section className="db-section-block" aria-labelledby="restart-section-heading">
              <h2 id="restart-section-heading" className="db-section-heading">
                Ranní restart
                <span className="db-section-heading-date">29. dubna 2026</span>
              </h2>
              <div className="db-restart-card">
                <span className="db-restart-card-time">čte se za 45 s</span>
                <p className="db-restart-card-text">
                  Sazby ČNB nejspíš zůstanou beze změny, ale člen bankovní rady Jakub Seidler
                  naznačil, že čím déle potrvá konflikt v Perském zálivu, tím vyšší je
                  pravděpodobnost jejich zvýšení — firmy by měly počítat s tím, že financování
                  zůstane dražší déle, než se čekalo. Klíčové riziko pro podnikatele: historická
                  zkušenost ukazuje, že firmy v inflačním prostředí sklouzávají k navyšování
                  marží nad rámec skutečných nákladů — regulátoři i odběratelé to sledují.
                </p>
              </div>
            </section>

            <hr className="db-divider" aria-hidden="true" />

            {/* Section 4 — Živé setkání s odborníky (hardcoded demo content) */}
            <section className="db-section-block" aria-labelledby="event-section-heading">
              <h2 id="event-section-heading" className="db-section-heading">
                Živé setkání s odborníky
              </h2>
              <div className="db-event-card">
                <div className="db-event-speaker">
                  <div className="db-event-avatar">RN</div>
                  <div className="db-event-speaker-name">Mgr. Radek Novák, MBA</div>
                  <div className="db-event-speaker-role">Seniorní analytik · Česká spořitelna</div>
                </div>
                <div className="db-event-body">
                  <div className="db-event-title">Stavebnictví 2026: kde jsou marže a kde jsou rizika</div>
                  <p className="db-event-teaser">
                    Radek se věnuje sektorové analýze přes deset let a dříve pracoval na
                    ministerstvu průmyslu a obchodu. Na živém setkání projde klíčové trendy
                    v oboru, ukáže čísla, která nikde jinde neuvidíte, a zodpoví vaše dotazy
                    přímo.
                  </p>
                  <div className="db-event-meta">
                    <span className="db-event-date">18. června 2026 · 10:00–11:30</span>
                    <span className="db-event-pill">Stavebnictví</span>
                    <span className="db-event-pill">Úrokové prostředí</span>
                  </div>
                  <button type="button" className="db-event-cta">Rezervovat místo →</button>
                </div>
              </div>
              <p className="db-event-note">
                Průběžně pořádáme oborové webináře a setkání s analytiky ČS a externími
                experty, přihlásit se může každý klient Strategy Radaru.
              </p>
            </section>

            <hr className="db-divider" aria-hidden="true" />

            {/* Section 5 — Briefs list */}
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
                        naceCode={
                          brief.nace_sectors?.includes(activeNace)
                            ? activeNace
                            : brief.nace_sector
                        }
                        naceName={
                          NACE_LABELS[
                            brief.nace_sectors?.includes(activeNace)
                              ? activeNace
                              : brief.nace_sector
                          ] ?? null
                        }
                        isNew={isNew}
                      />
                    );
                  })}
                </ul>
              )}
            </section>

          </div>
        </main>

        {/* AI disclaimer is rendered globally v app/layout.tsx — nikoli zde,
            aby nedocházelo k duplikaci na dashboard route. */}

      </div>
    </>
  );
}
