# n8n Integration — Engineering

*Owner: engineer · Slug: n8n-integration · Last updated: 2026-04-27*

## 1. Upstream links

- Product: `docs/product/analysis-automation.md` (PM Track C — blocked by filename guard at spec time; reference by intended filename)
- Design: not applicable — no new owner-facing UI; the analyst upload UI and existing edit page are unchanged.
- Data: `docs/data/analysis-pipeline-data.md` (DE Track C — blocked by filename guard at spec time; reference by intended filename). Owns the in-process payload shape and lane-separation posture for the n8n job.
- Decisions: [D-013](../project/decision-log.md) (Supabase Postgres + Storage), [D-020](../project/decision-log.md) (`paired_observation_index` additive field), [D-022](../project/decision-log.md) (v0.3 branch scope)
- Build plan: [docs/project/build-plan.md §11.3 Phase 3.1 Track C](../project/build-plan.md)

## 2. Architecture overview

```
Analyst browser
  │
  └─ POST /api/admin/publications/upload
       │  multipart: file (PDF/DOCX), naceDivision, jobId (client-generated UUID)
       │  store file → Supabase Storage bucket 'publications/'
       │  insert analysis_jobs row (status='pending')
       │  generate signed URL (1h TTL) for n8n to fetch
       │  POST → n8n webhook (HMAC-signed)
       └─ 202 { jobId }

n8n Cloud (workspace kappa3)
  │  fetches publicationFileUrl
  │  generates: opener_markdown, observations[], closing_actions[]
  │
  └─ POST /api/admin/briefs/from-n8n
       │  verify HMAC-SHA256 signature (N8N_CALLBACK_SECRET)
       │  validate draft shape (Zod schema)
       │  insert briefs row (publish_state='draft', content = n8n draft)
       │  update analysis_jobs (status='done', completed_at)
       └─ 200 { briefId }

Analyst browser (polling)
  └─ GET /api/admin/publications/jobs/[id]
       └─ 200 { jobId, status, briefId? }
```

Privacy boundary: the `ownerMetricSnapshot` field in the webhook payload carries aggregated per-owner metrics (percentile + quartile, not raw values) for context-enrichment in n8n. This is an in-process payload — it is not persisted in `analysis_jobs` in any user-identifying form. Full lane-separation posture is in `docs/data/analysis-pipeline-data.md`.

## 3. ADRs

### ADR-N8N-01 — HMAC-SHA256 in both directions with distinct secrets

- **Date**: 2026-04-27
- **Context**: Two webhook calls must be authenticated: (1) orchestrator → n8n, (2) n8n → orchestrator callback. Using the same secret in both directions means a compromised n8n endpoint can forge callback payloads.
- **Decision**: Two separate env vars: `N8N_WEBHOOK_SECRET` for the orchestrator→n8n direction; `N8N_CALLBACK_SECRET` for the n8n→orchestrator direction.
- **Consequences**: Both sides must rotate both secrets independently. n8n's HMAC-signing is configured in the n8n workflow node (webhook trigger → "Header Auth" with custom header `X-Signature-256`).
- **Rejected alternatives**: Shared single secret — simpler but allows n8n-side compromise to forge orchestrator-trusted callbacks. API key only (no body signing) — does not protect against payload tampering in transit.

### ADR-N8N-02 — Supabase Storage for publication files; signed URL with 1h TTL

- **Date**: 2026-04-27
- **Context**: n8n must fetch the uploaded file. Options: (a) include file bytes in the webhook payload, (b) store in Supabase Storage and pass a URL, (c) store in Vercel Blob.
- **Decision**: Supabase Storage bucket `publications/`, public-read disabled, signed URL generated per job with 1h TTL. After the job completes (status `done` or `failed`), the signed URL is not rotated — it expires naturally within 1h. The file itself is retained in storage indefinitely at v0.3 for analyst review; deletion policy is a v0.4 concern.
- **Consequences**: File path in `analysis_jobs.file_path` is the Supabase Storage path, not the signed URL (which changes on each signing call). A new signed URL is generated on demand for re-submission.
- **Rejected alternatives**: Vercel Blob — already used for PDFs per ADR-0001-F; introducing a second storage vendor for a distinct use case adds confusion. File bytes in payload — exceeds n8n webhook payload size limits for large PDFs.

### ADR-N8N-03 — `analysis_jobs` table lives in the `brief` lane

