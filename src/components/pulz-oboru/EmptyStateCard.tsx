/**
 * EmptyStateCard — shown when no published analysis exists for the owner's NACE.
 *
 * Dashed border distinguishes "not yet available" from "error" (solid border on ErrorCard).
 * No CTA, no email capture, no "notify me" prompt — give-to-get is Increment 3+.
 * Per OQ-079 and CLAUDE.md guardrail.
 *
 * OQ-080: body text uses #666 (5.74:1) instead of #888 (3.54:1) for WCAG AA compliance.
 *
 * Design spec: docs/design/pulz-oboru.md §4.6
 * PM spec: docs/product/pulz-oboru.md §5.7 / US-4
 */

export function EmptyStateCard() {
  return (
    <div
      style={{
        border: "1px dashed #e0e0e0",
        borderRadius: "8px",
        padding: "24px",
        backgroundColor: "#ffffff",
      }}
    >
      <p
        style={{
          fontSize: "15px",
          fontWeight: 600,
          color: "#444",
          margin: "0 0 8px 0",
        }}
      >
        Analýza pro váš obor se připravuje
      </p>
      <p
        style={{
          fontSize: "15px",
          fontWeight: 400,
          /* OQ-080: #666 (5.74:1) in place of #888 (3.54:1) */
          color: "#666",
          margin: 0,
          lineHeight: "1.5",
        }}
      >
        Jakmile analytici České spořitelny vydají přehled pro váš sektor, zobrazí se zde.
      </p>
      {/* No "notify me" CTA — intentionally absent at MVP. OQ-079 / CLAUDE.md guardrail. */}
    </div>
  );
}
