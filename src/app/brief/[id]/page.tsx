/**
 * /brief/[id] — Owner brief detail view (Surface B — web view)
 *
 * Displays all six content components per information-architecture.md §3 Surface B:
 *   1. Záhlaví (header)
 *   2. Úvodní přehled (opening summary)
 *   3. Pozorování with time-horizon pills (2–4)
 *   4. Srovnávací přehled — four D-011 category accordions with BenchmarkSnippet
 *   5. Doporučené kroky with time-horizon pills (2–4)
 *   6. Zápatí (footer / PDF download CTA)
 *
 * When ?format=pdf query parameter is present: renders without chrome for
 * Puppeteer capture (ADR-0001-C). No nav, no header, just content.
 *
 * Auth: George JWT via ?token= or Supabase session (OQ-050 stub).
 * Consent gate: if no active consent, redirect to /consent?returnTo=this page.
 *
 * Czech copy per D-004. Formal register.
 */

import { redirect } from "next/navigation";
import Link from "next/link";
import type { Brief, BriefContent, BenchmarkCategory, BenchmarkMetric } from "@/lib/briefs";
import { getBriefById } from "@/lib/briefs";
import { resolveUserId } from "@/lib/auth";
import { hasActiveConsent } from "@/lib/consent";

// ─── BenchmarkSnippet ────────────────────────────────────────────────────────

function BenchmarkSnippet({ metric }: { metric: BenchmarkMetric }) {
  // Rung 4 / below-floor: verbatim fallback copy (quartile-position-display.md §5.5)
  if (metric.confidence_state === "below-floor") {
    return (
      <div style={{ padding: "12px 0" }}>
        <p style={{ fontSize: "14px", color: "#888", fontStyle: "italic" }}>
          Tento ukazatel zatím nemůžeme spolehlivě porovnat — k dispozici je málo
          srovnatelných firem v kohortě.
        </p>
      </div>
    );
  }

  // Empty state (no data this month)
  if (metric.confidence_state === "empty" || !metric.verdict_text) {
    return (
      <div style={{ padding: "12px 0" }}>
        <p style={{ fontSize: "14px", color: "#888", fontStyle: "italic" }}>
          Tento ukazatel není pro váš sektor v tomto měsíci k dispozici.
        </p>
      </div>
    );
  }

  // Render-time guard: if quartileLabel or percentile is null despite valid state,
  // fall back to empty-state copy (quartile-position-display.md §3 Error row)
  if (!metric.quartile_label || metric.percentile === null) {
    return (
      <div style={{ padding: "12px 0" }}>
        <p style={{ fontSize: "14px", color: "#888", fontStyle: "italic" }}>
          Tento ukazatel není pro váš sektor v tomto měsíci k dispozici.
        </p>
      </div>
    );
  }

  const percentileText = `${metric.percentile}. percentil`;
  const ariaLabel = `${metric.quartile_label}, ${percentileText}`;

  return (
    <div style={{ padding: "12px 0", borderBottom: "1px solid #f0f0f0" }}>
      <p style={{ fontSize: "13px", fontWeight: "600", color: "#555", marginBottom: "4px" }}>
        {metric.metric_label}
      </p>
      <p
        aria-label={ariaLabel}
        style={{ fontSize: "15px", color: "#1a1a1a", lineHeight: "1.5", marginBottom: "4px" }}
      >
        {metric.verdict_text}
      </p>
      {metric.rung_footnote && (
        <p
          style={{
            fontSize: "12px",
            color: "#888",
            fontStyle: "italic",
            lineHeight: "1.4",
          }}
        >
          {metric.rung_footnote}
        </p>
      )}
    </div>
  );
}

// ─── BenchmarkCategorySection ─────────────────────────────────────────────────

// The category component uses client-side state for accordion expansion.
// At SSR time (server component), we pre-expand the first category.
// Since this is a server component, all categories render expanded in PDF mode.
// In web mode the first is visually highlighted (CSS-only, no JS accordion at MVP).

