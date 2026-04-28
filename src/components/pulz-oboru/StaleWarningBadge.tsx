/**
 * StaleWarningBadge — shown when published_at > 91 days ago.
 *
 * Renders an amber-bordered badge with a warning triangle character and
 * the Czech stale-warning copy. Color is not the only signal — the ⚠
 * icon and text carry the warning independently.
 *
 * OQ-080 fix: text at #888 on white fails WCAG AA at normal body size.
 * This component uses #1a1a1a for the body text per design §4.1b spec
 * (the spec explicitly sets --color-ink-primary for the text, not muted).
 *
 * Design spec: docs/design/pulz-oboru.md §4.1b
 * PM spec: docs/product/pulz-oboru.md §5.2
 */

/**
 * Format a date as a Czech month+year in the genitive case, lower-case.
 * E.g. 2026-01-15 → "ledna 2026"
 */
function formatCzechMonthYear(date: Date): string {
  const months = [
    "ledna",   // January  — genitive
    "února",   // February
    "března",  // March
    "dubna",   // April
    "května",  // May
    "června",  // June
    "července",// July
    "srpna",   // August
    "září",    // September
    "října",   // October
    "listopadu",// November
    "prosince",// December
  ];
  return `${months[date.getMonth()]} ${date.getFullYear()}`;
}

export function StaleWarningBadge({ publishedAt }: { publishedAt: string }) {
  const date = new Date(publishedAt);
  const monthYear = formatCzechMonthYear(date);

  return (
    <div
      role="status"
      style={{
        border: "1px solid #E65100",
        borderRadius: "6px",
        padding: "10px 14px",
        background: "rgba(230, 81, 0, 0.06)",
        marginBottom: "12px",
        display: "flex",
        gap: "8px",
        alignItems: "flex-start",
      }}
    >
      <span aria-hidden="true" style={{ fontSize: "15px", lineHeight: "1.5", flexShrink: 0 }}>
        ⚠
      </span>
      <p style={{ margin: 0, fontSize: "15px", color: "#1a1a1a", lineHeight: "1.5" }}>
        Tato analýza pochází z {monthYear}. Aktuálnější data zatím nejsou k dispozici.
      </p>
    </div>
  );
}

export { formatCzechMonthYear };
