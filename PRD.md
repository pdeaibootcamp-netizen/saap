# Product Requirements Document — Strategic Position Dashboard (SAAP)

*Version 0.1 — 2026-04-17*
*Source: Arkana discovery docs (synthetic research, solution area transition, idea brainstorming, north star, roadmap)*

---

## 1. Summary

The **Strategic Position Dashboard** is a subscription SaaS for Czech SME owner-operators that continuously tracks their financial and operational metrics against a segmented peer cohort (industry × size × geography) and alerts them in plain language whenever their relative position shifts in a way that warrants attention.

It converts isolated numbers ("12% gross margin") into comparative verdicts ("28th percentile of professional services firms with 10–50 employees in Moravia — and falling"). It is distributed through Česká Spořitelna's (ČS) business banking channel and priced at **€4–6k/year** annual subscription.

The single unfair advantage is ČS's proprietary dataset of 20,000+ anonymized SME clients — a structurally unreplicable data asset that every external competitor lacks.

---

## 2. Problem Statement

Czech SME owners make pricing, hiring, and capital allocation decisions with no external reference frame. Internal numbers are treated as absolutes when they can only be interpreted comparatively. The discovery research confirmed five primary pain points, ranked by problem score:

| Rank | ID | Problem | Score |
|------|----|---------|-------|
| 1 | H3 | Inability to validate whether internal financial performance represents success or failure | 19 |
| 2 | H2 | Pricing negotiations conducted from position of fear rather than market knowledge | 18 |
| 3 | H1 | Strategic decisions made on unvalidated assumptions due to absence of peer operational benchmarks | 14 |
| 4 | H4 | Competitive intelligence gathering consumes disproportionate time while producing minimal actionable insight | 13 |
| 5 | H13 | External shocks trigger reactive firefighting rather than strategic response due to missing market context | 9 |

**Root cause** — identified in the competitive synthesis — is a single absent capability: segmented peer benchmarking calibrated to Czech SME size, sector, and geography. Every existing market tool (Statista, AlphaSense, D&B, CB Insights, Stripe) serves analysts, investors, or lenders — not SME operators. H3 is completely unaddressed by any competitor.

The three highest-priority problems (H1, H2, H3) share this same root. A single core capability — continuous peer benchmarking — resolves them simultaneously.

---

## 3. Target Users

### Primary: The Exposed Owner (Beachhead)
- Owner/CEO of a 10–100 employee Czech firm in manufacturing, trade, transport, or business services.
- Sole strategic decision-maker; no strategy function on payroll.
- Triggered by a specific pain event: margin squeeze, competitor pricing pressure, unexplained cost escalation, bank covenant conversation, tender loss.
- Evaluates fast and skeptically; **requires proof of insight within 14 days** or churns.
- €4–6k is within unilateral budget authority.
- Primary buying barrier: benchmark credibility and fear that shared data feeds back into ČS credit decisions.

### Secondary: The Bank-Referred Passive Adopter (Volume)
- Owner or senior manager of a 15–100 employee ČS client.
- Has not actively sought strategic intelligence tooling; does not recognize the need as a defined problem. The RM conversation is the trigger.
- Converts in 1–3 weeks once shown a concrete relevant output.
- Lower price sensitivity due to implicit bank endorsement.
- **Churns faster than the Exposed Owner if the product doesn't embed into an existing habit.**
- Segment existence depends entirely on RM training, incentivization, and enablement — fundamentally an internal bank sales enablement challenge, not a marketing one.

### Out of scope (for v1)
Enterprises, financial analysts, investors, lenders evaluating counterparties, and any use case requiring analyst-level interpretation of raw data.

---

## 4. Goals and Non-Goals

