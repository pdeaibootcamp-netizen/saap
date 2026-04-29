# n8n Integration — Engineering

*Owner: engineer · Slug: n8n-integration · Last updated: 2026-04-29*

## 1. Upstream links

- Product: `docs/product/analysis-automation.md` (PM Track C — blocked by filename guard at spec time; reference by intended filename)
- Design: not applicable — no new owner-facing UI; the analyst upload UI and existing edit page are unchanged.
- Data: `docs/data/analysis-pipeline-data.md` (DE Track C — blocked by filename guard at spec time; reference by intended filename). Owns the in-process payload shape and lane-separation posture for the n8n job.
- Decisions: [D-013](../project/decision-log.md) (Supabase Postgres + Storage), [D-020](../project/decision-log.md) (`paired_observation_index` additive field), [D-022](../project/decision-log.md) (v0.3 branch scope), [D-028](../project/decision-log.md) (multi-NACE workflow architecture), [D-029](../project/decision-log.md) (Model B callback shape), [D-030](../project/decision-log.md) (per-NACE relevance gate), [D-031](../project/decision-log.md) (4-NACE PoC scope)
- Build plan: [docs/project/build-plan.md §11.6–§11.7 Track C](../project/build-plan.md)
- Live workflow: [`n8n-workflows/analyze-publication.json`](../../n8n-workflows/analyze-publication.json) — importable snapshot of the running n8n workflow (snapshot 2026-04-29)
- Workflow README: [`n8n-workflows/README.md`](../../n8n-workflows/README.md) — topology diagram, setup steps, troubleshooting table

## 2. Architecture overview

```
Analyst browser
  │
  └─ POST /api/admin/publications/upload
       │  multipart: file (PDF/DOCX), naceDivision, jobId (client-generated UUID)
       │  store file → Supabase Storage bucket 'publications/'
       │  insert analysis_jobs row (status='pending')   [optional — see §6]
       │  generate signed URL (1h TTL) for n8n to fetch
       │  POST → n8n webhook (HMAC-signed)
       └─ 202 { jobId }

n8n Cloud (workspace kappa3) — workflow "Strategy Radar — Analyze Publication"
  │  Webhook responds 200 immediately (responseMode=Immediately)
  │  Workflow runs asynchronously:
  │    Fetch File → Extract Text (truncate to 8000 chars)
  │    → Layperson Opener (shared AI summary)
  │    → 4 parallel NACE branches (NACE 10, 31, 46, 49):
  │        Insights N (langchain.agent + Claude Haiku 4.5)
  │        → IF relevant? (relevance gate, D-030)
  │        → Actions N (if relevant) → Tag N
  │    → Merge (4 inputs, mode=Append)
  │    → Compose Bundle (builds naceSectors[], perNaceContent map)
  │    → Sign Callback (HMAC-SHA256 using N8N_CALLBACK_SECRET)
  │    → Send Callback (HTTP POST, body raw JSON, contentType=raw)
  │
  └─ POST /api/admin/briefs/from-n8n
       │  verify HMAC-SHA256 signature (N8N_CALLBACK_SECRET)
       │  validate payload shape (manual validation — no zod dependency yet)
       │  detect v0.3 multi-NACE shape vs v0.1/v0.2 legacy single-NACE shape
       │  insert briefs row (publish_state='draft', nace_sectors=[...])
       │  write opener_markdown → BriefContent.opening_summary (NOT publication block)
       │  update analysis_jobs (status='done', completed_at) — if job row exists
       └─ 200 { briefId }

Analyst browser (polling — still supported but less critical post-v0.3)
  └─ GET /api/admin/publications/jobs/[id]
       └─ 200 { jobId, status, briefId? }
```

Key design change from original v0.2 spec: the webhook now responds `200` immediately (n8n `Respond = Immediately`), so `analysis_jobs` is no longer polled as the primary completion signal. The brief lands directly via the callback. See §6 for `analysis_jobs` status.

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

### 5a. v0.3 multi-NACE shape (D-029, Model B) — primary

This is the shape emitted by `analyze-publication.json`. The handler detects it when `naceSectors` and `perNaceContent` are both present.

