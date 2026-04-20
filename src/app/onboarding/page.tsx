/**
 * /onboarding — Sector profile configuration (direct sign-up path)
 *
 * Collects three fields: NACE sector, size band, region.
 * After submission: POST /api/profile, then redirect to /brief (most recent brief)
 * or /no-brief (if none exists for their sector).
 *
 * For bank-referred owners (token in query param), pre-populated seed data
 * may be available via the prepopulated_seed table. At MVP trial this is a
 * stub that presents the Selection Form (direct sign-up variant) for all owners.
 *
 * Out-of-persona guard: size band selection outside S1/S2/S3 (i.e., employee
 * count < 10 or > 100) routes to an exclusion screen (US-2 AC-3).
 *
 * Czech copy per D-004. Formal register.
 */
"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const NACE_SECTORS = [
  { code: "10", name: "Výroba potravinářských výrobků" },
  { code: "11", name: "Výroba nápojů" },
  { code: "13", name: "Výroba textilií" },
  { code: "14", name: "Výroba oděvů" },
  { code: "16", name: "Zpracování dřeva a výroba dřevěných výrobků" },
  { code: "17", name: "Výroba papíru a výrobků z papíru" },
  { code: "20", name: "Výroba chemických látek" },
  { code: "22", name: "Výroba pryžových a plastových výrobků" },
  { code: "25", name: "Výroba kovových konstrukcí" },
  { code: "28", name: "Výroba strojů a zařízení" },
  { code: "41", name: "Výstavba budov" },
  { code: "43", name: "Specializované stavební činnosti" },
  { code: "45", name: "Velkoobchod a maloobchod s motorovými vozidly" },
  { code: "46", name: "Velkoobchod (kromě motorových vozidel)" },
  { code: "47", name: "Maloobchod (kromě motorových vozidel)" },
  { code: "55", name: "Ubytování" },
  { code: "56", name: "Stravování a pohostinství" },
  { code: "62", name: "Činnosti v oblasti informačních technologií" },
  { code: "63", name: "Informační služby" },
  { code: "71", name: "Architektonické a inženýrské činnosti" },
  { code: "74", name: "Ostatní odborné, vědecké a technické činnosti" },
];

const CZ_REGIONS = [
  "Praha",
  "Střední Čechy",
  "Jihozápad",
  "Severozápad",
  "Severovýchod",
  "Jihovýchod",
  "Střední Morava",
  "Moravskoslezsko",
];

function OnboardingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [nace, setNace] = useState<string | null>(null);
  const [sizeBand, setSizeBand] = useState<"S1" | "S2" | "S3" | null>(null);
  const [region, setRegion] = useState<string | null>(null);
  const [outOfPersona, setOutOfPersona] = useState(false);
  const [sectorSearch, setSectorSearch] = useState("");
  const [showSectorModal, setShowSectorModal] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canContinue = nace !== null && sizeBand !== null && region !== null;

  const filteredSectors = NACE_SECTORS.filter(
    (s) =>
      s.name.toLowerCase().includes(sectorSearch.toLowerCase()) ||
      s.code.includes(sectorSearch)
  );

  const selectedSector = NACE_SECTORS.find((s) => s.code === nace);

  // Size band labels
  const sizeBandLabel: Record<string, string> = {
    S1: "10–24 zaměstnanců",
    S2: "25–49 zaměstnanců",
    S3: "50–100 zaměstnanců",
  };

  async function handleSubmit() {
    if (!canContinue) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nace_sector: nace,
          size_band: sizeBand,
          region,
          token,
        }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Nepodařilo se uložit váš profil. Zkuste to prosím znovu.");
        return;
      }

      // Redirect to brief view (most recent published brief for their sector)
      const tokenParam = token ? `?token=${token}` : "";
      router.push(`/brief${tokenParam}`);
    } catch {
      setError("Nepodařilo se uložit váš profil. Zkuste to prosím znovu.");
    } finally {
      setSubmitting(false);
    }
  }

  // Out-of-persona screen
  if (outOfPersona) {
    return (
      <main
        style={{
          minHeight: "100vh",
          backgroundColor: "#fff",
          fontFamily: "system-ui, sans-serif",
          maxWidth: "480px",
          margin: "0 auto",
          padding: "40px 20px",
        }}
      >
        <h1 style={{ fontSize: "22px", fontWeight: "bold", marginBottom: "16px" }}>
          Strategy Radar je zatím pro firmy s 10 až 100 zaměstnanci
        </h1>
        <p style={{ fontSize: "15px", color: "#444", marginBottom: "32px", lineHeight: "1.5" }}>
          Naše přehledy jsou aktuálně připraveny pro firmy v tomto rozsahu. Pokud
          se váš počet zaměstnanců změní, budeme rádi, když se vrátíte.
        </p>
        <button
          type="button"
          onClick={() => setOutOfPersona(false)}
          style={{
            padding: "12px 24px",
            backgroundColor: "#1a1a1a",
            color: "#fff",
            border: "none",
            borderRadius: "6px",
            fontSize: "15px",
            cursor: "pointer",
            marginBottom: "16px",
            display: "block",
          }}
        >
          Zpět
        </button>
        <a href="/" style={{ fontSize: "14px", color: "#666", textDecoration: "none" }}>
          Zpět do George
        </a>
      </main>
    );
  }

  return (
    <>
      {/* Sector picker modal */}
      {showSectorModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Vyberte obor podnikání"
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "#fff",
            zIndex: 1000,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              padding: "16px 20px",
              borderBottom: "1px solid #e0e0e0",
              display: "flex",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <button
              type="button"
              onClick={() => {
                setShowSectorModal(false);
                setSectorSearch("");
              }}
              style={{
                background: "none",
                border: "none",
                fontSize: "20px",
                cursor: "pointer",
                padding: "4px",
              }}
              aria-label="Zavřít výběr oboru"
            >
              ←
            </button>
            <input
              type="text"
              value={sectorSearch}
              onChange={(e) => setSectorSearch(e.target.value)}
              placeholder="Vyhledat obor podnikání…"
              aria-label="Vyhledat obor podnikání"
              autoFocus
              style={{
                flex: 1,
                padding: "8px 12px",
                border: "1px solid #d0d0d0",
                borderRadius: "4px",
                fontSize: "15px",
              }}
            />
          </div>
          <div style={{ overflowY: "auto", flex: 1 }}>
            {filteredSectors.length === 0 ? (
              <p style={{ padding: "24px", color: "#888", textAlign: "center" }}>
                Žádný obor neodpovídá vašemu hledání.
              </p>
            ) : (
              filteredSectors.map((s) => (
                <button
                  key={s.code}
                  type="button"
                  onClick={() => {
                    setNace(s.code);
                    setShowSectorModal(false);
                    setSectorSearch("");
                  }}
                  style={{
                    width: "100%",
                    display: "flex",
                    gap: "12px",
                    padding: "16px 20px",
                    textAlign: "left",
                    background: nace === s.code ? "#f0f4ff" : "transparent",
                    border: "none",
                    borderBottom: "1px solid #f0f0f0",
                    cursor: "pointer",
                    fontSize: "14px",
                    minHeight: "44px",
                    alignItems: "center",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "monospace",
                      fontWeight: "600",
                      color: "#555",
                      width: "32px",
                      flexShrink: 0,
                    }}
                  >
                    {s.code}
                  </span>
                  <span>{s.name}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      <main
        style={{
          minHeight: "100vh",
          backgroundColor: "#fff",
          fontFamily: "system-ui, sans-serif",
          maxWidth: "480px",
          margin: "0 auto",
          padding: "32px 20px 120px",
        }}
      >
        <h1 style={{ fontSize: "22px", fontWeight: "bold", marginBottom: "12px" }}>
          Řekněte nám o vaší firmě
        </h1>
        <p style={{ fontSize: "15px", color: "#444", marginBottom: "28px", lineHeight: "1.5" }}>
          Potřebujeme tři údaje, abychom vám mohli zobrazit přehled pro váš
          obor. Nic jiného nepotřebujeme.
        </p>

        {/* NACE picker */}
        <div style={{ marginBottom: "24px" }}>
          <label
            style={{
              display: "block",
              fontSize: "14px",
              fontWeight: "600",
              marginBottom: "8px",
            }}
          >
            Obor podnikání
          </label>
          <button
            type="button"
            onClick={() => setShowSectorModal(true)}
            style={{
              width: "100%",
              padding: "12px 14px",
              border: "1px solid #d0d0d0",
              borderRadius: "6px",
              textAlign: "left",
              fontSize: "15px",
              backgroundColor: "#fff",
              cursor: "pointer",
              minHeight: "44px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
            aria-label="Obor podnikání"
          >
            <span style={{ color: nace ? "#1a1a1a" : "#aaa" }}>
              {selectedSector
                ? `${selectedSector.code} — ${selectedSector.name}`
                : "Vyberte obor podnikání"}
            </span>
            <span style={{ color: "#888" }}>▼</span>
          </button>
        </div>

        {/* Size band */}
        <div style={{ marginBottom: "24px" }}>
          <label
            style={{
              display: "block",
              fontSize: "14px",
              fontWeight: "600",
              marginBottom: "8px",
            }}
          >
            Počet zaměstnanců
          </label>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {(["S1", "S2", "S3"] as const).map((band) => (
              <button
                key={band}
                type="button"
                onClick={() => setSizeBand(band)}
                aria-pressed={sizeBand === band}
                style={{
                  flex: "1 1 auto",
                  padding: "12px 8px",
                  border: `2px solid ${sizeBand === band ? "#1a1a1a" : "#d0d0d0"}`,
                  borderRadius: "6px",
                  backgroundColor: sizeBand === band ? "#1a1a1a" : "#fff",
                  color: sizeBand === band ? "#fff" : "#1a1a1a",
                  fontSize: "14px",
                  fontWeight: sizeBand === band ? "600" : "400",
                  cursor: "pointer",
                  minHeight: "44px",
                }}
              >
                {sizeBandLabel[band]}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setOutOfPersona(true)}
            style={{
              marginTop: "10px",
              background: "none",
              border: "none",
              color: "#666",
              fontSize: "13px",
              cursor: "pointer",
              textDecoration: "underline",
              padding: 0,
            }}
          >
            Naše firma zaměstnává méně než 10 nebo více než 100 lidí
          </button>
        </div>

        {/* Region */}
        <div style={{ marginBottom: "28px" }}>
          <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
            <legend
              style={{
                display: "block",
                fontSize: "14px",
                fontWeight: "600",
                marginBottom: "8px",
              }}
            >
              Kraj / region
            </legend>
            {CZ_REGIONS.map((r) => (
              <label
                key={r}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "10px 0",
                  borderBottom: "1px solid #f0f0f0",
                  cursor: "pointer",
                  fontSize: "15px",
                  minHeight: "44px",
                }}
              >
                <input
                  type="radio"
                  name="region"
                  value={r}
                  checked={region === r}
                  onChange={() => setRegion(r)}
                  style={{ flexShrink: 0 }}
                />
                {r}
              </label>
            ))}
          </fieldset>
        </div>

        {/* Error */}
        {error && (
          <div
            role="alert"
            aria-live="assertive"
            style={{
              backgroundColor: "#fff0f0",
              border: "1px solid #ffcccc",
              borderRadius: "4px",
              padding: "12px",
              color: "#c00",
              fontSize: "14px",
              marginBottom: "16px",
            }}
          >
            {error}
          </div>
        )}
      </main>

      {/* Sticky footer button */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: "#fff",
          borderTop: "1px solid #e0e0e0",
          padding: "16px 20px",
          zIndex: 100,
        }}
      >
        <button
          type="button"
          onClick={() => { void handleSubmit(); }}
          disabled={!canContinue || submitting}
          aria-disabled={!canContinue || submitting}
          style={{
            width: "100%",
            padding: "14px",
            backgroundColor: canContinue && !submitting ? "#1a1a1a" : "#ccc",
            color: canContinue && !submitting ? "#fff" : "#888",
            border: "none",
            borderRadius: "6px",
            fontSize: "16px",
            fontWeight: "bold",
            cursor: canContinue && !submitting ? "pointer" : "not-allowed",
            minHeight: "44px",
          }}
        >
          {submitting ? "Ukládám…" : "Pokračovat"}
        </button>
      </div>
    </>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<div style={{ padding: "40px", textAlign: "center" }}>Načítám…</div>}>
      <OnboardingContent />
    </Suspense>
  );
}
