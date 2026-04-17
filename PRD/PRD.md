# Product Requirements Document — Strategy Radar

*Version 0.3 — 2026-04-17*
*Primary sources: North Star Definition, Roadmap Definition (MVP). Supporting: Synthetic Research, Solution Area Transition, Idea Brainstorming.*

---

## 1. Summary

The **Strategy Radar** is a web application for Czech SME owner-operators that delivers monthly **sector briefs** — plain-language intelligence on the owner's sector, peer cohort, and market environment, ending with 2–4 specific, time-horizon-tagged actions.

Briefs are the atomic unit of value at MVP. Benchmarks exist in a minimal form of a 4-6 key metrics, existing as a standalone dashboard. Over later increments, benchmarking matures into the continuous monitoring instrument described in the North Star.

**Form factor**: web app accessed via browser. Responsive web only at v1 — no native mobile. Monetization is out of scope for v1.

**Who this product serves**. Beyond the SME owner-operator, the product serves three Česká Spořitelna business goals:

1. **Increased engagement** of SME banking clients with ČS.
2. **More client data, in more detail, more often** — feeding richer cohort depth and better personalization.
3. **Leads for relationship managers** — signals surfaced to RMs about existing clients, enabling timely, opportunity-flavored conversations.

These three goals shape the product's success metrics, feature priorities, and GTM design.

---

## 2. Problem Statement

Czech SME owners make pricing, hiring, and capital decisions with no external reference frame. The top three ranked problems from the discovery research:

| Rank | ID  | Problem                                                                                                    | MVP directly addresses?                                                                    |
| ---- | --- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| 1    | H3  | Inability to validate whether internal financial performance represents success or failure                 | Partially (via minimal embedded benchmarks in briefs)                                      |
| 2    | H2  | Pricing negotiations conducted from position of fear rather than market knowledge                          | Partially (via benchmarks and commodity pricing or general market predictions in analyses) |
| 3    | H1  | Strategic decisions made on unvalidated assumptions due to absence of peer operational benchmarks          | **Yes**                                                                                    |
| —    | H13 | External shocks trigger reactive firefighting rather than strategic response due to missing market context | **Yes**                                                                                    |

The MVP targets H1, H2, and H13 directly through the sector brief — a regular, pre-interpreted, forward-looking view that reaches owners before market shifts hit their P&L. H3 and partially H2 (the benchmarking-centric pains) are addressed progressively as benchmarking matures through later increments.

The competitive synthesis confirmed these problems share a root cause: absence of segmented peer intelligence calibrated to Czech SME size, sector, and geography. Every existing competitor (Statista, AlphaSense, D&B, CB Insights, Stripe) serves analysts, investors, or lenders — not SME operators. The SME operator is the whitespace.

---

## 3. Target Users

### Primary: The Exposed Owner
- Owner/CEO of a 10–100 employee Czech firm (manufacturing, trade, transport, business services).
- Sole strategic decision-maker; no dedicated strategy function.
- Triggered by a specific pain event: margin squeeze, competitor pricing pressure, unexplained cost escalation, bank covenant conversation, lost tender.
- Evaluates fast and skeptically. **Must see proof of insight within 14 days** or disengages.
- Core trust barrier: explicit fear that shared financial data feeds back into ČS credit risk decisions.

### Secondary: The Bank-Referred Passive Adopter
- Owner or senior manager of a 15–100 employee ČS client.
- Has not actively sought strategic intelligence tooling. The RM's introduction is what surfaces the need.
- Engages quickly once shown a concrete, relevant brief.
- Churns faster than the Exposed Owner if the product doesn't embed into a repeatable habit (monthly brief cadence is the habit anchor).

### Out of scope for v1
Analysts, investors, lenders evaluating counterparties, enterprises, users expecting raw-data or analyst-level output.

---

## 4. Goals and Non-Goals

### ČS business goals
Three top-level business outcomes drive product prioritization:

1. **Engagement** — increase recurring engagement of SME clients with ČS, with the product acting as a reason to return.
2. **Data depth and cadence** — acquire more client data, in greater detail, more frequently. The product is ČS's primary instrument for sustained SME data contribution.
3. **RM lead generation** — produce signals about existing clients (opportunity-flavored, not risk-flavored) that RMs can act on in proactive outreach.

### Product goals
To deliver the three business goals, the product must:

