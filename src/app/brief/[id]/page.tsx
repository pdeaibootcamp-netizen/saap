/**
 * /brief/[id] — Owner brief detail view (Surface B — web view)
 *
 * v0.2 shape (D-020, brief-page-v0-2.md):
 *   1. Záhlaví (header)
 *   2. Sektorová analýza block — layperson opener (always visible) +
 *      collapsible full ČS publication (<details>/<summary>).
 *      Omitted if content.publication is absent (v0.1 brief: render
 *      opening_summary instead, then observations directly).
 *   3. Doporučené kroky — paired observation+action cards, then orphan
 *      actions under "Další doporučené kroky" (omitted when empty).
 *   4. Zápatí (footer / PDF download CTA)
 *
 * Removed in v0.2 (brief-page-v0-2.md §7):
 *   - "Srovnávací přehled" section (web + PDF surfaces)
 *   - BenchmarkCategorySection and BenchmarkSnippet JSX components
 *     (grep confirmed zero callers other than this file; deleted here.
 *      BenchmarkSnippet type + benchmark_snippet column stay on disk.)
 *
 * Fallback for v0.1 briefs (no paired_observation_index on any action):
 *   All actions treated as orphans → rendered under "Další doporučené kroky".
 *   Heuristic: if every action's paired_observation_index is undefined or
 *   null, the brief is v0.1-shaped; fall back to flat-list rendering.
 *
 * Container width: 680px reading column (OQ-057 resolved — PD spec §2b).
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
import { cookies } from "next/headers";
import type { Brief, BriefContent } from "@/lib/briefs";
import { getBriefById } from "@/lib/briefs";
import { resolveUserId } from "@/lib/auth";
import { hasActiveConsent } from "@/lib/consent";
import { isDemoOwner, DEMO_OWNER_USER_ID } from "@/lib/demo-owner";

// ─── Time-horizon pill ────────────────────────────────────────────────────────

function TimeHorizonPill({ label, subordinate = false }: { label: string; subordinate?: boolean }) {
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
        fontSize: subordinate ? "11px" : "12px",
        fontWeight: "600",
        backgroundColor: style.bg,
        color: style.color,
        marginBottom: "8px",
        opacity: subordinate ? 0.75 : 1,
      }}
    >
      {label}
    </span>
  );
}

// ─── Markdown paragraph renderer ─────────────────────────────────────────────
// Split on double-newline → render one <p> per block.
// v0.2 plain-text approach; upgrade to remark/rehype for v0.3 when table +
// list rendering in the full analyst text is needed (brief-page-v0-2.md §6.4).

function MarkdownParagraphs({
  text,
  color = "var(--gds-text-body)",
  fontSize = "15px",
}: {
  text: string;
  color?: string;
  fontSize?: string;
}) {
  const blocks = text.split(/\n\n+/).map((b) => b.trim()).filter(Boolean);
  return (
    <>
      {blocks.map((block, i) => (
        <p
          key={i}
          style={{
            fontSize,
            color,
            lineHeight: "1.6",
            marginBottom: i < blocks.length - 1 ? "12px" : "0",
          }}
        >
          {block}
        </p>
      ))}
    </>
  );
}

// ─── Sektorová analýza block ──────────────────────────────────────────────────
// brief-page-v0-2.md §4, design §4.1.
// Native <details>/<summary>; no JS needed. CSS attribute selector on
// details[open] summary flips the label text via content: — but because
// Next.js server components can't inject a <style> block trivially in JSX,
// we use a data-label approach and inline the two states via ::before in a
// global style tag.  Simpler alternative used here: render both labels and
// hide/show with CSS sibling selector via the [open] attribute.
//
// Accessibility: <details>/<summary> provides aria-expanded automatically.
// Chevrons are aria-hidden. <summary> min-height 44px for touch targets.

function SekterovaAnalyzaBlock({
  heading,
  openerMarkdown,
  fullTextMarkdown,
  source,
}: {
  heading: string;
  openerMarkdown: string;
  fullTextMarkdown: string;
  source: string;
}) {
  return (
    <section style={{ marginBottom: "28px" }}>
      <h2 style={{ fontSize: "18px", fontWeight: "bold", marginBottom: "16px", color: "var(--gds-heading-color)" }}>
        {heading}
      </h2>
      <div
        style={{
          borderLeft: "4px solid var(--gds-border-default)",
          paddingLeft: "16px",
          backgroundColor: "var(--gds-surface-card)",
          borderRadius: "6px",
          padding: "16px 16px 16px 20px",
        }}
      >
        {/* Opener — always visible */}
        <MarkdownParagraphs text={openerMarkdown} color="var(--gds-text-body)" />

        {/* Source attribution */}
        {source && (
          <p style={{ fontSize: "13px", color: "var(--gds-text-muted)", marginTop: "12px", fontStyle: "italic" }}>
            {source}
          </p>
        )}

        {/* Collapsible full text — CSS-only label flip via [open] attribute selector */}
        {fullTextMarkdown && (
          <>
            {/* Inline style block: flip summary text on open state. */}
            <style>{`
              .sr-disclosure summary::before {
                content: "▶ Číst celou analýzu";
                font-size: 14px;
                font-weight: 600;
                color: var(--gds-color-primary);
                cursor: pointer;
              }
              .sr-disclosure[open] summary::before {
                content: "▼ Skrýt celou analýzu";
              }
              .sr-disclosure summary:focus {
                outline: 3px solid var(--gds-color-primary);
                outline-offset: 2px;
                border-radius: 2px;
              }
              .sr-disclosure summary:hover {
                background: var(--gds-page-bg);
                border-radius: 4px;
              }
            `}</style>
            <details className="sr-disclosure" style={{ marginTop: "16px" }}>
              <summary
                style={{
                  listStyle: "none",
                  minHeight: "44px",
                  display: "flex",
                  alignItems: "center",
                  padding: "4px 0",
                  cursor: "pointer",
                }}
                aria-label="Číst celou analýzu"
              />
              <div style={{ marginTop: "16px", borderTop: "1px solid var(--gds-border-default)", paddingTop: "16px" }}>
                <MarkdownParagraphs
                  text={fullTextMarkdown}
                  color="var(--gds-text-secondary)"
                  fontSize="15px"
                />
              </div>
            </details>
          </>
        )}
      </div>
    </section>
  );
}

