/**
 * Canonical data-lane identifiers — D-010
 *
 * These values mirror the `data_lane` PostgreSQL enum defined in
 * 0001_init_lanes.sql. TypeScript and the DB enum must stay in sync;
 * the migrations are the source of truth, this type is the
 * compile-time enforcement layer (ADR-0002-C).
 *
 * Do NOT add values here without:
 *   1. A migration that adds the value to the DB enum.
 *   2. A new decision-log entry (a lane activation is an irreversible action).
 */
export const DATA_LANE = {
  BRIEF: "brief",
  USER_CONTRIBUTED: "user_contributed",
  RM_VISIBLE: "rm_visible",
  CREDIT_RISK: "credit_risk",
} as const;

export type DataLane = (typeof DATA_LANE)[keyof typeof DATA_LANE];

/**
 * Publish state enum — mirrors `publish_state` in 0002_briefs.sql (ADR-0002-B).
 * "archived" is the canonical superseded state (aligns with ADR-0002-D: no full history).
 */
export const PUBLISH_STATE = {
  DRAFT: "draft",
  PUBLISHED: "published",
  ARCHIVED: "archived",
} as const;

export type PublishState = (typeof PUBLISH_STATE)[keyof typeof PUBLISH_STATE];

/**
 * Delivery format enum — mirrors `format` in 0002_briefs.sql brief_deliveries table.
 */
export const DELIVERY_FORMAT = {
  EMAIL: "email",
  WEB: "web",
  PDF: "pdf",
} as const;

export type DeliveryFormat =
  (typeof DELIVERY_FORMAT)[keyof typeof DELIVERY_FORMAT];

/**
 * Consent event type enum — mirrors `event_type` in 0004_consent_events.sql.
 */
export const CONSENT_EVENT_TYPE = {
  GRANT: "grant",
  REVOKE: "revoke",
} as const;

export type ConsentEventType =
  (typeof CONSENT_EVENT_TYPE)[keyof typeof CONSENT_EVENT_TYPE];

/**
 * Consent surface enum — where the consent event was captured.
 * Mirrors `surface` in 0004_consent_events.sql.
 */
export const CONSENT_SURFACE = {
  ONBOARDING_SCREEN: "onboarding-screen",
  SETTINGS_SOUKROMI: "settings-soukromi",
  // rm-introduction-flow is Increment 2+ per privacy-architecture.md §4.1
} as const;

export type ConsentSurface =
  (typeof CONSENT_SURFACE)[keyof typeof CONSENT_SURFACE];

/**
 * Consent channel enum — how the user arrived.
 * Mirrors `channel` in 0004_consent_events.sql.
 */
export const CONSENT_CHANNEL = {
  DIRECT_SIGNUP: "direct-signup",
  RM_REFERRED_GEORGE_EMBED: "rm-referred-george-embed",
} as const;

export type ConsentChannel =
  (typeof CONSENT_CHANNEL)[keyof typeof CONSENT_CHANNEL];

/**
 * Size band enum — cohort-math.md §2.2.
 * Mirrors `size_band` in 0003_user_contributed.sql.
 */
export const SIZE_BAND = {
  S1: "S1", // 10–24 employees
  S2: "S2", // 25–49 employees
  S3: "S3", // 50–100 employees
} as const;

export type SizeBand = (typeof SIZE_BAND)[keyof typeof SIZE_BAND];

/**
 * Czech NUTS 2 region enum — cohort-math.md §2.3.
 * Mirrors `region` in 0003_user_contributed.sql.
 */
export const CZ_REGION = {
  PRAHA: "Praha",
  STREDNI_CECHY: "Střední Čechy",
  JIHOZAPAD: "Jihozápad",
  SEVEROZAPAD: "Severozápad",
  SEVEROVYCHOD: "Severovýchod",
  JIHOVYCHOD: "Jihovýchod",
  STREDNI_MORAVA: "Střední Morava",
  MORAVSKOSLEZSKO: "Moravskoslezsko",
} as const;

export type CzRegion = (typeof CZ_REGION)[keyof typeof CZ_REGION];

/**
 * Time-horizon tag enum — frozen by D-015 (Phase 2 gate).
 * Used in observations and actions (information-architecture.md §4.2, §4.5).
 */
export const TIME_HORIZON = {
  IMMEDIATELY: "Okamžitě",
  THREE_MONTHS: "Do 3 měsíců",
  TWELVE_MONTHS: "Do 12 měsíců",
  OVER_YEAR: "Více než rok",
} as const;

export type TimeHorizon = (typeof TIME_HORIZON)[keyof typeof TIME_HORIZON];