1. Produce a monthly sector brief that owners open, read, and act on — the habit anchor.
2. Capture new owner-supplied data on every meaningful interaction (give-to-get loop).
3. Surface client-level signals to RMs through a dedicated back-office surface.
4. Deliver a day-one proof-of-insight — the first brief or embedded snippet must make the owner think "I didn't know that" — so activation holds long enough to reach the first full monthly cadence.
5. Ship the four table-stakes features (structured pre-processed output, customizable dashboards, Excel/PDF export, monitoring/alerts) progressively across increments. Pre-processed output is the MVP anchor; the others arrive later.

### Non-Goals
- **No automated brief generation at MVP.** Briefs are authored by ČS analysts using back-end tooling and delivered through the product surface. Automation comes in later increments.
- **No benchmark dashboard as a standalone product at MVP.** Benchmarks exist as minimal comparative snippets embedded in briefs, not as a separate surface.
- **No operational metrics.** The product tracks financial and strategic positioning only. Throughput, utilization, and ops KPIs are out of scope.
- **No raw data dumps.** Every output delivers a verdict or an action.
- **No analyst user.** SME operators are the target.
- **No generic BI tooling.** Free LLMs already commoditize that. The defensible layer is proprietary peer comparison and curated sector intelligence.
- **No pricing / subscription model at v1.** Monetization is a Phase 2 decision.
- **No native mobile app at v1.** Responsive web only.
- **No credit-risk signaling to RMs.** Lead signals are framed as opportunities (e.g., "this client appears ready for a treasury product conversation"), not as risk flags. This is a hard principle — violating it would trigger the #1 trust barrier identified in research.

---

## 5. Metric Taxonomy

Two top-level categories — no operational metrics.

### Financial metrics
Profitability and cost structure ratios derived from P&L and balance sheet signals.
- Gross margin, EBITDA margin, net margin
- Overhead ratio, labor cost ratio
- Working capital cycle, cash conversion
- Capital efficiency (ROCE, asset turnover)

### Strategic metrics
Higher-order indicators of the firm's market position, trajectory, and resilience.
- Revenue growth vs cohort median
- Revenue concentration (customer, sector, geographic)
- Pricing power proxy (margin trajectory vs cohort margin)
- Structural position signals (sector mix shifts, capital intensity trend)

**MVP coverage**: 6–8 metrics spanning both categories, embedded into briefs as supporting comparative snippets. The standalone benchmark dashboard is explicitly post-MVP.

**Open question**: revenue per employee is listed as a candidate in the Roadmap MVP. Ambiguous between financial (revenue ratio) and operational (productivity). Decision during MVP spec.

---

## 6. Success Metrics

Metrics are organized around the three ČS business goals. No revenue or unit-economics metrics at v1.

### Goal 1 — Engagement
- **Monthly brief open rate** (the primary engagement KPI).
- **Time spent per brief** — proxy for whether the content is actually read.
- **Observation engagement** — click-throughs on the 2–4 closing actions; share-to-advisor/accountant rate.
- **Monthly active users** among onboarded SMEs.
- **Return visit rate** — share of users who come back between briefs.
- **Month-3 and month-12 retention** — do clients stay engaged past the first delivery cycle?

### Goal 2 — Data depth and cadence
- **Onboarding data completion** — share of users who complete the initial profile beyond minimum required fields.
- **Post-MVP: supplementary contribution rate** — share of users who respond to in-app data requests (give-to-get loop). (Requires the Additional Customer Information Gatherer feature in Increment 3.)
- **Data recency** — median age of each user's financial data; improves as users log back in and refresh.
- **Cohort depth** — median participant count per (NACE × size × region) cell. Must stay above the statistical-validity floor.
- **Fields-per-user** — distribution of completed profile fields across the user base.

### Goal 3 — RM lead generation
- **Lead signals surfaced per week/month** — raw volume of opportunity-flavored signals delivered to RMs.
- **RM action rate** — share of surfaced signals that an RM acts on (opens a conversation, logs a follow-up).
- **RM-attributed conversion** — share of RM actions that convert into a ČS product conversation or sale.
- **Signal precision feedback** — RMs mark signals as useful / not useful; informs signal tuning.

### Cross-cutting — activation (prerequisite for all three goals)
- **Time to first verdict**: <60 seconds for bank-referred users (pre-loaded brief at first login); <15 minutes for direct sign-ups.
- **Proof-of-insight rate**: share of users whose first brief or snippet surfaces something they rate as surprising and actionable.

---

## 7. Product Principles

