# Orchestration Skill — Claude-Code-driven brief generation

*Engineering spec for the Claude Code workflow that replaces the n8n-driven LLM pipeline (D-026). Owner: engineer.*

## 1. Purpose

Define the prompts, control flow, and tool-call contract that Claude Code (running on the analyst's machine, using the analyst's Max subscription quota) follows to:

1. Read a publication file (PDF / DOCX / MD).
2. Generate a Czech-language layperson opener (~200–400 words).
3. Spawn one parallel sub-agent **per supported NACE** (today: NACE 31, NACE 49).
4. Each sub-agent generates 3 paired observations + 3 paired action steps for its NACE.
5. Each sub-agent calls the `write_draft_brief` MCP tool exposed by n8n to persist a draft.

Result: N drafts (one per NACE) appearing at `https://<app-url>/admin` for analyst review and publish.

This spec is the source of truth for the prompt content. The `.claude/skills/draft-brief.md` skill (if shipped) consumes the same prompts; the analyst-facing operating procedure is in `docs/product/analysis-automation-claude-code.md`.

## 2. Preconditions

- `claude mcp list` shows `strategy-radar — Connected` at user scope.
- The MCP server exposes the `write_draft_brief` tool (Phase TC-A complete).
- The Strategy Radar app is running and reachable from n8n via ngrok (or static URL); `NEXT_PUBLIC_APP_URL` matches the URL hardcoded in n8n's tool node.
- `N8N_CALLBACK_SECRET` matches between n8n and `src/.env.local`.

## 3. Control flow

```
[Analyst]: drag PDF/DOCX into Claude Code session, type a kickoff prompt
   ↓
[Orchestrator (top-level Claude Code agent)]:
   3.1  Read the file (Read tool for text/MD; built-in PDF/DOCX support otherwise)
   3.2  Generate the layperson opener (single completion using Phase 5.1 prompt)
   3.3  Spawn 2 sub-agents in parallel via Task tool
        ↓                                    ↓
   [NACE 31 sub-agent]               [NACE 49 sub-agent]
        ↓                                    ↓
   3.4  Apply per-NACE prompt (Phase 5.2/5.3)
   3.5  Generate 3 observations + 3 paired actions
   3.6  Call MCP tool write_draft_brief
        ↓                                    ↓
   3.7  Return success/failure summary to orchestrator
   ↓
[Orchestrator]: report all draft IDs + URLs to analyst
```

Sub-agent isolation is important — each sub-agent should NOT see the other NACE's prompt or output. Parallel `Agent` calls in Claude Code provide this isolation by default.

## 4. Inputs

| Field | Source | Required |
|---|---|---|
| Publication file | Analyst attaches via Claude Code drag-drop or path | Yes |
| Target NACE list | Hardcoded in skill: `["31", "49"]` | Yes |
| Owner-metric snapshot | Deferred (OQ-075) — pasted manually by analyst until tool exists | No |

## 5. Prompts

### 5.1 Orchestrator: layperson opener

System role: act as a Czech-SME-owner-facing translator. Do NOT use analyst jargon.

Prompt template:

```
Vygeneruj český úvod sektorové analýzy pro malého a středního podnikatele.

Délka: 200–400 slov.
Styl: jednoduchá čeština, vykání, věcný tón. Žádné statistické termíny ani anglicismy.
Účel: shrnout obsah analýzy tak, aby si majitel firmy během 60 sekund udělal obrázek o trendech v jeho oboru.

Pravidla:
- Nikdy nepiš "podle analýzy" nebo "studie ukazuje" — formuluj přímo, jako by mluvil rozumný kolega.
- Žádná čísla bez kontextu (vždy s rokem, mezikvartálním srovnáním, nebo benchmarkem).
- Konec úvodu odkáže na to, že navazují konkrétní pozorování pro daný obor.

Vstupní text publikace:
{publication_body}

Vrať pouze samotný český úvod, bez nadpisu, bez prefixu, bez metakomentáře.
```

Output: a single Czech-language string, ~200–400 words. The orchestrator passes this verbatim to all sub-agents (same opener used for all NACE drafts).

### 5.2 NACE 31 (Výroba nábytku) sub-agent — placeholder skeleton

**STATUS: Skeleton only. Per-NACE rules to be designed by user (OQ-074). Output will be generic until refined.**

System role: sector analyst specialised in Czech furniture manufacturing (NACE 31).

Prompt template:

