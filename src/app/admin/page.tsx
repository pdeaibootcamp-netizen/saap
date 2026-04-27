/**
 * /admin — Authoring dashboard
 *
 * Lists all briefs (draft + published) for analysts.
 * Auth-gated via middleware (checks admin session cookie).
 * Czech copy per D-004.
 */

import { redirect } from "next/navigation";
import Link from "next/link";
import { isAdminAuthenticated } from "@/lib/auth";
import { listBriefs } from "@/lib/briefs";
import type { Brief } from "@/lib/briefs";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("cs-CZ", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function AdminDashboard() {
  if (!isAdminAuthenticated()) {
    redirect("/admin/login");
  }

  let briefs: Brief[] = [];
  let loadError: string | null = null;

  try {
    briefs = await listBriefs();
  } catch (err) {
    console.error("[admin] Failed to load briefs:", err);
    loadError = "Nepodařilo se načíst seznam přehledů. Zkuste to znovu.";
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        backgroundColor: "#f5f5f5",
        fontFamily: "system-ui, sans-serif",
      }}
    >
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
        <div>
          <span style={{ fontWeight: "bold", fontSize: "16px" }}>Strategy Radar</span>
          <span style={{ color: "#aaa", marginLeft: "12px", fontSize: "14px" }}>
            Analytický portál
          </span>
        </div>
        <a
          href="/api/admin/logout"
          style={{ color: "#aaa", fontSize: "13px", textDecoration: "none" }}
        >
          Odhlásit se
        </a>
      </header>

      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "32px 24px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "24px",
          }}
        >
          <h1 style={{ fontSize: "24px", fontWeight: "bold", margin: 0 }}>Přehledy</h1>
          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <Link
              href="/admin/publications/new"
              style={{
                backgroundColor: "transparent",
                color: "#1a1a1a",
                padding: "10px 20px",
                borderRadius: "4px",
                textDecoration: "none",
                fontWeight: "500",
                fontSize: "14px",
                border: "1px solid #1a1a1a",
              }}
            >
              Nahrát publikaci pro automatické generování
            </Link>
            <Link
              href="/admin/briefs/new"
              style={{
                backgroundColor: "#1a1a1a",
                color: "#fff",
                padding: "10px 20px",
                borderRadius: "4px",
                textDecoration: "none",
                fontWeight: "500",
                fontSize: "14px",
              }}
            >
              Nový přehled
            </Link>
          </div>
        </div>

        {loadError && (
          <div
            role="alert"
            style={{
              backgroundColor: "#fff0f0",
              border: "1px solid #ffcccc",
              borderRadius: "4px",
              padding: "12px 16px",
              color: "#c00",
              marginBottom: "16px",
            }}
          >
            {loadError}
          </div>
        )}

        {!loadError && briefs.length === 0 && (
          <div
            style={{
              backgroundColor: "#fff",
              border: "1px solid #e0e0e0",
              borderRadius: "8px",
              padding: "48px",
              textAlign: "center",
              color: "#666",
            }}
          >
            <p style={{ fontSize: "18px", fontWeight: "500", marginBottom: "8px" }}>
              Zatím nemáte žádné přehledy.
            </p>
            <p style={{ fontSize: "14px" }}>
              Začněte výběrem sektoru a vytvořte první přehled.
            </p>
            <Link
              href="/admin/briefs/new"
              style={{
                display: "inline-block",
                marginTop: "16px",
                backgroundColor: "#1a1a1a",
                color: "#fff",
                padding: "10px 20px",
                borderRadius: "4px",
                textDecoration: "none",
                fontSize: "14px",
              }}
            >
              Nový přehled
            </Link>
          </div>
        )}

        {briefs.length > 0 && (
          <div
            style={{
              backgroundColor: "#fff",
              border: "1px solid #e0e0e0",
              borderRadius: "8px",
              overflow: "hidden",
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ backgroundColor: "#f8f8f8", borderBottom: "1px solid #e0e0e0" }}>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "13px", fontWeight: "600", color: "#555" }}>
                    Sektor (NACE)
                  </th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "13px", fontWeight: "600", color: "#555" }}>
                    Stav
                  </th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "13px", fontWeight: "600", color: "#555" }}>
                    Naposledy upraveno
                  </th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "13px", fontWeight: "600", color: "#555" }}>
                    Akce
                  </th>
                </tr>
              </thead>
              <tbody>
                {briefs.map((brief, idx) => (
                  <tr
                    key={brief.id}
                    style={{
                      borderBottom: idx < briefs.length - 1 ? "1px solid #f0f0f0" : "none",
                    }}
                  >
                    <td style={{ padding: "14px 16px", fontSize: "14px" }}>
                      <span style={{ fontWeight: "500" }}>NACE {brief.nace_sector}</span>
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "3px 8px",
                          borderRadius: "12px",
                          fontSize: "12px",
                          fontWeight: "600",
                          backgroundColor:
                            brief.publish_state === "published" ? "#e6f4ea" : "#fff3e0",
                          color:
                            brief.publish_state === "published" ? "#1e7e34" : "#e65100",
                        }}
                      >
                        {brief.publish_state === "published" ? "Publikováno" : "Koncept"}
                      </span>
                    </td>
                    <td style={{ padding: "14px 16px", fontSize: "13px", color: "#666" }}>
                      {brief.publish_state === "published"
                        ? `Publikováno: ${formatDate(brief.published_at)}`
                        : `Naposledy uloženo: ${formatDate(brief.created_at)}`}
                    </td>
                    <td style={{ padding: "14px 16px", fontSize: "13px" }}>
                      <Link
                        href={`/admin/briefs/${brief.id}/edit`}
                        style={{ color: "#1a1a1a", textDecoration: "underline" }}
                      >
                        {brief.publish_state === "published"
                          ? "Zobrazit / nová verze"
                          : "Pokračovat v editaci"}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
