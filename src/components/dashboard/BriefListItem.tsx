/**
 * BriefListItem — v0.2 dashboard brief list row.
 *
 * Spec: docs/design/dashboard-v0-2/brief-list-item.md
 * Copy: docs/product/dashboard-v0-2.md §5.3
 *
 * Renders one entry in the "Analýzy" section of the owner dashboard.
 * Entire row is a single <a> link to /brief/{briefId} — no nested interactive
 * elements (accessibility: brief-list-item.md §7, §10).
 *
 * Props supplied by the parent (page.tsx) after parsing published_at and
 * extracting title from the brief_content section JSON.
 */

import Link from "next/link";

// ─── Czech month names (nominative) — brief-list-item.md §6.3 ────────────────

const CZECH_MONTHS: Record<number, string> = {
  1: "Leden",
  2: "Únor",
  3: "Březen",
  4: "Duben",
  5: "Květen",
  6: "Červen",
  7: "Červenec",
  8: "Srpen",
  9: "Září",
  10: "Říjen",
  11: "Listopad",
  12: "Prosinec",
};

/**
 * Format a published_at ISO string as "Duben 2026".
 * Falls back to an em-dash if the date is missing or unparseable.
 */
export function formatPublicationMonth(publishedAt: string | null): string {
  if (!publishedAt) return "—";
  const d = new Date(publishedAt);
  if (isNaN(d.getTime())) return "—";
  const monthName = CZECH_MONTHS[d.getUTCMonth() + 1] ?? "—";
  return `${monthName} ${d.getUTCFullYear()}`;
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface BriefListItemProps {
  /** Brief DB id — used to construct href="/brief/{briefId}" */
  briefId: string;
  /** Analyst-authored title (from brief_content.title) */
  title: string;
  /** Pre-formatted publication month, e.g. "Duben 2026" */
  publicationMonth: string;
  /** NACE division code, e.g. "31" */
  naceCode: string;
  /** Optional resolved Czech NACE label, e.g. "Výroba nábytku" */
  naceName: string | null;
  /** True if published_at is within 30 days of now */
  isNew: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function BriefListItem({
  briefId,
  title,
  publicationMonth,
  naceCode,
  naceName,
  isNew,
}: BriefListItemProps) {
  // NACE badge label — brief-list-item.md §6.1
  const naceBadgeText = naceName
    ? `NACE ${naceCode} — ${naceName}`
    : `NACE ${naceCode}`;

  // Accessible row label — brief-list-item.md §6.5
  const ariaLabel = `Přehled: ${title}, ${publicationMonth}`;

  return (
    <li style={{
      listStyle: "none",
      border: "1px solid #e4eaf0",
      borderRadius: "12px",
      overflow: "hidden",
      marginBottom: "8px",
    }}>
      <Link
        href={`/brief/${briefId}`}
        aria-label={ariaLabel}
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          padding: "14px 16px",
          textDecoration: "none",
          color: "inherit",
          backgroundColor: "#ffffff",
          minHeight: "72px",
          transition: "background-color 120ms ease",
          cursor: "pointer",
          boxSizing: "border-box",
          gap: "12px",
        }}
        className="bli-row"
      >
        {/* Left — metadata + title + date */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Row A — NACE badge + "Nový" pill */}
          <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
            <span
              aria-hidden="true"
              style={{
                display: "inline-block",
                fontSize: "12px",
                fontWeight: 500,
                color: "#537090",
                backgroundColor: "#eef0f4",
                border: "1px solid #e4eaf0",
                borderRadius: "999px",
                padding: "2px 8px",
                lineHeight: "1.4",
              }}
            >
              {naceBadgeText}
            </span>
            {isNew && (
              <span
                aria-label="Nový přehled"
                style={{
                  display: "inline-block",
                  fontSize: "12px",
                  fontWeight: 700,
                  color: "#ffffff",
                  backgroundColor: "#135ee2",
                  borderRadius: "999px",
                  padding: "2px 8px",
                  lineHeight: "1.4",
                }}
              >
                Nový
              </span>
            )}
          </div>

          {/* Row B — title */}
          <div style={{ fontSize: "16px", fontWeight: 700, color: "#1a1a1a", lineHeight: "1.4", marginBottom: "4px" }}>
            {title}
          </div>

          {/* Row C — publication month */}
          <span style={{ fontSize: "12px", color: "#9e9e9e" }}>{publicationMonth}</span>
        </div>

        {/* Right — "Zobrazit" vertically centered */}
        <span
          aria-hidden="true"
          style={{
            flexShrink: 0,
            fontSize: "13px",
            fontWeight: 600,
            color: "#135ee2",
          }}
        >
          Zobrazit
        </span>
      </Link>
    </li>
  );
}

// ─── Inline hover/focus/pressed styles ───────────────────────────────────────
// CSS-module-free approach: inject a small <style> tag from page.tsx alongside
// the existing dashboardCss block. The .bli-row class is used as the hook.
// See page.tsx briefListCss constant.
