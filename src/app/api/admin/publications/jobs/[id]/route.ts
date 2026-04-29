/**
 * GET /api/admin/publications/jobs/[id] — Job status polling
 *
 * Returns the current status of an analysis_jobs row.
 * Polled by the upload UI every 5s until done or failed.
 *
 * Auth: requires analyst session cookie (isAdminAuthenticated).
 * docs/engineering/n8n-integration.md §7
 */

import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { sql } from "@/lib/db";

function unauthorized() {
  return NextResponse.json({ error: "Neautorizováno." }, { status: 401 });
}

interface AnalysisJobRow {
  id: string;
  status: string;
  brief_id: string | null;
  error: string | null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!isAdminAuthenticated()) return unauthorized();

  const { id } = params;

  // Basic UUID validation
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "Neplatné ID úlohy." }, { status: 400 });
  }

  try {
    const rows = await sql<AnalysisJobRow[]>`
      SELECT id, status, brief_id, error
      FROM analysis_jobs
      WHERE id = ${id}::uuid
      LIMIT 1
    `;

    if (rows.length === 0) {
      return NextResponse.json({ error: "Úloha nebyla nalezena." }, { status: 404 });
    }

    const job = rows[0];
    const response: {
      jobId: string;
      status: string;
      briefId?: string;
      error?: string;
    } = {
      jobId: job.id,
      status: job.status,
    };

    if (job.brief_id) {
      response.briefId = job.brief_id;
    }
    if (job.error) {
      response.error = job.error;
    }

    return NextResponse.json(response);
  } catch (err) {
    console.error(`[jobs/${id}] GET error:`, err);
    return NextResponse.json(
      { error: "Nepodařilo se načíst stav úlohy." },
      { status: 500 }
    );
  }
}
