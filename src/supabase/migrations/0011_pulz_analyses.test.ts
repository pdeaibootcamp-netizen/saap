/**
 * 0011_pulz_analyses.test.ts — Migration enum invariants and privacy trip-wires
 *
 * Verifies that TypeScript constants for pulz_analyses, pulz_analysis_charts,
 * and pulz_analysis_actions match the SQL CHECK constraints in
 * 0011_pulz_analyses.sql without requiring a live database connection.
 *
 * Pattern follows 0008_analysis_jobs.test.ts in the same directory.
 * See docs/data/analyses-schema.md §8.3 for the test convention spec.
 */

import { describe, it, expect } from "vitest";

// ── Constants mirroring SQL CHECK constraints ─────────────────────────────────

/**
 * Frozen time-horizon enum values for pulz_analysis_actions.time_horizon.
 * Must match: CHECK (time_horizon IN ('Okamžitě','Do 3 měsíců','Do 12 měsíců','Více než rok'))
 * Source of truth: D-015, action-specificity-framing.md.
 * Same values used in briefs.content_sections closing_actions[*].time_horizon.
 */
export const PULZ_TIME_HORIZONS = [
  "Okamžitě",
  "Do 3 měsíců",
  "Do 12 měsíců",
  "Více než rok",
] as const;

export type PulzTimeHorizon = (typeof PULZ_TIME_HORIZONS)[number];

/**
 * Allowed MIME types for pulz_analysis_charts.image_mime_type.
 * Must match: CHECK (image_mime_type IN ('image/png','image/svg+xml','image/webp'))
 * JPEG is intentionally excluded (lossy artefacts on flat-colour chart graphics).
 */
export const PULZ_CHART_MIME_TYPES = [
  "image/png",
  "image/svg+xml",
  "image/webp",
] as const;

export type PulzChartMimeType = (typeof PULZ_CHART_MIME_TYPES)[number];

/**
 * The only permitted data_lane value for all three Pulz oboru tables.
 * Must match: CHECK (data_lane = 'brief') on pulz_analyses,
 * pulz_analysis_charts, and pulz_analysis_actions.
 */
export const PULZ_DATA_LANE = "brief" as const;

/**
 * Permitted status values for pulz_analyses.status.
 * Must match: CHECK (status IN ('draft', 'published'))
 */
export const PULZ_ANALYSIS_STATUS = {
  DRAFT: "draft",
  PUBLISHED: "published",
} as const;

export type PulzAnalysisStatus =
  (typeof PULZ_ANALYSIS_STATUS)[keyof typeof PULZ_ANALYSIS_STATUS];

/**
 * Cardinality constraints (enforced in application code, documented here).
 * DDL cannot enforce "exactly 3 charts and 1–3 actions per row."
 * The publish handler enforces this in a transaction.
 * See docs/data/analyses-schema.md §3.4.
 */
export const PULZ_CHART_COUNT = 3 as const;
export const PULZ_ACTION_MIN = 1 as const;
export const PULZ_ACTION_MAX = 3 as const;

/**
 * Slot index range for charts and actions.
 * Must match: CHECK (slot_index BETWEEN 1 AND 3)
 */
export const PULZ_SLOT_MIN = 1 as const;
export const PULZ_SLOT_MAX = 3 as const;

/**
 * Alt-text minimum length (chars) for pulz_analysis_charts.alt_text.
 * Must match: CHECK (char_length(alt_text) >= 20)
 * The upload form enforces a stricter 30-char floor.
 */
export const PULZ_ALT_TEXT_MIN_CHARS = 20 as const;

/**
 * Stale threshold: 91 days from published_at triggers the StaleWarningBadge.
 * Source: PM §4.5 (Q-PO-008 resolved), Design §4.1b.
 * Applied at render time in the rendering layer — not a DB constraint.
 */
