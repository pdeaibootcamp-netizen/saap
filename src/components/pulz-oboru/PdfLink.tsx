/**
 * PdfLink — secondary-weight download link for the full ČS publication PDF.
 *
 * Renders only when pdfUrl is non-null. Omits silently otherwise (PM Q-PO-005).
 * Uses <a download> — no new browser tab, no clipboard.
 *
 * Accessibility:
 *   - aria-label carries the full screen-reader label (PM §5.5).
 *   - ↓ icon is aria-hidden.
 *   - underline in addition to colour (colour is not the only signal).
 *   - min-height 44 px for touch targets.
 *
 * Design spec: docs/design/pulz-oboru.md §4.4
 * PM spec: docs/product/pulz-oboru.md §5.5
 */

export function PdfLink({
  pdfUrl,
  pdfSourceLabel,
  publicationPeriod,
}: {
  pdfUrl: string | null;
  pdfSourceLabel: string | null;
  publicationPeriod: string;
}) {
  if (!pdfUrl) return null;

  const subline = [pdfSourceLabel, publicationPeriod]
    .filter(Boolean)
    .join(" · ");

  return (
    <div style={{ marginBottom: "16px" }}>
      <a
        href={pdfUrl}
        download
        aria-label="Stáhnout celou analýzu ve formátu PDF"
        style={{
          display: "inline-flex",
          flexDirection: "column",
          gap: "2px",
          minHeight: "44px",
          justifyContent: "center",
          textDecoration: "none",
          color: "#666",
        }}
      >
        <span
          style={{
            fontSize: "15px",
            fontWeight: 400,
            textDecoration: "underline",
            color: "inherit",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <span aria-hidden="true">↓</span>
          Stáhnout celou analýzu (PDF)
        </span>
        {subline && (
          <span
            style={{
              /* OQ-080: #666 (5.74:1) is used here as the spec calls for
                 --color-ink-tertiary for the primary link label.
                 The subline uses #666 too (from #888 muted, per OQ-080 fix). */
              fontSize: "12px",
              color: "#666",
              textDecoration: "none",
              paddingLeft: "22px", // aligns under the label text, past the ↓ icon
            }}
          >
            {subline}
          </span>
        )}
      </a>
    </div>
  );
}
