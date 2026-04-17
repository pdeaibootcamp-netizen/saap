# Bootstrap the SAAP Agent Orchestration Framework (v2)

*Draft v2 — 2026-04-17*
*Intended use: paste into a fresh Claude Code session opened in this repository.*

---

You are setting up the agent orchestration framework for the **Strategic Position Dashboard (SAAP)** in this repository. The canonical source of truth is `PRD/PRD.md`. **Read it in full before acting.** Treat the PRD as a living document: every task re-reads it, and changes propagate through the PRD-iteration protocol.

## Context

- **Repository**: this repo (`saap`), currently minimal
- **Product**: Czech SME peer-benchmarking SaaS, distributed via Česká Spořitelna
- **Frontend**: React is presumed
- **Backend / data / infra**: the `engineer-backend` + `product-manager` agents produce `docs/architecture/adr-001-stack-selection.md`. User approval required before stack scaffolding.
- **Team**: multi-developer, GitHub PR workflow
- **Scope**: development only — GTM / RM enablement is out of scope

## Two-dimensional agent model

Every unit of work has **two owners**:

- A **feature agent** — owns a PRD capability end-to-end and tracks it across increments.
- A **role agent** — executes a slice of that feature (design, frontend, backend, data, ML, review).

Feature agents decompose work and delegate to role agents. Role agents build. Reviewers gate merges.

## Role agents (`.claude/agents/roles/`)

**Product Trio (primary):**
- `product-manager.md` — PRD interpretation, increment scope enforcement, feature prioritization, open-question tracking, PRD changelog, partial stack-decision ownership
- `product-designer.md` — UX flows, plain-language copy, enforces "verdicts not datasets", owns the design-system spec
- `engineer-frontend.md` — React, component architecture, accessibility, George Business embedding compatibility
- `engineer-backend.md` — APIs, services, business logic, **primary stack selector** (proposes ADR-001)
- `engineer-data.md` — cohort segmentation, percentile math, NACE taxonomy, benchmark pipelines
- `engineer-ml.md` — RAG, federated learning implementation, differential-privacy mechanics

**Reviewers and cross-cutting:**
- `privacy-specialist.md` — architectural enforcement of DP + FL, credit-risk data separation, consent and revocation flows (a marketed feature per PRD §6.5, not a compliance afterthought)
- `prd-reviewer.md` — blocks PRs that violate product principles or drift across increment boundaries
- `qa.md` — test strategy, synthetic-persona testing, regression coverage, alert signal-to-noise metrics
- `security-reviewer.md` — OWASP, GDPR, consent-flow correctness
- `orchestrator.md` — planner; decomposes increments → features → tasks; assigns to feature + role agents; monitors parallelism constraints

Each file uses Claude Code subagent format (frontmatter with `name`, `description`, `tools`; body covering role, authority boundaries, inputs/outputs, collaboration protocol).

## Feature agents (`.claude/agents/features/`)

Each owns one PRD capability end-to-end across all increments. Each agent definition lists: responsibility, MVP scope, later-increment scope, inputs, outputs, upstream + downstream feature dependencies, and which role agents it typically delegates to.

### F1. `feature-data-pipeline.md`
**Owns**: ingestion (ČS transaction data + Manual Input Fast-Track), normalization, cohort segmentation storage.
**MVP**: rule-based transaction categorization; <15 min fast-track form; NACE × size × region segmentation; minimum-cohort-size flag.
**Inputs**: raw ČS data (consented), manual inputs. **Outputs**: cleaned segmented data, cohort validity flags.
**Dependencies**: blocks F2, F4. Gated by F6 for write paths.
**Typical delegates**: engineer-data, engineer-backend.

### F2. `feature-benchmarking-engine.md`
**Owns**: percentile + quartile position calculation, peer cohort summary stats, historical series.
**MVP**: monthly batch, 6–8 ratios, rolling 2–4 quarters. **Increment 2**: weekly, 12–15 metrics. Architected for near-real-time at North Star.
**Consumes**: F1's cohort validity flag — degrades gracefully below the statistical-validity floor (never silent low-confidence percentiles).
**Outputs**: percentile/quartile scores per metric, cohort summary (median, IQR, top-decile), historical series.
**Dependencies**: requires F1 + F6 stable. Feeds F3, F4.
**Typical delegates**: engineer-data, engineer-backend, engineer-ml (later increments).

