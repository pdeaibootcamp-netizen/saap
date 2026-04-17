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

---

## How to add an entry

- New term → PM adds it here before it lands in any other artifact.
- Every entry: 1–2 sentence definition + link to the authoritative PRD section.
- If a term is defined in the PRD, link; don't paraphrase.
- Rename or retire carefully — other artifacts likely link here.
