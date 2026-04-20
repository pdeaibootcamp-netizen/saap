/**
 * email.tsx — React Email component + Resend delivery client
 *
 * ADR-0001-B: Resend + React Email for transactional brief delivery.
 * Stub posture: if RESEND_API_KEY is unset, logs the email instead of sending.
 *
 * OQ-048: email unsubscribe vs. revocation semantics is unresolved.
 * The footer uses Variant B (settings link only, no one-click unsubscribe)
 * pending Q-MFD-002 / OQ-048 resolution.
 *
 * This module renders the condensed email layout per information-architecture.md
 * §3 Surface A: ≤ 400 words, single observation (email-teaser), single snippet
 * (if confidenceState === 'valid'), primary CTA, secondary PDF link, footer.
 *
 * Privacy: email content is brief-lane data only. No per-user financial data
 * appears in the rendered email.
 */

import React from "react";
import type { Brief, BriefContent, BenchmarkMetric } from "./briefs";

// ─── Email component ──────────────────────────────────────────────────────────

interface BriefEmailProps {
  brief: Brief;
  content: BriefContent;
  briefWebUrl: string;
  pdfUrl: string;
  sectorName: string;
  publicationMonth: string;
}

/** Renders the condensed brief email (Surface A per IA §3). */
export function BriefEmail({
  content,
  briefWebUrl,
  pdfUrl,
  sectorName,
  publicationMonth,
}: BriefEmailProps): React.ReactElement {
  const teaserObservation = content.observations[content.email_teaser_observation_index];

  // Find the email-teaser snippet (first valid metric marked as email teaser)
  const teaserMetric: BenchmarkMetric | undefined = content.benchmark_categories
    .flatMap((cat) => cat.metrics)
    .find((m) => m.is_email_teaser_snippet && m.confidence_state === "valid");

  const currentYear = new Date().getFullYear();

  return (
    <html lang="cs">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{`Váš sektorový přehled — ${publicationMonth} ${currentYear}`}</title>
      </head>
      <body
        style={{
          fontFamily: "Georgia, serif",
          maxWidth: "600px",
          margin: "0 auto",
          padding: "24px 16px",
          backgroundColor: "#ffffff",
          color: "#1a1a1a",
          lineHeight: "1.6",
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: "24px", borderBottom: "2px solid #1a1a1a", paddingBottom: "16px" }}>
          <div style={{ fontSize: "12px", color: "#666", marginBottom: "8px" }}>
            Česká Spořitelna · Strategy Radar
          </div>
          <h1 style={{ fontSize: "20px", fontWeight: "bold", margin: "0 0 4px 0" }}>
            {content.title}
          </h1>
          <div style={{ fontSize: "14px", color: "#444" }}>
            {publicationMonth} · {sectorName}
          </div>
        </div>

        {/* Opening summary */}
        <div style={{ marginBottom: "24px" }}>
          <p style={{ fontSize: "16px", margin: "0 0 8px 0" }}>Dobrý den,</p>
          <p style={{ fontSize: "15px", margin: "0 0 8px 0" }}>
            Přinášíme vám měsíční přehled pro váš obor.
          </p>
          <p style={{ fontSize: "15px", margin: "0", color: "#222" }}>
            {content.opening_summary}
          </p>
        </div>

        {/* Teaser observation */}
        {teaserObservation && (
          <div
            style={{
              backgroundColor: "#f8f8f8",
              border: "1px solid #e0e0e0",
              borderRadius: "4px",
              padding: "16px",
              marginBottom: "24px",
            }}
          >
            <div
              style={{
                fontSize: "11px",
                fontWeight: "bold",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                color: "#666",
                marginBottom: "8px",
              }}
            >
              Hlavní pozorování · {teaserObservation.time_horizon}
            </div>
            <p style={{ fontSize: "16px", fontWeight: "bold", margin: "0 0 8px 0" }}>
              {teaserObservation.headline}
            </p>
            <p style={{ fontSize: "14px", margin: "0", color: "#444" }}>
              {teaserObservation.body}
            </p>
          </div>
        )}

        {/* Teaser benchmark snippet — only if confidenceState === 'valid' per IA §4.3 */}
        {teaserMetric && (
          <div
            style={{
              backgroundColor: "#f0f4f8",
              border: "1px solid #c8d6e5",
              borderRadius: "4px",
              padding: "16px",
              marginBottom: "24px",
            }}
          >
            <div
              style={{
                fontSize: "11px",
                fontWeight: "bold",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                color: "#555",
                marginBottom: "8px",
              }}
            >
              Srovnání · {teaserMetric.metric_label}
            </div>
            <p style={{ fontSize: "14px", margin: "0", color: "#222" }}>
              {teaserMetric.verdict_text}
            </p>
          </div>
        )}

        {/* CTA buttons */}
        <div style={{ marginBottom: "32px" }}>
          <a
            href={briefWebUrl}
            style={{
              display: "inline-block",
              backgroundColor: "#1a1a1a",
              color: "#ffffff",
              padding: "12px 24px",
              borderRadius: "4px",
              textDecoration: "none",
              fontWeight: "bold",
              fontSize: "15px",
              marginRight: "12px",
              marginBottom: "8px",
            }}
          >
            Přečíst celý přehled
          </a>
          <a
            href={pdfUrl}
            style={{
              display: "inline-block",
              color: "#1a1a1a",
              padding: "12px 0",
              textDecoration: "underline",
              fontSize: "14px",
            }}
          >
            Stáhnout PDF
          </a>
        </div>

        {/* Footer — Variant B: settings link, no one-click unsubscribe (OQ-048 pending) */}
        <div
          style={{
            borderTop: "1px solid #e0e0e0",
            paddingTop: "16px",
            fontSize: "12px",
            color: "#888",
          }}
        >
          <p style={{ margin: "0 0 4px 0" }}>
            <a
              href={`${briefWebUrl.split("/brief/")[0]}/settings/soukromi`}
              style={{ color: "#555", textDecoration: "underline" }}
            >
              Spravovat nastavení přehledů
            </a>
            {" · "}
            <a
              href="https://www.csas.cz/cs/osobni-udaje"
              style={{ color: "#555", textDecoration: "underline" }}
            >
              Zásady ochrany osobních údajů
            </a>
          </p>
          <p style={{ margin: "0" }}>
            Česká spořitelna, a.s. · Olbrachtova 1929/62, 140 00 Praha 4
          </p>
        </div>
      </body>
    </html>
  );
}

