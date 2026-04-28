/**
 * ActionBox — 1–3 time-horizon-tagged orphan action cards for Pulz oboru.
 *
 * Reuses the OrphanActionCard pattern from the brief detail page
 * (src/app/brief/[id]/page.tsx). Actions are flat orphans — no
 * paired_observation_index (PM §4.3 pairing note).
 *
 * Heading: <h3>Doporučené kroky</h3> — h3 because it sits under the
 * <h2>Pulz oboru</h2> section heading. No heading levels skipped.
 *
 * Omits entirely when actions array is empty (action box heading and cards
 * both omitted — no empty placeholder).
 *
 * Read-only at MVP — no "mark as done" or "follow up" interactive control.
 * Opportunity-framed actions only; no risk-framed actions (authoring scope).
 *
 * Design spec: docs/design/pulz-oboru.md §4.5
 * PM spec: docs/product/pulz-oboru.md §5.6
 */

import type { PulzActionView } from "@/lib/pulz-analyses";

const TIME_HORIZON_COLORS: Record<
  string,
  { bg: string; color: string }
> = {
  "Okamžitě":      { bg: "#fff3e0", color: "#e65100" },
  "Do 3 měsíců":   { bg: "#e3f2fd", color: "#0d47a1" },
  "Do 12 měsíců":  { bg: "#e8f5e9", color: "#1b5e20" },
  "Více než rok":  { bg: "#f3e5f5", color: "#4a148c" },
};

function TimeHorizonPill({ label }: { label: string }) {
  const colors = TIME_HORIZON_COLORS[label] ?? { bg: "#f5f5f5", color: "#555" };
  return (
    <span
      style={{
        display: "inline-block",
        padding: "3px 10px",
        borderRadius: "999px",
        fontSize: "12px",
        fontWeight: 600,
        backgroundColor: colors.bg,
        color: colors.color,
        marginBottom: "8px",
      }}
    >
      {label}
    </span>
  );
}

function OrphanActionCard({ action }: { action: PulzActionView }) {
  return (
    <div
      style={{
        border: "1px solid #e0e0e0",
        borderRadius: "6px",
        padding: "14px 16px",
        backgroundColor: "#fafafa",
        marginBottom: "12px",
      }}
    >
      <TimeHorizonPill label={action.timeHorizon} />
      <p
        style={{
          fontSize: "15px",
          fontWeight: 400,
          color: "#1a1a1a",
          lineHeight: "1.5",
          margin: 0,
        }}
      >
        {action.actionText}
      </p>
    </div>
  );
}

export function ActionBox({ actions }: { actions: PulzActionView[] }) {
  if (actions.length === 0) return null;

  return (
    <div>
      <h3
        style={{
          fontSize: "15px",
          fontWeight: 600,
          color: "#1a1a1a",
          margin: "0 0 12px 0",
        }}
      >
        Doporučené kroky
      </h3>
      {actions.map((action) => (
        <OrphanActionCard key={`${action.slotIndex}`} action={action} />
      ))}
    </div>
  );
}