function BenchmarkCategorySection({
  category,
  isFirst,
  isPdf,
}: {
  category: BenchmarkCategory;
  isFirst: boolean;
  isPdf: boolean;
}) {
  // Empty category check: all metrics are below-floor or excluded (null verdict_text)
  const hasAnyContent = category.metrics.some(
    (m) => m.confidence_state === "valid" && m.verdict_text
  );

  // The category-based-layout.md specifies per-category empty-state copy
  const categoryEmptyState: Record<string, string> = {
    ziskovost:
      "Srovnání ziskovosti pro váš sektor a velikost firmy tento měsíc nepřinášíme — počet srovnatelných firem v kohortě je zatím nedostatečný.",
    "naklady-produktivita":
      "Srovnání nákladů a produktivity pro váš sektor a velikost firmy tento měsíc nepřinášíme — počet srovnatelných firem v kohortě je zatím nedostatečný.",
    "efektivita-kapitalu":
      "Srovnání efektivity kapitálu pro váš sektor a velikost firmy tento měsíc nepřinášíme — počet srovnatelných firem v kohortě je zatím nedostatečný.",
    "rust-trzni-pozice":
      "Srovnání růstu a tržní pozice pro váš sektor a velikost firmy tento měsíc nepřinášíme — počet srovnatelných firem v kohortě je zatím nedostatečný.",
  };

  return (
    <details
      open={isFirst || isPdf}
      style={{
        border: "1px solid #e0e0e0",
        borderRadius: "6px",
        marginBottom: "8px",
        overflow: "hidden",
      }}
    >
      <summary
        style={{
          padding: "14px 16px",
          backgroundColor: "#f8f8f8",
          cursor: "pointer",
          fontWeight: "600",
          fontSize: "15px",
          listStyle: "none",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          minHeight: "44px",
        }}
        aria-label={`${category.category_label} — ${isPdf ? "rozbaleno" : "klikněte pro rozbalení"}`}
      >
        <span>{category.category_label}</span>
        <span style={{ fontSize: "12px", color: "#888" }} aria-hidden="true">
          ▼
        </span>
      </summary>

      <div style={{ padding: "0 16px 16px" }}>
        {category.metrics.length === 0 || !hasAnyContent ? (
          <p style={{ fontSize: "14px", color: "#888", padding: "12px 0", fontStyle: "italic" }}>
            {categoryEmptyState[category.category_id] ?? "Srovnání pro tuto kategorii tento měsíc nepřinášíme."}
          </p>
        ) : (
          category.metrics.map((m) => (
            <BenchmarkSnippet key={m.metric_id} metric={m} />
          ))
        )}
      </div>
    </details>
  );
}

// ─── Time-horizon pill ────────────────────────────────────────────────────────

function TimeHorizonPill({ label }: { label: string }) {
  const colorMap: Record<string, { bg: string; color: string }> = {
    "Okamžitě": { bg: "#fff3e0", color: "#e65100" },
    "Do 3 měsíců": { bg: "#e3f2fd", color: "#0d47a1" },
    "Do 12 měsíců": { bg: "#e8f5e9", color: "#1b5e20" },
    "Více než rok": { bg: "#f3e5f5", color: "#4a148c" },
  };
  const style = colorMap[label] ?? { bg: "#f5f5f5", color: "#555" };

  return (
    <span
      style={{
        display: "inline-block",
        padding: "3px 8px",
        borderRadius: "12px",
        fontSize: "12px",
        fontWeight: "600",
        backgroundColor: style.bg,
        color: style.color,
        marginBottom: "8px",
      }}
    >
      {label}
    </span>
  );
}

// ─── Consent-revoked screen ───────────────────────────────────────────────────

