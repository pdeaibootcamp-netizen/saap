# Glossary

*Owner: product-manager. Canonical definitions for terms used across Strategy Radar artifacts. Every entry links to its PRD source. When a specialist needs a new term, the PM adds it here first, then everyone links.*

---

### Sector brief
The atomic unit of value at MVP — a monthly, 2–3 page, sector-calibrated, plain-language document closing with 2–4 time-horizon-tagged actions. At MVP, briefs are human-authored by ČS analysts using back-end tooling. Source: [PRD §1](../../PRD/PRD.md#1-summary), [PRD §8.1](../../PRD/PRD.md#81-sector-briefing-engine--what-this-means-for-you-primary-mvp).

### Exposed Owner
Primary persona. Owner/CEO of a 10–100 employee Czech firm, sole strategic decision-maker, triggered into evaluating the product by a specific pain event (margin squeeze, competitor pricing, lost tender, etc.). Must see proof of insight within 14 days or disengages. Source: [PRD §3](../../PRD/PRD.md#3-target-users).

### Bank-Referred Passive Adopter
Secondary persona. Owner or senior manager of a 15–100 employee ČS client who did not actively seek the product — the RM's introduction surfaces the need. Churns fast without a habit anchor; the monthly brief cadence *is* the habit anchor. Source: [PRD §3](../../PRD/PRD.md#3-target-users).

### Cohort (NACE × size × region)
The peer group against which an owner is benchmarked. Segmented by NACE industry code (primary), employee/revenue size band, and Czech geographic region. Source: [PRD §10](../../PRD/PRD.md#10-data-and-technical-foundation).

### Statistical-validity floor
Minimum participant count per cohort cell below which percentiles must not surface silently. When a cell is below the floor, the system emits a degradation signal and the UX shows a plain-language fallback instead of a low-confidence number. Source: [PRD §10](../../PRD/PRD.md#10-data-and-technical-foundation).

### Verdict (vs dataset)
A user-facing conclusion — a named quartile position, a plain-language interpretation, an action. Strategy Radar never shows a raw number without a comparison. "Verdicts, not datasets" is Principle #2. Source: [PRD §7.2](../../PRD/PRD.md#7-product-principles).

### Give-to-get loop
The product-wide behavior in which every meaningful interaction considers what data could be gathered in exchange for a richer output. It is a *design posture* at MVP and a *built feature set* (Additional Customer Information Gatherer) from Increment 3. Source: [PRD §7.8](../../PRD/PRD.md#7-product-principles), [PRD §9 Increment 3](../../PRD/PRD.md#9-release-plan).

### Lead signal (opportunity-flavored)
A signal surfaced to an ČS relationship manager about an existing SME client, framed as a conversational opportunity (e.g., "client positioned in top quartile for growth" → expansion conversation), never as a risk flag. Credit-risk framing is a hard non-goal. Source: [PRD §4 non-goals](../../PRD/PRD.md#4-goals-and-non-goals), [PRD §7.6](../../PRD/PRD.md#7-product-principles), [PRD §10 RM lead signal architecture](../../PRD/PRD.md#10-data-and-technical-foundation).

### George Business
The ČS digital banking platform in which Strategy Radar is embedded as the default distribution surface. Source: [PRD §7.7](../../PRD/PRD.md#7-product-principles), [PRD §11](../../PRD/PRD.md#11-go-to-market).

### RM (Relationship Manager)
A ČS banker responsible for SME client relationships. Plays two roles for Strategy Radar: **distribution** (introducing the product to existing clients) and **consumption** (acting on opportunity-flavored lead signals). RM enablement is a first-class workstream alongside the product itself. Source: [PRD §11](../../PRD/PRD.md#11-go-to-market).

### Data lane
One of four architecturally separate streams of client data in Strategy Radar: (1) **brief lane** — data used to author and render briefs; (2) **user-contributed lane** — data owners actively supply (post-MVP give-to-get); (3) **RM-visible lane** — opportunity-flavored signals surfaced to relationship managers (deferred at MVP per [D-002](../project/decision-log.md)); (4) **credit-risk lane** — ČS's internal credit-risk evaluation data, which Strategy Radar never reads from or writes to. "Architecturally separate" means isolation, not merely access control. Source: [PRD §7.5](../../PRD/PRD.md#7-product-principles), [PRD §10](../../PRD/PRD.md#10-data-and-technical-foundation), [assumption A-015](assumption-log.md).

### Embedded benchmark snippet
The minimal, in-brief comparative element through which peer benchmarks reach the owner at MVP — a named-quartile verdict plus exact percentile for a single metric, rendered inside a brief. Snippets are grouped by the four MVP categories (see below) and degrade silently (not surfaced at all) when the owner's cohort cell is below the statistical-validity floor. There is **no** standalone benchmark dashboard at MVP. Source: [PRD §8.2](../../PRD/PRD.md#82-peer-position-engine-minimal-mvp), [PRD §4 Non-Goals](../../PRD/PRD.md#4-goals-and-non-goals), [mvp-metric-list.md](mvp-metric-list.md).

### MVP metric categories (the four)
The four owner-facing grouping categories that structure embedded benchmark snippets inside a brief (per PRD §9 Category-Based Layout). Czech names are canonical (user-facing per [D-004](../project/decision-log.md)); English names are internal:
1. **Ziskovost** (Profitability) — gross margin, EBITDA margin.
2. **Náklady a produktivita** (Cost structure & productivity) — labor cost ratio, revenue per employee.
3. **Efektivita kapitálu** (Capital efficiency) — working capital cycle, ROCE.
4. **Růst a tržní pozice** (Growth & market position) — revenue growth vs cohort median, pricing power proxy.

Source: [mvp-metric-list.md](mvp-metric-list.md), [D-003](../project/decision-log.md), [PRD §9](../../PRD/PRD.md#9-release-plan).

### Statistical-validity floor suppression (silent-to-user)
When an owner's cohort cell for a given ratio is below the statistical-validity floor, the ratio is **not surfaced at all** in the owner's embedded snippet — the brief is silent on that metric for that user. The system still records the suppression event; silence is directed at the user, not at instrumentation. Source: [assumption A-017](assumption-log.md), [PRD §10](../../PRD/PRD.md#10-data-and-technical-foundation), [PRD §13.5](../../PRD/PRD.md#13-risks-and-open-questions).

### Brief artifact
The versioned, published, delivery-ready object emitted by the Monthly Briefing Generation authoring back-end — distinct from the user-facing concept **Sector brief** (above). A brief artifact has authoring state, publish state, a version counter per ADR-0002-D, and is the input to Multi-Format Delivery. Source: [monthly-briefing-generation.md](monthly-briefing-generation.md), [adr-0002-brief-storage-and-delivery.md](../engineering/adr-0002-brief-storage-and-delivery.md).

### Observation (Strategy Radar)
A templated 2–4-per-brief verdict unit pairing a cohort finding with an owner-actionable frame. Distinct from general English "observation" — in Strategy Radar, an observation has a schema (framing `sector` | `owner_relative`; anchor `ratio` | `narrative`; time-horizon tag) and is subject to the Plain-Language Translation rules. Source: [observation-generation.md](observation-generation.md), [PRD §8.1](../../PRD/PRD.md#81-sector-briefing-engine--what-this-means-for-you-primary-mvp).

### Observation framing (`sector` | `owner_relative`)
A required sub-field on every observation that determines whether it expresses a sector-level finding (always allowable) or an owner-relative positioning (hard-blocked at authoring when the owner's cohort cell is below the statistical-validity floor). Source: [observation-generation.md](observation-generation.md).

### Observation anchor (`ratio` | `narrative`)
A required sub-field on every observation that determines whether it is anchored to one of the eight MVP ratios (`ratio`) or to a sector narrative beyond the ratio set (`narrative`). Source: [observation-generation.md](observation-generation.md), [mvp-metric-list.md](mvp-metric-list.md).

### Time-horizon tag
A required sub-field on every observation and every closing action, drawn from a closed four-value enum: **Okamžitě** / **Do 3 měsíců** / **Do 12 měsíců** / **Více než rok**. Czech labels are user-facing per [D-004](../project/decision-log.md); the enum is shared across `observation-generation.md`, `action-specificity-framing.md`, and [information-architecture.md §2](../design/information-architecture.md). Source: [action-specificity-framing.md](action-specificity-framing.md), [PRD §8.1](../../PRD/PRD.md#81-sector-briefing-engine--what-this-means-for-you-primary-mvp).

### Delivery record
A per-`(brief_artifact, recipient, surface)` audit row written by the Multi-Format Delivery pipeline at publish time, capturing which version was delivered to whom in which surface (email / WebView / PDF) at what timestamp. Used for engagement measurement (PRD §6 G1) and for consent-revocation enforcement (D-012 stop-flow). Source: [multi-format-delivery.md](multi-format-delivery.md), [adr-0002-brief-storage-and-delivery.md](../engineering/adr-0002-brief-storage-and-delivery.md).

---

## How to add an entry

- New term → PM adds it here before it lands in any other artifact.
- Every entry: 1–2 sentence definition + link to the authoritative PRD section.
- If a term is defined in the PRD, link; don't paraphrase.
- Rename or retire carefully — other artifacts likely link here.

## Changelog

- 2026-04-17 — Phase 1 additions: **Data lane**, **Embedded benchmark snippet**, **MVP metric categories (the four)**, **Statistical-validity floor suppression (silent-to-user)** — introduced by `mvp-metric-list.md` and `assumption-log.md`. — product-manager