```typescript
interface N8nCallbackPayload {
  jobId: string;                        // UUID or opaque label (e.g. "mcp-...")
  status: "done" | "failed";
  error?: string;                       // populated when status = "failed"

  // ── v0.3 multi-NACE fields ──
  naceSectors: string[];                // 2-digit NACE divisions that passed the relevance gate
  publicationMonth: string;             // Czech month-year, e.g. "Duben 2026"
  publicationMonthIso: string;          // ISO month, e.g. "2026-04"
  title: string;                        // Brief title (no NACE in title for multi-NACE briefs)
  publication: {
    heading: string;
    opener_markdown: string;            // AI layperson opener (written to opening_summary — see handler note)
    full_text_markdown: string;
    source: string;
  };
  perNaceContent: {
    [nace: string]: {                   // key = 2-digit NACE division
      observations: N8nObservation[];   // 3 per NACE
      closing_actions: N8nClosingAction[];
    };
  };
  diagnostics?: {
    total: number;                      // total NACE branches run
    relevant_count: number;
    dropped: { nace: string; reason: string }[];
  };
}
```

**Handler note — opener routing**: the route writes `publication.opener_markdown` into `BriefContent.opening_summary` (top-level field), NOT into a `publication` block. This is because the admin editor reads `content.opening_summary` via its "Text úvodního přehledu" textarea; writing to `publication.opener_markdown` made the AI opener invisible to the editor. The `publication` block is therefore not populated for v0.3 n8n-generated briefs.

**Compose Bundle invariant**: the Compose Bundle n8n node throws if `passedGates > 0 && naceSectors.length < passedGates`, catching any silent merge drops before the callback is sent.

### 5b. v0.1/v0.2 single-NACE shape — legacy (backward compat)

The handler also accepts the original single-NACE shape for backward compatibility with manual test workflows and the original `analysis-automation.json` workflow (frozen). The handler detects this path when `naceSectors` and `perNaceContent` are absent and falls back to `draft.*`.

```typescript
// Legacy shape — still accepted but not emitted by the live workflow
interface N8nCallbackPayloadLegacy {
  jobId: string;
  status: "done" | "failed";
  naceDivision?: string;                // single NACE; falls back to job row if absent
  draft?: {
    title: string;
    publication_month: string;          // ISO 8601 YYYY-MM
    publication: {
      heading: string;
      opener_markdown: string;
      full_text_markdown: string;
      source: string;
    };
    observations: N8nObservation[];
    closing_actions: N8nClosingAction[];
  };
  error?: string;
}
```

### 5c. Handler behaviour

1. Verify HMAC-SHA256 signature using `N8N_CALLBACK_SECRET` → 401 on mismatch. On mismatch the route logs a temporary diagnostic (secret prefix + body sample) to assist debugging — this is intentional and kept in the codebase per explicit decision.
2. Parse body as JSON → 422 on parse failure.
3. Validate payload shape (manual validation; zod not yet added — see OQ-C-01) → 422 on invalid shape.
4. Lookup `analysis_jobs WHERE id = jobId` — optional: non-UUID jobIds (`mcp-...`, `manual-...`) skip the lookup and proceed jobless. If the UUID row is not found, proceed without linking to a job.
5. If `status === "done"`:
   a. Build `BriefContent` from the multi-NACE or legacy shape.
   b. Insert `briefs` row with `publish_state = 'draft'`, `nace_sectors = naceSectors[]`.
   c. Update `analysis_jobs SET status = 'done', completed_at = now(), brief_id = <new id>` — only if a job row was found.
   d. Return `200 { briefId }`.
6. If `status === "failed"`:
   a. Update `analysis_jobs SET status = 'failed', error = payload.error, completed_at = now()` — only if job row found.
   b. Return `200 {}` (n8n does not retry on 200).

**Example curl (v0.3 shape)**:
```bash
BODY='{"jobId":"uuid","status":"done","naceSectors":["31","49"],"publicationMonth":"Duben 2026","publicationMonthIso":"2026-04","title":"Sektorová analýza","publication":{"heading":"...","opener_markdown":"...","full_text_markdown":"...","source":"..."},"perNaceContent":{"31":{...},"49":{...}}}'
SIG=$(echo -n "$BODY" | openssl dgst -sha256 -hmac "$N8N_CALLBACK_SECRET" | awk '{print $2}')
curl -s -X POST https://app/api/admin/briefs/from-n8n \
  -H "Content-Type: application/json" \
  -H "X-Signature-256: sha256=$SIG" \
  -d "$BODY"
```