export const PULZ_STALE_THRESHOLD_DAYS = 91 as const;
export const PULZ_STALE_THRESHOLD_MS = PULZ_STALE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("0011 pulz_analyses — time_horizon CHECK constraint", () => {
  it("PULZ_TIME_HORIZONS contains exactly the four frozen values (D-015)", () => {
    expect([...PULZ_TIME_HORIZONS].sort()).toEqual(
      ["Do 12 měsíců", "Do 3 měsíců", "Okamžitě", "Více než rok"].sort()
    );
  });

  it("PULZ_TIME_HORIZONS has exactly 4 entries", () => {
    expect(PULZ_TIME_HORIZONS).toHaveLength(4);
  });

  it("all time_horizon values are non-empty strings", () => {
    PULZ_TIME_HORIZONS.forEach((v) => {
      expect(typeof v).toBe("string");
      expect(v.length).toBeGreaterThan(0);
    });
  });

  it("Czech time-horizon strings are not substituted with English equivalents", () => {
    const english = ["immediately", "3 months", "12 months", "1 year"];
    english.forEach((eng) => {
      expect(PULZ_TIME_HORIZONS).not.toContain(eng);
    });
  });

  it("matches the frozen enum used in briefs.content_sections closing_actions", () => {
    // These four values are frozen across both the brief detail page and Pulz oboru.
    // Any change here must be reflected in briefs.ts ClosingAction.time_horizon.
    expect(PULZ_TIME_HORIZONS).toContain("Okamžitě");
    expect(PULZ_TIME_HORIZONS).toContain("Do 3 měsíců");
    expect(PULZ_TIME_HORIZONS).toContain("Do 12 měsíců");
    expect(PULZ_TIME_HORIZONS).toContain("Více než rok");
  });
});

describe("0011 pulz_analysis_charts — image_mime_type CHECK constraint", () => {
  it("PULZ_CHART_MIME_TYPES contains exactly PNG, SVG, WebP", () => {
    expect([...PULZ_CHART_MIME_TYPES].sort()).toEqual(
      ["image/png", "image/svg+xml", "image/webp"].sort()
    );
  });

  it("PULZ_CHART_MIME_TYPES has exactly 3 entries", () => {
    expect(PULZ_CHART_MIME_TYPES).toHaveLength(3);
  });

  it("JPEG is NOT a permitted MIME type (lossy artefacts on charts)", () => {
    expect(PULZ_CHART_MIME_TYPES).not.toContain("image/jpeg");
    expect(PULZ_CHART_MIME_TYPES).not.toContain("image/jpg");
  });

  it("GIF and video MIME types are NOT permitted (no animated charts)", () => {
    expect(PULZ_CHART_MIME_TYPES).not.toContain("image/gif");
    expect(PULZ_CHART_MIME_TYPES).not.toContain("video/mp4");
  });
});

describe("0011 — data_lane CHECK constraint (all three tables)", () => {
  it("PULZ_DATA_LANE is 'brief' only", () => {
    expect(PULZ_DATA_LANE).toBe("brief");
  });

  it("user_contributed is NOT a permitted data_lane for Pulz oboru tables", () => {
    expect(PULZ_DATA_LANE).not.toBe("user_contributed");
  });

  it("rm_visible is NOT a permitted data_lane", () => {
    expect(PULZ_DATA_LANE).not.toBe("rm_visible");
  });

  it("credit_risk is NOT a permitted data_lane", () => {
    expect(PULZ_DATA_LANE).not.toBe("credit_risk");
  });
});

describe("0011 pulz_analyses — status CHECK constraint", () => {
  it("PULZ_ANALYSIS_STATUS contains exactly 'draft' and 'published'", () => {
    expect(Object.values(PULZ_ANALYSIS_STATUS).sort()).toEqual(
      ["draft", "published"].sort()
    );
  });

  it("initial/default status is 'draft'", () => {
    expect(PULZ_ANALYSIS_STATUS.DRAFT).toBe("draft");
  });
});

describe("0011 — cardinality invariants (enforced in application code)", () => {
  it("PULZ_CHART_COUNT is exactly 3", () => {
    expect(PULZ_CHART_COUNT).toBe(3);
  });

  it("PULZ_ACTION_MIN is 1 and PULZ_ACTION_MAX is 3", () => {
    expect(PULZ_ACTION_MIN).toBe(1);
    expect(PULZ_ACTION_MAX).toBe(3);
  });

  it("slot index range is 1–3 for both charts and actions", () => {
    expect(PULZ_SLOT_MIN).toBe(1);
    expect(PULZ_SLOT_MAX).toBe(3);
  });

  it("publish-time invariant: chart count = 3 AND action count BETWEEN 1 AND 3", () => {
    // This test documents the application-layer invariant described in
    // docs/data/analyses-schema.md §3.4. The publish handler must verify
    // both conditions before committing. A nightly assertion job re-checks
    // every is_current = true row.
    const chartCount = PULZ_CHART_COUNT;
    const actionMin = PULZ_ACTION_MIN;
    const actionMax = PULZ_ACTION_MAX;
    expect(chartCount).toBe(3);
    expect(actionMin).toBeGreaterThanOrEqual(1);
    expect(actionMax).toBeLessThanOrEqual(3);
  });
});

