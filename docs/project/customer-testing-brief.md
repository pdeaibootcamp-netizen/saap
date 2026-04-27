# Customer Testing Brief — Strategy Radar

*Context file for a Claude session supporting customer testing. Drop into the session's working directory or paste inline. Contains no technical or architectural detail — only what an interviewer, moderator, or synthesis helper needs to understand what the participant is looking at and what they're reacting to.*

*Date: 2026-04-21.*

---

## 1. What Strategy Radar is, in one paragraph

Strategy Radar is a service from Česká Spořitelna for owners of Czech small and medium businesses. Once a month the owner receives a short written briefing — two to three pages — about what is happening in their sector and how their business compares to other similar Czech firms. The briefing ends with two to four concrete things the owner can actually do, each labeled with a time horizon (right now / within three months / within twelve months / longer). It is delivered as an email, a page inside the application, and a downloadable PDF — the same content in three forms, so the owner can read it however fits their day. The whole product is about one thing: giving the owner an outside-in perspective on their business that they do not currently have and cannot easily get elsewhere.

---

## 2. Who Strategy Radar is for

**Primary participant profile:**

- Owner or CEO of a Czech firm with roughly 10 to 100 employees.
- Works in manufacturing, wholesale/trade, transport, or business services.
- Is the sole strategic decision-maker — no in-house strategy team, no dedicated planner.
- Runs the firm from experience and intuition, checks their own numbers, but has no external reference for whether those numbers are good, bad, or average.
- Feels exposed at specific pain moments: margins being squeezed, a competitor suddenly cutting prices, an unexpected cost jump, a tough conversation with the bank, losing a tender.

Two flavors of this person show up in testing:

- **The Exposed Owner** — actively feels the pain, is evaluating whether this product helps. Skeptical, moves fast, will disengage within about two weeks if they don't see something useful.
- **The Bank-Referred Passive Adopter** — was introduced to the product by their Česká Spořitelna relationship manager rather than seeking it out. Engages if the first briefing is obviously relevant. Churns faster than the Exposed Owner if the monthly rhythm doesn't take hold.

**Who Strategy Radar is _not_ for:**
Financial analysts, investors, lenders evaluating other companies, large enterprises, or anyone who wants raw data to crunch themselves. The product is explicitly built for the operator, not the analyst.

---

## 3. The problem in the customer's own words

Most Czech SME owners run their business without any reliable outside reference. When they set prices, hire, or decide whether to invest, they are comparing themselves to nothing — or to a neighbor they vaguely know, or to something they saw once in the press. The three recurring pain patterns we hear:

1. "I have no idea whether what I'm seeing in my numbers is normal for my industry or a warning sign."
2. "I'm negotiating prices with customers and suppliers from fear — I don't know what others are charging or paying."
3. "By the time I realize the market has shifted, the shift is already in my P&L."

Strategy Radar directly addresses these three. It is _not_ trying to be a full business-intelligence tool, a dashboard, a CRM, or a strategy consultant. It is trying to be the one thing the owner opens once a month to get oriented.

---

## 4. What the customer actually experiences

### 4.1 How they encounter the product

Two entry points:

