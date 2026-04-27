/**
 * /admin/login — Analyst authentication
 *
 * ADR-0001-D: password check against ADMIN_PASSWORD_HASH env var,
 * sets an HTTP-only cookie for the session.
 *
 * Czech copy — analyst-facing internal tool. Formal register (vykání).
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (res.ok) {
      router.push("/admin");
    } else {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? "Nesprávné heslo.");
    }
    setLoading(false);
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#f5f5f5",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div
        style={{
          backgroundColor: "#fff",
          padding: "40px",
          borderRadius: "8px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          width: "100%",
          maxWidth: "360px",
        }}
      >
        <h1 style={{ fontSize: "20px", fontWeight: "bold", marginBottom: "8px" }}>
          Strategy Radar
        </h1>
        <p style={{ color: "#666", fontSize: "14px", marginBottom: "24px" }}>
          Analytický portál ČS
        </p>

        <form onSubmit={(e) => { void handleSubmit(e); }}>
          <div style={{ marginBottom: "16px" }}>
            <label
              htmlFor="password"
              style={{ display: "block", fontSize: "14px", fontWeight: "500", marginBottom: "6px" }}
            >
              Heslo
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: "100%",
                padding: "10px 12px",
                border: "1px solid #d0d0d0",
                borderRadius: "4px",
                fontSize: "15px",
                boxSizing: "border-box",
              }}
              placeholder="Zadejte heslo"
            />
          </div>

          {error && (
            <div
              role="alert"
              aria-live="assertive"
              style={{
                color: "#c00",
                fontSize: "14px",
                marginBottom: "12px",
                padding: "8px 12px",
                backgroundColor: "#fff0f0",
                borderRadius: "4px",
                border: "1px solid #ffcccc",
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "12px",
              backgroundColor: loading ? "#888" : "#1a1a1a",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              fontSize: "15px",
              fontWeight: "bold",
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Přihlašování…" : "Přihlásit se"}
          </button>
        </form>
      </div>
    </main>
  );
}
