/**
 * /admin/briefs/new — Sector picker
 *
 * Analyst selects a NACE sector to create a new brief draft.
 * Only sectors with a pre-seeded cohort are listed (D-001).
 * Sector is immutable after brief creation (D-006, US-1 AC 3).
 *
 * Czech copy per D-004. Formal register.
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

// Hard-coded available NACE sectors from seed cohorts (D-001).
// At runtime these are the sectors that have pre-seeded cohort data.
// Engineering note: this list mirrors SEED_COHORTS in cohort.ts; at
// production scale, /api/admin/cohorts would return the list dynamically.
const AVAILABLE_SECTORS = [
  { naceCode: "10", sectorName: "Výroba potravinářských výrobků" },
  { naceCode: "41", sectorName: "Výstavba budov" },
  { naceCode: "46", sectorName: "Velkoobchod (kromě motorových vozidel)" },
  { naceCode: "62", sectorName: "Činnosti v oblasti informačních technologií" },
];

export default function NewBriefPage() {
  const router = useRouter();
  const [searchText, setSearchText] = useState("");
  const [selectedNace, setSelectedNace] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = AVAILABLE_SECTORS.filter(
    (s) =>
      s.sectorName.toLowerCase().includes(searchText.toLowerCase()) ||
      s.naceCode.includes(searchText)
  );

  async function handleCreate() {
    if (!selectedNace) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/briefs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nace_sector: selectedNace }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Nepodařilo se vytvořit přehled.");
        return;
      }

      const data = (await res.json()) as { id: string };
      router.push(`/admin/briefs/${data.id}/edit`);
    } catch {
      setError("Nepodařilo se vytvořit přehled. Zkuste to prosím znovu.");
    } finally {
      setSubmitting(false);
    }
  }

  const selectedSector = AVAILABLE_SECTORS.find((s) => s.naceCode === selectedNace);

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

      <div style={{ maxWidth: "640px", margin: "0 auto", padding: "40px 24px" }}>
        <div style={{ marginBottom: "24px" }}>
          <Link
            href="/admin"
            style={{ color: "#666", fontSize: "14px", textDecoration: "none" }}
          >
            ← Zpět na přehledy
          </Link>
        </div>

        <h1 style={{ fontSize: "24px", fontWeight: "bold", marginBottom: "8px" }}>
          Vyberte sektor
        </h1>
        <p style={{ color: "#666", fontSize: "14px", marginBottom: "24px" }}>
          Sektor bude po vytvoření přehledu uzamčen a nelze ho změnit.
        </p>

        {/* Search field */}
        <div style={{ marginBottom: "16px" }}>
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Hledat sektor nebo kód NACE…"
            aria-label="Vyhledat sektor"
            style={{
              width: "100%",
              padding: "10px 14px",
              border: "1px solid #d0d0d0",
              borderRadius: "6px",
              fontSize: "15px",
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* Sector list */}
        {filtered.length === 0 ? (
          <div
            style={{
              backgroundColor: "#fff",
              border: "1px solid #e0e0e0",
              borderRadius: "8px",
              padding: "32px",
              textAlign: "center",
              color: "#666",
              fontSize: "14px",
            }}
          >
            Nejsou k dispozici žádné sektory s dostatečnými daty pro tvorbu přehledu.
            Obraťte se na správce dat.
          </div>
        ) : (
          <div
            style={{
              backgroundColor: "#fff",
              border: "1px solid #e0e0e0",
              borderRadius: "8px",
              overflow: "hidden",
              marginBottom: "24px",
            }}
          >
            {filtered.map((sector, idx) => {
              const isSelected = sector.naceCode === selectedNace;
              return (
                <button
                  key={sector.naceCode}
                  onClick={() => setSelectedNace(sector.naceCode)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "14px 16px",
                    textAlign: "left",
                    background: isSelected ? "#f0f4ff" : "transparent",
                    border: "none",
                    borderBottom: idx < filtered.length - 1 ? "1px solid #f0f0f0" : "none",
                    cursor: "pointer",
                    borderLeft: isSelected ? "3px solid #1a1a1a" : "3px solid transparent",
                  }}
                  aria-pressed={isSelected}
                >
                  <span
                    style={{
                      display: "inline-block",
                      width: "48px",
                      flexShrink: 0,
                      fontSize: "13px",
                      fontWeight: "600",
                      color: "#555",
                      fontFamily: "monospace",
                    }}
                  >
                    {sector.naceCode}
                  </span>
                  <span style={{ fontSize: "14px", color: "#1a1a1a" }}>
                    {sector.sectorName}
                  </span>
                  {isSelected && (
                    <span
                      style={{
                        marginLeft: "auto",
                        fontSize: "16px",
                        color: "#1a1a1a",
                      }}
                      aria-hidden="true"
                    >
                      ✓
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Error */}
        {error && (
          <div
            role="alert"
            style={{
              backgroundColor: "#fff0f0",
              border: "1px solid #ffcccc",
              borderRadius: "4px",
              padding: "12px 16px",
              color: "#c00",
              marginBottom: "16px",
              fontSize: "14px",
            }}
          >
            {error}
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <button
            onClick={() => { void handleCreate(); }}
            disabled={!selectedNace || submitting}
            title={!selectedNace ? "Vyberte sektor před vytvořením přehledu." : undefined}
            style={{
              padding: "12px 24px",
              backgroundColor: selectedNace && !submitting ? "#1a1a1a" : "#999",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              fontSize: "15px",
              fontWeight: "bold",
              cursor: selectedNace && !submitting ? "pointer" : "not-allowed",
            }}
          >
            {submitting ? "Vytvářím…" : "Vytvořit přehled"}
          </button>
          <Link
            href="/admin"
            style={{ color: "#666", fontSize: "14px", textDecoration: "none" }}
          >
            Zrušit
          </Link>
        </div>

        {selectedSector && (
          <p style={{ marginTop: "16px", fontSize: "13px", color: "#555" }}>
            Vybraný sektor:{" "}
            <strong>
              {selectedSector.sectorName} (NACE {selectedSector.naceCode})
            </strong>{" "}
            — sektor nelze po vytvoření přehledu změnit.
          </p>
        )}
      </div>
    </main>
  );
}
