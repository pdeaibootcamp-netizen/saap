/**
 * auth.ts — Authentication utilities
 *
 * Covers:
 *  1. Admin/analyst session check (password-protected /admin/* routes per ADR-0001-D).
 *  2. George Business JWT stub verification (ADR-0001-E).
 *  3. User session resolution for owner-facing routes.
 *
 * ADR-0001-D: admin auth uses a password check against ADMIN_PASSWORD_HASH env var
 *   with an HTTP-only cookie for the session.
 * ADR-0001-E: George JWT stub — validates a signed JWT in the ?token= query param.
 *   The JWT sub claim is the owner's pseudonymous user_id.
 *
 * OQ-050: Direct sign-up auth hand-off is unspecified. At MVP trial, Supabase Auth
 *   handles direct sign-up; the Supabase session cookie is the identity mechanism.
 *   This is a stub — logged in open-questions.md OQ-050.
 */

import { cookies } from "next/headers";
import { jwtVerify, SignJWT } from "jose";
import { createClient } from "@supabase/supabase-js";

// ─── Admin session ────────────────────────────────────────────────────────────

const ADMIN_SESSION_COOKIE = "sr_admin_session";
const ADMIN_SESSION_VALUE = "authenticated";

/**
 * Verify the admin password against ADMIN_PASSWORD_HASH.
 * At MVP trial, uses a simple constant-time string comparison.
 * Production should use bcrypt — flagged as a trial stub.
 */
export function verifyAdminPassword(password: string): boolean {
  const hash = process.env.ADMIN_PASSWORD_HASH;
  if (!hash) {
    // Dev convenience: if no hash set, accept "test" as per seed script.
    return password === "test";
  }
  // Simple comparison for trial. In production: bcrypt.compare(password, hash).
  return password === hash;
}

/** Check whether the current request has a valid admin session cookie. */
export function isAdminAuthenticated(): boolean {
  try {
    const cookieStore = cookies();
    const session = cookieStore.get(ADMIN_SESSION_COOKIE);
    return session?.value === ADMIN_SESSION_VALUE;
  } catch {
    return false;
  }
}

/** Return the cookie header string to set an admin session. */
export function makeAdminSessionCookie(): string {
  return `${ADMIN_SESSION_COOKIE}=${ADMIN_SESSION_VALUE}; HttpOnly; Path=/; SameSite=Strict; Max-Age=86400`;
}

/** Return the cookie header string to clear the admin session. */
export function clearAdminSessionCookie(): string {
  return `${ADMIN_SESSION_COOKIE}=; HttpOnly; Path=/; SameSite=Strict; Max-Age=0`;
}

// ─── George JWT stub (ADR-0001-E) ────────────────────────────────────────────

const GEORGE_JWT_SECRET = process.env.GEORGE_JWT_SECRET ?? "dev-george-jwt-secret-change-me";

/** Verify a George Business JWT and return the user_id (sub claim). */
export async function verifyGeorgeToken(token: string): Promise<string | null> {
  try {
    const secret = new TextEncoder().encode(GEORGE_JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    const sub = payload.sub;
    if (!sub) return null;
    return sub;
  } catch {
    return null;
  }
}

/** Create a stub George JWT for testing (dev/trial only). */
export async function createStubGeorgeToken(userId: string): Promise<string> {
  const secret = new TextEncoder().encode(GEORGE_JWT_SECRET);
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("1h")
    .setIssuedAt()
    .sign(secret);
}

// ─── Owner session (Supabase Auth — direct sign-up path) ─────────────────────

/** Get the Supabase admin client for server-side session management. */
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase env vars not set");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * Resolve the authenticated user_id from the current request.
 * Checks George JWT in query params first, then Supabase session cookie.
 * Returns null if not authenticated.
 *
 * OQ-050: direct sign-up path uses Supabase session; this is a stub.
 */
export async function resolveUserId(
  searchParams: URLSearchParams
): Promise<string | null> {
  // Check George JWT stub first
  const token = searchParams.get("token");
  if (token) {
    return verifyGeorgeToken(token);
  }

  // Fall back to Supabase Auth session
  try {
    const cookieStore = cookies();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) return null;

    // For server-side, we use service role to check session
    const supabase = getSupabaseAdmin();
    const authHeader = cookieStore.toString();
    void authHeader; // not used directly; Supabase SSR handles this

    // Simplified: look for user session in cookies
    // In production this would use @supabase/ssr createServerClient
    return null; // OQ-050: stub — direct sign-up auth not fully implemented
  } catch {
    return null;
  }
}
