# n8n Workflows — Strategy Radar

This directory holds importable n8n workflow JSON files for the v0.3 analysis-automation pipeline.

## Files

| File | Status | What it is |
|---|---|---|
| `analyze-publication.json` | **LIVE** — source of truth, snapshot 2026-04-29 | Multi-NACE publication analysis (Webhook → 4 parallel NACE branches → bundled callback). The currently-deployed workflow on n8n Cloud as `Strategy Radar — Analyze Publication`. ~34 nodes. |
| `analysis-automation.json` | Frozen, historical | Original single-NACE pipeline (D-026 era). 14–18 nodes. Used the Anthropic HTTP Request pattern; superseded by the langchain-agent + multi-NACE design. |
| `mcp-draft-writer.json` | Frozen, abandoned | The aborted MCP-orchestrator approach (D-026, blocked by `$fromAI` resolution issues). Kept for context only. |

`analyze-publication.json` is the only file the running system depends on. The other two are kept so future work can see what was tried and ruled out (D-026 → D-028 in `docs/project/decision-log.md`).

## How the live workflow snapshot is maintained

The actual workflow lives in n8n Cloud (`kappa3.app.n8n.cloud`) under the workspace name `Strategy Radar — Analyze Publication`. n8n is the source of truth for *running* state; this repo is the source of truth for *versioned* state.

When the workflow changes meaningfully:

1. In n8n Cloud, open the workflow → ⋮ menu → **Download** (gives a file like `Strategy Radar — Analyze Publication.json`).
2. Save it over `n8n-workflows/analyze-publication.json` in this repo (rename the download to drop the spaces and em-dash; the path here uses ASCII).
3. Commit with a message describing what changed (e.g., "n8n: increase Merge to 4 inputs").

Treat this as the rollback-of-last-resort: if someone overwrites a node in n8n's UI or the workspace gets deleted, importing the JSON re-creates the workflow exactly. It will not pick up live state changes (executions, secrets) — those have to be re-set in the UI.

## Live workflow shape (analyze-publication.json)

```
Webhook ─► Verify HMAC ─► Fetch File ─► Extract Text ─► Layperson Opener
                                                              │
                ┌─────────────────────┬───────────────────────┼──────────────────┐
                ▼                     ▼                       ▼                  ▼
         Insights 31          Insights 49            Insights 10          Insights 46
        (langchain.agent)         …                       …                    …
                │                     │                       │                  │
         IF (relevant?)         IF (relevant?)         IF (relevant?)     IF (relevant?)
            │       │              │      │               │      │           │      │
         Actions  ───►Tag       Actions ─►Tag          Actions ─►Tag      Actions ─►Tag
                │                     │                       │                  │
                └──────────► Merge (4 inputs, append) ◄──────┘                   │
                                       │                                         │
                                Compose Bundle (filter relevant, build per-NACE)
                                       │
                                Sign Callback (HMAC)
                                       │
                                Send Callback ─► /api/admin/briefs/from-n8n
```

Per-NACE prompts, the relevance gate, and the `roe` cohort metric are described in:
- `docs/engineering/n8n-integration.md` — webhook contract + topology
- `docs/data/analysis-pipeline-data.md` — data inputs/outputs
- `docs/project/decision-log.md` — D-028…D-032

## Setup (for a fresh n8n workspace)

If you're rebuilding from scratch (new workspace, lost workflow):

1. **Import** `analyze-publication.json`.
2. **Anthropic credential**: `Settings → Credentials → New → Anthropic API`. Paste API key. Re-attach to the model subnode `Claude Haiku` (it's shared by all 8 langchain.agent nodes).
3. **HMAC secrets**: edit the `Verify HMAC` and `Sign Callback` Code nodes. The shared secret value is hardcoded inline at the top of each (see `N8N_CALLBACK_SECRET` constant). Generate with `openssl rand -hex 32`. Same value goes into the app's `src/.env.local` as both `N8N_WEBHOOK_SECRET` and `N8N_CALLBACK_SECRET` (they're identical by convention; HMAC signs both directions).
4. **Webhook URL**: activate the workflow → click the **Webhook Trigger** node → copy the **Production URL** → paste into `src/.env.local` as `N8N_WEBHOOK_URL`.
5. **Test**: upload a publication via `/admin/publications/new` in the dev app. Watch the n8n execution panel: 1 webhook → 4 NACE branches → all 4 reach Merge → 1 callback POST out.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| 401 from app on callback | HMAC secrets don't match | Confirm n8n's hardcoded secret matches `.env.local`; restart `npm run dev` (env reads at boot) |
| Brief tagged with too few NACEs | Merge node has < 4 inputs (silently drops branches) | Merge node panel → ensure **4 input slots**, mode = **Append**; wire each Tag-N node to a distinct slot |
| All gates return `relevant: false` | Insights agent prompts too strict | See `docs/engineering/n8n-integration.md` §7 for the lenient + tightened prompt template per NACE |
| 50k input-tokens/min rate limit | Tier 1 Haiku on a publication > 8k chars | The Extract Text node truncates body to 8000 chars before the NACE branches fan out — confirm that line is intact |
| `Model output doesn't fit required format` | Haiku returned non-JSON or missing fields | All output parsers have `autoFix: true`; system prompts include `STRICT_JSON_RULES` forbidding markdown fences |
| Webhook 500 with circular-JSON error | Webhook responseMode is "lastNode" but the response object includes IncomingMessage | Set webhook **Respond** dropdown to **Immediately** (responds 200 before the chain runs; the chain still completes via callback) |
| Body double-encoded `{"<json>":""}` | Send Callback HTTP node has `specifyBody: "string"` instead of `"raw"` | In Send Callback → Body Content Type = **Raw**; Content-Type header = `application/json`; Body = `{{ $json.callbackBody }}` |
