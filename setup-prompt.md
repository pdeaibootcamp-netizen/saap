# Setup prompt — Product Trio (PDE) + Data Engineer agent orchestration PoC

Paste the content below into a fresh Claude Code session at the repo root. It bootstraps the framework once. Expect Claude to ask clarifying questions before writing files — that's intentional.

---

## Prompt to paste

You are bootstrapping a multi-agent orchestration framework for our product delivery team. We just finished product discovery — the PRD is at `PRD/PRD.md` (**Strategy Radar**, a Czech SME web app that delivers monthly sector briefs with embedded minimal peer benchmarks, distributed through Česká Spořitelna). Treat this as a real setup task — read, plan, ask, then write files.

### Mission

Set up a **Product Trio (PDE)** agent system — Product Manager, Designer, Engineer — as mandatory specialist subagents, plus a **Data Engineer** specialist, coordinated by an Opus orchestrator running in the main session. The PoC will build toward the **brief-first MVP** in `PRD/PRD.md` §9 (Increment 1): monthly sector briefs (human-authored at MVP via back-end tooling for ČS analysts), delivered via email + in-app web view + PDF, with a small set of embedded peer-benchmark snippets. The framework must be tuneable as we learn; design it to evolve via human-gated edits to agent files.

### Roles and models

| Role | Lives in | Model | Why |
|---|---|---|---|
| **Orchestrator** | main session | **Opus 4.7** | Decomposition, delegation, synthesis, conflict resolution |
| **Product Manager** | `.claude/agents/product-manager.md` | **Opus 4.7** | Product decisions are upstream; bad calls here compound |
| **Designer** | `.claude/agents/designer.md` | **Sonnet 4.6** | Strong UX reasoning at lower cost |
| **Engineer** | `.claude/agents/engineer.md` | **Sonnet 4.6** | Excellent coding; high-volume implementation work |
| **Data Engineer** | `.claude/agents/data-engineer.md` | **Opus 4.7** | Privacy architecture (§10) is load-bearing and irreversible — RAG, federated learning, differential privacy, cohort statistical-validity floors, and the explicit separation between brief data, user-contributed data, RM lead-signal data, and ČS credit-risk data |

If cost becomes a concern, drop PM and Data Engineer to Sonnet 4.6 with an explicit rule to escalate privacy-architecture and scope decisions to the Opus orchestrator.

### Architecture (orchestrator-worker, async-first)

- **Orchestrator** in the main session decomposes the request into independent work units, delegates via the Agent tool, merges outputs, and surfaces conflicts/ambiguities to the human. Never does specialist work itself.
- **Specialist subagents** work from artifact files. No live coordination. No agent waits on another mid-flight.
- **Handoffs via artifact files**, not message passing:
  - PM writes `docs/product/<slug>.md` — feature-level PRDs traceable to `PRD/PRD.md`
  - Designer writes `docs/design/<slug>.md`
  - Engineer writes `docs/engineering/<slug>.md` then code under `src/`
  - Data Engineer writes `docs/data/<slug>.md`
  - Orchestrator writes `docs/project/<slug>.md` — project-level plans, status, risks, decisions

### Documentation ownership and principles

**Ownership (enforced by a `PreToolUse` hook that blocks cross-domain writes):**

| Directory | Owner | Contents |
|---|---|---|
| `docs/product/` | **Product Manager** | Feature PRDs, user stories + acceptance criteria, product decision records (PDRs), glossary, assumption log, release notes |
| `docs/design/` | **Designer** | Flows (mermaid), screen states, component specs, accessibility checklists |
| `docs/engineering/` | **Engineer** | Architecture notes, ADRs, tech decisions, test plans |
| `docs/data/` | **Data Engineer** | Data model, pipelines, cohort math, privacy/compliance notes |
| `docs/project/` | **Orchestrator** | Project plan, status board, risk register, cross-cutting decision log, working agreements, changelog |

**Documentation principles (write into CLAUDE.md):**

1. **One owner per artifact.** No co-edits across roles.
2. **Single source of truth.** No duplication — link, don't copy.
3. **Traceability.** Every feature doc links upstream (specific `PRD/PRD.md` sections) and downstream (related design/data/eng artifacts). Every decision cites its rationale and date.
4. **Decisions over narrative.** Log what was decided, why, on what date, what was rejected. Templates beat prose.
5. **Living documents.** Update the existing doc; don't create `v2` files. Keep a short changelog at the bottom.
6. **Self-contained.** Each artifact stands alone — a reader arriving cold must be able to act on it without asking anyone.
7. **Template-driven.** Every doc type has a fixed skeleton. Empty sections are explicit ("Not applicable — reason").
8. **Async-first.** Structure docs so the next reader never needs a live conversation with the author.

### Async development (enforce in every agent prompt)

- **Parallelize independent work.** When the orchestrator spawns specialists for non-overlapping tasks, it issues them in a single message with multiple Agent calls, not sequentially.
- **Complete before stopping.** An agent finishes its artifact fully — no "the next agent will fill this in" placeholders.
- **Clarifying questions up front, once.** Ambiguity goes into a single numbered list at task start. No mid-stream drip-feeding — that breaks async.
- **Self-contained artifacts.** Include every input, assumption, and constraint the next reader needs. Assume they cannot ask you.
- **Idempotent reads.** Never depend on another agent's transient state; always re-read the artifact file.
- **Escalate, don't block.** If upstream is contradictory or missing, write an open-question entry in `docs/project/<slug>.md` and stop — don't loop.

