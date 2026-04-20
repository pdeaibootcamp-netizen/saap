/**
 * GET /api/admin/logout — Clear the analyst session cookie and redirect.
 *
 * The logout link in the admin header uses a plain <a href> (not a fetch),
 * so this must be a GET that returns a redirect response.
 */

import { NextResponse } from "next/server";
import { clearAdminSessionCookie } from "@/lib/auth";

export async function GET() {
  const response = NextResponse.redirect(new URL("/admin/login", process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"));
  response.headers.set("Set-Cookie", clearAdminSessionCookie());
  return response;
}
