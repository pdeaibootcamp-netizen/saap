# Decision Log

*Owner: orchestrator. Cross-cutting decisions only — single-domain decisions live in the owning specialist's artifact (e.g., ADRs in `docs/engineering/`, PDRs in `docs/product/`).*

| Date | ID | Decision | Rationale | Rejected alternatives | Author |
|---|---|---|---|---|---|
| 2026-04-17 | D-001 | MVP will use hand-assigned cohorts on pre-populated data. | Closes the MVP scope gap called out in PRD §9: percentile calculation needs cohort segmentation matching and owner data ingestion, but both are scheduled for Increment 3. Hand-assignment on pre-populated data keeps embedded benchmark value in MVP without pulling full onboarding + data-ingestion forward. | (a) Pull cohort-assignment and data-ingestion features into MVP — inflates scope and delays the first brief; (c) Ship MVP briefs with sector-level data only and defer per-user embedded benchmarks to Increment 2 — weakens day-one proof of value. | orchestrator |
| 2026-04-17 | D-002 | No RM Lead Signal Surface at MVP. | PRD §8.3 and §9 list this as an open question. The RM program, consent UX, and opportunity-framing rules aren't ready; shipping a lead surface prematurely risks triggering the #1 trust barrier (fear that data feeds ČS credit risk — PRD §3, §13.3). Goal #3 (RM lead generation) is deferred one increment rather than compromised. | Manual analyst-curated weekly list; dedicated RM-facing view in George; export feed into existing RM tooling — all require consent UX and signal-framing work we haven't completed. | orchestrator |

## How to add an entry

1. Use the next sequential `D-NNN` ID.
2. Keep **Decision** to one sentence.
3. **Rationale** cites PRD sections, principles, or upstream decisions — not opinion.
4. **Rejected alternatives** names each and why — never leave blank; write "None considered — reason" if so.
5. Append only; never edit past rows. If a decision is reversed, add a new row referencing the old ID.