## 6. Job-state table — `analysis_jobs` (reduced role in v0.3)

In v0.3 the webhook responds `200` immediately (`Respond = Immediately` on the n8n webhook trigger), so `analysis_jobs` is no longer the primary completion signal. The brief lands via the callback regardless of whether a job row exists. The job row is now optional: the upload route still creates one so the analyst UI can poll job status, but the callback handler works without it (non-UUID jobIds produced by MCP-style triggers skip the job lookup entirely and proceed jobless). The `nace_sectors` column on `briefs` (populated from `naceSectors[]` in the callback) is the canonical record of which NACEs a brief covers.

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

The analyst-facing upload UI polls this endpoint every 10 s after submission. Timeout: if `status` is still `pending` after 3 minutes (18 polls), the UI shows a timeout error message. The job row remains in `pending`; the analyst can re-submit. Note: in v0.3 the webhook responds `200` immediately, so the brief typically arrives before the first poll cycle. The polling path is retained as a fallback completion signal and for analyst UX continuity.

## 8. Prompt design

Each NACE branch runs two `langchain.agent` calls (Anthropic Claude Haiku 4.5):

1. **Insights agent** — returns `{ relevant: bool, insights?: [...3], reason?: string }`. The relevance gate (D-030) fires here: if `relevant === false`, the Actions agent is skipped entirely and no content for that NACE is included in the bundle. Relevance prompts include a `PŘÍSNĚ` tightening clause to prevent tangential-mention bleed (e.g., a bakery publication that mentions freight in passing should not pass the NACE 49 freight gate).

2. **Actions agent** — runs only when `relevant === true`. Returns structured closing actions with time-horizon tags.

All 8 output parsers (2 per NACE branch) have `autoFix: true` enabled. System prompts include `STRICT_JSON_RULES` forbidding markdown fences around JSON output.

The publication body is truncated to 8000 chars by the Extract Text node before the fan-out. Reason: 4 parallel branches × a full publication (~30k chars / ~8k tokens) would exceed Tier 1 Anthropic's 50 000 input-tokens-per-minute rate limit. Truncation keeps total throughput under ~30k tokens/minute.

The Layperson Opener is a single shared AI call (before the fan-out) that produces a plain-language summary of the publication — written into `opening_summary` on the brief.

Prompt library tracking: OQ-077 (open-questions.md) tracks the ongoing curation of per-NACE relevance prompts and tightening clauses.

## 9. Troubleshooting — known failure modes from v0.3 build

These issues were hit and resolved during the multi-NACE implementation. Documented here for future maintainers.

| # | Symptom | Root cause | Fix |
|---|---|---|---|
| 1 | Brief tagged with fewer NACEs than expected; some NACE branches silently dropped | n8n Merge node default is 2 inputs. With 4 Tag nodes feeding a 2-input Merge, only 2 branches' outputs were merged; the others were silently dropped. | Configure Merge node with exactly 4 input slots, mode = Append. Wire each Tag-N node to a distinct slot. |
| 2 | Callback body arrives as `{"<json string>":""}` instead of a JSON object | n8n HTTP Request node `specifyBody: "string"` mode double-encodes the body — it wraps the JSON string as a key in a new JSON object. | Set Send Callback HTTP node: Body Content Type = **Raw**, rawContentType = `application/json`. Body expression = `{{ $json.callbackBody }}`. |
| 3 | 429 from Anthropic mid-run; some branches fail with rate-limit errors | Tier 1 Anthropic rate limit: 50 000 input tokens/minute. 4 branches × full publication body (~8k tokens each) = ~32k tokens/minute base, plus system prompts pushed it over. | Extract Text node truncates `publication_body` to 8000 chars before fan-out, keeping total well under the limit. |
| 4 | `"Output parser format error"` or `"Model output doesn't fit required format"` | Claude Haiku returned JSON wrapped in markdown fences (` ```json … ``` `). The n8n output parser expected bare JSON and rejected the output. | Set `autoFix: true` on all 8 output parsers. Add `STRICT_JSON_RULES` to all system prompts: "Return ONLY raw JSON. Do not wrap in markdown fences. No ` ```json ``` ` blocks." |
| 5 | Webhook returns 500 with "circular structure to JSON" in n8n logs | Webhook `responseMode = lastNode` caused n8n to try serialising the Send Callback HTTP response object (Node.js `IncomingMessage`) as JSON at the end of the chain. `IncomingMessage` contains circular references. | Set webhook **Respond** dropdown to **Immediately**. n8n responds 200 to the orchestrator before the chain runs; the chain completes and fires the callback asynchronously. |
| 6 | 401 "Signature mismatch" on the from-n8n route even when the secret looks correct | Caused by failure mode #2 above: the double-encoded body was being signed in n8n but a different body (the unwrapped version) was being received by the route. The two bodies had different HMAC values. The route logs a diagnostic (secret prefix + body sample) on mismatch — useful for diagnosing this class of issue. | Fix #2 first (raw body mode). The diagnostic logging is intentional and kept in the codebase. |

