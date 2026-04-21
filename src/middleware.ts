/**
 * Next.js middleware — v0.2 PoC demo-owner cookie bootstrap.
 *
 * Runs before every non-static request. If the visitor has no `sr_user_id`
 * cookie, plants one pointing at DEMO_OWNER_USER_ID so downstream server
 * components can treat them as the hardcoded furniture-SME demo owner.
 *
 * Why here, not in src/app/page.tsx:
 *   Next.js 14 App Router forbids cookies().set() from server components —
 *   it's only valid in Server Actions and Route Handlers. Middleware runs
 *   before the page is rendered and can mutate the response, which is the
 *   right place for this.
 *
 * Scope: all routes except Next internals. /admin/* analyst routes read a
 * separate session cookie, so planting sr_user_id alongside is harmless.
 *
 * Removal plan (v0.3): delete this file; the real auth layer takes over.
 * See docs/engineering/v0-2-identity-bypass.md §7.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { DEMO_OWNER_USER_ID } from "@/lib/demo-owner";

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  if (!request.cookies.get("sr_user_id")) {
    response.cookies.set("sr_user_id", DEMO_OWNER_USER_ID, {
      path: "/",
      sameSite: "lax",
      httpOnly: false,
      maxAge: 60 * 60 * 24 * 30, // 30 days — covers the trial window
    });
  }

  return response;
}

export const config = {
  // Run on all paths except Next internals and static assets.
  // /admin/* analyst routes are included but harmless — they read a
  // separate analyst-session cookie and ignore sr_user_id.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