1. **Briefs are the atomic unit of value.** Every feature either produces, enriches, or distributes a brief, or it is out of scope. The only exception are the benchmark metrics, which exist by themselves.
2. **Verdicts, not datasets.** Every output delivers a conclusion. Raw numbers without a comparison are a failure, not a feature.
3. **Plain language, no jargon.** No statistical notation. Briefs and alerts should read like something the owner's accountant would say.
4. **Proof of value before anything else.** The first session must produce a verdict. A first-login screen that requires configuration before delivering insight breaks the product's core promise.
5. **Privacy as product.** Client data never enters base-model training. This is a marketed feature — not hidden compliance. The fear that data feeds into credit risk is the #1 trust barrier and must be visibly addressed.
6. **Lead signals are opportunity-flavored, not risk-flavored.** Goal #3 requires surfacing signals to RMs, but those signals must never read to the owner as "the bank is watching me for credit risk." Violating this collapses trust and makes the product unsafe.
7. **Bank-native distribution.** Introduced via ČS relationship managers; embedded in George Business (MVP delivered as a self-contained web app). Onboarding, trust signals, and data consent are designed for that channel first.
8. **Every interaction is a data acquisition opportunity.** Goal #2 means the give-to-get loop is not a feature — it is a product-wide behavior. Every touchpoint should consider what data could be gathered in exchange for a richer output.

---

## 8. Scope — Feature Surfaces

Five surfaces, reordered to reflect the brief-first MVP. The Sector Briefing Engine is the primary surface; the others support or extend it.

### 8.1 Sector Briefing Engine + What-This-Means-For-You (primary, MVP)
Monthly 2–3 page sector briefs calibrated to the owner's sector profile, closing with 2–4 specific, time-horizon-tagged actions. At MVP, briefs are human-authored by ČS analysts using back-end tooling; automation and personalization come later.

### 8.2 Peer Position Engine (minimal, MVP)
Computes a minimal set of percentile positions for the owner against their segmented cohort (NACE × size × region). At MVP, these are embedded inside briefs as comparative snippets — not a standalone dashboard.

### 8.3 RM Lead Signal Surface (MVP scope TBD, likely post-MVP)
A back-office view for ČS relationship managers that surfaces opportunity-flavored signals about their existing SME clients. Derived from the same cohort and brief data that serves the end user. **Not in the Arkana source docs** — introduced in v0.3 to address ČS business goal #3. Scope for MVP to be confirmed.

### 8.4 Shift Detection and Alert System (post-MVP, Increment 2)
Monitors for meaningful changes in relative peer position and issues plain-language alerts. Cause Attribution distinguishes owner-driven from cohort-wide shifts.

### 8.5 Pre-Loaded Benchmark Report + Configurable Metric Dashboard (post-MVP)
The day-one benchmark summary and the persistent customizable dashboard described in the North Star. Both are post-MVP. The day-one value at MVP is delivered by an initial brief (or a pre-loaded snippet), not a dashboard.

---

## 9. Release Plan

### MVP (Increment 1) — First brief
The MVP is brief-centric. The seven features explicitly listed in the Roadmap MVP appear below, plus two features pulled forward from Roadmap Increment 3 (**in bold**) because briefs cannot reach users without them.

- **Sector Profile Configuration** [basic] — industry, size band, geography captured at onboarding; drives brief targeting.
- **Observation Generation** [basic] — 2–4 templated observations per brief.
- **Plain-Language Translation** [basic] — template-guided jargon removal on all outputs.
- **Action Specificity Framing** [basic] — action-verb + context + timeframe template per observation.
- **Percentile Position Calculation** [basic] — monthly batch, 6–8 core financial/strategic ratios. Output is consumed inside briefs, not displayed as a standalone dashboard.
- **Quartile Position Display** [basic] — named quartile position with exact percentile, embedded in briefs.
- **Category-Based Layout** [basic] — four grouping categories for the embedded benchmark snippets.
- **Monthly Briefing Generation** [basic, pulled forward from Increment 3] — back-end tooling enabling ČS analysts to author briefs with sector-calibrated templates and data. Automation is explicitly out of scope; this is a back-end authoring surface at MVP.
- **Multi-Format Delivery** [basic, pulled forward from Increment 3] — briefs delivered via email, in-app web view, and downloadable PDF.

**MVP scope gap — resolve before build.** Percentile calculation needs cohort segmentation matching and a way to ingest owner data (bank pre-processing or manual input) — but the Roadmap places those in Increment 3. Options: (a) add minimal cohort-assignment and data-ingestion features to MVP; (b) pilot with hand-assigned cohorts on pre-populated data; (c) ship MVP briefs with sector-level data only and defer per-user embedded benchmarks to Increment 2. Must be closed before build. Decision: We choose option b - we will use hand assigned cohorts on pre-populated data.

**Open MVP question: RM Lead Signal Surface.** Goal #3 (lead generation for RMs) requires a back-office surface or export mechanism. Scope at MVP TBD — options range from a manual analyst-curated weekly list to a dedicated RM-facing view. Needs to be decided with the RM program team before MVP scope is locked. Decision: We will not include this in the MVP.

