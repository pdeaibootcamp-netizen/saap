# North Star Definition — SAAP (I)

*Generated 4/17/2026*

---

## Strategic Position Dashboard

> A persistent benchmark monitoring platform that continuously tracks a Czech SME owner's financial and operational metrics against a segmented peer cohort — and alerts them in plain language the moment their relative position shifts in a way that demands attention. Built for The Exposed Owner who needs to know whether their 12% margin is a sign of strength or distress, and distributed through The Bank-Referred Passive Adopter channel where a pre-loaded benchmark report is waiting at first login.

The Strategic Position Dashboard is a subscription-based, always-on financial positioning tool that tells SME owner-operators exactly where they stand relative to peers in their industry, size band, and geography — and keeps watching that position over time. It serves two primary segments: The Exposed Owner, triggered by a specific pain event (margin compression, competitor pricing pressure, unexplained cost escalation), who evaluates within days and needs proof of insight within 14 days; and The Bank-Referred Passive Adopter, activated by ČS relationship managers, who encounters a pre-generated benchmark report at first login before taking any action. The platform replaces the current state where SME owners make pricing, investment, and cost decisions with no external reference frame — treating internal numbers as absolutes when they can only be interpreted comparatively.

The dashboard directly addresses the three highest-priority confirmed problems. It closes the performance validation gap [H3] by maintaining a continuous percentile view of the owner's financial metrics against their peer cohort — transforming isolated numbers into comparative positions. It grounds strategic decisions [H1] by providing persistent peer operational benchmarks so that capital allocation, hiring, and expansion choices are made from a position of known relative strength or weakness rather than unvalidated assumption. It shifts pricing negotiations [H2] from fear-based to evidence-based by showing where the owner's pricing-related metrics (gross margin, revenue per employee, cost ratios) sit within their peer group, giving them concrete ammunition for client and supplier conversations. Every feature delivers a verdict, not a dataset — satisfying the Pre-Processed Output market standard and the Actionability Framing expectation identified across the competitive landscape.

The timing is structurally favorable. Free general-purpose LLMs are establishing a "good enough" baseline for generic business intelligence, which means the only defensible position is proprietary data that LLMs cannot access — the anonymized financial benchmarks from 20,000+ ČS business clients represent exactly that asset. The banking channel reduces customer acquisition cost by an estimated 70–90% compared to direct B2B SaaS acquisition, fundamentally changing unit economics at the €4–6k annual price point. Trust transfer from the ČS brand overcomes the SME skepticism of new vendors that would otherwise kill adoption of an unknown third-party tool. And privacy-preserving benchmarking architecture — built on RAG foundations that keep client data out of model training — enables the give-to-get data network effect where each new participant improves cohort depth, sharpens segmentation, and widens the moat against any competitor who cannot access the raw material.

### Peer Position Engine

A continuous benchmarking system that calculates and maintains an SME owner's percentile position across key financial and operational metrics relative to a segmented peer cohort defined by industry, size band, and Czech regional geography. It directly addresses [H3] — the inability to validate whether internal financial performance represents success or failure — by converting raw financial figures into comparative positions (e.g., "Your gross margin places you in the 28th percentile of Czech professional services firms with 10–50 employees"). The owner's data is mapped to their peer cohort at onboarding — either through consented bank data integration or manual input — and the engine recalculates positions as new data flows in from both the owner and the cohort, maintaining a living view rather than a static snapshot.