### F3. `feature-alerts-monitoring.md`
**Owns**: drift detection, cause attribution, alert generation and delivery, alert history.
**MVP**: ±10 percentile-point threshold over rolling 2 quarters; templated copy; email + in-dashboard. **Increment 2**: cause attribution (owner-side vs cohort-side — the feature that converts alerts from noise to signal). **Increment 4**: LLM-generated narratives, mobile push.
**Copy test**: every alert must sound like the owner's accountant, not a research report.
**Dependencies**: listens to F2. Surfaces in F5. Enriched by F4 at Increment 4.
**Typical delegates**: engineer-backend, product-designer, engineer-ml (Increment 4+).

### F4. `feature-reports-briefings.md`
**Owns**: Pre-Loaded Benchmark Report + monthly Sector Briefing Engine.
**Pre-Loaded Report (MVP)**: one-page Instant Position Summary, 4–6 metrics, plain-language verdict per metric, Proof-of-Insight Highlight. Bank-referred: generated before first login, delivered <60 s. Direct sign-up: generated in session with fast-track.
**Monthly Briefing (Increment 3+)**: 2–3 pages, 2–4 numbered observations with action-verb + time-horizon tags + evidence links; email/web/PDF; Czech-only MVP, Czech/English from Increment 5; accountant-ready formatting.
**Dependencies**: F2 (benchmarks), F1 (owner metrics), F5 (renders), F3 (briefing context enriches alerts).
**Typical delegates**: engineer-backend, product-designer, engineer-ml (briefing generation).

### F5. `feature-dashboard-ui.md`
**Owns**: configurable metric dashboard — the daily-use surface; onboarding flow; give-to-get UX surface; in-dashboard alert surface.
**MVP**: four fixed categories (financial performance, cost structure, revenue dynamics, structural indicators); metric selection + reordering; quartile color-coded display; time-window presets; percentile/quartile toggle; 5 saved view profiles.
**Embedding**: components must work both inside George Business and as standalone web for direct sign-ups.
**Dependencies**: renders F2, F3, F4. Owns consent UI content provided by F6.
**Typical delegates**: engineer-frontend, product-designer.

### F6. `feature-privacy-compliance.md`
**Owns**: RAG pattern enforcement, federated learning + differential privacy wrapper for cohort computation, consent flow, data revocation.
**Hard invariant**: no client data enters base-model training, ever. Explicit, auditable separation from ČS credit-risk data.
**MVP**: consent flow + revocation API + DP wrapper around cohort computation + plain-language privacy disclosure.
**Dependencies**: gates F1 writes; wraps F2 computation; provides F5 with consent UI content; cross-cutting audit role over all features.
**Typical delegates**: privacy-specialist, engineer-backend, engineer-ml, security-reviewer.

## Orchestrator operating rules

1. **PRD is the arbiter.** When any output conflicts with the PRD, halt the workstream and open a GitHub discussion issue rather than silently deviating.
2. **MVP scope is a hard boundary.** No Increment 2+ feature implementation until MVP exit criteria (PRD §9) are met. Design for extensibility; do not implement prematurely.
3. **Plain language is a test, not a principle.** Before shipping any user-facing copy, run the accountant test: would the owner's accountant say this? If not, rewrite. `product-designer` owns this test.
4. **Cold-start is a launch constraint.** F2 must never expose percentiles below the statistical-validity floor. F1 + F2 + F5 coordinate the graceful-degradation UX before any benchmark surface ships.
5. **Parallelism strategy**:
   - **Wave 1 (blocking)**: F1 + F6 stabilize schema and consent architecture.
   - **Wave 2**: F2 and F4 begin implementation once Wave 1 is stable. F5 scaffolds components in parallel but does not wire live data.
   - **Wave 3**: F3 layers on once F2 is emitting stable position data. F5 wires live data.
6. **Open questions (PRD §13)** are blockers for specific features, not the overall build. Surface each to the relevant feature agent when that agent's work depends on it; escalate for human resolution rather than assuming.
7. **Feature + role co-ownership**: every task has one feature owner and one role executor. PRs reference both.

## Claude Code artifacts

### `CLAUDE.md` at repo root
- Points to `PRD/PRD.md`
- Encodes the seven product principles from PRD §6 as hard guardrails
- Increment discipline rule
- Agent routing: "If the task is about capability X, start with feature agent F<n>. If it's cross-cutting, start with the orchestrator."

