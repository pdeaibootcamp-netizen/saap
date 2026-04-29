# Analysis automation — analyst upload UX

*Owner: product manager. Status: draft. Created: 2026-04-21 (v0.2 conceptual sketch); v0.3 spec written 2026-04-27 (orchestrator on PM's behalf — `Write` blocked by a filename-heuristic guard during PM session, content drafted to PM's specification).*

This is the v0.3 PM spec for the analyst's experience when uploading a publication and getting back a generated draft brief. It pairs with:

- `docs/product/in-tile-prompts.md` — Track A owner-side prompts. Same release.
- `docs/engineering/n8n-integration.md` — Track C engineering contract (load-bearing partner).
- `docs/data/analysis-pipeline-data.md` — what client data flows into the prompt.
- `docs/project/decision-log.md` D-020 (BriefContent shape with publication block + paired observations/actions), D-022 (v0.3 branch), D-023 (real-firm demo owner).

## 1. Frame

The analyst uploads a sectoral publication (PDF or DOCX), picks the NACE the publication concerns, optionally toggles "include the active demo owner's metric snapshot in the prompt", clicks **Generovat návrh přehledu**. After ~30–60 seconds, the analyst lands on the standard brief edit page at `/admin/briefs/[id]/edit` with a draft populated: a layperson-language Sektorová analýza opener, three paired observation+action cards, time-horizon tags from the frozen enum, action categories from the four D-011 IDs. The analyst reviews, edits where needed, and clicks **Publish**.

This collapses the v0.1 / v0.2 analyst loop from "type 200–400 words of opener + 3 observations × ~80 words + 3 actions × ~60 words by hand" to "upload + review + publish", saving roughly 30–60 minutes per brief.

## 2. Human-in-the-loop posture (load-bearing)

No auto-publish under any condition. The pipeline produces a `publish_state = 'draft'` brief; the analyst still owns the publish click. Preserves CLAUDE.md guardrail "no automated brief generation at MVP" — automation produces input, the analyst authors. Same publish checklist (`v1.0-2026-04`) gates the publish action; nothing changes about the existing edit + publish surface.

## 3. The analyst flow