1. Cohort Segmentation Matching — Assigns the owner to a peer cohort based on three-dimensional segmentation: NACE industry code, employee/revenue size band, and Czech geographic region.
2. Percentile Position Calculation — Computes the owner's percentile rank for each tracked metric against the matched peer cohort, updated as new data enters the system.
3. Quartile Position Display — Presents each metric's standing as a named quartile position (top 25%, second quartile, etc.) alongside the exact percentile, so the owner reads comparative standing rather than raw numbers.
4. Peer Cohort Summary Statistics — Shows the cohort median, interquartile range, and top-decile threshold for each metric, giving the owner the full distribution context behind their position.
5. Historical Position Tracking — Maintains a rolling time-series of the owner's percentile position for each metric, enabling the owner to see trajectory (improving, stable, deteriorating) over quarters and years.
6. Additional Customer Information Gatherer - Determines the highest-value piece of information to get from the client (financial or strategic metrics that we do not yet have) and asks the client to input it at the right moment, offering more detailed benchmarks in return.

### Shift Detection and Alert System

A monitoring layer that watches for meaningful changes in the owner's relative peer position and delivers plain-language alerts when a metric drifts beyond a significance threshold. It addresses [H3] by catching performance deterioration that the owner would otherwise discover only in annual accounts, and [H1] by surfacing comparative shifts that should inform strategic decisions before they become crises. The system distinguishes between owner-driven movement and cohort-wide shifts — telling the owner whether their labor cost ratio climbed because their costs rose or because the peer group's costs fell — and delivers alerts through email and in-dashboard notification with enough context to understand the shift without needing to open a spreadsheet.

1. Threshold-Based Drift Detection — Triggers an alert when any tracked metric's percentile position moves beyond a configurable threshold (default: 10 percentile points) over a defined rolling window.
2. Cause Attribution Analysis — Determines whether a position shift was driven by the owner's own metric changing, the peer cohort's distribution shifting, or both, and states this explicitly in the alert.
3. Plain-Language Alert Generation — Produces a human-readable alert statement (e.g., "Your labor cost ratio moved from the 34th to 58th percentile over the last two quarters — the peer median held flat, so this is your cost rising, not the market shifting") without jargon or statistical notation.
4. Alert Delivery Channels — Sends shift alerts via email and in-dashboard notification, with the owner controlling frequency preferences (immediate, daily digest, weekly summary).
5. Alert History Log — Maintains a chronological record of all triggered alerts with their context, enabling the owner to review the sequence of position shifts over time.

### Pre-Loaded Benchmark Report

An automatically generated benchmark report that is ready at the owner's first login, delivering immediate comparative positioning before the owner has taken any action in the platform. It addresses [H3] and [H2] by providing an instant verdict on where the owner stands — not after weeks of data collection, but on day one — which is the critical conversion mechanism for both The Exposed Owner (who needs proof of insight within 14 days) and The Bank-Referred Passive Adopter (who will not return if the first session delivers nothing). For bank-referred users, the report is generated from consented bank transaction data; for direct sign-ups, it is generated from the onboarding financial input. The report covers the owner's top-line position across core financial ratios with a plain-language summary verdict.

1. Bank Data Pre-Processing — Ingests consented bank transaction data to derive key financial metrics (revenue, cost categories, margin proxies) before the owner's first login, enabling a report to be waiting at account activation.
2. Manual Input Fast-Track — Provides a structured onboarding form (under 15 minutes) for owners without bank data integration to input enough financial data to generate an initial benchmark report within the same session.
3. Instant Position Summary — Generates a one-page summary showing the owner's percentile position on 4–6 core metrics against their matched peer cohort, with a plain-language verdict for each (e.g., "Your overhead ratio is higher than 72% of peers in your segment").
4. Proof-of-Insight Highlight — Identifies and surfaces the single most significant finding from the initial benchmarking — the metric where the owner's position is most divergent from the cohort median — as the lead insight, designed to deliver immediate proof of value.

### Configurable Metric Dashboard

A customizable primary view where the owner selects which financial and operational metrics occupy their persistent monitoring surface, organized across four metric categories: financial performance ratios, cost structure, revenue dynamics, and structural indicators. It addresses [H1] by ensuring the owner's strategic priorities — not a generic default — determine what they see first, and satisfies the Customizable Dashboards market standard identified as a table-stakes launch requirement. The owner drags metrics into their primary view, sets the time window for trend display, and chooses whether to see percentile positions, quartile bands, or both. The dashboard is the daily-use surface; every other feature feeds into or is accessed from it.

