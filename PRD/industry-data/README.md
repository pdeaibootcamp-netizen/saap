# Industry data — drop your Excel here

This folder is the destination for the industry-data Excel that powers v0.3 cohort percentile computation.

## What to drop

A spreadsheet (`.xlsx` preferred, `.csv` also OK) containing one row per Czech company with at least:

- A NACE code (2-digit division minimum; 4-digit class better)
- An employee count or other size proxy (so we can derive size band)
- Some financial signal columns — anything that maps to one of the 8 frozen Strategy Radar metrics (gross margin, EBITDA margin, labour cost ratio, revenue per employee, working capital cycle, ROCE, revenue growth, pricing-power proxy). It's fine if not every metric is covered — the orchestrator will surface which tiles fall back to fixtures.

Multi-year data is acceptable in either layout — wide (one row per company, columns per year) or long (one row per company-year). The shape is decided after the file is in hand.

## Naming

Suggested: `companies-2026.xlsx`. Any filename works — the orchestrator will rename if needed.

## What happens next

Phase 3.0 of the v0.3 build plan (`docs/project/build-plan.md` §11) is gated on this file landing here. Once the file is in:

1. Orchestrator opens it, reads the column layout, surfaces gaps to the user.
2. Data Engineer authors `docs/data/cohort-ingestion.md` matched to the actual columns.
3. Engineer implements `src/scripts/ingest-industry-data.ts` to upsert into `cohort_companies` (or `cohort_aggregates`).
4. Cohort percentiles for the dashboard tiles start computing from real data.

## Privacy posture

The contents of this folder are committed to the repo. If the data includes anything that should not be public, flag it before pushing — we can `.gitignore` the folder and keep the file local-only. Default assumption is that anonymised industry-level data is public-shareable.
