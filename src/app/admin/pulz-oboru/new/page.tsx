/**
 * /admin/pulz-oboru/new — Author a new Pulz oboru analysis.
 *
 * Single-page form: NACE/period identity → 3 chart tile builders →
 * summary textarea → optional PDF → 1–3 actions → save-as-draft / publish.
 *
 * Czech copy per D-004. Formal register.
 * Design: docs/design/pulz-oboru-admin.md §1b, §4
 */

import { PulzOboruForm } from "../PulzOboruForm";

export default function NewPulzOboruPage() {
  return (
    <main style={{ minHeight: "100vh", backgroundColor: "#f5f5f5", fontFamily: "system-ui, sans-serif" }}>
      <header
        style={{
          backgroundColor: "#1a1a1a",
          color: "#fff",
          padding: "16px 24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <a href="/admin/pulz-oboru" style={{ color: "#aaa", fontSize: "13px", textDecoration: "none" }}>
          ← Zpět na přehledy
        </a>
        <span style={{ fontWeight: "bold", fontSize: "16px" }}>
          Strategy Radar — Nová analýza Pulz oboru
        </span>
      </header>

      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "40px 24px" }}>
        <h1 style={{ fontSize: "22px", fontWeight: "bold", marginBottom: "8px" }}>
          Nová analýza Pulz oboru
        </h1>
        <p style={{ fontSize: "14px", color: "#666", marginBottom: "32px" }}>
          Vyplňte tři grafy, shrnutí a doporučené kroky. Analýza se po publikování zobrazí
          majitelům firem ve správném oboru.
        </p>

        <PulzOboruForm />
      </div>

      <footer style={{ textAlign: "center", padding: "24px 16px 32px", color: "#9E9E9E", fontSize: "13px" }}>
        Tento prototyp byl vygenerován pomocí AI.
      </footer>
    </main>
  );
}
