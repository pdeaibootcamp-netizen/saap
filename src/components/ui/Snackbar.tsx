/**
 * Snackbar — GDS reusable error/notification toast (POC)
 *
 * Floats bottom-right, slides in, auto-dismisses after autoHideMs (default 10 s)
 * or on user click. Designed for POC error reporting where inline error placement
 * is illegible (e.g. on the boundary of a coloured stripe header — IcoSwitcher).
 *
 * Visual: dark navy bg (#0a285c — gds-heading-color), white text, red circular X
 * icon on left, dismiss × on right. Styles in globals.css (.gds-snackbar*).
 *
 * A11y: role=alert + aria-live=assertive (screen readers announce immediately);
 * close button has aria-label; auto-dismiss timer cleared on unmount.
 *
 * Not a global queue — caller controls open/onClose. For multi-snackbar UX,
 * elevate to context later (out of scope for POC).
 */

"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

interface SnackbarProps {
  open: boolean;
  message: string;
  onClose: () => void;
  /** Auto-dismiss after this many ms. Default 10 000. Pass 0 to disable. */
  autoHideMs?: number;
}

export default function Snackbar({
  open,
  message,
  onClose,
  autoHideMs = 10000,
}: SnackbarProps) {
  // Mounted-on-client guard: createPortal needs document, which is undefined
  // during SSR. Without this gate Next.js logs a hydration mismatch warning.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open || autoHideMs === 0) return;
    const timer = setTimeout(onClose, autoHideMs);
    return () => clearTimeout(timer);
  }, [open, autoHideMs, onClose]);

  if (!open || !mounted) return null;

  // Portal to body — any ancestor with transform/filter/perspective would
  // re-anchor position:fixed to itself instead of the viewport (CSS spec).
  // The IcoSwitcher wrapper uses translateY(-50%) for centring; rendering
  // here would break the bottom-right floating placement.
  return createPortal(
    <div className="gds-snackbar" role="alert" aria-live="assertive">
      <span className="gds-snackbar__icon" aria-hidden="true">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="10" r="9" fill="#cf2a1e" />
          <path
            d="M7 7L13 13M13 7L7 13"
            stroke="white"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      </span>
      <span className="gds-snackbar__text">{message}</span>
      <button
        type="button"
        className="gds-snackbar__close"
        aria-label="Zavřít upozornění"
        onClick={onClose}
      >
        ×
      </button>
    </div>,
    document.body,
  );
}