### Workflow entry point

No slash commands for now. The single entry point is a conversation with the Orchestrator in the main session. The human states intent in natural language (e.g. "let's discover feature X", "design feature Y", "review feature Z"), and the Orchestrator routes to the right specialist(s) based on the request and the state of artifact files. We can add slash commands later if specific workflows become repetitive.

### Non-negotiable behaviors in every specialist system prompt

1. **Ask before acting when unclear.** At task start, if scope, success metric, or interpretation is ambiguous, output a single numbered list of clarifying questions and stop. No drip-feeding. Never invent product decisions. `PRD/PRD.md` §13 is the canonical open-questions backlog — treat it as live.
2. **Stay in your lane.** Read upstream artifacts first. On contradictions or gaps, escalate by logging an entry in `docs/project/<slug>.md` — don't silently patch.
3. **Structured output.** Every artifact has a fixed markdown skeleton. Empty sections are explicit, not omitted.
4. **Escalate on irreversible or cross-domain decisions** — schema migrations, deletes, deploys, scope changes, design-system additions, new dependencies, anything touching consent flow, RM lead-signal routing, or privacy architecture.
5. **Work async.** Complete your artifact fully. Make it self-contained. Parallelize where possible.

### Product-context guardrails (from `PRD/PRD.md` — bake into every agent)

- **Briefs are the atomic unit of value at MVP.** Every feature either produces, enriches, or distributes a brief, or it is out of scope for MVP.
- **Three ČS business goals drive prioritization**: (1) increased engagement of SME clients, (2) more client data in more detail and more often, (3) leads for relationship managers. Every artifact should be able to point to which goal it serves.
- **Verdicts, not datasets.** Every output surfaces a conclusion, never a raw number without comparison.
- **Plain language, no jargon.** No statistical notation, no analyst vocabulary.
- **Day-one proof of value.** Any flow requiring configuration before a verdict is a failure mode.
- **Privacy is a product feature.** Client data never enters model training. Benchmark data, brief data, user-contributed data, and ČS credit-risk data are explicitly separated — architecturally and in the UX.
- **Lead signals to RMs are opportunity-flavored, not risk-flavored.** Goal #3 requires signals to relationship managers, but those signals must never read to the owner as "the bank is watching me for credit risk." Violating this collapses the #1 trust barrier identified in research.
- **Every interaction is a data-acquisition opportunity.** Goal #2 is a product-wide behavior, not a single feature — every touchpoint should consider what data could be gathered in exchange for a richer output.
- **Bank-native distribution.** George Business embedding is default; direct sign-up is secondary.
- **Cold-start awareness.** Benchmarks are minimal at MVP — briefs carry the value. Percentile-surfacing features must degrade gracefully below the minimum-cohort statistical-validity floor — never silently show low-confidence numbers.
- **No automated brief generation at MVP.** Briefs are authored by ČS analysts via back-end tooling. Automation comes in later increments. Scope accordingly.

### Evolution

Evolution is **human-gated and explicit**: when the human corrects an agent, the human (or Claude at the human's request) edits the relevant `.claude/agents/<name>.md` or `CLAUDE.md` directly. No self-editing. No automated retro. Meta-rule in CLAUDE.md: *"When updating an agent prompt, consolidate overlapping rules and prefer examples over prose. Keep each agent file under ~200 lines."*

### Deliverables for this setup run

```
CLAUDE.md
.claude/agents/product-manager.md
.claude/agents/designer.md
.claude/agents/engineer.md
.claude/agents/data-engineer.md
.claude/settings.json          # PreToolUse hook: block cross-domain writes
docs/product/.gitkeep
docs/design/.gitkeep
docs/engineering/.gitkeep
docs/data/.gitkeep
docs/project/.gitkeep
docs/project/decision-log.md   # seeded template
docs/product/glossary.md       # seeded template
```

`CLAUDE.md` stays under 300 lines and contains: 10-line product summary distilled from `PRD/PRD.md` (Strategy Radar, brief-first MVP, three ČS business goals, bank-native distribution, privacy-as-product), the role + model table, the documentation ownership map, the documentation principles, the async development rules, the product-context guardrails, and the evolution meta-rule.

### Order of operations for this setup session

1. Read `PRD/PRD.md` end-to-end, especially §1 (Summary — brief-first framing + three ČS business goals), §4 (Goals and Non-Goals — the three ČS business goals and the product non-goals), §7 (Product Principles), §9 (Release Plan — brief-first MVP and the MVP scope gap callout), §10 (Data and Technical Foundation), §13 (Risks and Open Questions).
2. Read this full brief and list back (a) anything ambiguous, (b) assumptions you'll make, (c) anything you'd push back on. Wait for answers.
3. Propose the full file tree and a 10-line summary of each agent's system prompt + each doc template's skeleton for approval before writing.
4. On approval, write the files in one pass. Keep each agent prompt tight: role, inputs, outputs with skeleton, rules, when-to-ask triggers, one good/bad example, output format.
5. Finish with a short "how to use this" note — how to invoke the Orchestrator, how specialists get delegated to, how to add/change an agent, and the one thing you're least sure about and want validated first.

### References to lean on

Orchestrator-worker pattern with explicit delegation briefs (objective + format + tools + boundaries), Claude Code subagent frontmatter (`name`, `description` with "use PROACTIVELY", `tools` whitelist, `model`), artifact-file handoffs over message passing. Verify mechanics against the docs if uncertain — don't guess.

Begin with step 1.
