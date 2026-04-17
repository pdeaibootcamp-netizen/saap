# Backlog

*Owner: orchestrator. Purpose: deferred items, post-MVP work, and cross-session continuity context for the multi-agent framework. Every specialist reads this at the start of any task (per [CLAUDE.md](../../CLAUDE.md) async rules).*

## How to use

- Append items; never silently delete. If an item is closed, move it to **Closed items** with date + outcome.
- Each item names: ID, date added, source (who flagged it), deferred-from (if from a named phase/decision), constraint (any rule future work must respect), trigger (what reopens it), status.
- Orchestrator reviews this at the start of every session and includes relevant items in each delegation brief.
- Specialists reading this at task start: if your task touches an open item, either resolve it (with orchestrator agreement) or flag in [open-questions.md](open-questions.md) — don't silently reinterpret the deferral.

## Open items

### B-001 — Brief cadence commitment to users
- **Added:** 2026-04-17
- **Source:** user (Q0.4 deferral during Phase 0 scope lock; see [D-005](decision-log.md))
- **Deferred from:** Phase 0 open-question Q0.4 — monthly vs. pre-loaded set vs. ad-hoc publishing with no cadence promise
- **Constraint from user:** "This is just an MVP to work for less than a month, so no need to deal with this now." MVP is a time-boxed trial; no cadence commitment to end-users is required during the trial window.
- **Trigger to reopen:** MVP extends past the initial trial window, OR post-MVP planning begins, OR any feature work implies a cadence promise to users (e.g., subscription UI, "next brief on X" copy).
- **Status:** deferred

### B-002 — Accountant/advisor brief sharing
- **Added:** 2026-04-17
- **Source:** user (Q0.7 deferral during Phase 0 scope lock; see [D-009](decision-log.md))
- **Deferred from:** Phase 0 open-question Q0.7 — PDF forwarding only vs. read-only share link vs. named advisor seat
- **Constraint from user:** same trial-duration rationale as B-001. During MVP trial, owners may forward the PDF manually if they wish (§9 Multi-Format Delivery still ships); no in-product sharing infrastructure is built.
- **Trigger to reopen:** MVP extends past the trial window, OR §6 "share-to-advisor/accountant rate" engagement metric becomes a measurement requirement, OR give-to-get plumbing (Increment 3 per CLAUDE.md guardrail) enters planning.
- **Status:** deferred

## Closed items

*(none yet)*

## Changelog
- 2026-04-17 — file created; B-001 logged.
- 2026-04-17 — B-002 logged (Q0.7 deferral).