The `n8n-workflows/README.md` has a companion troubleshooting table focused on operational symptoms (NACE gate tuning, credential setup, etc.). The table above focuses on build-time root causes.

## 10. Workflow shape — source of truth

The live workflow is `n8n-workflows/analyze-publication.json` (snapshot 2026-04-29). It is importable into any n8n workspace to reproduce the running pipeline exactly.

Topology summary:

```
Webhook (Respond = Immediately)
  → Verify HMAC
  → Fetch File (signed Supabase Storage URL)
  → Extract Text (truncate to 8000 chars)
  → Layperson Opener (shared Claude Haiku call)
  → fan-out to 4 parallel NACE branches:
      [NACE 10 Bakery | NACE 31 Furniture | NACE 46 Wholesale Metal | NACE 49 Freight]
      each branch: Insights N → IF relevant? → Actions N → Tag N
  → Merge (4 inputs, mode=Append)
  → Compose Bundle (builds naceSectors[], perNaceContent map; tag-drop invariant check)
  → Sign Callback (HMAC-SHA256 using hardcoded N8N_CALLBACK_SECRET)
  → Send Callback (POST to callbackUrl, body raw JSON, contentType=application/json)
```

4-NACE PoC scope (D-031): NACE 10 (Pekárenství), NACE 31 (Výroba nábytku), NACE 46 (Velkoobchod s rudami / Výroba hliníku), NACE 49 (Nákladní doprava).

Model: Anthropic Claude Haiku 4.5, shared credential across all 8 langchain.agent nodes.

Setup and credential wiring: see `n8n-workflows/README.md §Setup`.

## 11. Env vars — additions to `src/.env.example`

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

## 12. Test plan

### Unit tests — `src/app/api/admin/__tests__/`

- `hmac-verify.test.ts`: correct signature → passes; tampered body → fails; wrong secret → fails; missing header → fails.
- `from-n8n.test.ts` (mocked DB):
  - Valid v0.3 multi-NACE `done` payload (`naceSectors`, `perNaceContent`) → inserts `briefs` row in `draft` state with `nace_sectors` populated, opener in `opening_summary`, returns 200 + `briefId`.
  - Valid v0.1/v0.2 legacy single-NACE `done` payload (`draft.*`) → inserts `briefs` row in `draft` state, returns 200 + `briefId`.
  - Valid `failed` payload → updates job to `failed`, returns 200.
  - Invalid `status` value → 422.
  - Non-UUID jobId (e.g. `"mcp-test-001"`) with no job row → proceeds jobless, still inserts brief, returns 200.
  - `naceSectors` empty array → 422.
  - `perNaceContent` missing a NACE listed in `naceSectors` → 422.
  - `paired_observation_index` out of range (>= observations.length) → 422.
- `upload.test.ts` (mocked Storage + DB): confirm `analysis_jobs` row is created with `status = 'pending'` and `data_lane = 'brief'`.
- `jobs-polling.test.ts` (mocked DB): pending → 200 pending; done with briefId → 200 done + briefId; unknown id → 404.

### Integration tests (require Supabase local stack + n8n dev webhook)

- Full round-trip: upload a test PDF → assert `analysis_jobs` row created → simulate n8n callback with a valid signed payload → assert `briefs` row in `draft` state → assert `analysis_jobs.status = 'done'`.
- Signature mismatch: callback with wrong secret → 401, job stays `pending`.

### Privacy invariant tests

- Assert `owner_metric_snapshot` in `analysis_jobs` never contains `raw_value` field — manual validation in the upload route + a post-insert SELECT that inspects the JSONB column.
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

