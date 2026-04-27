/**
 * publish.ts — Brief publish pipeline
 *
 * Implements ADR-0002-E: synchronous sequential pipeline.
 * publishBrief(briefId) — validates, snapshots benchmark, generates PDF,
 * sends email to each recipient with active consent, records delivery rows.
 *
 * Pipeline steps (ADR-0002-E):
 *  1. Read brief (validate draft state)
 *  2. Validate content (2–4 observations, 2–4 actions, tags present)
 *  3. Snapshot benchmark snippet from cohort module
 *  4. Update brief in DB (publish_state='published', benchmark_snapshot)
 *  5. Resolve recipients = sector_profiles with matching NACE + active consent
 *  6. Generate PDF (Puppeteer → local filesystem)
 *  7. For each recipient: send email, record delivery rows (email + web + pdf)
 *
 * OQ-049: on consent check network error, fail-closed (no delivery).
 * OQ-048: email footer is Variant B (settings link, no one-click unsubscribe).
 * OQ-012: synchronous pipeline — acceptable for trial volume.
 *
 * Privacy: publishBrief reads sector_profiles via the user_contributed lane
 * (sqlUser) and cross-references consent_events. The brief content and delivery
 * records are written to the brief lane (sql).
 */

import { getBriefById, publishBriefRecord, recordDelivery } from "./briefs";
import type { BriefContent } from "./briefs";
import { getBenchmarkSnapshot } from "./cohort";
import { generatePdf, getSignedPdfUrl } from "./pdf";
import { sendBriefEmail } from "./email";
import { hasActiveConsent } from "./consent";
import { getUserIdsByNace } from "./profiles";
import { sqlUser } from "./db-user";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PublishResult {
  brief_id: string;
  version: number;
  recipients_total: number;
  recipients_consented: number;
  emails_sent: number;
  pdf_path: string;
  errors: string[];
}

// ─── Validation ───────────────────────────────────────────────────────────────

/** Parse and validate content_sections into BriefContent. Returns errors[]. */
function extractBriefContent(contentSections: unknown[]): { content: BriefContent | null; errors: string[] } {
  const errors: string[] = [];

  // At MVP, content_sections stores the full BriefContent as a single element
  // with section_id = 'brief_content'. The authoring form serializes BriefContent
  // as JSON stored in the body field.
  const contentSection = (contentSections as Array<{ section_id: string; body: string }>)
    .find((s) => s.section_id === "brief_content");

  if (!contentSection) {
    errors.push("Chybí sekce brief_content.");
    return { content: null, errors };
  }

  let content: BriefContent;
  try {
    content = JSON.parse(contentSection.body) as BriefContent;
  } catch {
    errors.push("Obsah přehledu není platný JSON.");
    return { content: null, errors };
  }

  // Validate observation count (2–4)
  if (!content.observations || content.observations.length < 2) {
    errors.push(`Přidejte alespoň 2 pozorování před publikováním. Aktuálně: ${content.observations?.length ?? 0}.`);
  }
  if (content.observations && content.observations.length > 4) {
    errors.push(`Maximální počet pozorování je 4. Aktuálně: ${content.observations.length}.`);
  }

  // Validate action count (2–4)
  if (!content.closing_actions || content.closing_actions.length < 2) {
    errors.push(`Přidejte alespoň 2 doporučené kroky před publikováním. Aktuálně: ${content.closing_actions?.length ?? 0}.`);
  }
  if (content.closing_actions && content.closing_actions.length > 4) {
    errors.push(`Maximální počet doporučených kroků je 4. Aktuálně: ${content.closing_actions.length}.`);
  }

  // Validate time-horizon tags on observations
  const validHorizons = ["Okamžitě", "Do 3 měsíců", "Do 12 měsíců", "Více než rok"];
  content.observations?.forEach((obs, i) => {
    if (!obs.time_horizon || !validHorizons.includes(obs.time_horizon)) {
      errors.push(`Pozorování ${i + 1}: zvolte časový horizont.`);
    }
  });

  // Validate time-horizon tags on actions
  content.closing_actions?.forEach((action, i) => {
    if (!action.time_horizon || !validHorizons.includes(action.time_horizon)) {
      errors.push(`Doporučený krok ${i + 1}: zvolte časový horizont.`);
    }
  });

  // Validate email-teaser observation selection
  const hasEmailTeaser = content.observations?.some((obs) => obs.is_email_teaser);
  if (!hasEmailTeaser && (content.observations?.length ?? 0) > 0) {
    errors.push("Označte jedno pozorování jako e-mail teaser.");
  }

  if (errors.length > 0) return { content: null, errors };
  return { content, errors: [] };
}

// ─── Recipient resolution ─────────────────────────────────────────────────────

/** Get email address for a user. At MVP, stored in the sector_profiles table
 *  as an optional field. For trial, falls back to a placeholder. */
async function getUserEmail(userId: string): Promise<string | null> {
  const rows = await sqlUser<{ email: string | null }[]>`
    SELECT email FROM sector_profiles WHERE user_id = ${userId} LIMIT 1
  `;
  return rows[0]?.email ?? null;
}