// ─── Paired observation + action card ────────────────────────────────────────
// Design spec §4.2. Continuous 4px left border spans observation → divider → action.
// "Doporučený krok:" prefix on action is a text signal (not colour-only).

function ObservationActionPair({
  obsHeadline,
  obsBody,
  obsTimeHorizon,
  actionText,
  actionTimeHorizon,
}: {
  obsHeadline: string;
  obsBody?: string;
  obsTimeHorizon?: string;
  actionText?: string;
  actionTimeHorizon?: string;
}) {
  const hasAction = Boolean(actionText);
  return (
    <div
      style={{
        borderLeft: "4px solid var(--gds-heading-color)",
        padding: "16px 16px 16px 20px",
        marginBottom: "32px",
      }}
    >
      {/* Observation */}
      {obsTimeHorizon && <TimeHorizonPill label={obsTimeHorizon} />}
      <h3
        style={{
          fontSize: "15px",
          fontWeight: "600",
          marginBottom: "8px",
          color: "var(--gds-text-body)",
          marginTop: "0",
        }}
      >
        {obsHeadline}
      </h3>
      {obsBody && (
        <p style={{ fontSize: "15px", color: "var(--gds-text-secondary)", lineHeight: "1.5", marginBottom: hasAction ? "12px" : "0" }}>
          {obsBody}
        </p>
      )}

      {/* Within-pair divider + action */}
      {hasAction && (
        <>
          <div style={{ borderTop: "1px solid var(--gds-border-default)", margin: "12px 0" }} />
          {actionTimeHorizon && <TimeHorizonPill label={actionTimeHorizon} subordinate />}
          <p
            style={{
              fontSize: "12px",
              fontWeight: "600",
              color: "var(--gds-text-secondary)",
              letterSpacing: "0.04em",
              marginBottom: "4px",
              marginTop: "0",
            }}
          >
            Doporučený krok:
          </p>
          <p style={{ fontSize: "15px", color: "var(--gds-text-body)", lineHeight: "1.5", margin: "0" }}>
            {actionText}
          </p>
        </>
      )}
    </div>
  );
}