1. Metric Selection and Prioritization — Allows the owner to choose which metrics appear on their primary dashboard view and in what order, from the full library of tracked metrics across the four categories.
2. Time Window Configuration — Lets the owner set the rolling time window for trend display (last quarter, last 2 quarters, trailing 12 months, custom range) independently for each metric or globally.
3. Display Mode Toggle — Offers three display modes per metric: percentile rank, quartile band position, or trend chart showing position over time, switchable without leaving the dashboard.
4. Category-Based Layout — Organizes available metrics into the four standard categories (financial performance, cost structure, revenue dynamics, structural indicators) so the owner can scan by domain rather than searching an unstructured list.
5. Saved View Profiles — Enables the owner to save multiple dashboard configurations (e.g., "Monthly Review," "Pricing Prep," "Board Meeting") and switch between them with one click.

### Sector Briefing Engine

A monthly intelligence delivery system that produces two-to-three-page sector briefings calibrated to each owner's industry, business size, and operating geography. It directly addresses H1 (unvalidated strategic assumptions) and H13 (reactive firefighting from missing market context) by providing a pre-interpreted, forward-looking market view on a regular cadence — so owners encounter shifts in their cost environment, regulatory landscape, and competitive dynamics before those shifts hit their P&L, not after. At onboarding, the owner specifies their sector, size band, and geography; the system assembles briefings from ČS sector research, public regulatory monitoring, and scraped market signals, then delivers them monthly via email with a web-readable view and downloadable PDF.

1. Sector Profile Configuration — Captures the owner's industry, business size band, and primary operating geography at onboarding to calibrate all briefing content to their specific context.
2. Monthly Briefing Generation — Produces a structured two-to-three-page briefing each month covering sector changes, forward-looking developments, and explicit business implications, assembled from ČS sector research, regulatory monitoring, and public market data.
3. Forward-Look Identification — Isolates the two to three developments most likely to affect the owner's cost base, pricing environment, or competitive position over the next two quarters, with estimated impact magnitude.
4. Plain-Language Translation — Rewrites all analytical findings in non-analyst vocabulary, eliminating jargon and framing every insight as a concrete business implication rather than a market observation.
5. Multi-Format Delivery — Delivers each briefing via email, a simple web-readable view, and a downloadable PDF suitable for sharing with an accountant or business partner.

### What-This-Means-For-You Action Section

A structured closing section in every briefing that converts all preceding intelligence — sector changes, peer benchmarks, cost signals, competitive movements — into two to four explicit, actionable observations written in plain language and framed as decisions the owner can evaluate immediately. It addresses the Market Standard that actionability framing is a near-universal expectation and that benchmarks without decision guidance are perceived as incomplete. This section is not an appendix or a summary; it is the product's core deliverable — the reason the owner reads the briefing. Each observation connects a specific finding to a specific business action, with enough context that the owner can act on it alone or bring it to their accountant.

1. Observation Generation — Produces two to four discrete, numbered observations per briefing, each linking a specific intelligence finding to a concrete business implication or decision point.
2. Action Specificity Framing — Frames each observation as a specific action the owner can evaluate ("review your supplier contract terms before the Q3 cost increase takes effect") rather than a vague recommendation ("consider your cost structure").
3. Evidence Linking — Ties each observation back to the specific briefing section (sector change, peer benchmark, cost signal, or competitive movement) that supports it, so the owner can trace the reasoning.
4. Urgency Calibration — Tags each observation with a time horizon indicator (immediate, next quarter, next six months) so the owner can prioritize which actions to evaluate first.
5. Accountant-Ready Formatting — Structures each observation so it can be forwarded directly to the owner's accountant or advisor with sufficient context for them to understand the finding and its business relevance without reading the full briefing.