### Goals
1. Deliver a day-one comparative verdict on the owner's financial position before they take any action in the product (pre-loaded benchmark report at first login).
2. Maintain a persistent, living view of the owner's percentile position across 6–15 core metrics, updated on a regular cadence.
3. Detect meaningful drifts in relative position and deliver plain-language alerts that distinguish owner-driven movement from cohort-wide shifts.
4. Seed and sustain a "give-to-get" data network effect: each new participant widens the moat.
5. Hit all four table-stakes features at launch: pre-processed output, customizable dashboards, data export (Excel/PDF), monitoring/alerts.
6. Reduce customer acquisition cost by 70–90% vs direct B2B SaaS by leveraging the ČS banking channel.

### Non-Goals
- Do not provide raw data dumps. Every output is a verdict, not a dataset.
- Do not serve analysts, investors, or credit risk users.
- Do not rely on public-information synthesis (SEC filings, earnings calls) — Czech SMEs generate none of these signals. The data moat is proprietary, not scraped.
- Do not build generic BI or dashboarding. Free LLMs already commoditize generic business intelligence; the only defensible layer is proprietary comparison.
- No analyst-style vocabulary. Plain-language framing is non-negotiable.

---

## 5. Success Metrics

### Activation
- **Time to first verdict**: <60 seconds for bank-referred users (pre-loaded report at first login); <15 minutes for direct sign-ups via manual input fast-track.
- **Proof-of-insight rate**: % of users whose first-session summary surfaces a metric position they rate as surprising and actionable. Target: ≥60%.

### Engagement
- Weekly active use of dashboard among paid subscribers.
- Alert acknowledgement rate (proxy for signal quality — too low = noise; too high = unsurprising).
- Number of metrics the owner chooses to pin to their primary view (proxy for perceived relevance).

### Retention
- 14-day trial → paid conversion rate for The Exposed Owner.
- Month-12 retention for bank-referred cohort.
- Churn reason attribution — distinguish product failure from life-event churn.

### Network effect
- % of users who contribute supplementary data beyond onboarding minimum (validates the give-to-get loop).
- Cohort depth: median participant count per (NACE × size × region) cell. Target: above the statistical-validity floor for differential privacy.

### Unit economics
- CAC via ČS channel vs direct. Target: 70–90% reduction.
- Gross margin per subscriber at €4–6k ARR.

---

## 6. Product Principles

1. **Verdicts, not datasets.** Every output — dashboard cell, alert, briefing, observation — delivers a conclusion. The SME operator has no analyst capacity. A raw number without a comparison is a failure.
2. **Comparative by default.** The owner never reads their data in a vacuum. Percentile, quartile, or named-position framing is always present.
3. **Plain-language, no jargon.** No statistical notation. No "standard deviation." No "beta." Alerts read like something the owner's accountant would say, not a research report.
4. **Proof of value before commitment.** Day-one pre-loaded report. The first session must produce a "I didn't know that" moment or the user is gone.
5. **Privacy as product feature.** Client data never enters model training. Privacy-preserving architecture (RAG + federated learning + differential privacy) is a marketing asset, not only a compliance checkbox — the explicit fear that data feeds into credit risk is a top buying barrier.
6. **Bank-native distribution.** The product lives inside George Business and is introduced by RMs. Everything — onboarding, trust signals, data consent flow — is optimized for that channel before direct-to-SME flows.
7. **Table-stakes are non-negotiable.** Structured output, customizable dashboards, Excel/PDF export, and alerts ship at launch. Missing any of the four causes the product to read as unfinished, regardless of benchmark quality.

---

## 7. Scope — Feature Overview

Five major surfaces, each with MVP and later-increment scope. Detailed increment mapping is in §9 (Release Plan).

### 7.1 Peer Position Engine
Continuously calculates and maintains the owner's percentile position across 6–15 financial and operational metrics against a segmented peer cohort.

