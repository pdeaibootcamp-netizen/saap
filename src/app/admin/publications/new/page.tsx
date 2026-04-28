/**
 * /admin/publications/new — Upload publication for AI-assisted brief generation
 *
 * v0.3 (D-029, Model B): file-only upload. The analyst picks a PDF / DOCX /
 * MD / TXT file and clicks "Generovat návrh přehledu". The n8n workflow
 * (Strategy Radar — Analyze Publication) fans out to all four NACEs in
 * parallel, runs a relevance gate per NACE, and writes ONE multi-NACE brief
 * tagged with whichever NACEs the publication is relevant for. No NACE
 * selector here — relevance is determined automatically.
 *
 * After submission the page polls GET /api/admin/publications/jobs/[id] every 5s.
 * On 'done', redirects to /admin/briefs/[brief_id]/edit.
 * Hard timeout at 3 minutes per PM spec.
 *
 * Czech copy throughout. Formal register (vykání) per D-004.
 */
"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
const POLL_INTERVAL_MS = 5000;
const HARD_TIMEOUT_MS = 3 * 60 * 1000; // 3 minutes

type UploadStatus =
  | "idle"
  | "uploading"
  | "queued"
  | "running"
  | "done"
  | "failed"
  | "timeout";

// ── Helper ────────────────────────────────────────────────────────────────────