1. From `/admin`, click **Nahrát publikaci** (new link added to admin sidebar).
2. Land on `/admin/publications/new`. Three controls:
   - File picker (`accept=".pdf,.docx"`, max 10 MB enforced client-side, soft-confirmed server-side).
   - NACE selector (the same 21-option list used in onboarding; default is the active demo owner's NACE if applicable).
   - Checkbox: "Použít data aktivního demo klienta jako kontext" — defaults to **off**. When on, the active demo owner's metric snapshot is sent to n8n alongside the publication so the generated insights can reference owner-relative framing.
3. Click **Generovat návrh přehledu**.
4. The page enters a polling state (see §6). Status pills: `Zařazeno` → `Generuje se…` → `Hotovo` (success) or `Selhalo` (failure).
5. On `Hotovo`, the page redirects to `/admin/briefs/[id]/edit` for the newly-created draft.
6. Analyst reviews (the form is pre-filled), edits anything that needs editing, then clicks **Publikovat**. Same flow as v0.1/v0.2.

## 4. The draft the analyst sees

Matches the v0.2 BriefContent shape (D-020) with no schema changes:

- `title` — generated from the file's title metadata or the first heading. Default placeholder: "Sektorová analýza — [NACE label] — [month year]".
- `publication_month` — current month and year in Czech ("Duben 2026").
- `publication.heading` — fixed string `Sektorová analýza` (constant; analyst can override).
- `publication.opener_markdown` — generated 200–400 word Czech-formal layperson opener.
- `publication.full_text_markdown` — the publication's extracted plain text, lightly cleaned but not edited.
- `publication.source` — defaults to `Ekonomické a strategické analýzy České spořitelny — {filename-stem}, {month year}` (analyst can edit). [OQ-AA-02 from PM in `in-tile-prompts.md` — orchestrator should reconcile.]
- `observations[]` — exactly three, generated. Each: `headline`, `body` (~60–100 Czech words), `time_horizon` (from the frozen enum), `is_email_teaser` boolean (the first one defaults to `true`, others `false`).
- `closing_actions[]` — exactly three, generated. Each: `action_text` (~40–80 Czech words), `time_horizon`, `category` (one of the four D-011 IDs), `paired_observation_index` set to its sibling observation's index (0, 1, 2 for default 1:1 pairing).
- `benchmark_categories: []` — empty (per D-020, benchmarks live on the dashboard not the brief).
- `pdf_footer_text` — default: "Strategy Radar · Česká spořitelna".
- `email_teaser_observation_index: 0`.

## 5. Failure modes + analyst-facing copy

All Czech, formal vykání. Each error has a `Zkusit znovu` button and a `Zrušit` button that returns to `/admin`.

| Failure | Cause | Czech copy |
|---|---|---|
| File too large | > 10 MB | "Soubor přesahuje 10 MB. Použijte zhuštěnější verzi a zkuste to znovu." |
| Unsupported format | Not PDF/DOCX | "Tento formát zatím nepodporujeme. Nahrajte prosím PDF nebo DOCX." |
| Upload failed | Network / Storage error | "Nahrávání selhalo. Zkontrolujte připojení a zkuste to znovu." |
| Timeout | n8n not responding within 3 min | "Generování trvá déle než obvykle. Můžete to zkusit znovu — pokud problém trvá, kontaktujte technickou podporu." |
| Generation failed | n8n returned `status: 'failed'` | "Generování návrhu selhalo. {error_detail}. Můžete to zkusit znovu nebo přehled vytvořit ručně." |
| Malformed output | n8n returned invalid JSON | "Generovaný návrh nelze načíst. Můžete to zkusit znovu nebo přehled vytvořit ručně." |

The analyst always retains the option to fall back to the manual authoring form (`/admin/briefs/new`).

## 6. Status polling

Client polls `GET /api/admin/publications/jobs/[id]` every **5 seconds**. Display: a circular indicator + status pill + elapsed time ("12 s"). Hard timeout at **3 minutes** — after that, the page surfaces the timeout error and stops polling. The analyst can refresh to resume polling if they suspect the timeout was premature.

## 7. File-size + format limits

- Format: PDF or DOCX. Other formats rejected client-side with a clear message.
- Max size: **10 MB**. Source: typical sector publications are 3–8 MB; 10 MB headroom is sufficient. Larger files would also stress the n8n PDF parser.
- Pages: no hard cap, but documents over ~50 pages may produce lower-quality openers (the prompt-context window is finite). Soft warning at file pick if PDF page count > 50.

## 8. The "demo data" framing

The analyst flow is **staff UX**, not customer UX. The PoC's customer-testing audience never sees `/admin/publications/new`. Tone is professional and clear, but doesn't need the deep Czech-formal-care we put into owner-facing copy. Analyst can be assumed to read Czech business prose fluently and to understand the difference between a draft and a published brief.

## 9. Acceptance criteria

1. Uploading a 5 MB PDF, picking NACE 49.41, leaving the snapshot checkbox off, and clicking Generovat lands the analyst on a populated draft within 90 seconds.
2. The draft contains a 200–400 word opener, exactly three observations, and exactly three actions, all paired 1:1 by `paired_observation_index`.
3. With the snapshot checkbox **on**, at least one observation in the generated draft references owner-relative framing (e.g. "Vaše marže oproti průměru oboru…").
4. With the snapshot checkbox **off**, no observation references owner-specific values; all framing is NACE-level.
5. Timing out at 3 min surfaces the timeout copy and stops polling. Pressing Zkusit znovu re-runs the generation.
6. The publish flow remains unchanged: same checklist, same affirmation step, same delivery records.

## 10. What's not in scope

- Multi-file upload (one file per generation — flag for v0.4 if useful).
- Re-generation against the same file with different NACE (currently requires a re-upload — minor friction, not a blocker).
- Showing the analyst the raw n8n prompt or model response (intentional — keeps the surface clean).
- Cost / token-usage display for the analyst (defer to ops dashboard, not analyst surface).
- Custom prompts per analyst (one canonical prompt; tunable by the engineer in n8n only).

## 11. Open questions

- **OQ-AA-02** (cross-spec): the `publication.source` default string format. PM proposes `Ekonomické a strategické analýzy České spořitelny — {title}, {month year}`. Engineer to confirm during Phase 3.2.C5 implementation that the JSON shape produced by n8n includes a `title` field that maps cleanly. If not, fall back to using the filename-stem as the title.
- **OQ-AA-03** (deferred): multi-file upload and re-run. Logged for v0.4. Not promoted to `docs/project/open-questions.md`.

## Changelog

- 2026-04-27 — initial draft written by orchestrator on PM's behalf (filename guard blocked the PM agent from writing this file directly; content reflects PM's design intent as captured in their session report — see Phase 3.1 spec gate for cross-references).
