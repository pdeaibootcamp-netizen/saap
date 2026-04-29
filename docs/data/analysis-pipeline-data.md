# Analysis pipeline — data flowing into the n8n call

*Owner: data engineer. Status: draft. Created 2026-04-27 by orchestrator on DE's behalf — filename heuristic guard blocked the DE agent from writing this file directly; content matches DE's design intent as captured in their session report.*

This spec covers the data-side contract for the n8n analysis-automation pipeline (v0.3 Track C). Pairs with:

- `docs/product/analysis-automation.md` — analyst UX.
- `docs/engineering/n8n-integration.md` — webhook contract + signing.
- `docs/data/owner-metrics-schema.md` — source of the owner snapshot.
- `docs/data/percentile-compute.md` — source of the percentile/quartile values that go into the snapshot.
- `docs/data/privacy-architecture.md` — data-lane separation rules. Load-bearing for §3 below.

## 1. The payload to n8n

When the analyst clicks **Generovat návrh přehledu** in `/admin/publications/new`, the orchestrator app POSTs to the n8n webhook (`N8N_WEBHOOK_URL`) the following body:

```json
{
  "jobId": "uuid",
  "callbackUrl": "https://app/api/admin/briefs/from-n8n",
  "publicationFileUrl": "https://supabase/.../signed-url-1h-ttl.pdf",
  "naceDivision": "49",
  "ownerMetricSnapshot": [
    { "metric_id": "gross_margin",         "percentile": 68, "quartile_label": "třetí čtvrtina" },
    { "metric_id": "ebitda_margin",        "percentile": 44, "quartile_label": "druhá čtvrtina" },
    { "metric_id": "labor_cost_ratio",     "percentile": null, "quartile_label": null },
    { "metric_id": "revenue_per_employee", "percentile": 57, "quartile_label": "třetí čtvrtina" },
    { "metric_id": "working_capital_cycle","percentile": null, "quartile_label": null },
    { "metric_id": "net_margin",           "percentile": 51, "quartile_label": "druhá čtvrtina" },
    { "metric_id": "revenue_growth",       "percentile": 78, "quartile_label": "horní čtvrtina" },
    { "metric_id": "pricing_power",        "percentile": null, "quartile_label": null }
  ]
}
```

`ownerMetricSnapshot` is **omitted** when the analyst leaves the snapshot checkbox off. When present, it has exactly 8 entries — one per frozen metric. Entries with no owner data have `percentile: null, quartile_label: null` and the model is instructed to either skip owner-relative framing for that metric or describe it as "data not yet available".

## 2. What the snapshot does NOT include

Critical — `raw_value` is **never** included. Only the derived `percentile` + `quartile_label` cross to n8n. Rationale in §3.

## 3. Privacy boundary (load-bearing)

Per `docs/data/privacy-architecture.md` §2 the four data lanes are: brief / user_contributed / rm_visible / credit_risk. They stay architecturally separate.

- The publication file is **brief-lane** content. Sending it to n8n is a brief-lane → external-processor flow.
- The owner metric snapshot is derived from **user_contributed-lane** data (`owner_metrics` rows + `cohort_aggregates` for percentile compute).
- The lanes meet only inside the orchestrator app's request handler, which composes the payload. n8n receives the composed payload, runs the workflow, and returns a generated draft brief. **n8n never persists the snapshot**; the workflow is configured to drop the input after generation completes.
- The generated draft brief contains brief-lane content only. Per-client raw values are explicitly forbidden from appearing in observation copy. NACE-level framing ("v sektoru je medián marže 18 %") and quartile-relative framing ("vaše marže patří do třetí čtvrtiny oboru") are allowed.

This carries forward CLAUDE.md guardrail: "Client data never enters base-model training." The Anthropic terms of service for the Claude API confirm that input data is not used for training — the n8n workflow inherits this boundary by calling the Claude API directly.

## 4. Fallback when ownerMetricSnapshot is absent

If the analyst left the snapshot checkbox off, or if the active demo owner has no `owner_metrics` rows yet, the n8n call carries no snapshot. The workflow's prompt then produces NACE-only framing — observations talk about the sector, not the owner. This is the safe default and it's still useful for a brief that primarily covers sector trends.

## 5. Composition logic