- **Date**: 2026-04-27
- **Context**: The job tracks an analyst action (uploading a publication for AI analysis). The output is a draft brief. Both are brief-lane artifacts. The job row must not carry user-contributed data.
- **Decision**: `analysis_jobs` is created in `brief_db` infrastructure namespace, `data_lane = 'brief'`. `owner_metric_snapshot` in the job row is stored as a JSONB blob of `{ metric_id, percentile, quartile_label }[]` — no `raw_value`, no `user_id`, no IČO.
- **Consequences**: The brief-lane role can read job status. The user-contributed-lane role cannot. If a future audit requires linking a job to a specific owner, that linkage is done via the `briefs` table's existing author trail, not by adding user-identifying fields to `analysis_jobs`.
- **Rejected alternatives**: `user_contributed` lane for the job — rejected: the job is an analyst artifact, not owner-contributed data. Storing full `raw_value` in `owner_metric_snapshot` — rejected: crosses the user_contributed → brief lane boundary without an explicit in-process payload boundary (see `docs/data/analysis-pipeline-data.md`).

## 4. Webhook contract — orchestrator → n8n

**Endpoint**: `N8N_WEBHOOK_URL` (env var, pointing to the n8n Cloud webhook URL for workspace kappa3)

**Method**: `POST`

**Headers**:
```
Content-Type: application/json
X-Signature-256: sha256=<HMAC-SHA256 of raw body using N8N_WEBHOOK_SECRET>
```

**Body**:
```typescript
interface N8nWebhookPayload {
  publicationFileUrl: string;        // signed Supabase Storage URL (1h TTL)
  naceDivision: string;              // 2-digit, e.g. "49"
  ownerMetricSnapshot?: {            // optional — present when a demo firm is active
    metric_id: string;
    percentile: number | null;
    quartile_label: string | null;
  }[];
  jobId: string;                     // UUID, client-generated, stored in analysis_jobs
  callbackUrl: string;               // https://<app-domain>/api/admin/briefs/from-n8n
}
```

**Example curl**:
```bash
BODY='{"publicationFileUrl":"https://...","naceDivision":"49","jobId":"uuid","callbackUrl":"https://app/api/admin/briefs/from-n8n"}'
SIG=$(echo -n "$BODY" | openssl dgst -sha256 -hmac "$N8N_WEBHOOK_SECRET" | awk '{print $2}')
curl -s -X POST "$N8N_WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -H "X-Signature-256: sha256=$SIG" \
  -d "$BODY"
```

**Response**: n8n webhook trigger returns `200` immediately on receipt. The analysis is asynchronous; completion is signalled via the callback.

## 5. Callback contract — n8n → orchestrator

**Endpoint**: `POST /api/admin/briefs/from-n8n`

**Headers**:
```
Content-Type: application/json
X-Signature-256: sha256=<HMAC-SHA256 of raw body using N8N_CALLBACK_SECRET>
```

**Body — success case**:
```typescript
interface N8nCallbackPayload {
  jobId: string;
  status: "done" | "failed";
  draft?: {
    title: string;
    publication_month: string;          // ISO 8601 YYYY-MM
    publication: {
      heading: string;
      opener_markdown: string;
      full_text_markdown: string;
      source: string;
    };
    observations: {
      text: string;
      metric_anchor?: string;           // optional metric_id this observation references
    }[];
    closing_actions: {
      action_text: string;
      time_horizon: "Okamžitě" | "Do 3 měsíců" | "Do 12 měsíců" | "Více než rok";
      paired_observation_index?: number; // index into observations[] array; nullable
    }[];
  };
  error?: string;                       // populated when status = "failed"
}
```

The `draft` shape matches the existing `BriefContent` type in `src/lib/briefs.ts` — specifically the `publication`, `observations`, and `closing_actions` fields that the analyst edit page already loads. No new fields are added to the edit page.

**Handler behaviour at `POST /api/admin/briefs/from-n8n`**:

1. Verify HMAC-SHA256 signature using `N8N_CALLBACK_SECRET` → 401 on mismatch.
2. Parse body and validate against the Zod schema for `N8nCallbackPayload` → 422 on invalid shape.
3. Lookup `analysis_jobs WHERE id = jobId` → 404 if not found.
4. If `status === "done"` and `draft` is present:
   a. Insert a new `briefs` row with `publish_state = 'draft'`, content populated from `draft`.
   b. Update `analysis_jobs SET status = 'done', completed_at = now(), brief_id = <new brief id>`.
   c. Return `200 { briefId }`.
5. If `status === "failed"`:
   a. Update `analysis_jobs SET status = 'failed', error = payload.error, completed_at = now()`.
   b. Return `200 {}` (n8n does not retry on 200).