// ─── Orphan action card ───────────────────────────────────────────────────────
// Design spec §4.3. Simpler card: no left-border connector, no label prefix.

function OrphanActionCard({
  actionText,
  timeHorizon,
}: {
  actionText: string;
  timeHorizon?: string;
}) {
  return (
    <div
      style={{
        border: "1px solid var(--gds-border-default)",
        borderRadius: "6px",
        padding: "14px 16px",
        backgroundColor: "var(--gds-surface-card)",
        marginBottom: "12px",
      }}
    >
      {timeHorizon && <TimeHorizonPill label={timeHorizon} />}
      <p style={{ fontSize: "15px", color: "var(--gds-text-body)", lineHeight: "1.5", margin: "0" }}>
        {actionText}
      </p>
    </div>
  );
}

// ─── Consent-revoked screen ───────────────────────────────────────────────────

function ConsentRevokedScreen() {
  return (
    <main
      style={{
        minHeight: "100vh",
        backgroundColor: "var(--gds-surface-card)",
        fontFamily: "'Inter var', Inter, system-ui, sans-serif",
        maxWidth: "480px",
        margin: "0 auto",
        padding: "48px 20px",
        textAlign: "center",
      }}
    >
      <h1 style={{ fontSize: "22px", fontWeight: "bold", marginBottom: "16px", color: "var(--gds-heading-color)" }}>
        Přehled není k dispozici
      </h1>
      <p style={{ fontSize: "15px", color: "var(--gds-text-secondary)", marginBottom: "32px", lineHeight: "1.5" }}>
        Váš souhlas se zpracováním dat byl odvolán. Přehledy vám přestanou být
        doručovány a obsah aplikace není přístupný.
      </p>
      <p style={{ fontSize: "14px", color: "var(--gds-text-secondary)" }}>
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
        backgroundColor: "var(--gds-surface-card)",
        fontFamily: "'Inter var', Inter, system-ui, sans-serif",
        maxWidth: "480px",
        margin: "0 auto",
        padding: "48px 20px",
        textAlign: "center",
      }}
    >
      <h1 style={{ fontSize: "22px", fontWeight: "bold", marginBottom: "16px", color: "var(--gds-heading-color)" }}>
        Váš přehled se připravuje
      </h1>
      <p style={{ fontSize: "15px", color: "var(--gds-text-secondary)", lineHeight: "1.5" }}>
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

  // Resolve user ID — v0.2: check sr_user_id cookie first (set by dashboard on first visit).
  // If the cookie holds DEMO_OWNER_USER_ID, we short-circuit the George JWT / Supabase
  // session chain entirely. See v0-2-identity-bypass.md §4.3.
  const cookieStore = cookies();
  const cookieUserId = cookieStore.get("sr_user_id")?.value ?? null;
  let userId: string | null = null;
  if (cookieUserId && isDemoOwner(cookieUserId)) {
    userId = DEMO_OWNER_USER_ID;
  } else {
    const urlSearchParams = new URLSearchParams();
    if (token) urlSearchParams.set("token", token);
    userId = await resolveUserId(urlSearchParams);
  }

  // Check consent — if no active consent, redirect to consent screen
  // (fail-closed per OQ-049 principles)
  if (userId) {
    // v0.2 bypass: demo owner always has consent; skip DB check entirely.
    // See v0-2-identity-bypass.md §4.1.
    if (isDemoOwner(userId)) {
      // no-op: consent is implicitly granted for the demo owner
    } else {
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

  const publicationMonth = content.publication_month ?? "—";
  const sectorName = `NACE ${brief.nace_sector}`;
  const pdfUrl = `/api/pdf/${briefId}`;

  // ─── Paired / orphan computation ─────────────────────────────────────────
  // v0.1 fallback heuristic: if EVERY action has paired_observation_index
  // undefined or null, treat as v0.1 flat-list (all orphans).
  const actions = content.closing_actions ?? [];
  const observations = content.observations ?? [];

  const isV1Shape = actions.every(
    (a) => a.paired_observation_index === undefined || a.paired_observation_index === null
  );

  // For each observation index, find the first paired action (if any).
  const pairedActionForObs = (obsIdx: number) =>
    isV1Shape
      ? undefined
      : actions.find((a) => a.paired_observation_index === obsIdx);

  // Orphan actions: null/undefined paired_observation_index (or all, if v0.1 shape).
  const orphanActions = isV1Shape
    ? actions
    : actions.filter(
        (a) => a.paired_observation_index === undefined || a.paired_observation_index === null
      );

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

        {/* Sektorová analýza — opener (expanded in PDF; full text omitted for length) */}
        {content.publication && (
          <div style={{ marginBottom: "24px" }}>
            <h2 style={{ fontSize: "16px", fontWeight: "bold", marginBottom: "12px" }}>
              {content.publication.heading}
            </h2>
            <div
              style={{
                borderLeft: "3px solid #e0e0e0",
                paddingLeft: "14px",
                backgroundColor: "#fafafa",
                padding: "12px 12px 12px 16px",
              }}
            >
              {content.publication.opener_markdown
                .split(/\n\n+/)
                .map((b) => b.trim())
                .filter(Boolean)
                .map((block, i) => (
                  <p key={i} style={{ fontSize: "13px", color: "#1a1a1a", lineHeight: "1.6", marginBottom: "8px" }}>
                    {block}
                  </p>
                ))}
              {content.publication.source && (
                <p style={{ fontSize: "11px", color: "#888", fontStyle: "italic", marginTop: "8px" }}>
                  {content.publication.source}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Opening summary (v0.1 briefs) */}
        {!content.publication && content.opening_summary && (
          <div style={{ marginBottom: "24px" }}>
            <p style={{ fontSize: "15px", lineHeight: "1.6" }}>{content.opening_summary}</p>
          </div>
        )}

        {/* Observations + paired actions */}
        {observations.length > 0 && (
          <div style={{ marginBottom: "24px" }}>
            <h2 style={{ fontSize: "16px", fontWeight: "bold", marginBottom: "12px" }}>
              Doporučené kroky
            </h2>
            {observations.map((obs, i) => {
              const paired = pairedActionForObs(i);
              return (
                <div
                  key={i}
                  style={{
                    marginBottom: "16px",
                    borderLeft: "2px solid #1a1a1a",
                    paddingLeft: "12px",
                  }}
                >
                  <p style={{ fontWeight: "600", marginBottom: "4px", fontSize: "14px" }}>
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
                    <p style={{ fontSize: "13px", color: "#444", marginBottom: paired ? "8px" : "0" }}>
                      {obs.body}
                    </p>
                  )}
                  {paired && (
                    <div style={{ marginTop: "6px", borderTop: "1px solid #f0f0f0", paddingTop: "6px" }}>
                      <p style={{ fontSize: "11px", color: "#888", marginBottom: "2px" }}>
                        Doporučený krok: {paired.time_horizon}
                      </p>
                      <p style={{ fontSize: "13px" }}>{paired.action_text}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Orphan actions */}
        {orphanActions.length > 0 && (
          <div style={{ marginBottom: "24px" }}>
            <h2 style={{ fontSize: "16px", fontWeight: "bold", marginBottom: "12px" }}>
              Další doporučené kroky
            </h2>
            {orphanActions.map((action, i) => (
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
        backgroundColor: "var(--gds-page-bg)",
        fontFamily: "'Inter var', Inter, system-ui, sans-serif",
      }}
    >
      {/* Header CSS — identical breakpoints as dashboard .db-header */}
      <style dangerouslySetInnerHTML={{ __html: `
        .bp-header {
          height: 48px;
          background: #135ee2;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          padding: 0 16px;
        }
        @media (min-width: 601px) {
          .bp-header { height: 56px; padding: 0 24px; }
        }
      `}} />

      {/* Blue header stripe — matches dashboard header */}
      <header className="bp-header">
        <a
          href="/"
          style={{
            position: "absolute",
            left: "16px",
            color: "#ffffff",
            fontSize: "15px",
            fontWeight: 600,
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
          }}
          aria-label="Zpět na dashboard"
        >
          ← Zpět
        </a>
        <span style={{ fontSize: "17px", fontWeight: 700, color: "#ffffff" }}>
          Strategy Radar
        </span>
      </header>

      {/* Content card */}
      <div style={{ maxWidth: "680px", margin: "0 auto", padding: "16px 16px 80px" }}>
        <div
          style={{
            backgroundColor: "#ffffff",
            borderRadius: "12px",
            padding: "24px 20px",
            border: "1px solid #e4eaf0",
          }}
        >
          {/* Brief header */}
          <div style={{ paddingBottom: "20px", borderBottom: "1px solid var(--gds-border-default)", marginBottom: "24px" }}>
            <p style={{ fontSize: "12px", color: "var(--gds-text-muted)", marginBottom: "4px" }}>
              Česká Spořitelna · Strategy Radar
            </p>
            <h1 style={{ fontSize: "22px", fontWeight: "bold", marginBottom: "4px", color: "var(--gds-heading-color)" }}>
              {content.title || `Sektorový přehled — ${sectorName}`}
            </h1>
            <p style={{ fontSize: "14px", color: "var(--gds-text-secondary)" }}>{publicationMonth}</p>
          </div>

      {/* Sektorová analýza block (v0.2) */}
      {content.publication ? (
        <SekterovaAnalyzaBlock
          heading={content.publication.heading}
          openerMarkdown={content.publication.opener_markdown}
          fullTextMarkdown={content.publication.full_text_markdown}
          source={content.publication.source}
        />
      ) : (
        /* v0.1 fallback: render opening_summary if present */
        content.opening_summary && (
          <section style={{ marginBottom: "28px" }}>
            <p style={{ fontSize: "16px", lineHeight: "1.6", color: "var(--gds-text-body)" }}>
              {content.opening_summary}
            </p>
          </section>
        )
      )}

      {/* Doporučené kroky — paired observation+action cards */}
      {observations.length > 0 && (
        <section style={{ marginBottom: "28px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: "bold", marginBottom: "16px", color: "var(--gds-heading-color)" }}>
            Doporučené kroky
          </h2>
          {observations.map((obs, i) => {
            const paired = pairedActionForObs(i);
            return (
              <ObservationActionPair
                key={i}
                obsHeadline={obs.headline}
                obsBody={obs.body}
                obsTimeHorizon={obs.time_horizon}
                actionText={paired?.action_text}
                actionTimeHorizon={paired?.time_horizon}
              />
            );
          })}
        </section>
      )}

      {/* Další doporučené kroky — orphan actions only; omitted when empty */}
      {orphanActions.length > 0 && (
        <section style={{ marginBottom: "28px" }}>
          <h2
            style={{
              fontSize: "18px",
              fontWeight: "bold",
              marginBottom: "16px",
              marginTop: "32px",
              color: "var(--gds-heading-color)",
            }}
          >
            Další doporučené kroky
          </h2>
          {orphanActions.map((action, i) => (
            <OrphanActionCard
              key={i}
              actionText={action.action_text}
              timeHorizon={action.time_horizon}
            />
          ))}
        </section>
      )}

      {/* Footer / PDF footer text */}
      {content.pdf_footer_text && (
        <section style={{ marginBottom: "24px" }}>
          <p style={{ fontSize: "14px", color: "var(--gds-text-secondary)", lineHeight: "1.5" }}>
            {content.pdf_footer_text}
          </p>
        </section>
      )}

      {/* PDF download CTA */}
      <div
        style={{
          borderTop: "1px solid var(--gds-border-default)",
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
            backgroundColor: "var(--gds-color-primary)",
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
          style={{ fontSize: "14px", color: "var(--gds-color-primary)", textDecoration: "none", textAlign: "center" }}
        >
          Zpět do George
        </a>
      </div>
        </div>
      </div>
    </main>
  );
}
