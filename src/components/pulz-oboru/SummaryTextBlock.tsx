/**
 * SummaryTextBlock — 3–6 sentence plain-Czech synthesis below the chart tiles.
 *
 * No border, no card. Rendered as a standard prose block within the section.
 * Split on double-newline for multi-paragraph content (same pattern as
 * MarkdownParagraphs in the brief page).
 *
 * Design spec: docs/design/pulz-oboru.md §4.3
 */

export function SummaryTextBlock({ text }: { text: string }) {
  const paragraphs = text
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (paragraphs.length === 0) return null;

  return (
    <div style={{ marginTop: "16px", marginBottom: "12px" }}>
      {paragraphs.map((para, i) => (
        <p
          key={i}
          style={{
            fontSize: "15px",
            fontWeight: 400,
            color: "#1a1a1a",
            lineHeight: "1.6",
            margin: i < paragraphs.length - 1 ? "0 0 12px 0" : "0",
          }}
        >
          {para}
        </p>
      ))}
    </div>
  );
}