**Example curl (n8n calling back)**:
```bash
BODY='{"jobId":"uuid","status":"done","draft":{...}}'
SIG=$(echo -n "$BODY" | openssl dgst -sha256 -hmac "$N8N_CALLBACK_SECRET" | awk '{print $2}')
curl -s -X POST https://app/api/admin/briefs/from-n8n \
  -H "Content-Type: application/json" \
  -H "X-Signature-256: sha256=$SIG" \
  -d "$BODY"
```

## 6. Job-state table — `analysis_jobs`

```sql
CREATE TABLE IF NOT EXISTS analysis_jobs (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  status           TEXT         NOT NULL
                                CHECK (status IN ('pending','done','failed')),
  file_path        TEXT         NOT NULL,  -- Supabase Storage path (not signed URL)
  nace_division    TEXT         NOT NULL
                                CHECK (nace_division ~ '^\d{2}$'),
  owner_metric_snapshot  JSONB, -- { metric_id, percentile, quartile_label }[] — no raw_value
  brief_id         UUID         REFERENCES briefs(id) ON DELETE SET NULL,
  error            TEXT,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  completed_at     TIMESTAMPTZ,
  data_lane        data_lane    NOT NULL DEFAULT 'brief'
                                CHECK (data_lane = 'brief')
);

CREATE INDEX IF NOT EXISTS idx_analysis_jobs_status ON analysis_jobs (status);
```

RLS: only `brief_lane_role` and the service role can read/write this table. `user_contributed_lane_role` has no grants.

## 7. Polling endpoint

```
GET /api/admin/publications/jobs/[id]

Response 200:
{
  jobId: string;
  status: "pending" | "done" | "failed";
  briefId?: string;   // populated when status = "done"
  error?: string;     // populated when status = "failed"
}

Response 404: { error: "Job not found." }
```

The analyst-facing upload UI polls this endpoint every 10 s after submission. Timeout: if `status` is still `pending` after 3 minutes (18 polls), the UI shows a timeout error message. The job row remains in `pending`; the analyst can re-submit. The 3-minute default matches the PM timeout specification in `docs/product/analysis-automation.md`.

## 8. Failure modes

| Failure | Detection | Analyst-visible error |
|---|---|---|
| n8n timeout (> 3 min, still pending) | Polling endpoint returns `pending` after timeout threshold | Upload UI shows: "Zpracování trvá příliš dlouho. Zkuste prosím nahrát soubor znovu." |
| Malformed callback JSON | `JSON.parse` throws → 422 logged | `analysis_jobs.error` updated; polling returns `failed` with the error string. |
| Signature mismatch on callback | HMAC verify fails → 401 returned to n8n; n8n may retry | If n8n retries and signature is still wrong, the job stays `pending` until timeout. Logged to server stderr. |
| File not found (n8n cannot fetch URL) | n8n returns `status: 'failed', error: 'file_not_found'` in callback | Polling returns `failed`; analyst re-uploads. |
| Draft shape invalid (Zod parse fails) | Zod throws → 422; job updated to `failed` | Polling returns `failed` with the Zod error path. |
| Supabase Storage upload fails | `storageClient.upload()` throws → 500 returned to analyst at upload time | Upload UI shows: "Soubor se nepodařilo nahrát. Zkuste to prosím znovu." |

## 9. Env vars — additions to `src/.env.example`

```bash
# n8n Cloud webhook URL (workspace kappa3). POST target for new analysis jobs.
N8N_WEBHOOK_URL=

# HMAC-SHA256 shared secret — orchestrator → n8n direction.
# Set the matching value in the n8n workflow's webhook node (Header Auth).
N8N_WEBHOOK_SECRET=

# HMAC-SHA256 shared secret — n8n → orchestrator callback direction.
# Set in the n8n workflow's HTTP Request node that calls /api/admin/briefs/from-n8n.
N8N_CALLBACK_SECRET=
```

## 10. Test plan

### Unit tests — `src/app/api/admin/__tests__/`

- `hmac-verify.test.ts`: correct signature → passes; tampered body → fails; wrong secret → fails; missing header → fails.
- `from-n8n.test.ts` (mocked DB):
  - Valid `done` payload → inserts `briefs` row in `draft` state, returns 200 + `briefId`.
  - Valid `failed` payload → updates job to `failed`, returns 200.
  - Invalid `status` value → 422.
  - Unknown `jobId` → 404.
  - `draft` missing when `status = "done"` → 422.
  - `paired_observation_index` out of range (>= observations.length) → 422.