function ConsentRevokedScreen() {
  return (
    <main
      style={{
        minHeight: "100vh",
        backgroundColor: "#fff",
        fontFamily: "system-ui, sans-serif",
        maxWidth: "480px",
        margin: "0 auto",
        padding: "48px 20px",
        textAlign: "center",
      }}
    >
      <h1 style={{ fontSize: "22px", fontWeight: "bold", marginBottom: "16px" }}>
        Přehled není k dispozici
      </h1>
      <p style={{ fontSize: "15px", color: "#444", marginBottom: "32px", lineHeight: "1.5" }}>
        Váš souhlas se zpracováním dat byl odvolán. Přehledy vám přestanou být
        doručovány a obsah aplikace není přístupný.
      </p>
      <p style={{ fontSize: "14px", color: "#666" }}>
        Pokud chcete souhlas obnovit, kontaktujte prosím ČS poradce nebo se
        vraťte do aplikace.
      </p>
    </main>
  );
}

// ─── Brief not found / not published screen ───────────────────────────────────

function BriefNotReadyScreen() {
  return (
    <main
      style={{
        minHeight: "100vh",
        backgroundColor: "#fff",
        fontFamily: "system-ui, sans-serif",
        maxWidth: "480px",
        margin: "0 auto",
        padding: "48px 20px",
        textAlign: "center",
      }}
    >
      <h1 style={{ fontSize: "22px", fontWeight: "bold", marginBottom: "16px" }}>
        Váš přehled se připravuje
      </h1>
      <p style={{ fontSize: "15px", color: "#444", lineHeight: "1.5" }}>
        Váš sektorový přehled je právě připravován. Dostanete e-mail, jakmile
        bude k dispozici.
      </p>
    </main>
  );
}

// ─── Main brief page (server component) ──────────────────────────────────────