### Slash commands in `.claude/commands/`
- `/plan-increment <n>` — orchestrator decomposes an increment into feature → task tree, honoring Wave 1/2/3 parallelism
- `/check-prd-alignment` — PRD reviewer audits current branch against product principles + increment scope
- `/new-feature` — PM + Designer + feature agent kickoff
- `/persona-test <flow>` — runs a flow against the synthetic persona's test data; QA reports
- `/prd-diff` — summarizes changes since `docs/prd-changelog.md` last checkpoint; orchestrator dispatches impact to affected feature agents
- `/accountant-test` — runs the plain-language test on staged copy

### Hooks in `.claude/settings.json`
- **Pre-commit**: reminder to run `/check-prd-alignment` when staged files touch `features/` or UI copy
- **Stop**: prompts to log handoff note if multiple agents collaborated
- **PostToolUse on Write/Edit in `features/`**: reminds author to update the owning feature agent's `spec.md`

## Synthetic client persona

At `docs/personas/synthetic-client-01/`:
- `profile.md` — fleshed-out "Exposed Owner" (PRD §3): Czech company name, NACE code, region (e.g. Moravia), size band, revenue, headcount, cost structure, specific pain-event trigger (e.g. lost tender, margin compression)
- `financials.csv` — 8 quarters of synthetic financials spanning the four metric categories in PRD §10
- `peer-cohort.csv` — 20 synthetic peer companies with correlated-but-distinct metrics; positions the persona at a non-trivial percentile (e.g. 28th on gross margin, 73rd on revenue-per-employee) so tests yield meaningful verdicts
- `test-scenarios.md` — expected outputs for: first-login verdict, Proof-of-Insight Highlight, a drift-alert trigger, monthly briefing observations

QA agent owns persona data; every feature agent writes persona-based test scenarios into its spec.

## PRD iteration protocol

At `docs/prd-iteration.md`:
- PRD is versioned via git; agents always read current `PRD/PRD.md` at task start
- When a task conflicts with the PRD, owning feature agent opens a GitHub discussion issue
- Extensions/interpretations of PRD → ADR in `docs/architecture/`
- PM agent maintains `docs/prd-changelog.md` — one-line note per PRD version, with list of affected feature agents
- `/prd-diff` dispatches change impact to those agents

## Multi-developer workflow

At `docs/workflow.md`:
- Branch naming: `<feature-id>/<role>-<slug>` (e.g. `f2/engineer-data-percentile-math`)
- PR template (`.github/pull_request_template.md`): feature + role owners, increment, principles checklist, persona-test results, PRD-alignment confirmation
- Parallel work: orchestrator assigns non-conflicting tasks respecting Wave 1/2/3
- Handoff notes: `docs/handoffs/<YYYY-MM-DD>-<from>-<to>.md`

## Project scaffolding

- `features/<feature-id>-<slug>/` — `design.md`, `spec.md`, implementation, tests (one dir per F1–F6)
- `docs/architecture/` — ADRs, system diagrams
- `docs/personas/` — synthetic personas
- `docs/handoffs/` — handoff notes
- First deliverable: `docs/architecture/adr-001-stack-selection.md` (proposal, flagged for user approval before code scaffolding)

## Hard constraints (encoded as guardrails)

1. **Verdicts, not datasets** — every user-facing output delivers a conclusion. `product-designer` + `prd-reviewer` enforce.
2. **Plain language** — no statistical notation in UI copy. Accountant test. `product-designer` owns.
3. **Increment discipline** — no Increment 2+ features during MVP. `prd-reviewer` blocks.
4. **Privacy as product feature** — client data never enters model training. `privacy-specialist` owns architectural enforcement; F6 gates writes.
5. **Cold-start degradation** — never expose percentiles below the statistical-validity floor.
6. **PRD is living** — every task re-reads `PRD/PRD.md`. No agent hard-codes PRD assumptions.

## Bootstrap workflow

1. Read `PRD/PRD.md` in full.
2. Produce a plan: file layout + one-line agent descriptions (role + feature) + which first-wave ADRs you'll open. **Wait for user approval.**
3. On approval, scaffold all files.
4. Generate the synthetic persona and its test data.
5. Open a PR titled **"Bootstrap agent orchestration framework v2"** summarizing what was built, open questions, and proposed next increment (likely: start MVP Wave 1 on F1 + F6).

Begin with step 1.