- Cohort Segmentation Matching (NACE × size band × Czech region; minimum-participant flag for statistical validity).
- Percentile Position Calculation (MVP: monthly batch, 6–8 ratios → later: weekly → north star: near-real-time, 20+ metrics with predictive projection).
- Quartile Position Display with color-coded visual.
- Peer Cohort Summary Statistics (median, IQR, top-decile threshold; later: cohort trend over time).
- Historical Position Tracking (rolling time series, 2–4 quarters → later: multi-year with event annotations).
- Additional Customer Information Gatherer (prompts owner for highest-value missing data point in exchange for richer benchmarks — the give-to-get loop's UX surface).

### 7.2 Shift Detection and Alert System
Monitors for meaningful changes in relative peer position and delivers plain-language alerts.

- Threshold-Based Drift Detection (default ±10 percentile points over rolling two-quarter window; later: configurable per metric, rate-of-change detection, multi-metric correlation).
- Cause Attribution Analysis — distinguishes owner-driven shifts from cohort-wide shifts. **This is the feature that converts alerts from noise into signal.**
- Plain-Language Alert Generation (MVP: templated; later: LLM-generated with business context).
- Alert Delivery Channels (email + in-dashboard → later: mobile push, SMS for critical, calendar-aware timing).
- Alert History Log with chronological review; later: filtering, outcome tracking, acknowledgement state.

### 7.3 Pre-Loaded Benchmark Report
Day-one comparative positioning, ready at first login. This is the single most important feature for conversion of both segments.

- Bank Data Pre-Processing — ingests consented ČS transaction data, derives revenue/cost/margin proxies via rule-based categorization (MVP) → ML-based categorization >95% accuracy (north star).
- Manual Input Fast-Track — structured form, <15 min (MVP) → <5 min with registry pre-fill and statement OCR (north star).
- Instant Position Summary — one-page summary on 4–6 core metrics with plain-language verdict per metric (MVP) → multi-page with narrative interpretation, trajectory, predictive next-quarter positioning (north star).
- Proof-of-Insight Highlight — surfaces the single most divergent metric as lead insight; later: weights both magnitude and owner's ability to influence.

### 7.4 Configurable Metric Dashboard
The daily-use surface. Every other feature feeds into or is accessed from here.

- Metric Selection and Prioritization (pre-set defaults per cohort; owner reorders).
- Time Window Configuration (presets → custom ranges, comparison windows, fiscal year alignment).
- Display Mode Toggle (percentile / quartile → + trend chart → full visualization suite).
- Category-Based Layout (four fixed categories: financial performance, cost structure, revenue dynamics, structural indicators → custom categories, correlation highlights).
- Saved View Profiles (up to 5 profiles → unlimited with scheduling, sharing, cohort-templated configurations).

### 7.5 Sector Briefing Engine + What-This-Means-For-You
Monthly 2–3 page sector briefings calibrated to the owner's sector profile, closing with 2–4 specific, time-horizon-tagged action observations.

- Sector Profile Configuration — captured at onboarding; later: autonomous refinement from actual metric patterns.
- Monthly Briefing Generation — assembled from ČS sector research + public regulatory monitoring (MVP with human review) → scraped market signals + personalization (north star).
- Forward-Look Identification — 2–3 developments most likely to affect the owner's cost base, pricing, or competitive position over next 2 quarters; qualitative impact magnitude (MVP) → ML-scored with quantitative ranges (north star).
- Plain-Language Translation (template-guided → LLM with reading-level calibration, Czech/English).
- Multi-Format Delivery — email, web view, PDF → + branded board-ready export, shareable advisor link.
- Observation Generation (2–4 numbered observations per briefing, template-based → LLM-driven with cross-briefing continuity).
- Action Specificity Framing — action-verb + context + timeframe structure; later: with estimated financial impact ranges.
- Evidence Linking — clickable back-reference to the briefing section supporting each observation.
- Urgency Calibration — time-horizon tags (immediate, next quarter, next six months).
- Accountant-Ready Formatting — forwardable output packets for the owner's advisor.

---

## 8. Key User Flows

### Flow 1 — Bank-referred first login (primary conversion flow)
1. RM introduces the product in a client conversation; client consents to bank data sharing.
2. System ingests consented transaction data and pre-processes a benchmark report overnight.
3. Client logs in. The one-page Instant Position Summary is already on screen.
4. The Proof-of-Insight Highlight presents the single most divergent metric as the lead finding.
5. Within 60 seconds the client has read their first verdict. They are prompted to pin metrics to their primary dashboard.

**Failure mode to design against**: a first-login screen that requires any configuration, data entry, or navigation before delivering a verdict. This cohort will not return.

### Flow 2 — Direct sign-up (Exposed Owner)
1. Owner hits the site after a trigger event (e.g., lost a tender, compressed margin).
2. Manual Input Fast-Track form, <15 minutes. Revenue, headcount, top cost lines, margin.
3. Instant Position Summary generated within the same session.
4. Proof-of-Insight Highlight delivers a first "I didn't know that" moment.
5. 14-day window to pin metrics, receive first alert, convert to paid.

### Flow 3 — Monthly cadence (retention flow)
1. Monthly briefing lands in inbox with web and PDF versions.
2. Briefing closes with 2–4 action observations tagged by time horizon, with evidence links and accountant-ready formatting.
3. Between briefings: dashboard reflects latest peer recalculation; shift alerts fire as thresholds cross.
4. Quarterly: higher-frequency alerts around fiscal year end, regulatory deadlines, and metric-specific cycles.

### Flow 4 — Drift alert
1. Metric percentile crosses threshold (±10 points over 2 quarters in MVP).
2. Cause Attribution Analysis determines whether the shift is owner-side, cohort-side, or both.
3. Plain-Language Alert Generation produces the statement.
4. Delivered via email + in-dashboard; logged to Alert History.
5. Owner can forward to accountant with full context attached.

### Flow 5 — Data contribution (give-to-get loop)
1. After a key moment (first report, alert, monthly check-in), Additional Customer Information Gatherer identifies the highest-value missing data point.
2. Owner is asked to input it, with an explicit preview of what benchmark unlocks.
3. Contribution triggers an immediate visible benchmark improvement — reinforcing the loop.

---

## 9. Release Plan

Following the roadmap doc's five-increment progression:

### MVP (Increment 1) — Proof of insight
Goal: deliver a day-one verdict that converts both segments within their evaluation window.

- Cohort Segmentation Matching [basic]
- Percentile Position Calculation [basic] — monthly, 6–8 ratios
- Quartile Position Display [basic]
- Category-Based Layout [basic]
- Bank Data Pre-Processing [basic]
- Manual Input Fast-Track [basic]
- Instant Position Summary [basic] — 4–6 core metrics, plain-language verdict per metric
- Proof-of-Insight Highlight [basic]
- Metric Selection and Prioritization [basic]
- Sector Profile Configuration [basic]
- Observation Generation [basic]
- Plain-Language Translation [basic]
- Action Specificity Framing [basic]

**Exit criteria**: The Exposed Owner converts ≥X% within 14 days; bank-referred users show first-session engagement above the defined activation threshold.

### Increment 2 — Continuous Monitoring
Shift from one-time reports to a living instrument.

- Peer Cohort Summary Statistics [basic]
- Historical Position Tracking [basic]
- Threshold-Based Drift Detection [basic]
- Plain-Language Alert Generation [basic]
- Alert Delivery Channels [basic]
- Alert History Log [basic]
- Time Window Configuration [basic]
- Display Mode Toggle [basic]
- Cohort Segmentation Matching [advanced]
- Percentile Position Calculation [advanced] — weekly cadence, 12–15 metrics

**Exit criteria**: shift alerts fire with acceptable signal-to-noise ratio; cause attribution distinguishes owner vs cohort movement reliably.

### Increment 3 — Sector Intelligence and Actionability
Layer in the briefing cadence.

- Monthly Briefing Generation [basic]
- Multi-Format Delivery [basic]
- Evidence Linking [basic]
- Additional Customer Information Gatherer [basic]
- Quartile Position Display [advanced]
- Cause Attribution Analysis [basic]
- Bank Data Pre-Processing [advanced]
- Instant Position Summary [advanced]

**Exit criteria**: monthly briefing open rate above threshold; observation click-through to evidence shows the chain is used.

### Increment 4 — Deep Intelligence and Personalization
LLM-generated narratives; per-metric alert tuning; richer historical context.

Headline additions: LLM-driven alert narratives, multi-metric correlation alerts, multi-year historical view with event annotations, intelligent metric recommendations, per-metric alert frequency, mobile push, advanced proof-of-insight that weighs actionability, forward-look identification, urgency calibration, accountant-ready formatting.

### Increment 5 — Predictive Maturity
Scraped market signals, quantitative forward-look impact ranges, Czech/English language engine, branded board-ready exports, observation engine that incorporates owner's specific metric positions and alert history.

### North Star
Near-real-time recalculation, 20+ metrics, predictive percentile projection, full causal decomposition with counterfactual analysis, multi-cohort benchmarking, fully personalized briefings matching analyst-produced reports, full evidence graph, strategic calendar view of recommended actions plotted against optimal timing windows.

---

## 10. Data and Technical Foundation

### Data moat
- **Primary asset**: 20,000+ anonymized financial records from ČS business clients. Structurally unreplicable — no competitor can purchase, scrape, or reconstruct it.
- **Give-to-get flywheel**: each new participant deepens cohort granularity and sharpens segmentation. Value compounds with scale.
- **Cold-start risk**: cohort statistical validity requires a minimum number of SMEs per (NACE × size × region) cell. This is a launch-phase constraint, not only a technical one. GTM must seed seed cohorts before benchmarks ship.

### Architecture
- **RAG (Retrieval-Augmented Generation)** is the foundational pattern. It combines proprietary bank benchmarks with client-specific financial data to generate personalized intelligence, prevents hallucinations, and keeps client data out of base-model training.
- **Federated Learning + Differential Privacy** underpins cohort computation. Legally compliant, continuously updated, granular — superior to survey-based competitors.
- **No client data enters model training.** This is an architectural commitment and a marketing position. It addresses the core buying barrier — the explicit fear that shared data feeds into ČS credit risk decisions.

### Metric taxonomy (v1 scope)
Four categories, 6–15 metrics at MVP:
- Financial performance ratios (gross margin, EBITDA margin, overhead ratio, net margin)
- Cost structure (labor cost ratio, supplier concentration, fixed vs variable split)
- Revenue dynamics (revenue per employee, revenue growth rate, customer concentration)
- Structural indicators (headcount trajectory, capex intensity, working capital cycle)

Exact v1 list to be locked during MVP build.

### Cohort segmentation
- NACE industry code (primary)
- Employee / revenue size band
- Czech geographic region
- Minimum cohort size flag — when below statistical-validity floor, the system must degrade gracefully, not silently show a low-confidence percentile.

---

## 11. Go-to-Market

### Primary channel — ČS relationship managers
- CAC reduction 70–90% vs direct B2B SaaS.
- Trust transfer from bank brand overcomes SME skepticism of new vendors — a structurally higher trust barrier for any outside-channel attempt.
- Success depends on RM training, enablement, and incentives. This is an **internal bank sales enablement program**, not a marketing program. Partnership terms and revenue-sharing deserve as much strategic attention as the product itself.
- Embedding inside George Business (the bank's digital portal) is the distribution anchor.

### Secondary channel — direct sign-up for The Exposed Owner
- Triggered by pain events. Acquisition messaging leads with verdict, not features.
- 14-day evaluation window. The product must deliver a proof of insight inside the first session and a shift alert or comparable value event inside 14 days.

### Pricing
- €4–6k annual subscription.
- Within unilateral budget authority for primary persona.
- Price is secondary to demonstrated P&L impact — the purchase is justified by the ability to cite benchmarks in one pricing negotiation or one capital decision.

### Positioning
- Against free LLMs: lead with the "good enough" problem. Generic LLM answers are plausible but context-blind and unvalidated for Czech SME decisions. Marketing must actively expose the hallucination and context-blindness risks for high-stakes decisions.
- Against incumbents (Statista, D&B, CB Insights, AlphaSense): they serve the wrong user. SME operators are structurally absent from every competitor's target segment. We aren't entering a crowded market — we're filling a validated whitespace.

---

## 12. Competitive Positioning and Moat

### Differentiation summary
- Only product built for the SME operator, not the analyst.
- Only product addressing H3 (performance validation) — the highest-scored pain and the structural blind spot in the competitive landscape.
- Only product with Czech SME peer benchmarks at NACE × size × region granularity.
- Privacy-preserving architecture is a marketed feature, not a hidden compliance layer.

### Moat
- **Dataset, not dashboard.** The benchmark data is the product. The UI is replaceable; the data is not.
- **Give-to-get network effect.** Each new participant improves cohort depth, sharpens segmentation, and widens the gap against any entrant.
- **Trust transfer.** Owners share financial data with their bank when they would not share it with a third-party vendor. This accelerates the network effect precisely at the cold-start stage where it is most fragile.

---

## 13. Risks and Open Questions

### Top risks
1. **Cold-start data insufficiency.** If minimum cohort counts are not met at launch, the benchmark feature cannot ship credibly. GTM must seed cohorts before the product is exposed. Mitigation: staged rollout by cohort-readiness, not calendar date.
2. **The "good enough" free LLM problem.** SME owners already ask ChatGPT/Copilot for business questions and perceive the answers as sufficient. Mitigation: lead with verdict quality and proprietary comparison, not feature count. Onboarding must make the LLM hallucination risk viscerally felt.
3. **Data contribution trust barrier.** The explicit fear that data feeds into ČS credit decisions is a first-order buying objection. Mitigation: privacy architecture is a marketing asset. Explicit, auditable, and visible separation of benchmark data from credit risk data.
4. **RM enablement failure.** The Bank-Referred Passive Adopter segment exists only if RMs are trained, incentivized, and equipped. If the RM program underperforms, the volume channel collapses. Mitigation: treat RM enablement as a first-class product workstream with its own metrics and iteration cycle.
5. **Churn faster than Exposed Owner for bank-referred cohort.** This cohort churns if the product doesn't embed into an existing habit within weeks. Mitigation: Alert cadence and monthly briefings are the habit anchors; without them Retention fails.

### Open questions
- Exact v1 metric list inside each of the four categories.
- Czech ↔ English language scope — MVP Czech-only? Both from day one?
- Mobile scope at MVP — native app, responsive web, both?
- Pricing tier structure — is €4–6k a single SKU or a range with feature tiers?
- RM incentivization model — referral fee, revenue share, adoption bonus?
- Bank data consent flow — UX inside George Business, what disclosures, revocation rules?
- Accountant/advisor roles — shared access at MVP or later?
- Alert noise calibration — how do we measure signal quality before we have long-term outcome data?
- Cold-start strategy — which cohorts launch first based on ČS data depth?

---

## 14. Appendix — Source Documents

- [Synthetic Research](arkana-saap-i-synthetic-research-2026-04-17.md) — persona interviews, hypothesis ranking, evidence base.
- [Solution Area Transition](arkana-saap-i-solution-area-transition-2026-04-17.md) — confirmed problems, market standards, competitive gaps, trends.
- [Idea Brainstorming](arkana-saap-i-idea-brainstorming-2026-04-17.md) — the Strategic Position Dashboard concept, differentiation, moat.
- [North Star Definition](arkana-saap-i-north-star-definition-2026-04-17.md) — product vision, five capability surfaces, segment-specific flows.
- [Roadmap Definition](arkana-saap-i-roadmap-definition-2026-04-17.md) — MVP → North Star increment mapping, per-feature depth progression.