export default async function BriefPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { token?: string; format?: string };
}) {
  const isPdf = searchParams.format === "pdf";
  const token = searchParams.token ?? null;
  const briefId = params.id;

  // Resolve user ID
  const urlSearchParams = new URLSearchParams();
  if (token) urlSearchParams.set("token", token);
  const userId = await resolveUserId(urlSearchParams);

  // Check consent — if no active consent, redirect to consent screen
  // (fail-closed per OQ-049 principles)
  if (userId) {
    let consentActive = false;
    try {
      consentActive = await hasActiveConsent(userId);
    } catch {
      // Consent check error: fail-closed, redirect to consent screen
      if (!isPdf) {
        redirect(`/consent?returnTo=/brief/${briefId}${token ? `&token=${token}` : ""}`);
      }
    }

    if (!consentActive && !isPdf) {
      redirect(`/consent?returnTo=/brief/${briefId}${token ? `&token=${token}` : ""}`);
    }
  }

  // Load the brief
  let brief: Brief | null = null;
  try {
    brief = await getBriefById(briefId);
  } catch {
    // Pass — will show not-ready screen
  }

  if (!brief || brief.publish_state !== "published") {
    return <BriefNotReadyScreen />;
  }

  // Parse content from content_sections
  const contentSection = brief.content_sections?.find(
    (s) => s.section_id === "brief_content"
  );
  let content: BriefContent | null = null;
  if (contentSection?.body) {
    try {
      content = JSON.parse(contentSection.body) as BriefContent;
    } catch {
      // Malformed content — show not-ready
    }
  }

  if (!content) {
    return <BriefNotReadyScreen />;
  }

  // Resolve benchmark categories: prefer brief.benchmark_snippet over content
  const categories: BenchmarkCategory[] =
    brief.benchmark_snippet?.categories ?? content.benchmark_categories ?? [];

  const publicationMonth = content.publication_month ?? "—";
  const sectorName = `NACE ${brief.nace_sector}`;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const pdfUrl = `/api/pdf/${briefId}`;

  // ── PDF surface: minimal chrome ──
  if (isPdf) {
    return (
      <div
        style={{
          fontFamily: "Georgia, serif",
          maxWidth: "680px",
          margin: "0 auto",
          padding: "32px 40px",
          fontSize: "14px",
          lineHeight: "1.6",
          color: "#1a1a1a",
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: "24px", borderBottom: "2px solid #1a1a1a", paddingBottom: "16px" }}>
          <p style={{ fontSize: "12px", color: "#888", marginBottom: "4px" }}>
            Česká Spořitelna · Strategy Radar
          </p>
          <h1 style={{ fontSize: "22px", fontWeight: "bold", marginBottom: "4px" }}>
            {content.title || `Sektorový přehled — ${sectorName}`}
          </h1>
          <p style={{ fontSize: "14px", color: "#555" }}>{publicationMonth}</p>
        </div>

        {/* Opening summary */}
        {content.opening_summary && (
          <div style={{ marginBottom: "24px" }}>
            <p style={{ fontSize: "15px", lineHeight: "1.6" }}>{content.opening_summary}</p>
          </div>
        )}

        {/* Observations */}
        {content.observations?.length > 0 && (
          <div style={{ marginBottom: "24px" }}>
            <h2 style={{ fontSize: "16px", fontWeight: "bold", marginBottom: "12px" }}>
              Pozorování
            </h2>
            {content.observations.map((obs, i) => (
              <div key={i} style={{ marginBottom: "16px" }}>
                <p style={{ fontWeight: "600", marginBottom: "4px" }}>
                  <span
                    style={{
                      fontSize: "11px",
                      backgroundColor: "#f0f0f0",
                      padding: "2px 6px",
                      borderRadius: "8px",
                      marginRight: "8px",
                    }}
                  >
                    {obs.time_horizon}
                  </span>
                  {obs.headline}
                </p>
                {obs.body && (
                  <p style={{ fontSize: "13px", color: "#444" }}>{obs.body}</p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Benchmark categories — fully expanded in PDF */}
        {categories.length > 0 && (
          <div style={{ marginBottom: "24px" }}>
            <h2 style={{ fontSize: "16px", fontWeight: "bold", marginBottom: "12px" }}>
              Srovnávací přehled
            </h2>
            {categories.map((cat) => (
              <div key={cat.category_id} style={{ marginBottom: "16px" }}>
                <h3 style={{ fontSize: "14px", fontWeight: "600", marginBottom: "8px" }}>
                  {cat.category_label}
                </h3>
                {cat.metrics.map((m) => (
                  <BenchmarkSnippet key={m.metric_id} metric={m} />
                ))}
              </div>
            ))}
          </div>
        )}

        {/* Closing actions */}
        {content.closing_actions?.length > 0 && (
          <div style={{ marginBottom: "24px" }}>
            <h2 style={{ fontSize: "16px", fontWeight: "bold", marginBottom: "12px" }}>
              Doporučené kroky
            </h2>
            {content.closing_actions.map((action, i) => (
              <div key={i} style={{ marginBottom: "12px", paddingLeft: "16px", borderLeft: "2px solid #1a1a1a" }}>
                <p style={{ fontSize: "11px", color: "#888", marginBottom: "2px" }}>
                  {action.time_horizon}
                </p>
                <p style={{ fontSize: "14px" }}>{action.action_text}</p>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        {content.pdf_footer_text && (
          <div style={{ marginBottom: "24px" }}>
            <p style={{ fontSize: "14px", color: "#555" }}>{content.pdf_footer_text}</p>
          </div>
        )}

        {/* Confidentiality notice (OQ-046 placeholder) */}
        <div style={{ marginTop: "48px", borderTop: "1px solid #e0e0e0", paddingTop: "12px" }}>
          <p style={{ fontSize: "11px", color: "#aaa" }}>
            Důvěrné — jen pro interní potřebu firmy · Česká Spořitelna · {publicationMonth}
          </p>
        </div>
      </div>
    );
  }

  // ── Web surface: full chrome ──
  return (
    <main
      style={{
        minHeight: "100vh",
        backgroundColor: "#fff",
        fontFamily: "system-ui, sans-serif",
        maxWidth: "680px",
        margin: "0 auto",
        padding: "0 20px 80px",
      }}
    >
      {/* Brief header */}
      <div style={{ padding: "24px 0 20px", borderBottom: "1px solid #e0e0e0", marginBottom: "24px" }}>
        <p style={{ fontSize: "12px", color: "#888", marginBottom: "4px" }}>
          Strategy Radar · {sectorName}
        </p>
        <h1 style={{ fontSize: "22px", fontWeight: "bold", marginBottom: "4px", color: "#1a1a1a" }}>
          {content.title || `Sektorový přehled — ${sectorName}`}
        </h1>
        <p style={{ fontSize: "14px", color: "#666" }}>{publicationMonth}</p>
      </div>

      {/* Opening summary */}
      {content.opening_summary && (
        <section style={{ marginBottom: "28px" }}>
          <p style={{ fontSize: "16px", lineHeight: "1.6", color: "#1a1a1a" }}>
            {content.opening_summary}
          </p>
        </section>
      )}

      {/* Observations */}
      {content.observations?.length > 0 && (
        <section style={{ marginBottom: "28px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: "bold", marginBottom: "16px" }}>
            Pozorování
          </h2>
          {content.observations.map((obs, i) => (
            <div
              key={i}
              style={{
                padding: "16px",
                border: "1px solid #e0e0e0",
                borderRadius: "8px",
                marginBottom: "12px",
              }}
            >
              {obs.time_horizon && <TimeHorizonPill label={obs.time_horizon} />}
              <h3 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "8px", color: "#1a1a1a" }}>
                {obs.headline}
              </h3>
              {obs.body && (
                <p style={{ fontSize: "15px", color: "#444", lineHeight: "1.5" }}>
                  {obs.body}
                </p>
              )}
            </div>
          ))}
        </section>
      )}

      {/* Srovnávací přehled — four category accordions */}
      {categories.length > 0 && (
        <section style={{ marginBottom: "28px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: "bold", marginBottom: "16px" }}>
            Srovnávací přehled
          </h2>
          {categories.map((cat, idx) => (
            <BenchmarkCategorySection
              key={cat.category_id}
              category={cat}
              isFirst={idx === 0}
              isPdf={false}
            />
          ))}
        </section>
      )}

      {/* Closing actions */}
      {content.closing_actions?.length > 0 && (
        <section style={{ marginBottom: "28px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: "bold", marginBottom: "16px" }}>
            Doporučené kroky
          </h2>
          {content.closing_actions.map((action, i) => (
            <div
              key={i}
              style={{
                padding: "14px 16px",
                borderLeft: "3px solid #1a1a1a",
                marginBottom: "12px",
                backgroundColor: "#fafafa",
              }}
            >
              {action.time_horizon && <TimeHorizonPill label={action.time_horizon} />}
              <p style={{ fontSize: "15px", color: "#1a1a1a", lineHeight: "1.5" }}>
                {action.action_text}
              </p>
            </div>
          ))}
        </section>
      )}

      {/* Footer / PDF CTA */}
      {content.pdf_footer_text && (
        <section style={{ marginBottom: "24px" }}>
          <p style={{ fontSize: "14px", color: "#555", lineHeight: "1.5" }}>
            {content.pdf_footer_text}
          </p>
        </section>
      )}

      {/* PDF download CTA */}
      <div
        style={{
          borderTop: "1px solid #e0e0e0",
          paddingTop: "20px",
          marginTop: "8px",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        <a
          href={pdfUrl}
          download
          style={{
            display: "inline-block",
            padding: "14px 24px",
            backgroundColor: "#1a1a1a",
            color: "#fff",
            textDecoration: "none",
            borderRadius: "6px",
            fontSize: "15px",
            fontWeight: "bold",
            textAlign: "center",
            minHeight: "44px",
            lineHeight: "16px",
          }}
        >
          Stáhnout přehled jako PDF
        </a>
        <a
          href="/"
          style={{ fontSize: "14px", color: "#666", textDecoration: "none", textAlign: "center" }}
        >
          Zpět do George
        </a>
      </div>
    </main>
  );
}