- `upload.test.ts` (mocked Storage + DB): confirm `analysis_jobs` row is created with `status = 'pending'` and `data_lane = 'brief'`.
- `jobs-polling.test.ts` (mocked DB): pending → 200 pending; done with briefId → 200 done + briefId; unknown id → 404.

### Integration tests (require Supabase local stack + n8n dev webhook)

- Full round-trip: upload a test PDF → assert `analysis_jobs` row created → simulate n8n callback with a valid signed payload → assert `briefs` row in `draft` state → assert `analysis_jobs.status = 'done'`.
- Signature mismatch: callback with wrong secret → 401, job stays `pending`.

### Privacy invariant tests

- Assert `owner_metric_snapshot` in `analysis_jobs` never contains `raw_value` field — Zod schema CHECK + a post-insert SELECT that inspects the JSONB column.
- Assert `brief_lane_role` cannot SELECT from `owner_metrics` table — attempt SELECT via `brief_lane_role` credentials, confirm PostgreSQL raises permission error.
- Assert `data_lane = 'brief'` CHECK constraint on `analysis_jobs` — attempt INSERT with `data_lane = 'user_contributed'`, confirm constraint violation.

### Migration test — `src/supabase/migrations/0008_analysis_jobs.test.ts`

Following the pattern in `src/supabase/migrations/migrations.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { ANALYSIS_JOB_STATUS, ANALYSIS_JOB_DATA_LANE } from "../../types/analysis-jobs";

describe("analysis_jobs enum invariants", () => {
  it("ANALYSIS_JOB_STATUS contains exactly three states", () => {
    expect(Object.values(ANALYSIS_JOB_STATUS).sort())
      .toEqual(["done", "failed", "pending"]);
  });
  it("ANALYSIS_JOB_DATA_LANE is brief only", () => {
    expect(Object.values(ANALYSIS_JOB_DATA_LANE)).toEqual(["brief"]);
  });
});
```

## 11. Deployment + rollback

- **Deploy**: Supabase migration `0008_analysis_jobs.sql` — creates `analysis_jobs` table. Env vars `N8N_WEBHOOK_URL`, `N8N_WEBHOOK_SECRET`, `N8N_CALLBACK_SECRET` must be set in Vercel before the endpoint is live.
- **Rollback**: if the callback endpoint misbehaves, set `N8N_WEBHOOK_URL` to an empty string — the upload handler will return 503 "Analýza není momentálně k dispozici." immediately after Storage upload, without creating a job row. `analysis_jobs` table and brief rows written by completed jobs are retained.
- **Feature flag**: none separate — the feature is gated by whether `N8N_WEBHOOK_URL` is set. An empty or absent `N8N_WEBHOOK_URL` disables the upload trigger path.

## 12. Open questions

| ID | Question | Assumed-for-now | Escalate to |
|---|---|---|---|
| OQ-EN-C01 | The `docs/data/analysis-pipeline-data.md` DE spec (Track C, blocked at time of this writing) owns the exact `ownerMetricSnapshot` payload shape and the lane-separation posture for what fields flow to n8n. This spec assumes `{ metric_id, percentile, quartile_label }[]` with no `raw_value`. If DE's spec adds or changes fields, this ADR-N8N-03 and the Zod schema must be updated. | Assumed correct per DE lane-separation principle; update when `analysis-pipeline-data.md` lands. | Orchestrator to cross-check when DE spec is unblocked. |
| OQ-EN-C02 | n8n workflow ID and trigger URL in workspace kappa3 are not yet confirmed. This spec uses `N8N_WEBHOOK_URL` as an env var so the workflow can be wired up at deploy time without code changes. | Env-var approach decouples code from workflow identity. | User / orchestrator when n8n workspace is ready. |
| OQ-EN-C03 | Signed URL expiry after 1h: if n8n takes longer than 1h to fetch the file (queue backlog on the n8n Cloud side), the download will fail. Default n8n timeout is shorter than 1h; the 3-min analyst-facing timeout also enforces a shorter bound. Accepted as a known edge case. | Accepted at v0.3. Increase TTL to 4h or generate a fresh URL on retry if this becomes load-bearing. | Orchestrator if n8n queue delays are observed. |

## Changelog

- 2026-04-27 — initial draft — engineer. Covers Track C: webhook + callback contracts, `analysis_jobs` table, HMAC-SHA256 posture, Supabase Storage signed URL, polling endpoint, 6 failure modes, 3 new env vars, full test plan including privacy invariant and migration tests.
