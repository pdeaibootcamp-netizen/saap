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
