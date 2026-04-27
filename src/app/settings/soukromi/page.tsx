/**
 * /settings/soukromi — Consent management screen
 *
 * Design reference: docs/design/trust-and-consent-patterns.md §6
 * Decision: D-008 (settings revocation entry point), D-012 (stop-flow Option A)
 *
 * Server component: reads current consent state for the logged-in user.
 * Client component (SoukromiClient) handles the confirmation dialog and
 * the POST to /api/consent/revoke.
 *
 * Czech copy, formal vykání per D-004.
 * OQ-007 placeholder used for ČS support contact (Q-TBD-010 in design doc).
 */

import { cookies } from "next/headers";
import { verifyGeorgeToken } from "@/lib/auth";
import { getCurrentConsent } from "@/lib/consent";
import { SoukromiClient } from "./SoukromiClient";

export const metadata = {
  title: "Soukromí — Strategy Radar",
};

// ─── Resolve user from cookie or George token ─────────────────────────────────

async function resolveUserId(): Promise<string | null> {
  const cookieStore = cookies();

  // Primary: sr_user_id cookie set after onboarding/consent grant.
  const userIdCookie = cookieStore.get("sr_user_id");
  if (userIdCookie?.value) {
    return userIdCookie.value;
  }

  // Secondary: George token cookie (set by /consent or /onboarding George flow).
  const georgeToken = cookieStore.get("sr_george_token");
  if (georgeToken?.value) {
    return verifyGeorgeToken(georgeToken.value);
  }

  return null;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function SoukromiPage() {
  const userId = await resolveUserId();

  // Unauthenticated — show minimal message; no redirect (WebView context).
  if (!userId) {
    return (
      <main style={{ padding: "24px", maxWidth: "480px", margin: "0 auto" }}>
        <h1>Soukromí</h1>
        <p>
          Pro správu souhlasu se musíte přihlásit prostřednictvím aplikace George Business.
        </p>
      </main>
    );
  }

  const consent = await getCurrentConsent(userId);

  // Format the consent grant date for display.
  const grantedOn =
    consent?.latest_event_type === "grant" && consent.latest_ts
      ? new Date(consent.latest_ts).toLocaleDateString("cs-CZ", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : null;

  const hasActiveConsent = consent?.latest_event_type === "grant";

  return (
    <main style={{ padding: "24px", maxWidth: "480px", margin: "0 auto" }}>
      <h1>Soukromí</h1>

      <p>
        Svůj souhlas se zpracováním dat v aplikaci Strategy Radar můžete kdykoli odvolat.
        Po odvolání souhlasu vám přestanou chodit přehledy a nebudete moci otevřít obsah
        aplikace.
      </p>

      {hasActiveConsent && grantedOn && (
        <p style={{ color: "#555", fontSize: "0.9rem" }}>
          Souhlas byl udělen: <strong>{grantedOn}</strong> (verze v1.0-2026-04)
        </p>
      )}

      {!hasActiveConsent && (
        <p style={{ color: "#555", fontSize: "0.9rem" }}>
          Momentálně nemáte udělený aktivní souhlas.
        </p>
      )}

      {/* Client component handles dialog + POST */}
      <SoukromiClient hasActiveConsent={hasActiveConsent} />
    </main>
  );
}
