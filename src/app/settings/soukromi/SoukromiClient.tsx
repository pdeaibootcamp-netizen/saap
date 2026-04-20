"use client";

/**
 * SoukromiClient — client-side revocation dialog for /settings/soukromi
 *
 * Renders the "Odvolat souhlas" button, confirmation dialog, and handles
 * POST to /api/consent/revoke. On success, redirects to /settings/soukromi/odvolano.
 *
 * Design: docs/design/trust-and-consent-patterns.md §6
 * D-012 Option A: revoke event appended; no data deleted.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";

interface SoukromiClientProps {
  hasActiveConsent: boolean;
}

export function SoukromiClient({ hasActiveConsent }: SoukromiClientProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!hasActiveConsent) {
    return null; // Nothing to revoke.
  }

  function openDialog() {
    setError(null);
    setDialogOpen(true);
  }

  function closeDialog() {
    if (!loading) {
      setDialogOpen(false);
      setError(null);
    }
  }

  async function handleRevoke() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/consent/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        setError(
          body.error ?? "Odvolání souhlasu se nepodařilo. Zkuste to prosím znovu nebo kontaktujte podporu."
        );
        setLoading(false);
        return;
      }

      // Success — navigate to confirmation screen.
      router.push("/settings/soukromi/odvolano");
    } catch {
      setError("Odvolání souhlasu se nepodařilo. Zkuste to prosím znovu nebo kontaktujte podporu.");
      setLoading(false);
    }
  }

  return (
    <>
      {/* Revocation button */}
      <button
        type="button"
        onClick={openDialog}
        style={{
          marginTop: "24px",
          padding: "12px 20px",
          backgroundColor: "#c0392b",
          color: "#fff",
          border: "none",
          borderRadius: "4px",
          fontSize: "1rem",
          cursor: "pointer",
          minWidth: "44px",
          minHeight: "44px",
        }}
      >
        Odvolat souhlas
      </button>

      {/* Confirmation dialog */}
      {dialogOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="dialog-heading"
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: "16px",
          }}
        >
          <div
            style={{
              backgroundColor: "#fff",
              borderRadius: "8px",
              padding: "24px",
              maxWidth: "400px",
              width: "100%",
              boxShadow: "0 4px 24px rgba(0,0,0,0.15)",
            }}
          >
            <h2 id="dialog-heading" style={{ marginTop: 0 }}>
              Odvolat souhlas
            </h2>

            <p>
              Opravdu chcete odvolat souhlas?
              <br />
              Přehledy vám přestanou být doručovány a obsah aplikace nebude přístupný.
            </p>

            {/* Error message (design §7) */}
            {error && (
              <p
                role="alert"
                style={{ color: "#c0392b", fontSize: "0.9rem", margin: "0 0 16px" }}
              >
                {error}
              </p>
            )}

            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
              {/* Zpět — dismiss */}
              <button
                type="button"
                onClick={closeDialog}
                disabled={loading}
                style={{
                  padding: "10px 16px",
                  backgroundColor: "transparent",
                  border: "1px solid #999",
                  borderRadius: "4px",
                  fontSize: "1rem",
                  cursor: loading ? "not-allowed" : "pointer",
                  minHeight: "44px",
                }}
              >
                Zpět
              </button>

              {/* Ano, odvolat souhlas — destructive confirm */}
              <button
                type="button"
                onClick={handleRevoke}
                disabled={loading}
                style={{
                  padding: "10px 16px",
                  backgroundColor: loading ? "#888" : "#c0392b",
                  color: "#fff",
                  border: "none",
                  borderRadius: "4px",
                  fontSize: "1rem",
                  cursor: loading ? "not-allowed" : "pointer",
                  minHeight: "44px",
                }}
              >
                {loading ? "Odesílám..." : "Ano, odvolat souhlas"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
