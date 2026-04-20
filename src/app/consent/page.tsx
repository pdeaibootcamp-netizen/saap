/**
 * /consent — Single-screen data declaration (D-007, D-008)
 *
 * Shown once per owner before their first brief. The four data lanes are
 * displayed as transparency rows, not toggles — this is informational, not
 * configuration (D-007 single opt-in).
 *
 * On confirm:
 *   1. POST /api/consent to record the grant event (user_contributed lane)
 *   2. Redirect to /onboarding (or back to /brief/[id] if token is present)
 *
 * Czech copy per D-004. Formal register.
 * Copy is draft — legal review required before production (OQ-004).
 */
"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

const LANE_ROWS = [
  {
    heading: "Obsah přehledů",
    notDoing:
      "Obsah přehledů nevzniká na základě vašich osobních finančních dat.",
    doing:
      "Přehledy píší analytici České spořitelny na základě sektorových statistik a veřejně dostupných tržních dat. Váš přehled odráží situaci ve vašem oboru — ne vaše konkrétní firemní čísla.",
  },
  {
    heading: "Vaše data v srovnání",
    notDoing:
      "Vaše srovnávací pozice není sdílena s jinými firmami ani s nikým mimo Českou spořitelnu. Data z přehledů nikdy nevstupují do trénování žádného AI modelu.",
    doing:
      "Na základě informací o vašem oboru, velikosti a regionu vás zařadíme do skupiny podobných firem. Ukážeme vám, jak si váš obor vede v porovnání s ostatními — nikoli komu konkrétně patří která čísla.",
  },
  {
    heading: "Váš poradce ČS",
    notDoing:
      "Váš poradce nevidí vaše finanční výsledky ani vaše chování v aplikaci. Tato funkce v současné verzi aplikace není aktivní.",
    doing:
      "V budoucích verzích může mít váš poradce přístup k obecným informacím o tom, jak využíváte přehledy — například že vás zajímá téma expanze. Cílem je, aby vám mohl nabídnout relevantní služby ve správný čas. Nikdy to nebude sloužit k hodnocení vašeho úvěrového rizika.",
  },
  {
    heading: "Úvěrové hodnocení",
    notDoing:
      "Data z aplikace Strategy Radar nikdy neslouží jako podklad pro úvěrové hodnocení vaší firmy. Tato aplikace a úvěrové oddělení České spořitelny jsou od sebe přísně odděleny.",
    doing:
      "Strategy Radar funguje jako samostatná služba. Žádná data, která zde vidíte nebo která s námi sdílíte, nejsou předávána do procesů hodnocení bonity.",
  },
];

function ConsentPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const returnTo = searchParams.get("returnTo");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConsent() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "grant", token }),
      });

      if (!res.ok) {
        setError("Nepodařilo se zaznamenat váš souhlas. Zkuste to prosím znovu.");
        return;
      }

      // Redirect to onboarding or back to brief
      if (returnTo) {
        router.push(returnTo);
      } else if (token) {
        router.push(`/onboarding?token=${token}`);
      } else {
        router.push("/onboarding");
      }
    } catch {
      setError("Nepodařilo se zaznamenat váš souhlas. Zkuste to prosím znovu.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        backgroundColor: "#fff",
        fontFamily: "system-ui, sans-serif",
        maxWidth: "480px",
        margin: "0 auto",
        padding: "24px 20px 120px",
      }}
    >
      {/* ČS wordmark placeholder */}
      <div style={{ marginBottom: "32px" }}>
        <span style={{ fontWeight: "bold", fontSize: "18px", color: "#1a1a1a" }}>
          Česká Spořitelna
        </span>
        <span style={{ marginLeft: "8px", color: "#888", fontSize: "14px" }}>
          Strategy Radar
        </span>
      </div>

      <h1 style={{ fontSize: "22px", fontWeight: "bold", marginBottom: "16px" }}>
        Jak nakládáme s vašimi daty
      </h1>

      <p style={{ fontSize: "15px", color: "#444", marginBottom: "28px", lineHeight: "1.5" }}>
        Než zobrazíme váš první přehled, chceme vám ukázat, jak přesně s vašimi
        daty zacházíme. Nemusíte nic nastavovat — stačí přečíst a pokračovat.
      </p>

      {/* Four lane rows */}
      {LANE_ROWS.map((lane) => (
        <div
          key={lane.heading}
          style={{
            border: "1px solid #e0e0e0",
            borderRadius: "8px",
            padding: "16px",
            marginBottom: "12px",
          }}
        >
          <p style={{ fontWeight: "700", fontSize: "15px", marginBottom: "10px" }}>
            {lane.heading}
          </p>
          <p style={{ fontSize: "14px", color: "#c00", marginBottom: "8px", lineHeight: "1.4" }}>
            <span aria-hidden="true" style={{ marginRight: "6px" }}>✕</span>
            <strong>Co neděláme:</strong> {lane.notDoing}
          </p>
          <p style={{ fontSize: "14px", color: "#1a7a34", lineHeight: "1.4" }}>
            <span aria-hidden="true" style={{ marginRight: "6px" }}>✓</span>
            <strong>Co děláme:</strong> {lane.doing}
          </p>
        </div>
      ))}

      <p style={{ fontSize: "12px", color: "#888", marginBottom: "32px", lineHeight: "1.4" }}>
        Svůj souhlas můžete kdykoli odvolat v nastavení aplikace pod položkou
        Soukromí.
      </p>

      {/* Sticky footer confirm button */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: "#fff",
          borderTop: "1px solid #e0e0e0",
          padding: "16px 20px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "12px",
          zIndex: 100,
        }}
      >
        {error && (
          <div
            role="alert"
            aria-live="assertive"
            style={{
              color: "#c00",
              fontSize: "14px",
              textAlign: "center",
              maxWidth: "440px",
            }}
          >
            {error}
          </div>
        )}
        <button
          type="button"
          onClick={() => { void handleConsent(); }}
          disabled={loading}
          style={{
            width: "100%",
            maxWidth: "440px",
            padding: "14px",
            backgroundColor: loading ? "#888" : "#1a1a1a",
            color: "#fff",
            border: "none",
            borderRadius: "6px",
            fontSize: "16px",
            fontWeight: "bold",
            cursor: loading ? "not-allowed" : "pointer",
            minHeight: "44px",
          }}
        >
          {loading ? "Zaznamenávám souhlas…" : "Rozumím a chci pokračovat"}
        </button>
        <a
          href="/"
          style={{
            fontSize: "14px",
            color: "#666",
            textDecoration: "none",
          }}
        >
          Zpět do George
        </a>
      </div>
    </main>
  );
}

export default function ConsentPage() {
  return (
    <Suspense fallback={<div style={{ padding: "40px", textAlign: "center" }}>Načítám…</div>}>
      <ConsentPageContent />
    </Suspense>
  );
}
