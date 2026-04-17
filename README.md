# Strategy Radar — saap

Monthly plain-language sector briefs for Czech SME owner-operators, authored by Česká Spořitelna analysts. Distribution: email + in-app web view + PDF, primarily via George Business embedding. Product spec: [PRD/PRD.md](PRD/PRD.md).

## Entry points for contributors and Claude sessions

Read in this order when opening the repo cold:

1. **[CLAUDE.md](CLAUDE.md)** — how the multi-agent framework works: roles (orchestrator + 4 specialists), documentation ownership, async rules, orchestrator rules, product guardrails. Always read first.
2. **[PRD/PRD.md](PRD/PRD.md)** — product requirements, three ČS business goals, MVP vs. later increments, risks and open questions.
3. **[docs/project/build-plan.md](docs/project/build-plan.md)** — phased build status (Phase 0 / 1 / 2 / 3 / 4), what's next, which track and owner. Check the changelog at the bottom to see where we are.
4. **[docs/project/decision-log.md](docs/project/decision-log.md)** — cross-cutting decisions (D-NNN), chronological, append-only.
5. **[docs/project/open-questions.md](docs/project/open-questions.md)** — unresolved cross-domain questions (OQ-NNN).
6. **[docs/project/backlog.md](docs/project/backlog.md)** — deferred items and cross-session continuity notes (B-NNN).

Specialist-owned doc lanes live under `docs/product/`, `docs/design/`, `docs/engineering/`, `docs/data/`; see the ownership table in [CLAUDE.md](CLAUDE.md). Write-lane enforcement is implemented by `.claude/hooks/enforce-write-lanes.sh`.