- **Through their bank.** The relationship manager at Česká Spořitelna mentions it during a regular meeting, or it shows up inside George Business (the bank's online banking for businesses). This is the primary channel — most participants will arrive this way.
- **Direct sign-up.** The owner heard about it, searches for it, signs up on their own. This is the secondary channel.

In both cases the product is positioned as free during the current validation phase. There is no pricing conversation.

### 4.2 First session — the critical moment

The first experience must produce a verdict within a minute or so for bank-referred users. No configuration-first screens, no "complete your profile first" gates that block insight. If the participant cannot see something concrete and relevant almost immediately, the product has failed its own test.

What the participant sees on first arrival:

1. **A short data declaration screen** — "Here is what we do and do not do with your data." Four topics, each shown as "what we don't do" and "what we do." Topics: the briefings themselves, how their data appears in comparisons, what their bank advisor sees, and how this relates to credit scoring. The screen exists because the biggest trust barrier in research was fear that data would flow into credit decisions — so the product addresses that fear explicitly and up-front. The owner confirms by clicking once; there are no sliders or toggles to configure.
2. **A very short onboarding** — their industry (NACE code), company size band, and region. That's it. The system then produces or shows them a briefing calibrated to that profile.
3. **Their first briefing** — this is the moment of truth. It should feel like something their best-informed accountant might say after reading every trade publication in their sector for them.

### 4.3 What a briefing contains

A briefing is always the same shape:

- A **title and the month** it covers.
- A **short opening summary** — what's happening in their sector this month, in plain prose.
- **Two to four key observations** — each one a short paragraph with a headline, a body, and a time horizon tag. Some are sector-wide ("margins are under pressure across wholesale"), some are owner-specific ("your gross margin puts you in the third quartile of similar firms").
- **A benchmark section** — four categories of financial health: profitability, costs and productivity, capital efficiency, and growth and market position. Within each category, the owner sees where they sit compared to similar Czech firms — expressed as named quartiles ("upper quarter", "third quarter", "second quarter", "bottom quarter") with a verdict sentence, never as a raw number standing alone. If the cohort is too small to compare against reliably, the system says so openly rather than showing a misleading number.
- **Two to four closing actions** — specific, time-horizon-tagged things the owner could actually do. Each action is a sentence, not a to-do-list item, and reads the way a trusted advisor would phrase a suggestion.

The language is Czech, formal register (vykání). No analyst jargon, no statistical notation, no percentages-without-context. Every comparison is framed as a conclusion, not as data.

### 4.4 How the briefing arrives

The same briefing is delivered three ways:

- **Email** — a short teaser with one headline observation and one benchmark snippet, linking to the full web view.
- **Web view inside the app** — the full briefing, readable on the phone or the laptop.
- **PDF download** — the same content, formatted for forwarding to an accountant or advisor.

The owner chooses which format fits. A quieter owner might only read the email; a more engaged one might read the web view and save the PDF.

### 4.5 Monthly rhythm

A new briefing every month for the owner's sector. That is the product's habit anchor — the reason the owner comes back. There is no daily feed, no push notifications, no alert system at this phase. Just the monthly arrival.

### 4.6 The relationship manager role

For bank-referred owners, the relationship manager is the introduction point. The RM might open the conversation with "I saw you're in wholesale — we've got a monthly briefing now on your sector, would you like me to set it up for you?" The owner does not interact with the RM through the product itself — the product is used directly, not through their advisor. But the RM is aware the product exists and can bring it up in conversation.

In later phases (not in this test), the RM will also receive **opportunity-flavored signals** about their clients — "this client is looking at growth content, might be a good moment to talk expansion financing." These are never framed as risk signals. The firewall between this product and credit-risk processes is a hard rule, not a nice-to-have.

---

## 5. What the product is _not_ (please don't probe on these — they're out of scope)

- **Not an automated AI briefing engine.** At this phase every briefing is written by a Česká Spořitelna analyst using back-office tools. Automation comes later. If a participant asks "did a robot write this?" — the honest answer is no, a person did, using templates and data.
- **Not a standalone benchmarking dashboard.** Benchmarks exist _inside_ the briefing, not as a separate page the owner visits on demand.
- **Not an alerting or monitoring tool.** There are no real-time alerts, no red-flag notifications. The monthly briefing is the entire delivery.
- **Not a mobile app.** It's a responsive website. Works on a phone browser, but no App Store download.
- **Not priced yet.** The product is free during validation. Questions about cost or subscription can be acknowledged but do not reflect a real pricing decision.
- **Not a credit-scoring or risk tool.** Completely separated from the bank's credit side. This separation is a feature, not an afterthought.
- **Not a general BI or reporting platform.** The owner cannot pull custom reports, build dashboards, or download raw data. The output is always a verdict or an action.
- **Not available in English at this phase.** Czech only for now.
- **Not a data-sharing marketplace.** The owner's individual financial numbers never appear to anyone else — not other owners, not their RM, not the analyst who wrote the brief. Only aggregated cohort statistics are visible.

---

## 6. Market context — how customers will frame it on their own

Participants will compare Strategy Radar against whatever they currently use to answer the question "how is my business doing compared to others." Most commonly:

- **Nothing formal.** They ask their accountant, read the trade press, talk to industry peers at events. This is the dominant baseline.
- **Their accountant** — who gives them their numbers but not a reference frame for whether those numbers are healthy.
- **Free LLM chatbots (ChatGPT and similar)** — increasingly common as a first question-asking tool. Participants may reasonably ask "why would I pay for this when I can ask ChatGPT?" The honest answer is that a general chatbot cannot see the actual Czech SME peer data — it gives plausible general answers, not calibrated-to-your-sector answers.
- **Large international data vendors** (Statista, Dun & Bradstreet, AlphaSense, CB Insights) — expensive, built for analysts and investors, not for the SME operator. Almost no testing participant will be a current customer of these.
- **The bank itself** — participants trust their bank with financial data more than they would trust a random SaaS vendor. This trust is meaningful and is part of why the product is distributed by Česká Spořitelna.

Strategy Radar's defensible position is not that it has better software — it is that it has access to anonymized Czech SME peer data (over 20,000 anonymized records) that nobody outside the bank has. That is what makes the comparisons real.

---

## 7. Trust and privacy — why it matters in the interview

This is the single most sensitive topic with Czech SME owners, and it will come up. The research was unambiguous: the #1 reason owners refuse products like this is fear that sharing their financial data will feed back into the bank's credit decisions. The product addresses this with four hard rules visible to the owner:

1. **The briefings are not written from the owner's private financial data.** Analysts write them from sector statistics and public market data. The owner's numbers determine _which_ cohort they are compared against — never _what the briefing says_.
2. **The owner's individual numbers are never shared** with other owners, with any other company, or outside Česká Spořitelna. Only anonymized aggregate comparisons exist.
3. **Data from Strategy Radar never enters credit-risk scoring.** Full separation between this service and the credit side of the bank.
4. **Data from this product never enters AI model training.** The bank commits to this architecturally and as a marketed promise, not as fine print.

The owner can withdraw consent at any time from a privacy settings page, which stops the monthly briefings being sent. Existing records are not deleted — there is a clear audit trail of consent and withdrawal events — but the active data flow stops.

If the participant wants to probe this, give honest answers. If they sound reassured, that is a positive signal. If they remain skeptical, that is itself a useful finding — trust framing copy may need refinement.

---

## 8. Key terms the participant may encounter, in plain Czech language

| Term on screen | What it means to the owner |
| --- | --- |
| **Přehled** (briefing) | The monthly document. Two to three pages, written for them. |
| **Obor** (sector / industry) | Their NACE industry code — e.g. 46 for wholesale. They'll pick this at onboarding. |
| **Velikost firmy** (size band) | Small (roughly 10–24 employees), medium (25–49), larger (50–100+). |
| **Region** | Praha / Jihozápad / Střední Čechy / Severozápad, etc. — Czech statistical regions. |
| **Kohorta** (cohort) | The group of similar Czech firms their results are compared against — same sector, same size band, same region. Never identified by name. |
| **Percentil / Čtvrtina** (percentile / quartile) | Where they sit in the comparison. "Horní čtvrtina" = top quarter, "třetí čtvrtina" = third quarter, and so on. |
| **Okamžitě / Do 3 měsíců / Do 12 měsíců / Více než rok** | The four time-horizon labels on each action. Fixed set — the owner will see exactly these four. |
| **Souhlas** (consent) | The one-time data declaration they confirmed at the start. They can revoke it from privacy settings. |

---

## 9. What a good testing conversation looks for

Helpful things to surface in interviews:

- **First-minute reaction.** Did the briefing feel relevant to their world or generic? A "this is me" reaction within the first 60 seconds is the activation signal.
- **Plain-language test.** Did they understand every sentence? Any jargon they had to re-read is a failure of the plain-language principle.
- **Action concreteness.** Did the two to four closing actions feel like things they could actually do, or like generic advice? Specific beats generic by a huge margin.
- **Comparison realism.** When they saw their quartile position, was their reaction "that matches what I thought" or "that's surprising"? Either is valuable. A "surprising but plausible" reaction is a proof-of-insight hit.
- **Trust reactions.** Did the privacy declaration reassure them, or did it raise new concerns they hadn't thought of? Both outcomes are useful.
- **Frequency fit.** Does monthly feel right? Would they prefer more often? Less often? Event-driven?
- **Sharing intent.** Would they forward the PDF to their accountant or advisor? That is a strong engagement signal and maps directly to how we expect the product to spread.
- **What's missing.** What question did they want the briefing to answer that it didn't? That's the roadmap for the next increments.

Things _not_ to drill into (out of scope or not representative of the final product):

- UI polish and visual design — current state is a functional prototype, not the final look.
- Features shown in the interface that aren't part of this test (anything beyond the monthly briefing, onboarding, and privacy settings).
- Pricing and subscription. The product is free during validation; pricing is not yet decided.
- English-language version. Not in scope for this phase.
- Real-time alerts or live dashboards. Not in scope for this phase.

---

## 10. One-line positioning the participant should walk away able to repeat

> "It's a monthly briefing from Česká Spořitelna about how my business is doing compared to similar Czech firms, with a few concrete things I could do — written for me, not for an analyst."

If they can say something close to that after the session, the product concept is landing.
