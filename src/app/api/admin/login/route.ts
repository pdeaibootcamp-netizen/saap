/**
 * POST /api/admin/login — Analyst authentication endpoint
 *
 * Validates the password against ADMIN_PASSWORD_HASH env var.
 * Sets an HTTP-only session cookie on success.
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyAdminPassword, makeAdminSessionCookie } from "@/lib/auth";

export async function POST(req: NextRequest) {
  let body: { password?: string };
  try {
    body = (await req.json()) as { password?: string };
  } catch {
    return NextResponse.json({ error: "Neplatný požadavek." }, { status: 400 });
  }

  const { password } = body;
  if (!password) {
    return NextResponse.json({ error: "Heslo je povinné." }, { status: 400 });
  }

  if (!verifyAdminPassword(password)) {
    return NextResponse.json({ error: "Nesprávné heslo." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.headers.set("Set-Cookie", makeAdminSessionCookie());
  return response;
}