### Increment 2 — Continuous Monitoring
Shift from one-time briefs to a living instrument with alerts.
- Peer Cohort Summary Statistics [basic]
- Historical Position Tracking [basic]
- Threshold-Based Drift Detection [basic]
- Plain-Language Alert Generation [basic]
- Alert Delivery Channels [basic] — email + in-dashboard
- Alert History Log [basic]
- Time Window Configuration [basic]
- Display Mode Toggle [basic]
- Cohort Segmentation Matching [advanced]
- Percentile Position Calculation [advanced] — weekly cadence, 12–15 metrics

### Increment 3 — Sector Intelligence Depth and Onboarding
Remaining foundational features and brief quality uplift. (Note: Monthly Briefing Generation [basic] and Multi-Format Delivery [basic] were pulled forward to MVP above.)
- Evidence Linking [basic]
- Additional Customer Information Gatherer [basic] — operationalizes Goal #2 at scale
- Quartile Position Display [advanced]
- Cause Attribution Analysis [basic]
- Bank Data Pre-Processing [basic + advanced]
- Instant Position Summary [basic + advanced]
- Cohort Segmentation Matching [basic]
- Manual Input Fast-Track [basic]
- Proof-of-Insight Highlight [basic]
- Metric Selection and Prioritization [basic]

### Increment 4 — Deep Intelligence and Personalization
LLM-generated brief narratives, multi-metric correlation alerts, multi-year historical view with event annotations, per-metric alert frequency, actionability-weighted proof-of-insight, forward-look identification, urgency calibration, accountant-ready formatting.

### Increment 5 — Predictive Maturity
Scraped market signals, quantitative forward-look impact ranges, Czech/English language support, branded board-ready exports, observation engine personalized against the owner's metric positions and alert history.

### North Star
Near-real-time recalculation across 20+ metrics, predictive percentile projection, full causal decomposition with counterfactual analysis, multi-cohort benchmarking, fully personalized AI-generated briefs, full evidence graph, strategic calendar view.

---

## 10. Data and Technical Foundation

### Data moat
- **Primary asset**: 20,000+ anonymized financial records from ČS business clients. Structurally unreplicable.
- **Give-to-get flywheel**: each participant deepens cohort granularity. Value compounds with scale. This is the mechanism behind Goal #2.
- **Cold-start constraint**: each (NACE × size × region) cell needs a minimum participant count for statistical validity. This is a launch-phase problem as much as a technical one — GTM must seed readiness before the benchmarking feature ships in each cohort.

### Architecture
- **RAG (Retrieval-Augmented Generation)** as the foundational pattern for later-increment brief automation. Combines proprietary benchmarks with client data, prevents hallucinations, keeps client data out of base-model training.
- **Federated Learning + Differential Privacy** for cohort-level computation. Compliant, continuously updated, granular.
- **Client data never enters model training.** Architectural commitment and marketing position — it addresses the top buying barrier.

### Cohort segmentation
- NACE industry code (primary)
- Employee / revenue size band
- Czech geographic region
- Minimum cohort size flag — when below the statistical-validity floor, the system must degrade gracefully (no silent low-confidence percentile).

### RM lead signal architecture
Signals surfaced to RMs must be derived from the same consented data flows that power the user-facing brief and must never reference data that would suggest credit-risk evaluation. Signal types TBD at MVP design — likely candidates include: "client positioned in top quartile for growth in your cohort" (expansion conversation), "client's working capital cycle has lengthened" (treasury/financing conversation), "client has engaged with three briefs on internationalization" (cross-border product conversation). Each signal needs an opportunity framing, not a risk framing.

---

## 11. Go-to-Market

