/**
 * /settings/soukromi/odvolano — Post-revocation confirmation screen
 *
 * Design: docs/design/trust-and-consent-patterns.md §6 post-revocation screen
 * D-012 Option A: copy confirms delivery stops, does not imply data deletion.
 *
 * OQ-007 placeholder used for ČS support contact (Q-TBD-010 in design doc).
 * Replace [OQ-007 placeholder] with actual ČS support contact before production.
 */

export const metadata = {
  title: "Souhlas odvolán — Strategy Radar",
};

export default function OdvolanoPage() {
  return (
    <main style={{ padding: "24px", maxWidth: "480px", margin: "0 auto", textAlign: "center" }}>
      {/* ČS wordmark placeholder */}
      <div style={{ marginBottom: "32px", color: "#005ca9", fontWeight: "bold", fontSize: "1.2rem" }}>
        Česká spořitelna
      </div>

      <h1>Souhlas byl odvolán</h1>

      <p>
        Váš souhlas jsme zaznamenali. Přehledy vám nebudou nadále doručovány a obsah aplikace
        Strategy Radar nebude dostupný.
      </p>

      <p>
        Pokud si přejete službu obnovit, obraťte se na svého poradce České spořitelny nebo nás
        kontaktujte na{" "}
        <span style={{ fontStyle: "italic" }}>[OQ-007 placeholder]</span>.
      </p>

      {/* Primary action — return to George */}
      <a
        href="georgebusiness://close"
        style={{
          display: "inline-block",
          marginTop: "32px",
          padding: "12px 24px",
          backgroundColor: "#005ca9",
          color: "#fff",
          borderRadius: "4px",
          textDecoration: "none",
          fontSize: "1rem",
          minHeight: "44px",
          lineHeight: "1.5",
        }}
      >
        Zpět do George
      </a>
    </main>
  );
}