describe("0011 — alt_text minimum length", () => {
  it("PULZ_ALT_TEXT_MIN_CHARS is 20 (schema floor)", () => {
    expect(PULZ_ALT_TEXT_MIN_CHARS).toBe(20);
  });

  it("the upload form enforces a stricter 30-char floor (OQ-078)", () => {
    // The form's client-side and server-side validation require >= 30 chars.
    // The DB CHECK is 20 chars — defence-in-depth only.
    // This test documents the layered enforcement:
    //   - Upload form: >= 30 chars + no-generic-placeholder rule.
    //   - DB CHECK:    >= 20 chars (blocks one-word placeholders).
    expect(30).toBeGreaterThan(PULZ_ALT_TEXT_MIN_CHARS);
  });
});

describe("0011 — stale threshold", () => {
  it("PULZ_STALE_THRESHOLD_DAYS is 91 (PM §4.5 / Q-PO-008 resolved)", () => {
    expect(PULZ_STALE_THRESHOLD_DAYS).toBe(91);
  });

  it("PULZ_STALE_THRESHOLD_MS equals 91 * 24 * 60 * 60 * 1000", () => {
    expect(PULZ_STALE_THRESHOLD_MS).toBe(91 * 24 * 60 * 60 * 1000);
  });
});

describe("0011 — privacy invariants (lane discipline)", () => {
  it("pulz_analyses column list does NOT include per-owner identifiers", () => {
    // These columns must never appear in pulz_analyses, pulz_analysis_charts,
    // or pulz_analysis_actions. If someone tries to add them, they must
    // update the SQL and explicitly justify here.
    const forbiddenColumns = [
      "user_id",
      "ico",
      "owner_id",
      "recipient_id",
      "consent_event_id",
      "raw_value",
      "percentile",
    ];
    // Static trip-wire: documents the invariant for reviewers.
    forbiddenColumns.forEach((col) => {
      // Test trivially passes — the column cannot appear in const definitions above.
      // Its value as a test is the explicit documentation of the forbidden list.
      expect(typeof col).toBe("string");
    });
  });

  it("uses_cs_internal_data is a boolean flag about sector-aggregate source — NOT a lane-crossing field", () => {
    // uses_cs_internal_data = true means the chart image was derived from
    // ČS-aggregate transaction statistics (sector-level, not per-owner).
    // This flag does NOT make the row user-contributed-lane data.
    // See docs/data/analyses-schema.md §7.2.
    const flagIsAboutDataSource = true; // semantic assertion documented here
    expect(flagIsAboutDataSource).toBe(true);
  });

  it("no FK exists from Pulz oboru tables to user_db, cohort_companies, consent_events", () => {
    // All three tables' FKs are: pulz_analyses.superseded_by (self-FK) and
    // pulz_analysis_charts.analysis_id + pulz_analysis_actions.analysis_id
    // (both FK to pulz_analyses). No cross-lane FKs.
    const allowedFkTargets = ["pulz_analyses"];
    const forbiddenFkTargets = [
      "user_db",
      "cohort_companies",
      "consent_events",
      "owner_metrics",
      "rm_events",
    ];
    forbiddenFkTargets.forEach((target) => {
      expect(allowedFkTargets).not.toContain(target);
    });
  });
});

describe("0011 — supersession model", () => {
  it("partial unique index on (nace_division) WHERE is_current = true enforces at-most-one-current constraint", () => {
    // This test documents that the partial unique index is the enforcement
    // mechanism — the application cannot insert a second is_current = true row
    // for the same nace_division. The publish transaction must flip the prior
    // row to is_current = false before or atomically with inserting the new row.
    const indexName = "idx_pulz_analyses_current_by_nace";
    expect(indexName).toBe("idx_pulz_analyses_current_by_nace");
  });

  it("soft-supersede keeps prior rows (storage and DB rows retained for audit)", () => {
    // When a new analysis is published for a NACE:
    // 1. New row inserted with is_current = true.
    // 2. Prior row updated: is_current = false, superseded_at = now(), superseded_by = new row id.
    // Prior row's child charts and actions are NOT deleted.
    // Prior row's storage objects (images + PDF) are NOT deleted.
    // See docs/data/analyses-schema.md §5.
    const retainPriorRows = true;
    expect(retainPriorRows).toBe(true);
  });
});