## 13. Deployment + rollback

- **Deploy**: Supabase migration `0008_analysis_jobs.sql` — creates `analysis_jobs` table. Env vars `N8N_WEBHOOK_URL`, `N8N_WEBHOOK_SECRET`, `N8N_CALLBACK_SECRET` must be set in Vercel before the endpoint is live.
- **Rollback**: if the callback endpoint misbehaves, set `N8N_WEBHOOK_URL` to an empty string — the upload handler will return 503 "Analýza není momentálně k dispozici." immediately after Storage upload, without creating a job row. `analysis_jobs` table and brief rows written by completed jobs are retained.
- **Feature flag**: none separate — the feature is gated by whether `N8N_WEBHOOK_URL` is set. An empty or absent `N8N_WEBHOOK_URL` disables the upload trigger path.

## 14. Open questions

| ID | Question | Assumed-for-now | Escalate to |
|---|---|---|---|
| OQ-EN-C01 | The `docs/data/analysis-pipeline-data.md` DE spec (Track C, blocked at time of this writing) owns the exact `ownerMetricSnapshot` payload shape and the lane-separation posture for what fields flow to n8n. This spec assumes `{ metric_id, percentile, quartile_label }[]` with no `raw_value`. If DE's spec adds or changes fields, this ADR-N8N-03 and the Zod schema must be updated. | Assumed correct per DE lane-separation principle; update when `analysis-pipeline-data.md` lands. | Orchestrator to cross-check when DE spec is unblocked. |
| OQ-EN-C02 | n8n workflow ID and trigger URL in workspace kappa3 are not yet confirmed. This spec uses `N8N_WEBHOOK_URL` as an env var so the workflow can be wired up at deploy time without code changes. | Resolved in v0.3: workflow is live at kappa3.app.n8n.cloud as "Strategy Radar — Analyze Publication". `N8N_WEBHOOK_URL` env var is set. No code changes needed. | Closed. |
| OQ-077 | Per-NACE relevance prompt library: as more NACE codes are added beyond the 4-NACE PoC scope (D-031), each new NACE branch needs a calibrated `PŘÍSNĚ` relevance clause tuned to avoid tangential-mention bleed. Prompt library curation and testing methodology not yet formalised. | Each prompt is manually validated for the 4 PoC NACEs. | Orchestrator to prioritise formalisation before NACE count scales beyond 8. |
| OQ-EN-C03 | Signed URL expiry after 1h: if n8n takes longer than 1h to fetch the file (queue backlog on the n8n Cloud side), the download will fail. Default n8n timeout is shorter than 1h; the 3-min analyst-facing timeout also enforces a shorter bound. Accepted as a known edge case. | Accepted at v0.3. Increase TTL to 4h or generate a fresh URL on retry if this becomes load-bearing. | Orchestrator if n8n queue delays are observed. |

## Changelog

- 2026-04-27 — initial draft — engineer. Covers Track C: webhook + callback contracts, `analysis_jobs` table, HMAC-SHA256 posture, Supabase Storage signed URL, polling endpoint, 6 failure modes, 3 new env vars, full test plan including privacy invariant and migration tests.
- 2026-04-27 — Phase 3.2.C implementation complete — engineer. All six steps shipped: migration 0008, n8n workflow JSON, upload UI, upload API, job-status API, callback endpoint, admin wiring. Status enum aligned with data doc ('queued','running','done','failed'). zod not added (new dependency — see OQ-C-01); manual validation used in callback handler.
- 2026-04-29 — v0.3 multi-NACE rewrite — engineer. Reflects D-028..D-031 live state. §1: links to live workflow files and D-028..D-031 decisions. §2: architecture updated for multi-NACE topology and immediate-respond webhook. §5: rewritten to Model B (D-029) callback shape with naceSectors/perNaceContent; legacy single-NACE shape documented for backward compat; opener routing to opening_summary (not publication block) explained. §6: `analysis_jobs` reduced-role note added. New §8: prompt design (relevance gate, STRICT_JSON_RULES, truncation). New §9: 6 build-time failure modes with root cause + fix. New §10: workflow shape summary referencing n8n-workflows/. Sections renumbered. Test plan updated for v0.3 payload shapes. OQ-EN-C02 resolved; OQ-077 added.