// ─── Main publish function ────────────────────────────────────────────────────

/**
 * Publish a brief: validate, snapshot, write delivery records, send emails, generate PDF.
 *
 * Synchronous per ADR-0002-E. Acceptable for trial volume (≤ 50 recipients).
 */
export async function publishBrief(
  briefId: string,
  opts: {
    checklist_affirmed_by: string;
    checklist_version: string;
  }
): Promise<PublishResult> {
  const errors: string[] = [];
  console.log(`[publish] Starting publish pipeline for brief=${briefId}`);

  // Step 1: Read and validate brief
  const brief = await getBriefById(briefId);
  if (!brief) throw new Error(`Brief ${briefId} not found`);
  if (brief.publish_state !== "draft") {
    throw new Error(`Brief ${briefId} is already ${brief.publish_state}`);
  }

  // Step 2: Validate content
  const { content, errors: validationErrors } = extractBriefContent(brief.content_sections);
  if (validationErrors.length > 0 || !content) {
    throw new Error(`Validace selhala: ${validationErrors.join("; ")}`);
  }

  // Step 3: Snapshot benchmark snippet
  const benchmarkSnapshot = getBenchmarkSnapshot(brief.nace_sector);
  console.log(`[publish] Benchmark snapshot resolved for NACE=${brief.nace_sector}`);

  // Step 4: Update brief in DB (publish)
  const publishedBrief = await publishBriefRecord(
    briefId,
    benchmarkSnapshot,
    opts.checklist_affirmed_by,
    opts.checklist_version
  );
  console.log(`[publish] Brief published: version=${publishedBrief.version}`);

  // Step 5: Resolve recipients with matching NACE + active consent
  const allUserIds = await getUserIdsByNace(brief.nace_sector);
  console.log(`[publish] Found ${allUserIds.length} sector_profile users for NACE=${brief.nace_sector}`);

  const consentedUserIds: string[] = [];
  for (const userId of allUserIds) {
    try {
      const active = await hasActiveConsent(userId);
      if (active) consentedUserIds.push(userId);
    } catch (err) {
      // OQ-049: fail-closed — skip this recipient on consent check error
      console.error(`[publish] Consent check failed for user=${userId}, skipping:`, err);
      errors.push(`Souhlas pro uživatele ${userId} se nepodařilo ověřit — přeskočeno.`);
    }
  }
  console.log(`[publish] ${consentedUserIds.length} of ${allUserIds.length} users have active consent`);

  // Step 6: Generate PDF
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  let pdfPath = "";
  try {
    pdfPath = await generatePdf({
      briefId,
      version: publishedBrief.version,
      appUrl,
    });
    console.log(`[publish] PDF generated: ${pdfPath}`);
  } catch (err) {
    console.error("[publish] PDF generation failed:", err);
    errors.push("PDF se nepodařilo vygenerovat.");
    pdfPath = "generation-failed";
  }

  const pdfUrl = getSignedPdfUrl(briefId, publishedBrief.version);
  const briefWebUrl = `${appUrl}/brief/${briefId}`;

  // Step 7: For each consented recipient, send email + record delivery rows
  let emailsSent = 0;
  const sectorName = `NACE ${brief.nace_sector}`;
  const publicationMonth = new Date().toLocaleDateString("cs-CZ", { month: "long", year: "numeric" });

  for (const userId of consentedUserIds) {
    try {
      // Get email address (may be null if not stored)
      const email = await getUserEmail(userId);

      if (email) {
        await sendBriefEmail({
          to: email,
          recipientId: userId,
          brief: publishedBrief,
          content,
          briefWebUrl: `${briefWebUrl}?token=STUB`,
          pdfUrl,
          sectorName,
          publicationMonth,
        });
        emailsSent++;

        // Record email delivery
        await recordDelivery({
          brief_id: briefId,
          brief_version: publishedBrief.version,
          recipient_id: userId,
          format: "email",
        });
      } else {
        console.log(`[publish] No email for user=${userId}, skipping email delivery`);
      }

      // Record web delivery (pre-creates the delivery record; actual access recorded on first GET)
      await recordDelivery({
        brief_id: briefId,
        brief_version: publishedBrief.version,
        recipient_id: userId,
        format: "web",
      });

      // Record PDF delivery
      await recordDelivery({
        brief_id: briefId,
        brief_version: publishedBrief.version,
        recipient_id: userId,
        format: "pdf",
      });
    } catch (err) {
      console.error(`[publish] Delivery failed for user=${userId}:`, err);
      errors.push(`Doručení pro uživatele ${userId} selhalo.`);
    }
  }

  const result: PublishResult = {
    brief_id: briefId,
    version: publishedBrief.version,
    recipients_total: allUserIds.length,
    recipients_consented: consentedUserIds.length,
    emails_sent: emailsSent,
    pdf_path: pdfPath,
    errors,
  };

  console.log(`[publish] Complete:`, JSON.stringify(result, null, 2));
  return result;
}