```
Jsi sektorový analytik České spořitelny pro odvětví Výroby nábytku (NACE 31).
Tvým úkolem je z poskytnuté publikace odvodit 3 konkrétní pozorování a 3 odpovídající doporučené kroky pro malého/středního výrobce nábytku v ČR.

Pravidla pro pozorování:
- Každé pozorování má krátký název (do 60 znaků) a tělo (2 věty, max 400 znaků).
- Reflektuj tématiku publikace, ale vztáhni ji k typickému českému výrobci nábytku (do 50 zaměstnanců, B2B + B2C kanály).
- TODO: konkrétní rule-set per NACE 31 (downstream consumer demand exposure, dependence on housing market, raw-material cost sensitivity, kitchen-vs-bedroom-vs-office submix).

Pravidla pro doporučené kroky:
- Každý krok je spárovaný s konkrétním pozorováním (paired_observation_index 0/1/2).
- Každý krok má název (do 60 znaků), tělo (2 věty, max 400 znaků), a time_horizon ∈ {"1m", "3m", "6-12m"}.
- Krok musí být akční — sloveso na začátku, konkrétní výstup, ne obecná rada.
- TODO: konkrétní rule-set per NACE 31 (např. cash-flow buffer pro sezónnost, dodavatelská diverzifikace, online-katalog jako odpověď na DIY-trend).

Vstupní text publikace:
{publication_body}

Český úvod (kontext):
{layperson_opener}

Vrať JSON ve formátu (a nic jiného):
{
  "observations": [
    {"title": "...", "body": "..."},
    {"title": "...", "body": "..."},
    {"title": "...", "body": "..."}
  ],
  "actions": [
    {"title": "...", "body": "...", "time_horizon": "1m"},
    {"title": "...", "body": "...", "time_horizon": "3m"},
    {"title": "...", "body": "...", "time_horizon": "6-12m"}
  ]
}
```

Output: structured JSON with 3 observations and 3 actions. The sub-agent then calls `write_draft_brief` (Section 6) with this content + the orchestrator-provided opener + `naceDivision: "31"`.

### 5.3 NACE 49 (Silniční nákladní doprava) sub-agent — placeholder skeleton

**STATUS: Skeleton only. Per-NACE rules to be designed by user (OQ-074).**

Same structure as 5.2 with substitutions:

- Sector name: `Silniční nákladní doprava` / `NACE 49`
- Per-NACE TODO bullets: fuel cost sensitivity, driver shortage, truck-fleet age, cross-border vs domestic mix, EU-driver-pay-equalisation regulation
- `naceDivision: "49"` in the tool call

## 6. Tool call: `write_draft_brief`

Each sub-agent ends by invoking the MCP tool. Schema (mirrors `n8n-workflows/mcp-draft-writer.json`):

```json
{
  "naceDivision": "31",
  "openerMarkdown": "<opener from Phase 5.1, verbatim>",
  "publicationBodyMarkdown": "<full publication body in MD; optional>",
  "observations": [
    { "title": "...", "body": "..." },
    { "title": "...", "body": "..." },
    { "title": "...", "body": "..." }
  ],
  "closingActions": [
    { "title": "...", "body": "...", "time_horizon": "1m" },
    { "title": "...", "body": "...", "time_horizon": "3m" },
    { "title": "...", "body": "...", "time_horizon": "6-12m" }
  ],
  "jobId": "mcp-<auto-generated-if-omitted>"
}
```

Tool returns:
- Success: `{ success: true, jobId: "...", message: "Draft brief written. Job ID: ...", appResponse: ... }`
- Failure: `{ success: false, jobId: "...", statusCode: <int>, error: "...", appResponse: ... }`

Sub-agent reports the tool's success/failure to its parent (the orchestrator).

## 7. Failure modes & recovery

| Failure | Surfaces as | Recovery |
|---|---|---|
| MCP tool not registered in n8n | Claude Code says "no tool `write_draft_brief` in `strategy-radar`" | Re-do Phase TC-A in n8n UI |
| HMAC mismatch | App returns 401 to n8n; tool returns `success: false, statusCode: 401` | Re-sync `N8N_CALLBACK_SECRET` between n8n Sign-Callback node + `src/.env.local` |
| ngrok URL stale | Tool returns `success: false, statusCode: <network>` | Update `callbackUrl` in n8n + `NEXT_PUBLIC_APP_URL` in `.env.local`, restart dev server |
| Sub-agent didn't call the tool | Orchestrator sees no jobIds returned | Re-run; if persistent, sub-agent prompt is missing explicit tool-call instruction (Phase 5 prompt bug) |
| PDF unparseable (scanned image) | Orchestrator can't extract publication body | Convert PDF to text-layer first (e.g., `ocrmypdf`) or hand-paste body into the kickoff prompt |
| Sub-agent JSON malformed | Tool call fails schema validation | Sub-agent prompt should specify "Vrať JSON a nic jiného" — already in Phase 5 templates |

## 8. Open items

- **OQ-074**: per-NACE rules — Phase 5.2 / 5.3 prompts are skeletons. Once user designs the rule library per NACE, replace TODO bullets with concrete rules. Output quality before that = generic.
- **OQ-075**: client-data injection. Two paths under consideration:
  - Add a second MCP tool `get_owner_metric_snapshot(ico)` that returns `{metric_id, percentile, quartile_label}[]` — sub-agents fetch per-firm snapshot before generating actions
  - Analyst pastes snapshot into kickoff prompt manually (PoC-acceptable)
- **OQ-076**: NACE 10/11 + 46 expansion. When Excels arrive, add Phase 5.4 (food) + 5.5 (aluminium wholesale), bump orchestrator's spawn count to 4.

## 9. Versioning

- v1 — 2026-04-28 — initial spec, NACE 31 + 49 with placeholder rules.
