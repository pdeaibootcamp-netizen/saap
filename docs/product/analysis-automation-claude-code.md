# Analysis automation — Claude Code procedure (v0.3 PoC)

*Owner: product-manager. Analyst-facing operating procedure for the Claude-Code-orchestrated multi-NACE brief-generation flow (D-026). Engineer companion: `docs/engineering/orchestration-skill.md`.*

## 1. What this is

The "Generovat" flow for v0.3, redesigned to run entirely on the analyst's machine using their Claude Code Max subscription. The original `/admin/publications/new` browser upload path remains in the codebase as the API-key alternative but is **not** the primary path for v0.3 customer testing.

End state: analyst attaches a publication (PDF, DOCX, or markdown), runs a Claude Code session, and within ~60 seconds **two new draft briefs** appear at `/admin` — one for NACE 31 (furniture) and one for NACE 49 (road freight). Analyst reviews each, edits if needed, clicks Publish.

## 2. Preconditions (one-time setup, ~10 minutes)

The moderator/setup person, not the analyst, completes this once per environment.

1. **n8n MCP workflow Published** with the `write_draft_brief` tool registered. See `docs/engineering/orchestration-skill.md` §2.
2. **Claude Code MCP server** registered at user scope:
   ```bash
   claude mcp add --transport sse --scope user strategy-radar https://kappa3.app.n8n.cloud/mcp/strategy-radar-draft/sse
   claude mcp list   # verify "Connected"
   ```
3. **Strategy Radar app** running on `localhost:3000` and exposed via ngrok (or static URL). The ngrok URL must match the `callbackUrl` hardcoded in n8n's tool node + `NEXT_PUBLIC_APP_URL` in `src/.env.local`.
4. **HMAC secret** matches between n8n's Sign Callback step and `src/.env.local`'s `N8N_CALLBACK_SECRET`.

## 3. Per-publication procedure (the analyst's workflow)

### 3.1 Place the publication file

Drop the publication into `~/Projects/saap-trial/PRD/publications/`. Supported formats:

- `.docx` (Word document, native Czech text)
- `.pdf` with a text layer (not scanned-image-only)
- `.md` or `.txt`

Scanned PDFs will fail; convert to text first (`ocrmypdf input.pdf out.pdf`) or paste the body into the kickoff prompt manually.

### 3.2 Open Claude Code in the project root

```bash
cd ~/Projects/saap-trial
claude
```

Wait for the `>` prompt. First-run users will be asked to log in via browser — use the email tied to your Max subscription.

### 3.3 Trigger the orchestration

Two ways depending on whether the `/draft-brief` skill is installed:

**Option A — with the skill (recommended once Phase TC-C ships the skill)**:
```
/draft-brief PRD/publications/Nábytkářský trh v ČR_2026_03.docx
```
The skill reads the file, runs the orchestration, and reports back.

**Option B — without the skill (works today)**:
Paste this kickoff prompt:

> Read the publication at `PRD/publications/<filename>`. Follow the orchestration spec at `docs/engineering/orchestration-skill.md` exactly:
>
> 1. Generate a Czech layperson opener (200–400 words, owner-voice) using the Phase 5.1 prompt.
> 2. Spawn 2 parallel sub-agents (NACE 31 and NACE 49) via the Task tool; each follows Phase 5.2 / 5.3.
> 3. Each sub-agent calls the `write_draft_brief` MCP tool with `{ naceDivision, openerMarkdown, observations, closingActions }`.
> 4. Report both jobIds back when done.

### 3.4 Watch progress

Claude Code shows the orchestrator's status as it works. Expected milestones:

- "Reading publication file..." (1–2 s)
- "Generating layperson opener..." (~10 s)
- "Spawning NACE 31 and NACE 49 sub-agents..." (~30–60 s, parallel)
- "Both sub-agents reported success: jobId mcp-... (NACE 31), jobId mcp-... (NACE 49)"

If a sub-agent fails, the orchestrator surfaces the error. See §5 (failure modes).

### 3.5 Review and publish

Open the browser at the active app URL → `/admin`. Two new drafts appear, titled like:

- `Sektorová analýza — NACE 31 — Duben 2026`
- `Sektorová analýza — NACE 49 — Duben 2026`

Click into each, scan the opener + 3 paired insights+actions, edit any wording, click **Zveřejnit** (Publish). Both drafts can be published independently — there's no atomic batch publish.

After publishing, switch the IčO switcher on the dashboard to a NACE 31 firm (e.g., `26393913` ALNUS, spol. s r.o.) and confirm the new brief appears at the top of the "Analýzy" section. Repeat for a NACE 49 firm.

## 4. What the output looks like

Both drafts share the same Czech layperson opener (the publication body is identical for both). What differs:

- **Title** — NACE division code in the header
- **Observations** — 3 NACE-specific framings of the publication's content
- **Actions** — 3 NACE-specific recommended next steps, paired with observations, time-horizon-tagged (`1m` / `3m` / `6-12m`)

Per-NACE rule design is deferred (OQ-074) — until that's done, the observations + actions will be reasonably topical but generic. Output quality jumps once rules land.

## 5. Failure modes & recovery

| What you see | Likely cause | Fix |
|---|---|---|
| Claude Code says "no tool `write_draft_brief`" | n8n trigger has zero tools registered | Re-do Phase TC-A (register the tool node in n8n UI) |
| One sub-agent succeeds, one fails | Per-NACE prompt issue, or n8n tool flaky | Re-run; check n8n Executions panel for failed run details |
| Both fail with `statusCode: 401` | HMAC mismatch | Sync `N8N_CALLBACK_SECRET` between n8n Sign Callback node + `src/.env.local`; restart dev server |
| Both fail with network error | ngrok URL stale (free-tier daily churn) | Update `callbackUrl` in n8n's tool node + `NEXT_PUBLIC_APP_URL` in `.env.local`; restart dev server |
| Drafts don't appear in `/admin` even though tool reported success | App's `/api/admin/briefs/from-n8n` route 200'd but the brief isn't where expected | Check `npm run dev` terminal logs for the from-n8n POST; verify `briefs` table in Supabase |
| Output is generic / lacks NACE-specific insight | Per-NACE rules not yet designed (OQ-074) | Expected — use placeholder output for PoC plumbing tests; revisit when rules land |

## 6. Privacy notes

- The publication body transits Claude Code → MCP tool → n8n → app. n8n's tool node is configured to NOT persist the publication payload after the workflow execution; only the structured callback fields (opener, observations, actions, draft metadata) are written to the app's database.
- No owner-firm raw data flows through this pipeline. When client-data integration lands (OQ-075), only the percentile + quartile snapshot will cross the boundary, never raw values — same posture as the original `analysis-pipeline-data.md` spec.
- Anthropic API is NOT invoked from n8n in this design; LLM inference happens in Claude Code on the analyst's machine, billed against the Max subscription quota only.

## 7. When real ČS analysts use this

PoC posture only. For real-analyst rollout (post-PoC), the Claude-Code-CLI requirement is a UX regression compared to a browser upload page. The browser path (`/admin/publications/new`, the original 18-node n8n workflow) remains in the codebase as the production-track alternative. Switching back means setting up an Anthropic API key in n8n + activating the original workflow + pointing the upload page at it. Both paths are first-class — D-026 chose Claude Code for cost reasons, not architecture reasons.

## 8. Changelog

- 2026-04-28 — initial spec for v0.3 PoC. NACE 31 + 49. Per-NACE rules and client-data integration deferred (OQ-074, OQ-075).
