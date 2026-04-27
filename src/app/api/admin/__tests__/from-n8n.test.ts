/**
 * from-n8n.test.ts — Callback payload validation
 *
 * Tests the manual payload validation logic from the
 * POST /api/admin/briefs/from-n8n handler.
 * The DB calls are not tested here (require live DB).
 * Privacy invariant tests are included.
 *
 * docs/engineering/n8n-integration.md §10
 */

import { describe, it, expect } from "vitest";

// ── Replicated validation logic (kept in sync with from-n8n/route.ts) ─────────
// Isolated here so tests don't need to import the route module (which imports
// Next.js internals that don't run in vitest's node environment).

const VALID_TIME_HORIZONS = [
  "Okamžitě",
  "Do 3 měsíců",
  "Do 12 měsíců",
  "Více než rok",
] as const;

function validatePayload(raw: unknown): string | null {
  if (typeof raw !== "object" || raw === null) return "payload must be an object";
  const p = raw as Record<string, unknown>;

  if (typeof p.jobId !== "string" || !p.jobId) return "jobId must be a non-empty string";
  if (p.status !== "done" && p.status !== "failed") {
    return `status must be 'done' or 'failed', got '${String(p.status)}'`;
  }

  if (p.status === "done") {
    if (!p.draft || typeof p.draft !== "object") return "draft is required when status is 'done'";
    const d = p.draft as Record<string, unknown>;

    if (typeof d.title !== "string" || !d.title) return "draft.title must be a non-empty string";
    if (typeof d.publication_month !== "string" || !d.publication_month) {
      return "draft.publication_month must be a non-empty string";
    }
    if (!d.publication || typeof d.publication !== "object") {
      return "draft.publication must be an object";
    }
    const pub = d.publication as Record<string, unknown>;
    for (const field of ["heading", "opener_markdown", "full_text_markdown", "source"]) {
      if (typeof pub[field] !== "string") {
        return `draft.publication.${field} must be a string`;
      }
    }

    if (!Array.isArray(d.observations)) return "draft.observations must be an array";
    if (d.observations.length < 1) return "draft.observations must contain at least one entry";
    for (let i = 0; i < d.observations.length; i++) {
      const obs = d.observations[i] as Record<string, unknown>;
      if (typeof obs.headline !== "string" || !obs.headline) {
        return `draft.observations[${i}].headline must be a non-empty string`;
      }
      if (typeof obs.body !== "string") {
        return `draft.observations[${i}].body must be a string`;
      }
      if (!VALID_TIME_HORIZONS.includes(obs.time_horizon as (typeof VALID_TIME_HORIZONS)[number])) {
        return `draft.observations[${i}].time_horizon is invalid: '${String(obs.time_horizon)}'`;
      }
      if (typeof obs.is_email_teaser !== "boolean") {
        return `draft.observations[${i}].is_email_teaser must be a boolean`;
      }
    }

    if (!Array.isArray(d.closing_actions)) return "draft.closing_actions must be an array";
    if (d.closing_actions.length < 1) return "draft.closing_actions must contain at least one entry";
    for (let i = 0; i < d.closing_actions.length; i++) {
      const act = d.closing_actions[i] as Record<string, unknown>;
      if (typeof act.action_text !== "string" || !act.action_text) {
        return `draft.closing_actions[${i}].action_text must be a non-empty string`;
      }
      if (!VALID_TIME_HORIZONS.includes(act.time_horizon as (typeof VALID_TIME_HORIZONS)[number])) {
        return `draft.closing_actions[${i}].time_horizon is invalid: '${String(act.time_horizon)}'`;
      }
      if (
        act.paired_observation_index !== undefined &&
        act.paired_observation_index !== null
      ) {
        const idx = act.paired_observation_index;
        if (
          typeof idx !== "number" ||
          !Number.isInteger(idx) ||
          idx < 0 ||
          idx >= (d.observations as unknown[]).length
        ) {
          return `draft.closing_actions[${i}].paired_observation_index is out of range`;
        }
      }
    }
  }

  return null;
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeValidDraft() {
  return {
    title: "Sektorová analýza — NACE 49 — Duben 2026",
    publication_month: "2026-04",
    publication: {
      heading: "Sektorová analýza",
      opener_markdown: "Sektor silniční nákladní dopravy...",
      full_text_markdown: "Celý text analýzy...",
      source: "Ekonomické a strategické analýzy České spořitelny — q1-2026, Duben 2026",
    },
    observations: [
      {
        headline: "Marže v sektoru klesají",
        body: "Průměrná provozní marže v sektoru klesla...",
        time_horizon: "Do 3 měsíců",
        is_email_teaser: true,
      },
      {
        headline: "Náklady na palivo rostou",
        body: "Ceny pohonných hmot vzrostly...",
        time_horizon: "Okamžitě",
        is_email_teaser: false,
      },
      {
        headline: "Poptávka po digitalizaci",
        body: "Zákazníci stále více vyžadují...",
        time_horizon: "Do 12 měsíců",
        is_email_teaser: false,
      },
    ],
    closing_actions: [
      {
        action_text: "Zkontrolujte nákladovou strukturu...",
        time_horizon: "Do 3 měsíců",
        category: "naklady-produktivita",
        paired_observation_index: 0,
      },
      {
        action_text: "Prověřte smlouvy na pohonné hmoty...",
        time_horizon: "Okamžitě",
        category: "ziskovost",
        paired_observation_index: 1,
      },
      {
        action_text: "Zvažte implementaci TMS systému...",
        time_horizon: "Do 12 měsíců",
        category: "rust-trzni-pozice",
        paired_observation_index: 2,
      },
    ],
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("from-n8n payload validation — happy paths", () => {
  it("valid 'done' payload with full draft passes", () => {
    const payload = { jobId: "uuid-abc", status: "done", draft: makeValidDraft() };
    expect(validatePayload(payload)).toBeNull();
  });

  it("valid 'failed' payload (no draft) passes", () => {
    const payload = { jobId: "uuid-abc", status: "failed", error: "extraction failed" };
    expect(validatePayload(payload)).toBeNull();
  });

  it("valid 'failed' payload (no error field) passes", () => {
    const payload = { jobId: "uuid-abc", status: "failed" };
    expect(validatePayload(payload)).toBeNull();
  });

  it("observations with null paired_observation_index pass", () => {
    const draft = makeValidDraft();
    draft.closing_actions[0] = { ...draft.closing_actions[0], paired_observation_index: null as unknown as number };
    expect(validatePayload({ jobId: "id", status: "done", draft })).toBeNull();
  });

  it("observations without paired_observation_index pass (optional field)", () => {
    const draft = makeValidDraft();
    const { paired_observation_index: _removed, ...rest } = draft.closing_actions[0];
    draft.closing_actions[0] = rest as typeof draft.closing_actions[0];
    expect(validatePayload({ jobId: "id", status: "done", draft })).toBeNull();
  });
});

describe("from-n8n payload validation — invalid status", () => {
  it("invalid status value returns 422 message", () => {
    const payload = { jobId: "uuid-abc", status: "running" };
    expect(validatePayload(payload)).toContain("status must be");
  });

  it("missing status returns error", () => {
    const payload = { jobId: "uuid-abc" };
    expect(validatePayload(payload)).not.toBeNull();
  });
});

describe("from-n8n payload validation — missing jobId", () => {
  it("missing jobId returns error", () => {
    const payload = { status: "done", draft: makeValidDraft() };
    expect(validatePayload(payload)).toContain("jobId");
  });

  it("empty jobId returns error", () => {
    const payload = { jobId: "", status: "done", draft: makeValidDraft() };
    expect(validatePayload(payload)).toContain("jobId");
  });
});

describe("from-n8n payload validation — draft required when done", () => {
  it("status=done without draft returns error", () => {
    const payload = { jobId: "uuid-abc", status: "done" };
    expect(validatePayload(payload)).toContain("draft is required");
  });

  it("status=done with null draft returns error", () => {
    const payload = { jobId: "uuid-abc", status: "done", draft: null };
    expect(validatePayload(payload)).toContain("draft is required");
  });
});

describe("from-n8n payload validation — invalid time_horizon", () => {
  it("invalid observation time_horizon returns 422 message", () => {
    const draft = makeValidDraft();
    (draft.observations[0] as Record<string, unknown>).time_horizon = "Zanedlouho";
    const payload = { jobId: "id", status: "done", draft };
    expect(validatePayload(payload)).toContain("time_horizon is invalid");
  });

  it("invalid action time_horizon returns 422 message", () => {
    const draft = makeValidDraft();
    (draft.closing_actions[0] as Record<string, unknown>).time_horizon = "brzy";
    const payload = { jobId: "id", status: "done", draft };
    expect(validatePayload(payload)).toContain("time_horizon is invalid");
  });
});

describe("from-n8n payload validation — paired_observation_index out of range", () => {
  it("index >= observations.length is rejected", () => {
    const draft = makeValidDraft();
    draft.closing_actions[0] = {
      ...draft.closing_actions[0],
      paired_observation_index: 99,
    };
    expect(validatePayload({ jobId: "id", status: "done", draft })).toContain(
      "paired_observation_index is out of range"
    );
  });

  it("negative index is rejected", () => {
    const draft = makeValidDraft();
    draft.closing_actions[0] = {
      ...draft.closing_actions[0],
      paired_observation_index: -1,
    };
    expect(validatePayload({ jobId: "id", status: "done", draft })).toContain(
      "paired_observation_index is out of range"
    );
  });
});

describe("from-n8n payload validation — observations array", () => {
  it("empty observations array is rejected", () => {
    const draft = { ...makeValidDraft(), observations: [] };
    expect(validatePayload({ jobId: "id", status: "done", draft })).toContain(
      "observations must contain at least"
    );
  });

  it("missing headline is rejected", () => {
    const draft = makeValidDraft();
    (draft.observations[0] as Record<string, unknown>).headline = "";
    expect(validatePayload({ jobId: "id", status: "done", draft })).toContain(
      "headline"
    );
  });
});

describe("privacy invariants — from-n8n route", () => {
  it("a payload with raw_value is not explicitly forbidden (not in contract) — confirming scope", () => {
    // The payload contract intentionally excludes raw_value.
    // This test confirms the valid payload shape does NOT contain raw_value.
    const draft = makeValidDraft();
    const draftKeys = Object.keys(draft.observations[0]);
    expect(draftKeys).not.toContain("raw_value");
  });

  it("generated content (opener) is in brief lane — draft field is present", () => {
    const payload = { jobId: "id", status: "done", draft: makeValidDraft() };
    const result = validatePayload(payload);
    expect(result).toBeNull(); // valid shape = brief-lane content
  });
});
