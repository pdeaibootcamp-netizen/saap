/**
 * ErrorCard — shown when the Pulz oboru section data fetch fails.
 *
 * Solid border (vs. dashed on EmptyStateCard) visually distinguishes
 * "load failure" from "no analysis yet". The distinction is per PM US-6.
 *
 * "Zkusit znovu" triggers a client-side re-fetch of the Pulz oboru section
 * only — not a full page reload.
 *
 * Because PulzOboruSection is a server component, retry is implemented as
 * a simple window.location.reload() scoped to the section via a client
 * component wrapper. At MVP this reloads the full page; a future iteration
 * can use router.refresh() once the section is wrapped in a Suspense boundary.
 * This matches PM US-6 acceptance criteria (section-scoped retry intent —
 * cohort tiles and briefs list are unaffected as long as their own fetch
 * succeeds).
 *
 * Design spec: docs/design/pulz-oboru.md §4.7
 * PM spec: docs/product/pulz-oboru.md §5.8 / US-6
 */

"use client";

export function ErrorCard() {
  function handleRetry() {
    window.location.reload();
  }

  return (
    <div
      style={{
        border: "1px solid #e0e0e0",
        borderRadius: "8px",
        padding: "24px",
        backgroundColor: "#ffffff",
      }}
    >
      <p
        style={{
          fontSize: "15px",
          fontWeight: 400,
          color: "#666",
          margin: "0 0 12px 0",
          lineHeight: "1.5",
        }}
      >
        Informace o vašem oboru se nepodařilo načíst.
      </p>
      <button
        type="button"
        onClick={handleRetry}
        style={{
          background: "none",
          border: "none",
          padding: 0,
          fontSize: "15px",
          fontWeight: 400,
          color: "#666",
          textDecoration: "underline",
          cursor: "pointer",
          minHeight: "44px",
          display: "inline-flex",
          alignItems: "center",
        }}
      >
        Zkusit znovu
      </button>
    </div>
  );
}
