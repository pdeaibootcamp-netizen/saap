/**
 * jobs-polling.test.ts — Job status response shape tests
 *
 * Tests the response-shape logic for GET /api/admin/publications/jobs/[id]
 * without a live DB connection.
 *
 * docs/engineering/n8n-integration.md §7, §10
 */

import { describe, it, expect } from "vitest";

// ── Response builder (mirrors jobs/[id]/route.ts logic) ───────────────────────

interface JobRow {
  id: string;
  status: string;
  brief_id: string | null;
  error: string | null;
}

function buildJobResponse(job: JobRow): {
  jobId: string;
  status: string;
  briefId?: string;
  error?: string;
} {
  const response: {
    jobId: string;
    status: string;
    briefId?: string;
    error?: string;
  } = {
    jobId: job.id,
    status: job.status,
  };
  if (job.brief_id) response.briefId = job.brief_id;
  if (job.error) response.error = job.error;
  return response;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("job polling response — status shapes", () => {
  it("queued job returns status:queued without briefId", () => {
    const row: JobRow = { id: "uuid-1", status: "queued", brief_id: null, error: null };
    const res = buildJobResponse(row);
    expect(res.jobId).toBe("uuid-1");
    expect(res.status).toBe("queued");
    expect(res.briefId).toBeUndefined();
    expect(res.error).toBeUndefined();
  });

  it("running job returns status:running without briefId", () => {
    const row: JobRow = { id: "uuid-2", status: "running", brief_id: null, error: null };
    const res = buildJobResponse(row);
    expect(res.status).toBe("running");
    expect(res.briefId).toBeUndefined();
  });

  it("done job returns status:done with briefId", () => {
    const row: JobRow = {
      id: "uuid-3",
      status: "done",
      brief_id: "brief-uuid-abc",
      error: null,
    };
    const res = buildJobResponse(row);
    expect(res.status).toBe("done");
    expect(res.briefId).toBe("brief-uuid-abc");
    expect(res.error).toBeUndefined();
  });

  it("failed job returns status:failed with error and no briefId", () => {
    const row: JobRow = {
      id: "uuid-4",
      status: "failed",
      brief_id: null,
      error: "extraction failed",
    };
    const res = buildJobResponse(row);
    expect(res.status).toBe("failed");
    expect(res.error).toBe("extraction failed");
    expect(res.briefId).toBeUndefined();
  });

  it("done job with no brief_id (edge case) does not include briefId in response", () => {
    // Edge case: job marked done but brief_id not yet written (race condition).
    const row: JobRow = { id: "uuid-5", status: "done", brief_id: null, error: null };
    const res = buildJobResponse(row);
    expect(res.briefId).toBeUndefined();
  });
});

describe("job polling response — ID invariants", () => {
  it("response always includes jobId matching the row id", () => {
    const row: JobRow = { id: "test-id-xyz", status: "queued", brief_id: null, error: null };
    const res = buildJobResponse(row);
    expect(res.jobId).toBe(row.id);
  });

  it("response always includes status", () => {
    const row: JobRow = { id: "id", status: "queued", brief_id: null, error: null };
    const res = buildJobResponse(row);
    expect(typeof res.status).toBe("string");
    expect(res.status.length).toBeGreaterThan(0);
  });
});
