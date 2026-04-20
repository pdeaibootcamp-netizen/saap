/**
 * Root page — scaffold placeholder.
 *
 * At MVP the landing route will redirect:
 *   - Bank-referred path: /brief?token=<george-jwt>  (ADR-0001-E)
 *   - Direct sign-up path: /onboarding
 *
 * Routing logic will be added in Phase 2 once the middleware (admin auth)
 * and George JWT validation (src/lib/auth.ts) are wired.
 *
 * This page is intentionally minimal — its only purpose is to confirm
 * the Next.js scaffold builds cleanly.
 */
export default function HomePage() {
  return (
    <main className="content-container" style={{ paddingTop: "2rem" }}>
      <h1>Strategy Radar</h1>
      <p>Scaffold — Phase 3. Feature routes will replace this page.</p>
    </main>
  );
}