/**
 * Frozen owner-metric IDs — D-024 (8 metrics; ROCE → net_margin).
 * These values mirror the metric_id CHECK constraint in 0006_owner_metrics.sql.
 * PM owns the values; do NOT add or remove without a new decision-log entry.
 *
 * The eight IDs in recommended-ask order (in-tile-prompts.md §7):
 *   gross_margin, ebitda_margin, net_margin, revenue_per_employee,
 *   labor_cost_ratio, revenue_growth, working_capital_cycle, roe
 *
 * D-032 (2026-04-29): pricing_power → roe. The new ROE metric is sourced
 * from cohort_companies.roe (migration 0012); pricing_power had no real
 * cohort column and is removed entirely.
 */
export const OWNER_METRIC_ID = {
  GROSS_MARGIN: "gross_margin",
  EBITDA_MARGIN: "ebitda_margin",
  LABOR_COST_RATIO: "labor_cost_ratio",
  REVENUE_PER_EMPLOYEE: "revenue_per_employee",
  WORKING_CAPITAL_CYCLE: "working_capital_cycle",
  NET_MARGIN: "net_margin",
  REVENUE_GROWTH: "revenue_growth",
  ROE: "roe",
} as const;

export type OwnerMetricId = (typeof OWNER_METRIC_ID)[keyof typeof OWNER_METRIC_ID];

/**
 * Source enum for owner_metrics rows — mirrors the CHECK constraint in 0006_owner_metrics.sql.
 *   user_entered       — PATCH from in-tile prompt by the owner
 *   prepopulated_excel — ingested from cohort_companies at activation
 *   demo_seed          — fixture written by the seed script for demo firms
 */
export const OWNER_METRIC_SOURCE = {
  USER_ENTERED: "user_entered",
  PREPOPULATED_EXCEL: "prepopulated_excel",
  DEMO_SEED: "demo_seed",
} as const;

export type OwnerMetricSource = (typeof OWNER_METRIC_SOURCE)[keyof typeof OWNER_METRIC_SOURCE];

/**
 * Plausibility bounds for each metric — PM-owned values from in-tile-prompts.md §5.
 * Enforced server-side in the PATCH handler; also used by client-side validation.
 * Keys match OWNER_METRIC_ID values exactly.
 *
 * DO NOT widen bounds here without returning to PM for re-spec (in-tile-prompts.md §5 note).
 */
export interface MetricBound {
  min: number;
  max: number;
  /** Decimal places accepted on input */
  decimalPlaces: number;
  /** Whether negative values are permitted */
  allowNegative: boolean;
  /** Per-metric Czech error string when value is out of bounds */
  errorCopy: string;
}

export const METRIC_BOUNDS: Record<OwnerMetricId, MetricBound> = {
  gross_margin: {
    min: -50,
    max: 100,
    decimalPlaces: 1,
    allowNegative: true,
    errorCopy: "Tato hodnota se zdá být mimo obvyklý rozsah. Zkontrolujte prosím zadání.",
  },
  ebitda_margin: {
    min: -50,
    max: 60,
    decimalPlaces: 1,
    allowNegative: true,
    errorCopy: "Tato hodnota se zdá být mimo obvyklý rozsah. Zkontrolujte prosím zadání.",
  },
  labor_cost_ratio: {
    min: 0,
    max: 90,
    decimalPlaces: 1,
    allowNegative: false,
    errorCopy: "Podíl nákladů by měl být mezi 0 a 90 %. Zkontrolujte prosím zadání.",
  },
  revenue_per_employee: {
    min: 100,
    max: 100_000,
    decimalPlaces: 0,
    allowNegative: false,
    errorCopy: "Tato hodnota se zdá být mimo obvyklý rozsah (uveďte prosím v tisících Kč).",
  },
  working_capital_cycle: {
    min: -90,
    max: 365,
    decimalPlaces: 0,
    allowNegative: true,
    errorCopy: "Cyklus by měl být mezi -90 a 365 dny. Zkontrolujte prosím zadání.",
  },
  net_margin: {
    min: -50,
    max: 60,
    decimalPlaces: 1,
    allowNegative: true,
    errorCopy: "Tato hodnota se zdá být mimo obvyklý rozsah. Zkontrolujte prosím zadání.",
  },
  revenue_growth: {
    min: -80,
    max: 200,
    decimalPlaces: 1,
    allowNegative: true,
    errorCopy: "Růst tržeb by měl být mezi -80 a 200 %. Zkontrolujte prosím zadání.",
  },
  roe: {
    min: -100,
    max: 200,
    decimalPlaces: 1,
    allowNegative: true,
    errorCopy: "ROE by měla být mezi -100 a 200 %. Zkontrolujte prosím zadání.",
  },
};
