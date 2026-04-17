# Open Questions — Cross-Agent Escalations

*Owner: orchestrator. This file tracks questions raised by specialists mid-task that block them or require a cross-domain decision. For product-level open questions owned by the PRD, see `PRD/PRD.md` §13.*

| Date raised | ID | Question | Raised by | Blocking what | Status |
|---|---|---|---|---|---|
| — | — | *(none yet)* | — | — | — |

## How specialists add an entry

- Add a row with the next `Q-NNN` ID.
- **Raised by**: agent name (`product-manager`, `designer`, `engineer`, `data-engineer`).
- **Blocking what**: the specific artifact or task that cannot complete without resolution.
- **Status**: `open` when added; the orchestrator updates to `resolved — see D-NNN` (pointing at a decision-log row) or `deferred — <reason>`.

## How the orchestrator resolves

1. Read the blocked artifact and the upstream PRD context.
2. Either (a) resolve directly and add a row to `decision-log.md` with the matching `D-NNN`, or (b) escalate to the human.
3. Update the `Status` column in this file. Never delete rows — resolved questions stay as an audit trail.
