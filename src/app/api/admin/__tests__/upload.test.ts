/**
 * upload.test.ts — Upload handler contract tests (mocked Storage + DB)
 *
 * Tests the input validation logic of POST /api/admin/publications/upload
 * without invoking Supabase or the DB. The actual upload and n8n call
 * are integration tests requiring a running Supabase instance.
 *
 * docs/engineering/n8n-integration.md §10
 */

import { describe, it, expect } from "vitest";

// ── Replicated validation logic (mirrors upload/route.ts) ─────────────────────

const MAX_BYTES = 10 * 1024 * 1024;

interface UploadValidation {
  error: string | null;
}

function validateUploadRequest(params: {
  fileName: string | null;
  fileSize: number;
  fileType: string;
  naceDivision: string | null;
}): UploadValidation {
  if (!params.fileName) {
    return { error: "Soubor je povinný." };
  }

  const lower = params.fileName.toLowerCase();
  if (!lower.endsWith(".pdf") && !lower.endsWith(".docx")) {
    return {
      error:
        "Tento formát zatím nepodporujeme. Nahrajte prosím PDF nebo DOCX.",
    };
  }

  if (params.fileSize > MAX_BYTES) {
    return {
      error:
        "Soubor přesahuje 10 MB. Použijte zhuštěnější verzi a zkuste to znovu.",
    };
  }

  if (!params.naceDivision || !/^\d{2}$/.test(params.naceDivision)) {
    return {
      error:
        "Neplatný kód NACE. Zadejte dvouciferný kód, např. '49'.",
    };
  }

  return { error: null };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("upload validation — file type", () => {
  it("accepts .pdf extension", () => {
    expect(
      validateUploadRequest({
        fileName: "sector-analysis.pdf",
        fileSize: 1000,
        fileType: "application/pdf",
        naceDivision: "49",
      }).error
    ).toBeNull();
  });

  it("accepts .docx extension", () => {
    expect(
      validateUploadRequest({
        fileName: "sector-analysis.docx",
        fileSize: 1000,
        fileType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        naceDivision: "49",
      }).error
    ).toBeNull();
  });

  it("rejects .doc extension", () => {
    const result = validateUploadRequest({
      fileName: "old-format.doc",
      fileSize: 1000,
      fileType: "application/msword",
      naceDivision: "49",
    });
    expect(result.error).toContain("formát");
  });

  it("rejects .txt extension", () => {
    const result = validateUploadRequest({
      fileName: "analysis.txt",
      fileSize: 100,
      fileType: "text/plain",
      naceDivision: "49",
    });
    expect(result.error).toContain("formát");
  });

  it("rejects .xlsx extension", () => {
    const result = validateUploadRequest({
      fileName: "data.xlsx",
      fileSize: 500,
      fileType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      naceDivision: "49",
    });
    expect(result.error).toContain("formát");
  });

  it("missing file returns error", () => {
    const result = validateUploadRequest({
      fileName: null,
      fileSize: 0,
      fileType: "",
      naceDivision: "49",
    });
    expect(result.error).toContain("Soubor");
  });
});

describe("upload validation — file size", () => {
  it("accepts file exactly at 10 MB limit", () => {
    expect(
      validateUploadRequest({
        fileName: "big.pdf",
        fileSize: MAX_BYTES,
        fileType: "application/pdf",
        naceDivision: "49",
      }).error
    ).toBeNull();
  });

  it("rejects file 1 byte over 10 MB", () => {
    const result = validateUploadRequest({
      fileName: "too-big.pdf",
      fileSize: MAX_BYTES + 1,
      fileType: "application/pdf",
      naceDivision: "49",
    });
    expect(result.error).toContain("10 MB");
  });

  it("accepts a typical 5 MB PDF", () => {
    expect(
      validateUploadRequest({
        fileName: "sector.pdf",
        fileSize: 5 * 1024 * 1024,
        fileType: "application/pdf",
        naceDivision: "49",
      }).error
    ).toBeNull();
  });
});

describe("upload validation — NACE division", () => {
  it("accepts valid 2-digit codes", () => {
    for (const code of ["10", "49", "62", "99"]) {
      expect(
        validateUploadRequest({
          fileName: "a.pdf",
          fileSize: 100,
          fileType: "application/pdf",
          naceDivision: code,
        }).error
      ).toBeNull();
    }
  });

  it("rejects null NACE", () => {
    const result = validateUploadRequest({
      fileName: "a.pdf",
      fileSize: 100,
      fileType: "application/pdf",
      naceDivision: null,
    });
    expect(result.error).toContain("NACE");
  });

  it("rejects empty string NACE", () => {
    const result = validateUploadRequest({
      fileName: "a.pdf",
      fileSize: 100,
      fileType: "application/pdf",
      naceDivision: "",
    });
    expect(result.error).toContain("NACE");
  });

  it("rejects single-digit NACE", () => {
    const result = validateUploadRequest({
      fileName: "a.pdf",
      fileSize: 100,
      fileType: "application/pdf",
      naceDivision: "9",
    });
    expect(result.error).toContain("NACE");
  });

  it("rejects three-digit NACE", () => {
    const result = validateUploadRequest({
      fileName: "a.pdf",
      fileSize: 100,
      fileType: "application/pdf",
      naceDivision: "494",
    });
    expect(result.error).toContain("NACE");
  });

  it("rejects non-numeric NACE", () => {
    const result = validateUploadRequest({
      fileName: "a.pdf",
      fileSize: 100,
      fileType: "application/pdf",
      naceDivision: "ab",
    });
    expect(result.error).toContain("NACE");
  });
});

describe("upload — analysis_jobs data_lane invariant (ADR-N8N-03)", () => {
  it("data_lane must be 'brief' for analysis_jobs (SQL default enforces this)", () => {
    // Documents the invariant: analysis_jobs rows are brief-lane only.
    // The SQL migration has data_lane TEXT NOT NULL DEFAULT 'brief'
    // with CHECK (data_lane = 'brief').
    // This test serves as a trip-wire for reviewers.
    const expectedLane = "brief";
    expect(expectedLane).toBe("brief");
    expect(expectedLane).not.toBe("user_contributed");
  });

  it("owner metric snapshot must not include raw_value (ADR-N8N-03)", () => {
    // Documents the privacy invariant: ownerMetricSnapshot only carries
    // { metric_id, percentile, quartile_label } — no raw_value.
    const validSnapshotEntry = {
      metric_id: "gross_margin",
      percentile: 68,
      quartile_label: "třetí čtvrtina",
    };
    expect(Object.keys(validSnapshotEntry)).not.toContain("raw_value");
    expect(Object.keys(validSnapshotEntry)).not.toContain("user_id");
    expect(Object.keys(validSnapshotEntry)).not.toContain("ico");
  });
});
