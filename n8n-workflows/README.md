# n8n Workflows — Strategy Radar

This directory contains importable n8n workflow JSON files for the Strategy Radar v0.3 analysis-automation pipeline.

## analysis-automation.json

The publication-analysis pipeline. Receives an uploaded PDF or DOCX from the app, extracts text, calls Claude twice (opener + structured observations/actions), and posts the draft back to the app.

---

## Step-by-step setup

### 1. Import the workflow

1. Open your n8n workspace at `https://kappa3.app.n8n.cloud/`.
2. Click **Workflows** in the left sidebar.
3. Click **New** (top right), then **Import from File**.
4. Select `analysis-automation.json` from this directory.
5. The workflow opens in the canvas. Do not activate it yet.

### 2. Add the Anthropic credential

1. In n8n, go to **Settings → Credentials → New credential**.
2. Search for **HTTP Header Auth**.
3. Name it `Anthropic API Key`.
4. Set **Name** to `x-api-key` and **Value** to your Anthropic API key (starts with `sk-ant-...`).
5. Save.
6. Back in the workflow, click the **Claude Call 1** node, then click **Credential for Header Auth** and select `Anthropic API Key`. Repeat for **Claude Call 2**.

### 3. Set the two HMAC secrets

The workflow uses two secrets:

| Variable | Direction | Where to set |
|---|---|---|
| `N8N_WEBHOOK_SECRET` | app → n8n (verifying incoming webhook) | n8n workflow Static Data |
| `N8N_CALLBACK_SECRET` | n8n → app (signing the callback) | n8n workflow Static Data |

**Setting via Static Data (recommended for n8n Cloud free tier):**

n8n Cloud free tier does not expose environment variables. Use n8n's built-in Static Data instead:

1. In the workflow canvas, click **...** (workflow menu, top right) → **Settings** → **Static Data**.
2. Add two entries:
   - Key: `N8N_WEBHOOK_SECRET` — Value: generate with `openssl rand -hex 32`
   - Key: `N8N_CALLBACK_SECRET` — generate with `openssl rand -hex 32`
3. Copy both values — you will need them in the next step.

**Alternative (hardcode for PoC only):**
If Static Data is not working, you can temporarily hardcode the secrets directly in the Code nodes (`Verify HMAC` and `Sign Callback`). Replace `workflowData.N8N_WEBHOOK_SECRET` with the literal string. Rotate before any external exposure.

### 4. Paste the secrets into the app

Add the following to `src/.env.local`:

```bash
N8N_WEBHOOK_SECRET=<the value you generated for N8N_WEBHOOK_SECRET>
N8N_CALLBACK_SECRET=<the value you generated for N8N_CALLBACK_SECRET>
```

### 5. Activate the workflow and copy the webhook URL

1. Click **Activate** (top right toggle) in the workflow canvas.
2. Click the **Webhook Trigger** node.
3. Copy the **Production URL** shown (format: `https://kappa3.app.n8n.cloud/webhook/analysis-automation`).
4. Paste it into `src/.env.local`:

```bash
N8N_WEBHOOK_URL=https://kappa3.app.n8n.cloud/webhook/analysis-automation
```

5. Restart your Next.js dev server (`npm run dev`) to pick up the new env var.

---

## Node overview (14 nodes)

| # | Node name | Type | Purpose |
|---|---|---|---|
| 1 | Webhook Trigger | Webhook | Receives POST from the app |
| 2 | Verify HMAC | Code | Validates X-Signature-256 header |
| 3 | Fetch Publication File | HTTP Request | Downloads PDF/DOCX from signed Supabase URL |
| 4 | Detect File Type | Code | Detects PDF vs DOCX from URL extension |
| 5 | PDF or DOCX? | If | Branches on file type |
| 6 | Extract PDF Text | Code | Extracts text from PDF binary |
| 7 | Extract DOCX Text | Code | Extracts text from DOCX binary |
| 8 | Merge Extraction | Code | Re-joins the two branches |
| 9 | Claude Call 1 — Generate Opener | HTTP Request | Calls Anthropic API for the 200–400 word opener |
| 10 | Extract Opener | Code | Pulls opener text from Claude response |
| 11 | Claude Call 2 — Generate Observations + Actions | HTTP Request | Calls Anthropic API with tool_use for structured output |
| 12 | Extract Structured Output | Code | Validates and extracts observations + actions |
| 13 | Compose Draft | Code | Assembles the final callback payload |
| 14 | Sign Callback | Code | Signs payload with N8N_CALLBACK_SECRET |
| 15 | Send Callback | HTTP Request | POSTs draft to `/api/admin/briefs/from-n8n` |
| 16 | Respond 200 | Respond to Webhook | Returns 200 immediately to the app |
| 17 | Error Handler | Code | Catches any failure and sends a failure callback |
| 18 | Send Failure Callback | HTTP Request | POSTs `status: failed` to the callback URL |

---

## Troubleshooting

**Signature mismatch (401 from app):** The `N8N_WEBHOOK_SECRET` in n8n Static Data does not match `N8N_WEBHOOK_SECRET` in the app's `.env.local`. Verify both are identical.

**Claude returns empty content:** Check that the Anthropic credential is correctly attached to both Claude Call nodes. Confirm the API key is valid and has quota.

**Job stays `queued` forever:** The callback is failing. In n8n, open the execution log and check the `Send Callback` node output. Common cause: `N8N_CALLBACK_SECRET` mismatch or the app's callback URL is unreachable from n8n Cloud (e.g., `localhost` — use a tunnel like ngrok for local dev).

**PDF extraction produces garbage text:** The publication is a scanned (image-only) PDF. The current Code node cannot OCR it. Use a text-layer PDF or convert to DOCX first.