### Primary channel — ČS relationship managers (dual role)
RMs play two roles now:
- **Distribution**: introducing the product to existing SME clients (this is the original channel design — CAC reduction 70–90% vs direct).
- **Consumption**: acting on lead signals generated by the product (Goal #3).

The RM pitch reframes from "see your benchmark position" to "receive a monthly sector brief tailored to your business — at no cost while the platform is in validation." RM enablement (training, scripts, incentives, signal workflow) is a first-class workstream alongside the product itself.

### Secondary channel — direct sign-up
For The Exposed Owner. Acquisition messaging leads with the brief (concrete value, immediate proof), not with "benchmark your business." The 14-day evaluation window still applies — a direct user needs to see one compelling brief before the end of their trial window.

### Positioning
- **Against free LLMs**: generic answers are plausible but context-blind and unvalidated for Czech SME decisions. Lead with the "good enough" LLM adoption risk.
- **Against incumbents (Statista, D&B, CB Insights, AlphaSense, Stripe benchmarks)**: they serve the wrong user. We're filling structural whitespace, not entering a crowded market.

### Monetization
Deferred. The v1 validation target is engagement, data acquisition, and lead flow. Pricing is a Phase 2 decision once the three ČS business goals show traction.

---

## 12. Competitive Positioning and Moat

- **Only product built for the SME operator, not the analyst.**
- **Only product addressing H1 and H13 with a regular sector-brief cadence** aimed at Czech SME owner-operators.
- **Only product with Czech SME peer data** at NACE × size × region granularity (even if minimal at MVP).
- **Dataset, not dashboard.** The UI is replaceable; the data is not.
- **Give-to-get network effect.** Each participant widens the gap. Goal #2 is the explicit strategic driver here.
- **Trust transfer.** Owners share financial data with their bank in a way they would not with an outside vendor. This accelerates the network effect precisely at the cold-start stage where it is most fragile.

---

## 13. Risks and Open Questions

### Top risks
1. **Brief production doesn't scale.** At MVP, briefs are human-authored. Each new sector × size × region combination multiplies author workload. Mitigation: ship briefs for a small number of priority cohorts first; automate in Increment 4–5.
2. **MVP scope gap.** Roadmap MVP lists percentile calculation without cohort matching or data ingestion. Must be resolved before build starts.
3. **Lead generation vs. trust barrier conflict.** Goal #3 (signals to RMs) and the top buying barrier (fear that data feeds into credit risk) are in direct tension. If mishandled, this collapses adoption. Mitigation: opportunity-only signal framing (Principle #6), explicit consent disclosures, clear separation between brief data and credit data, and visible audit trail.
4. **Benchmarks-too-minimal perception.** Competitive synthesis identifies benchmarking as a market-baseline table stake. Shipping with minimal embedded benchmarks may read as incomplete. Mitigation: frame the brief as the product at MVP; position benchmarks as the expanding layer that follows.
5. **Cold-start data insufficiency.** If minimum cohort counts aren't met at launch, even the minimal embedded benchmarks can't ship credibly. Mitigation: stage rollout by cohort-readiness, not calendar date.
6. **"Good enough" LLM problem.** SME owners already ask ChatGPT for business questions. Mitigation: lead with proprietary comparison and a level of sector-brief specificity no LLM can produce from public data alone.
7. **RM enablement failure.** The Bank-Referred segment and Goal #3 both depend on trained, incentivized RMs. If the RM program underperforms, both the volume channel and the lead-generation goal collapse.
8. **Bank-referred cohort churn.** This segment churns fast if the product doesn't embed into an existing habit within weeks. Monthly brief cadence is the habit anchor — without it, retention fails.

### Open questions
- Exact MVP metric list across the financial and strategic categories.
- Revenue per employee — include (financial ratio framing) or exclude (operational)?
- Czech / English language scope at MVP — Czech only, or both?
- MVP pilot model — hand-assigned cohorts on pre-populated data, or full onboarding flow?
- Brief cadence — monthly confirmed, or is there value in an event-triggered ad-hoc brief at MVP?
- Brief personalization — one brief per sector at MVP, or sub-segmented by size/geography?
- RM Lead Signal Surface scope at MVP — manual curated list, dedicated RM view, or export feed?
- What lead signal types ship at MVP, and who defines them?
- Consent UX for data flowing to RMs — what disclosure, where does the user see it, what can they revoke?
- Accountant / advisor roles — shared access at MVP or later?
- Bank data consent flow in George Business — disclosures and revocation rules.

---

## 14. Appendix — Source Documents

**Primary**
- [North Star Definition](arkana-saap-i-north-star-definition-2026-04-17.md) — product vision and five capability surfaces.
- [Roadmap Definition](arkana-saap-i-roadmap-definition-2026-04-17.md) — MVP → North Star increment mapping.

**Supporting**
- [Synthetic Research](arkana-saap-i-synthetic-research-2026-04-17.md) — persona interviews, hypothesis ranking.
- [Solution Area Transition](arkana-saap-i-solution-area-transition-2026-04-17.md) — confirmed problems, market standards, competitive gaps.
- [Idea Brainstorming](arkana-saap-i-idea-brainstorming-2026-04-17.md) — Strategy Radar concept.

**Note on scope beyond source docs**: The RM Lead Signal Surface (§8.3) and the three ČS business goals in §1, §4, and §6 are stakeholder inputs added in v0.3, not found in the Arkana source documents.
