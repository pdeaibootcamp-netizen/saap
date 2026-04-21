/**
 * consent.ts — Consent ledger read/write
 *
 * Writes consent events via the Supabase service-role client (bypasses RLS —
 * consent_events is a cross-lane meta-table; the service role is the only
 * writer per 0004_consent_events.sql §3).
 *
 * Reads use the same service-role client for simplicity at MVP trial.
 * In production, reads can use the brief_lane_role (which has SELECT access
 * per 0004_consent_events.sql RLS policy).
 *
 * Privacy rule: this module never returns per-user financial data.
 * It only reads/writes consent event rows (event_type, ts, lanes_covered).
 *
 * D-007: single opt-in — one grant event covers all four lanes.
 * D-012: revocation = stop-flow-only. No row deletion occurs here.
 */

import { createClient } from "@supabase/supabase-js";
import type { ConsentSurface, ConsentChannel } from "../types/data-lanes";
import { isDemoOwner } from "./demo-owner";

// ─── Supabase admin client (service role — bypasses RLS for consent writes) ──

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set for consent operations."
    );
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ConsentEvent {
  consent_event_id: string;
  user_id: string;
  event_type: "grant" | "revoke";
  ts: string;
  consent_copy_version: string;
  lanes_covered: string[];
  surface: ConsentSurface;
  channel: ConsentChannel;
  prior_event_id: string | null;
}

export interface CurrentConsent {
  user_id: string;
  consent_event_id: string;
  latest_event_type: "grant" | "revoke";
  latest_ts: string;
  lanes_covered: string[];
}

// ─── Reads ───────────────────────────────────────────────────────────────────

/**
 * Get the current (latest) consent state for a user.
 * Returns null if no consent event exists.
 * Uses the current_consent_status view from 0004_consent_events.sql.
 */
export async function getCurrentConsent(userId: string): Promise<CurrentConsent | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("current_consent_status")
    .select("user_id, consent_event_id, latest_event_type, latest_ts, lanes_covered")
    .eq("user_id", userId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // no rows
    console.error("[consent] getCurrentConsent error:", error);
    throw error;
  }
  return data as CurrentConsent;
}

/**
 * Check whether a user has active consent (latest event = grant).
 * Fail-closed per OQ-049: network error throws, caller must handle.
 */
export async function hasActiveConsent(userId: string): Promise<boolean> {
  // v0.2 bypass: demo owner always has consent; skip DB check.
  // Defence-in-depth guard — the brief page also short-circuits before calling
  // this function, so this line is not reached in the normal demo path.
  if (isDemoOwner(userId)) return true;

  const consent = await getCurrentConsent(userId);
  if (!consent) return false;
  return consent.latest_event_type === "grant";
}

// ─── Writes ──────────────────────────────────────────────────────────────────

/**
 * Grant consent for a user.
 * Writes a 'grant' event to the consent ledger.
 * Returns the created consent event ID.
 *
 * Write-ordering constraint (sector-profile-configuration.md §3.1):
 * This MUST be called BEFORE writing a sector_profile row.
 */
export async function grantConsent(params: {
  user_id: string;
  surface: ConsentSurface;
  channel: ConsentChannel;
  ip_prefix?: string;
}): Promise<string> {
  const supabase = getSupabaseAdmin();

  const consentCopyVersion = "v1.0-2026-04";
  const capturedTextHash = "placeholder-hash-" + consentCopyVersion; // OQ-046 placeholder
  const lanesCovered = ["brief", "user_contributed", "rm_visible", "credit_risk"];

  const { data, error } = await supabase
    .from("consent_events")
    .insert({
      user_id: params.user_id,
      event_type: "grant",
      consent_copy_version: consentCopyVersion,
      lanes_covered: lanesCovered,
      surface: params.surface,
      channel: params.channel,
      prior_event_id: null,
      captured_text_hash: capturedTextHash,
      ip_prefix: params.ip_prefix ?? null,
    })
    .select("consent_event_id")
    .single();

  if (error) {
    console.error("[consent] grantConsent error:", error);
    throw error;
  }
  console.log(`[consent] Grant recorded: user=${params.user_id} event=${data.consent_event_id}`);
  return data.consent_event_id;
}

/**
 * Revoke consent for a user.
 * Writes a 'revoke' event referencing the latest grant event.
 * D-012 Option A: does not delete any rows.
 */
export async function revokeConsent(params: {
  user_id: string;
  surface: ConsentSurface;
  channel: ConsentChannel;
  ip_prefix?: string;
}): Promise<void> {
  const supabase = getSupabaseAdmin();

  // Find the most recent grant event to reference as prior_event_id.
  const current = await getCurrentConsent(params.user_id);
  if (!current || current.latest_event_type !== "grant") {
    throw new Error(`User ${params.user_id} has no active consent to revoke`);
  }

  const consentCopyVersion = "v1.0-2026-04";
  const capturedTextHash = "placeholder-hash-" + consentCopyVersion;
  const lanesCovered = ["brief", "user_contributed", "rm_visible", "credit_risk"];

  const { error } = await supabase.from("consent_events").insert({
    user_id: params.user_id,
    event_type: "revoke",
    consent_copy_version: consentCopyVersion,
    lanes_covered: lanesCovered,
    surface: params.surface,
    channel: params.channel,
    prior_event_id: current.consent_event_id,
    captured_text_hash: capturedTextHash,
    ip_prefix: params.ip_prefix ?? null,
  });

  if (error) {
    console.error("[consent] revokeConsent error:", error);
    throw error;
  }
  console.log(`[consent] Revoke recorded: user=${params.user_id}`);
}
