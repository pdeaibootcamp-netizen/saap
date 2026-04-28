/**
 * /admin/pulz-oboru — Admin list view for Pulz oboru publications
 *
 * Shows all pulz_analyses rows (all NACEs, all periods, all statuses)
 * in a simple table. Columns: NACE label, period, status, published_at,
 * is_current, edit link.
 *
 * Closes Q-POAL-006 (list page implementation from admin-list description).
 *
 * Czech copy per D-004. Formal register.
 * Design: docs/design/pulz-oboru-admin.md §3 list view screen.
 */

import { listPulzAnalyses } from "@/lib/pulz-analyses";

export default async function PulzOboruListPage() {
  let analyses: Awaited<ReturnType<typeof listPulzAnalyses>> = [];
  let fetchError = false;

  try {
    analyses = await listPulzAnalyses();
  } catch {
    fetchError = true;
  }

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
        <a href="/admin" style={{ color: "#aaa", fontSize: "13px", textDecoration: "none" }}>
          ← Zpět na přehledy
        </a>
        <span style={{ fontWeight: "bold", fontSize: "16px" }}>
          Strategy Radar — Analýzy Pulz oboru
        </span>
      </header>

      <div style={{ maxWidth: "960px", margin: "0 auto", padding: "40px 24px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: "24px",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <h1 style={{ fontSize: "22px", fontWeight: "bold", margin: 0 }}>
            Analýzy Pulz oboru
          </h1>
          <a
            href="/admin/pulz-oboru/new"
            style={{
              padding: "10px 20px",
              backgroundColor: "#1a1a1a",
              color: "#fff",
              textDecoration: "none",
              borderRadius: "4px",
              fontSize: "14px",
              fontWeight: "bold",
              display: "inline-block",
            }}
          >
            + Nová analýza Pulz oboru
          </a>
        </div>

        {fetchError && (
          <div
            role="alert"
            style={{
              backgroundColor: "#fff0f0",
              border: "1px solid #ffcccc",
              borderRadius: "6px",
              padding: "16px 20px",
              marginBottom: "24px",
              color: "#c00",
              fontSize: "14px",
            }}
          >
            Načtení seznamu selhalo. Obnovte stránku pro opakování.
          </div>
        )}

        {!fetchError && analyses.length === 0 && (
          <div
            style={{
              backgroundColor: "#fff",
              border: "1px solid #e0e0e0",
              borderRadius: "8px",
              padding: "32px 24px",
              textAlign: "center",
            }}
          >
            <p style={{ fontSize: "15px", color: "#555", margin: "0 0 16px 0" }}>
              Zatím žádné publikace Pulz oboru.
            </p>
            <a
              href="/admin/pulz-oboru/new"
              style={{ color: "#1a1a1a", fontSize: "14px", textDecoration: "underline" }}
            >
              Vytvořit první analýzu
            </a>
          </div>
        )}

        {!fetchError && analyses.length > 0 && (
          <div
            style={{
              backgroundColor: "#fff",
              border: "1px solid #e0e0e0",
              borderRadius: "8px",
              overflow: "hidden",
            }}
          >
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "14px",
              }}
            >
              <thead>
                <tr style={{ backgroundColor: "#f5f5f5", borderBottom: "1px solid #e0e0e0" }}>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, color: "#333" }}>
                    Obor
                  </th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, color: "#333" }}>
                    Období
                  </th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, color: "#333" }}>
                    Stav
                  </th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, color: "#333" }}>
                    Aktuální
                  </th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, color: "#333" }}>
                    Publikováno
                  </th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, color: "#333" }}>
                    Akce
                  </th>
                </tr>
              </thead>
              <tbody>
                {analyses.map((row, i) => (
                  <tr
                    key={row.id}
                    style={{
                      borderBottom: i < analyses.length - 1 ? "1px solid #f0f0f0" : "none",
                    }}
                  >
                    <td style={{ padding: "12px 16px", color: "#1a1a1a" }}>
                      <span style={{ fontWeight: 500 }}>{row.nace_division}</span>
                      {" "}
                      <span style={{ color: "#537090" }}>{row.nace_label_czech}</span>
                    </td>
                    <td style={{ padding: "12px 16px", color: "#1a1a1a" }}>
                      {row.publication_period}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "2px 10px",
                          borderRadius: "999px",
                          fontSize: "12px",
                          fontWeight: 600,
                          backgroundColor: row.status === "published" ? "#e8f5e9" : "#e8f4ff",
                          color: row.status === "published" ? "#2E7D32" : "#1565C0",
                        }}
                      >
                        {row.status === "published" ? "Publikováno" : "Koncept"}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      {row.is_current ? (
                        <span style={{ color: "#2E7D32", fontSize: "13px" }}>✓ Aktuální</span>
                      ) : (
                        <span style={{ color: "#888", fontSize: "13px" }}>Archiv</span>
                      )}
                    </td>
                    <td style={{ padding: "12px 16px", color: "#537090", fontSize: "13px" }}>
                      {row.published_at
                        ? new Date(row.published_at).toLocaleDateString("cs-CZ")
                        : "—"}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <a
                        href={`/admin/pulz-oboru/${row.id}/edit`}
                        style={{ color: "#135ee2", fontSize: "13px", textDecoration: "underline" }}
                      >
                        Upravit
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <footer style={{ textAlign: "center", padding: "24px 16px 32px", color: "#9E9E9E", fontSize: "13px" }}>
        Tento prototyp byl vygenerován pomocí AI.
      </footer>
    </main>
  );
}