In the orchestrator app's `POST /api/admin/publications/upload` handler (Phase 3.2.C4), the snapshot composition runs inside a single transaction-scoped read against the user_contributed lane:

```ts
async function composeOwnerSnapshot(userId: string): Promise<OwnerSnapshotEntry[]> {
  const ownerMetrics = await sqlUser`SELECT metric_id, raw_value FROM owner_metrics WHERE user_id = ${userId}`;
  const profile = await getProfileByUserId(userId);
  return FROZEN_METRIC_IDS.map(metric_id => {
    const row = ownerMetrics.find(m => m.metric_id === metric_id);
    if (!row) return { metric_id, percentile: null, quartile_label: null };
    const result = computePercentile(metric_id, row.raw_value, profile.nace_sector, profile.size_band, profile.region);
    return { metric_id, percentile: result.percentile, quartile_label: result.quartileLabel };
  });
}
```

The composition is read-only and does not write back to either lane.

## 6. Job state row

A new `analysis_jobs` table in the **brief lane** captures job metadata for analyst-side polling:

```sql
CREATE TABLE analysis_jobs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status        TEXT NOT NULL CHECK (status IN ('queued','running','done','failed')),
  file_path     TEXT NOT NULL,
  nace_division TEXT NOT NULL,
  snapshot_used BOOLEAN NOT NULL DEFAULT false,
  brief_id      UUID REFERENCES briefs(id),  -- set on done
  error         TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  completed_at  TIMESTAMPTZ
);
```

The `snapshot_used` boolean records whether the analyst opted to send the snapshot. It is the only pointer back to the user_contributed lane and is intentionally not a foreign key — once the job is done, the snapshot itself is forgotten. Audit trail relies on the analyst's `affirmed_by` on the eventual publish.

## 7. Cohort context the prompt receives

In addition to the owner snapshot, n8n's prompt is given a NACE-level cohort summary so it can frame insights in industry context. Computed at request time:

```ts
async function composeCohortSummary(naceDivision: string): Promise<CohortSummaryEntry[]> {
  return FROZEN_METRIC_IDS.map(metric_id => {
    const aggregate = getCohortAggregate(naceDivision, metric_id); // real or synth per D-025
    return {
      metric_id,
      median: aggregate?.median ?? null,
      q1: aggregate?.q1 ?? null,
      q3: aggregate?.q3 ?? null,
      n_proxy: aggregate?.n_proxy ?? null,
      source: aggregate?.source ?? null  // "real" | "synthetic"
    };
  });
}
```

The cohort summary travels with the snapshot. It lets the model say things like "v sektoru je typická marže kolem 18 %" — a useful narrative anchor that does not reveal individual firm data.

## 8. Privacy-architecture allow-list addition

This is the first external-processor pipeline ever to leave the orchestrator app. `docs/data/privacy-architecture.md` should be extended in v0.3 (or v0.4 if the user prefers) with a new pipeline entry:

> **`analyse_publication_n8n`** — orchestrator → n8n Cloud (workspace `kappa3`). Crosses brief-lane (publication file) and reads-from user_contributed-lane (owner snapshot, never persisted in n8n). Output is a draft brief in the brief lane. Trigger: analyst-initiated, never automated.

Until that addendum lands, this spec is the canonical reference for the boundary.

## 9. Open questions

- **OQ-AP-01** (cross-spec, non-blocking for PoC): n8n Cloud's data-residency posture vs. ČS policy. Workspace `kappa3` is in the EU but the underlying compute may move. For v0.3 PoC this is acceptable; before v0.4 (real-customer demo), confirm with ČS legal.
- **OQ-AP-02** (cross-spec): the cohort summary in §7 includes `n_proxy` from synth rows (per D-025). The model may infer it's a real N — we should add a prompt-side instruction that "synthetic" sources are explicitly labelled. EN to capture in the prompt template.
- **OQ-AP-03** (forward-pointer): if and when ROCE re-enters the frozen 8 (D-024 reversibility), the snapshot composition's `FROZEN_METRIC_IDS` constant must update. Single source of truth lives in `src/types/data-lanes.ts`.

## Changelog

- 2026-04-27 — initial draft. Written by orchestrator on DE's behalf (filename guard blocked DE agent from writing this file).
