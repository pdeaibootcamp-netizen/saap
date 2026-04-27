/**
 * IcoSwitcher — v0.3 moderator-facing demo firm selector
 *
 * A small input + button in the dashboard header band that lets the testing
 * moderator switch the active demo firm by IČO. Not customer-facing chrome.
 *
 * Design spec: docs/design/in-tile-prompts.md §4.3
 * PM spec: docs/product/in-tile-prompts.md §8
 * API: POST /api/owner/demo/switch
 *
 * On success: full page reload (window.location.reload()) so the new firm's
 * data composes from scratch via the updated sr_active_ico cookie.
 *
 * Copy is verbatim from PM spec §8.2 — no editorialisation.
 *
 * GDS token note: all colours are hardcoded hex (not CSS vars) per engineer
 * visual-style rules (CSS vars not reliable in client components with
 * dangerouslySetInnerHTML-injected styles).
 */

"use client";

import React, { useState } from "react";

interface IcoSwitcherProps {
  /** Current active IČO (from cookie, shown as input value). */
  activeIco?: string;
  /** Current active firm name (from cohort_companies via switch route). */
  activeName?: string;
}

export default function IcoSwitcher({ activeIco, activeName }: IcoSwitcherProps) {
  const [inputValue, setInputValue] = useState(activeIco ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const ico = inputValue.trim();

    // Client-side format validation — exactly 8 digits
    if (!/^\d{8}$/.test(ico)) {
      setError("IČO má 8 číslic. Zkontrolujte prosím zadání.");
      return;
    }

    setIsLoading(true);

    try {
      const resp = await fetch("/api/owner/demo/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ico }),
      });

      if (resp.status === 404) {
        const data = await resp.json().catch(() => ({})) as Record<string, unknown>;
        setError((data.error as string) ?? "Tuto firmu v datech nemáme. Zkuste prosím jiné IČO.");
        return;
      }

      if (resp.status === 422) {
        const data = await resp.json().catch(() => ({})) as Record<string, unknown>;
        setError((data.error as string) ?? "IČO má 8 číslic. Zkontrolujte prosím zadání.");
        return;
      }

      if (!resp.ok) {
        setError("Přepnutí se nezdařilo. Zkuste to prosím znovu.");
        return;
      }

      // Success: full page reload so the new firm's data composes from scratch.
      // The server sets sr_active_ico cookie on the response; the reload picks it up.
      window.location.reload();
    } catch {
      setError("Přepnutí se nezdařilo. Zkuste to prosím znovu.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 0 }}
      aria-label="Přepnutí demo firmy"
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {/* DEMO badge — moderator-tool annotation */}
        <span style={{
          backgroundColor: "#FFF3E0",
          color: "#E65100",
          fontSize: 10,
          fontWeight: 700,
          padding: "1px 5px",
          borderRadius: 3,
          letterSpacing: "0.04em",
          textTransform: "uppercase" as const,
          marginRight: 2,
          display: "inline-block",
        }}>
          DEMO
        </span>

        {/* Label prefix */}
        <span style={{ fontSize: 12, color: "#9E9E9E", whiteSpace: "nowrap" }}>
          Demo:
        </span>

        {/* IČO input field */}
        <input
          type="text"
          inputMode="numeric"
          maxLength={8}
          placeholder="IČO firmy"
          autoComplete="off"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setError(null);
          }}
          aria-label="IČO firmy pro přepnutí demo firmy"
          aria-describedby={error ? "ico-switcher-error" : undefined}
          aria-invalid={error !== null}
          style={{
            width: 100,
            height: 32,
            fontSize: 13,
            color: "#1a1a1a",
            border: error ? "2px solid #C62828" : "1px solid #9E9E9E",
            borderRadius: 4,
            padding: "0 8px",
            outline: "none",
            fontFamily: "inherit",
            boxSizing: "border-box" as const,
            backgroundColor: "#ffffff",
          }}
          onFocus={(e) => {
            if (!error) (e.target as HTMLInputElement).style.border = "2px solid #1a1a1a";
          }}
          onBlur={(e) => {
            if (!error) (e.target as HTMLInputElement).style.border = "1px solid #9E9E9E";
          }}
        />

        {/* Přepnout button — subdued blue-gray, not primary blue (design §4.3) */}
        <button
          type="submit"
          disabled={isLoading}
          aria-label={isLoading ? "Načítám…" : "Přepnout firmu"}
          aria-disabled={isLoading}
          style={{
            backgroundColor: "#455A64",
            color: "#ffffff",
            border: "none",
            borderRadius: 4,
            height: 32,
            padding: "0 12px",
            fontSize: 13,
            fontWeight: 500,
            cursor: isLoading ? "not-allowed" : "pointer",
            opacity: isLoading ? 0.7 : 1,
            fontFamily: "inherit",
            whiteSpace: "nowrap" as const,
          }}
        >
          {isLoading ? "…" : "Přepnout"}
        </button>
      </div>

      {/* Active firm name — below the switcher row when present.
          Helps the moderator see at a glance which firm is loaded without
          having to remember the IčO. White text on the GDS blue header band
          (#135ee2) for high contrast; bumped to 15px / weight 600 so it
          reads at a glance, not just on close inspection. */}
      {activeName && !error && (
        <span
          style={{
            fontSize: 15,
            color: "#ffffff",
            marginTop: 6,
            fontWeight: 600,
            letterSpacing: "0.005em",
            maxWidth: 320,
            textAlign: "right" as const,
            whiteSpace: "nowrap" as const,
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
          title={activeName}
        >
          {activeName}
        </span>
      )}

      {/* Inline error — below the switcher row */}
      {error && (
        <span
          id="ico-switcher-error"
          role="alert"
          aria-live="polite"
          style={{ fontSize: 12, color: "#C62828", marginTop: 4 }}
        >
          {error}
        </span>
      )}
    </form>
  );
}