// ─── Resend delivery client ───────────────────────────────────────────────────

export interface SendBriefEmailParams {
  to: string;
  recipientId: string;
  brief: Brief;
  content: BriefContent;
  briefWebUrl: string;
  pdfUrl: string;
  sectorName: string;
  publicationMonth: string;
}

/**
 * Send a brief email via Resend.
 * Stubs (logs) when RESEND_API_KEY is unset — trial posture per task brief.
 * Returns the Resend message ID or a stub ID.
 */
export async function sendBriefEmail(params: SendBriefEmailParams): Promise<string> {
  const apiKey = process.env.RESEND_API_KEY;
  const currentYear = new Date().getFullYear();

  const subject = `Váš sektorový přehled — ${params.publicationMonth} ${currentYear}`;

  // Render HTML via React's renderToStaticMarkup equivalent
  // React Email uses a separate renderer; here we use a simple string render
  // for the trial. In production, import { render } from "@react-email/render".
  const emailHtml = renderBriefEmailHtml(params);

  if (!apiKey) {
    // Stub mode: log instead of send
    console.log(`[email][STUB] Would send email to=${params.to} subject="${subject}"`);
    console.log(`[email][STUB] Brief ID=${params.brief.id} recipient=${params.recipientId}`);
    return `stub-email-id-${Date.now()}`;
  }

  // Real Resend send
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Strategy Radar <prehled@cs-strategy-radar.cz>",
      to: [params.to],
      subject,
      html: emailHtml,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Resend API error: ${response.status} ${err}`);
  }

  const data = (await response.json()) as { id: string };
  console.log(`[email] Sent: id=${data.id} to=${params.to} brief=${params.brief.id}`);
  return data.id;
}

/** Simple HTML renderer for the trial (replaces @react-email/render). */
function renderBriefEmailHtml(params: SendBriefEmailParams): string {
  const { content, briefWebUrl, pdfUrl, sectorName, publicationMonth } = params;
  const currentYear = new Date().getFullYear();
  const teaserObs = content.observations[content.email_teaser_observation_index];
  const teaserMetric = content.benchmark_categories
    .flatMap((cat) => cat.metrics)
    .find((m) => m.is_email_teaser_snippet && m.confidence_state === "valid");

  return `<!DOCTYPE html>
<html lang="cs">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Váš sektorový přehled — ${publicationMonth} ${currentYear}</title></head>
<body style="font-family:Georgia,serif;max-width:600px;margin:0 auto;padding:24px 16px;background:#fff;color:#1a1a1a;line-height:1.6">
<div style="margin-bottom:24px;border-bottom:2px solid #1a1a1a;padding-bottom:16px">
  <div style="font-size:12px;color:#666;margin-bottom:8px">Česká Spořitelna · Strategy Radar</div>
  <h1 style="font-size:20px;font-weight:bold;margin:0 0 4px 0">${content.title}</h1>
  <div style="font-size:14px;color:#444">${publicationMonth} · ${sectorName}</div>
</div>
<div style="margin-bottom:24px">
  <p style="font-size:16px;margin:0 0 8px 0">Dobrý den,</p>
  <p style="font-size:15px;margin:0 0 8px 0">Přinášíme vám měsíční přehled pro váš obor.</p>
  <p style="font-size:15px;margin:0;color:#222">${content.opening_summary}</p>
</div>
${teaserObs ? `<div style="background:#f8f8f8;border:1px solid #e0e0e0;border-radius:4px;padding:16px;margin-bottom:24px">
  <div style="font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:.05em;color:#666;margin-bottom:8px">Hlavní pozorování · ${teaserObs.time_horizon}</div>
  <p style="font-size:16px;font-weight:bold;margin:0 0 8px 0">${teaserObs.headline}</p>
  <p style="font-size:14px;margin:0;color:#444">${teaserObs.body}</p>
</div>` : ""}
${teaserMetric ? `<div style="background:#f0f4f8;border:1px solid #c8d6e5;border-radius:4px;padding:16px;margin-bottom:24px">
  <div style="font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:.05em;color:#555;margin-bottom:8px">Srovnání · ${teaserMetric.metric_label}</div>
  <p style="font-size:14px;margin:0;color:#222">${teaserMetric.verdict_text}</p>
</div>` : ""}
<div style="margin-bottom:32px">
  <a href="${briefWebUrl}" style="display:inline-block;background:#1a1a1a;color:#fff;padding:12px 24px;border-radius:4px;text-decoration:none;font-weight:bold;font-size:15px;margin-right:12px;margin-bottom:8px">Přečíst celý přehled</a>
  <a href="${pdfUrl}" style="display:inline-block;color:#1a1a1a;padding:12px 0;text-decoration:underline;font-size:14px">Stáhnout PDF</a>
</div>
<div style="border-top:1px solid #e0e0e0;padding-top:16px;font-size:12px;color:#888">
  <p style="margin:0 0 4px 0"><a href="${briefWebUrl.split("/brief/")[0]}/settings/soukromi" style="color:#555;text-decoration:underline">Spravovat nastavení přehledů</a> · <a href="https://www.csas.cz/cs/osobni-udaje" style="color:#555;text-decoration:underline">Zásady ochrany osobních údajů</a></p>
  <p style="margin:0">Česká spořitelna, a.s. · Olbrachtova 1929/62, 140 00 Praha 4</p>
</div>
</body></html>`;
}