function elapsedLabel(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} s`;
  return `${Math.floor(s / 60)} min ${s % 60} s`;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PublicationUploadPage() {
  const router = useRouter();

  const [file, setFile] = useState<File | null>(null);

  const [status, setStatus] = useState<UploadStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutTimerRef = useRef<NodeJS.Timeout | null>(null);
  const elapsedTimerRef = useRef<NodeJS.Timeout | null>(null);

  // ── Cleanup ──
  function clearAllTimers() {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    if (timeoutTimerRef.current) clearTimeout(timeoutTimerRef.current);
    if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
  }

  useEffect(() => () => clearAllTimers(), []);

  // ── Elapsed ticker ──
  const startElapsedTicker = useCallback((from: number) => {
    if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    elapsedTimerRef.current = setInterval(() => {
      setElapsed(Date.now() - from);
    }, 1000);
  }, []);

  // ── Polling ──
  const startPolling = useCallback(
    (id: string, from: number) => {
      startElapsedTicker(from);

      // Hard timeout
      timeoutTimerRef.current = setTimeout(() => {
        clearAllTimers();
        setStatus("timeout");
        setErrorMessage(
          "Generování trvá déle než obvykle. Můžete to zkusit znovu — pokud problém trvá, kontaktujte technickou podporu."
        );
      }, HARD_TIMEOUT_MS);

      // Poll
      pollTimerRef.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/admin/publications/jobs/${id}`);
          if (!res.ok) return; // transient — keep polling

          const data = (await res.json()) as {
            status: string;
            briefId?: string;
            error?: string;
          };

          if (data.status === "done" && data.briefId) {
            clearAllTimers();
            setStatus("done");
            router.push(`/admin/briefs/${data.briefId}/edit`);
          } else if (data.status === "failed") {
            clearAllTimers();
            setStatus("failed");
            const errDetail = data.error ? ` ${data.error}.` : "";
            setErrorMessage(
              `Generování návrhu selhalo.${errDetail} Můžete to zkusit znovu nebo přehled vytvořit ručně.`
            );
          } else if (data.status === "running") {
            setStatus("running");
          }
          // queued: keep waiting
        } catch {
          // transient — keep polling
        }
      }, POLL_INTERVAL_MS);
    },
    [router, startElapsedTicker]
  );

  // ── File validation ──
  function validateFile(f: File): string | null {
    const lower = f.name.toLowerCase();
    const allowed = [".pdf", ".docx", ".doc", ".md", ".txt"];
    if (!allowed.some((ext) => lower.endsWith(ext))) {
      return "Tento formát zatím nepodporujeme. Nahrajte prosím PDF, DOCX, MD nebo TXT.";
    }
    if (f.size > MAX_FILE_BYTES) {
      return "Soubor přesahuje 10 MB. Použijte zhuštěnější verzi a zkuste to znovu.";
    }
    return null;
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setErrorMessage(null);
    if (f) {
      const err = validateFile(f);
      if (err) {
        setErrorMessage(err);
        setFile(null);
      }
    }
  }

  // ── Submit ──
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);

    if (!file) {
      setErrorMessage("Vyberte prosím soubor ke zpracování.");
      return;
    }
    const fileErr = validateFile(file);
    if (fileErr) {
      setErrorMessage(fileErr);
      return;
    }

    setStatus("running");
    const now = Date.now();
    setStartedAt(now);
    startElapsedTicker(now);

    const formData = new FormData();
    formData.append("file", file);

    // n8n's webhook responseMode='lastNode' means the POST blocks until the
    // WHOLE pipeline finishes (~30-60s with 4 NACE branches). When the upload
    // route's `await fetch(webhookUrl)` returns, the brief is already in the
    // DB — no polling needed, just redirect to /admin.

    try {
      const res = await fetch("/api/admin/publications/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        let msg = "Nahrávání selhalo. Zkontrolujte připojení a zkuste to znovu.";
        try {
          const data = (await res.json()) as { error?: string; detail?: string };
          if (data.error) msg = data.error;
          if (data.detail) msg += ` (${data.detail})`;
        } catch {}
        clearAllTimers();
        setStatus("failed");
        setErrorMessage(msg);
        return;
      }

      const { jobId: id } = (await res.json()) as { jobId: string };
      setJobId(id);
      clearAllTimers();
      setStatus("done");
      router.push("/admin");
    } catch {
      clearAllTimers();
      setStatus("failed");
      setErrorMessage("Nahrávání selhalo. Zkontrolujte připojení a zkuste to znovu.");
    }
  }

  // ── Retry ──
  function handleRetry() {
    clearAllTimers();
    setStatus("idle");
    setErrorMessage(null);
    setJobId(null);
    setStartedAt(null);
    setElapsed(0);
  }

  // ── Status pill label ──
  const statusPillLabel: Record<UploadStatus, string> = {
    idle: "",
    uploading: "Nahrávám soubor…",
    queued: "Zařazeno",
    running: "Generuji návrh přehledu… (typicky 30–60 s)",
    done: "Hotovo, otevírám přehled úloh…",
    failed: "Selhalo",
    timeout: "Vypršel čas",
  };

  const inProgress =
    status === "uploading" || status === "queued" || status === "running";

  // ── Render ──
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
          <a
            href="/admin"
            style={{ color: "#aaa", fontSize: "13px", textDecoration: "none" }}
          >
            ← Zpět na přehledy
          </a>
        </div>
        <span style={{ fontWeight: "bold", fontSize: "16px" }}>
          Strategy Radar — Nahrát publikaci
        </span>
      </header>

      <div style={{ maxWidth: "640px", margin: "0 auto", padding: "40px 24px" }}>
        <h1 style={{ fontSize: "22px", fontWeight: "bold", marginBottom: "8px" }}>
          Nahrát publikaci pro automatické generování
        </h1>
        <p style={{ fontSize: "14px", color: "#666", marginBottom: "32px" }}>
          Nahrajte sektorovou analýzu (PDF, DOCX, MD nebo TXT). Systém automaticky
          vyhodnotí, pro které obory je publikace relevantní, a vygeneruje
          jednotný návrh přehledu pokrývající všechny tyto obory.
        </p>

        {/* ── Status strip (shown during / after generation) ── */}
        {status !== "idle" && status !== "uploading" && (
          <div
            style={{
              backgroundColor:
                status === "done"
                  ? "#e6f4ea"
                  : status === "failed" || status === "timeout"
                  ? "#fff0f0"
                  : "#e8f4ff",
              border: `1px solid ${
                status === "done"
                  ? "#b7dfbe"
                  : status === "failed" || status === "timeout"
                  ? "#ffcccc"
                  : "#b3d4f5"
              }`,
              borderRadius: "6px",
              padding: "16px 20px",
              marginBottom: "24px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                marginBottom: errorMessage ? "8px" : 0,
              }}
            >
              {/* Spinner for in-progress states */}
              {inProgress && (
                <span
                  style={{
                    display: "inline-block",
                    width: "16px",
                    height: "16px",
                    border: "2px solid #1a73e8",
                    borderTopColor: "transparent",
                    borderRadius: "50%",
                    animation: "spin 0.8s linear infinite",
                  }}
                />
              )}
              <span
                style={{
                  fontWeight: "600",
                  fontSize: "14px",
                  color:
                    status === "done"
                      ? "#1e7e34"
                      : status === "failed" || status === "timeout"
                      ? "#c00"
                      : "#1a73e8",
                }}
              >
                {statusPillLabel[status]}
              </span>
              {inProgress && startedAt && (
                <span style={{ fontSize: "12px", color: "#666" }}>
                  {elapsedLabel(elapsed)}
                </span>
              )}
            </div>

            {errorMessage && (
              <p style={{ fontSize: "14px", color: "#c00", margin: 0 }}>
                {errorMessage}
              </p>
            )}

            {(status === "failed" || status === "timeout") && (
              <div style={{ display: "flex", gap: "12px", marginTop: "12px" }}>
                <button
                  type="button"
                  onClick={handleRetry}
                  style={{
                    padding: "8px 16px",
                    backgroundColor: "#1a1a1a",
                    color: "#fff",
                    border: "none",
                    borderRadius: "4px",
                    fontSize: "13px",
                    cursor: "pointer",
                    fontWeight: "500",
                  }}
                >
                  Zkusit znovu
                </button>
                <a
                  href="/admin"
                  style={{
                    padding: "8px 16px",
                    backgroundColor: "transparent",
                    color: "#666",
                    border: "1px solid #ccc",
                    borderRadius: "4px",
                    fontSize: "13px",
                    cursor: "pointer",
                    textDecoration: "none",
                    display: "inline-flex",
                    alignItems: "center",
                  }}
                >
                  Zrušit
                </a>
              </div>
            )}
          </div>
        )}

        {/* ── Upload form (shown only when not in progress / done) ── */}
        {!inProgress && status !== "done" && (
          <form
            onSubmit={(e) => {
              void handleSubmit(e);
            }}
            style={{
              backgroundColor: "#fff",
              border: "1px solid #e0e0e0",
              borderRadius: "8px",
              padding: "24px",
            }}
          >
            {/* File picker */}
            <div style={{ marginBottom: "20px" }}>
              <label
                htmlFor="pub-file"
                style={{
                  display: "block",
                  fontSize: "13px",
                  fontWeight: "600",
                  marginBottom: "6px",
                }}
              >
                Publikace (PDF, DOCX, MD nebo TXT, max 10 MB)
              </label>
              <input
                id="pub-file"
                type="file"
                accept=".pdf,.docx,.doc,.md,.txt"
                onChange={handleFileChange}
                style={{
                  display: "block",
                  fontSize: "14px",
                  width: "100%",
                  padding: "8px 0",
                }}
              />
              {file && (
                <p style={{ fontSize: "12px", color: "#555", marginTop: "4px" }}>
                  Vybrán: {file.name} ({(file.size / (1024 * 1024)).toFixed(1)} MB)
                </p>
              )}
            </div>

            {/* Error (form-level) */}
            {errorMessage && (
              <div
                role="alert"
                style={{
                  backgroundColor: "#fff0f0",
                  border: "1px solid #ffcccc",
                  borderRadius: "4px",
                  padding: "10px 14px",
                  color: "#c00",
                  fontSize: "14px",
                  marginBottom: "16px",
                }}
              >
                {errorMessage}
              </div>
            )}

            {/* Submit */}
            <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
              <button
                type="submit"
                disabled={!file}
                style={{
                  padding: "12px 24px",
                  backgroundColor: file ? "#1a1a1a" : "#999",
                  color: "#fff",
                  border: "none",
                  borderRadius: "4px",
                  fontSize: "14px",
                  fontWeight: "bold",
                  cursor: file ? "pointer" : "not-allowed",
                }}
              >
                Generovat návrh přehledu
              </button>
              <a
                href="/admin"
                style={{
                  fontSize: "13px",
                  color: "#666",
                  textDecoration: "underline",
                }}
              >
                Zrušit
              </a>
            </div>
          </form>
        )}

        <p style={{ fontSize: "12px", color: "#aaa", marginTop: "24px" }}>
          Vygenerovaný návrh je vždy ve stavu &ldquo;Koncept&rdquo;. Před
          publikováním ho zkontrolujete a případně upravíte.
        </p>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </main>
  );
}
