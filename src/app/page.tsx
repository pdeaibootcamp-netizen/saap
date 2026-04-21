/**
 * Root page — v0.2 customer-testing PoC dashboard scaffold.
 *
 * Phase 2.2.a implementation:
 *   - Server component.
 *   - On first visit (no sr_user_id cookie), sets sr_user_id=DEMO_OWNER_USER_ID
 *     so subsequent navigations to /brief/[id] are recognised as the demo owner.
 *   - Renders the header band and two placeholder sections.
 *   - No tile data, no brief list query — those land in Phase 2.2.b and 2.2.c.
 *
 * Copy: docs/product/dashboard-v0-2.md §5 (canonical).
 * Layout tokens: docs/design/dashboard-v0-2/layout.md §5 + §6.
 * Identity bypass: docs/engineering/v0-2-identity-bypass.md §3–§5.
 */

import { cookies } from "next/headers";
import { DEMO_OWNER_USER_ID } from "@/lib/demo-owner";

export default async function DashboardPage() {
  // ── Cookie: set sr_user_id on first visit (v0-2-identity-bypass.md §5) ──────
  // next/headers cookies() gives read access in RSC; setting a cookie in a server
  // component requires a response header. We use the Next.js 14 approach of reading
  // the store and branching — the actual Set-Cookie header is emitted via the
  // middleware-compatible pattern below.
  const cookieStore = cookies();
  const hasIdentityCookie = !!cookieStore.get("sr_user_id")?.value;

  if (!hasIdentityCookie) {
    // Next.js 14.2+ App Router: cookies() returns ReadonlyRequestCookies which
    // includes Pick<ResponseCookies, 'set' | 'delete'> — so .set() is available.
    // The page is dynamically rendered (it reads cookies, so Next opts it out of
    // static generation). See v0-2-identity-bypass.md §5.
    cookieStore.set("sr_user_id", DEMO_OWNER_USER_ID, {
      path: "/",
      sameSite: "lax",
      httpOnly: false,
      maxAge: 60 * 60 * 24 * 30, // 30 days — covers the trial window
    });
  }

  // ── Layout ───────────────────────────────────────────────────────────────────
  // Tokens from docs/design/dashboard-v0-2/layout.md §5.
  // Breakpoints applied via inline style + media queries in a <style> tag.

  return (
    <>
      <style>{`
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
      `}</style>

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

            {/* Section 2 — Briefs list (placeholder for Phase 2.2.c) */}
            {/* Copy: dashboard-v0-2.md §5.3 section header; D-019 "Analýzy" */}
            <section className="db-brief-section" aria-labelledby="brief-section-heading">
              <h2 id="brief-section-heading" className="db-section-heading" style={{ marginTop: "24px" }}>
                Analýzy
              </h2>
              <div className="db-placeholder" aria-label="Analýzy budou doplněny">
                Analýzy budou doplněny v dalším kroku
              </div>
            </section>

          </div>
        </main>

      </div>
    </>
  );
}
