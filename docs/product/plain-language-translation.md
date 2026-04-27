# Plain-Language Translation

*Owner: product-manager · Slug: plain-language-translation · Last updated: 2026-04-20*

## 1. Summary

Plain-Language Translation is not a UI feature — it is the **quality bar applied to every user-facing output** Strategy Radar ships at MVP. It codifies the plain-language rules ČS analysts follow when authoring briefs, observations, and action copy, and the review mechanism that enforces them before a brief leaves the authoring back-end. The owner should read the brief as though their accountant were explaining it aloud; this document defines what that means in testable terms.

## 2. Upstream links

- PRD sections:
  - [§7.3 Plain language, no jargon](../../PRD/PRD.md#7-product-principles) — the principle this feature operationalizes. "Briefs and alerts should read like something the owner's accountant would say."
  - [§7.2 Verdicts, not datasets](../../PRD/PRD.md#7-product-principles) — plain language is the medium; a verdict is the required form.
  - [§8.1 Sector Briefing Engine](../../PRD/PRD.md#81-sector-briefing-engine--what-this-means-for-you-primary-mvp) — defines the surfaces this rule set applies to (opening summary, observations, embedded snippet interpretations, closing actions).
  - [§9 Release Plan — Plain-Language Translation (basic)](../../PRD/PRD.md#9-release-plan) — MVP scope: "template-guided jargon removal on all outputs."
  - [§3 Target Users](../../PRD/PRD.md#3-target-users) — the Exposed Owner and Bank-Referred Passive Adopter personas; neither is an analyst; neither reads statistical notation.
  - [§13.1 Brief production scaling risk](../../PRD/PRD.md#13-risks-and-open-questions) — plain-language review is a recurring per-brief cost. A lightweight checklist is the mitigation.
- ČS business goals served:
  - **G1 Engagement** — the #1 reason an owner disengages is a brief they cannot parse on first read. Plain-language enforcement is an engagement-quality gate.
  - **G2 Data depth + cadence** — owners who find the brief readable are more likely to keep interacting, which over post-MVP increments feeds give-to-get capture (A-013).
  - Not G3 — the RM lane is deferred (D-002, A-002); this policy still binds any RM-facing copy the moment that lane reactivates, but MVP compliance is measured against brief surfaces only.
- Related decisions:
  - [D-004](../project/decision-log.md) — Czech-only at MVP. This policy covers Czech user-facing copy only; English plain-language rules are out of scope (see §4).
  - [D-008](../project/decision-log.md) — single-screen consent declaration; consent copy is bound by this policy but its legal review (OQ-004) takes precedence.
  - [D-011](../project/decision-log.md) — canonical benchmark category names are the Czech labels owners see; this policy treats them as frozen terms (see §6 rule P-6).
  - [D-012](../project/decision-log.md) — revocation semantics shape the post-revocation copy already drafted in trust-and-consent-patterns §6; this policy does not relitigate that copy but audits future edits to it.
- Related assumptions:
  - [A-004](assumption-log.md) — Czech only at MVP.
  - [A-011](assumption-log.md) — all briefs human-authored; this policy is a review gate on human authorship, not a rewrite engine.
  - [A-012](assumption-log.md) — benchmarks appear only as in-brief snippets; plain-language rules apply to their verdict text.

## 3. User stories

This feature has two users: the **ČS analyst** who authors copy, and the **plain-language reviewer** (an analyst or editor peer) who signs off before publication. The end owner is the beneficiary but not an actor in the review flow.

- As a **ČS analyst authoring a brief**, I want a concrete checklist of plain-language rules, so that I can self-check my draft before handing it to review instead of guessing what "plain language" means.
  - Acceptance criteria:
    - [ ] The checklist is accessible from within the analyst authoring back-end for every text field the analyst writes into (opening summary, each observation, each benchmark-snippet verdict, each closing action).
    - [ ] The checklist enumerates every rule in §6 of this PRD in plain Czech, each with one owner-facing example of a pass and a fail.
    - [ ] Running the checklist against a draft takes no more than five minutes per brief for an author who has used it before.

- As a **plain-language reviewer**, I want a review surface that shows me every user-facing string in a brief grouped by surface (email / web / PDF), so that I can confirm each passes the rule set before I approve the brief for publication.
  - Acceptance criteria:
    - [ ] The review surface lists every user-facing string the brief will render across the three delivery surfaces (email condensed variant, web full variant, PDF full variant) — strings that appear in more than one surface are reviewed once.
    - [ ] The reviewer can mark each string as *pass* / *fail with reason* against the §6 rule set; a brief cannot be published until every string is marked *pass*.
    - [ ] The reason for a *fail* is captured as free text and is visible to the authoring analyst for revision.

- As a **PM auditing a shipped brief**, I want to be able to re-run the plain-language checklist against the brief's rendered output in every surface, so that I can spot-check publication hygiene without re-authoring.
  - Acceptance criteria:
    - [ ] A shipped brief's rendered email, web, and PDF outputs can each be run through the checklist as a post-hoc audit without edit rights.
    - [ ] An audit that flags a rule violation is logged and routed back to the feature owner; no silent fix in production copy.

## 4. Scope

### In scope

- A written rule set (§6 below) — the plain-language constraints every Czech user-facing string at MVP must satisfy.
- A review checklist derived from the rule set — the §7 authoring checklist and the §8 review-surface behavior are the two operational artifacts this PRD specifies.
- Scope of enforcement: every Czech user-facing string inside a brief (opening summary, observation headline and body, benchmark-snippet verdict text, time-horizon pill values, closing action text), every Czech user-facing string in the brief delivery envelope (email subject, pre-header, opening line, CTA buttons, PDF footer boilerplate), and every Czech user-facing string on the degraded / empty / error states for the above (benchmark-snippet below-floor copy, brief-not-yet-published placeholder, network-error retry copy).
- A lightweight glossary of **frozen terms** (§6 rule P-6) — terms that may appear as-is despite otherwise being jargon, because they are the owner's own vocabulary or a canonical brand/category label.
- Guidance for reviewers on how to handle copy the rule set does not obviously cover (§9 escalation path).

### Out of scope

- **Automated plain-language rewrite / LLM-assisted simplification.** Deferred to Increment 4 per PRD §9 (LLM-generated brief narratives). At MVP the review is human and checklist-driven.
- **English-language plain-language rules.** Czech only per D-004 and A-004. If English scope reopens (PRD §9 Increment 5), this PRD is revised.
- **Translation between Czech registers.** Formal vykání is canonical per the designer's trust-and-consent-patterns §2.5 and the brief email opening line in information-architecture §5. This PRD does not define register; it assumes the designer's register convention and enforces plain language within it.
- **Consent screen copy legal adequacy.** The four-lane declaration copy drafted in `docs/design/trust-and-consent-patterns.md` §4 is bound by this policy in principle, but its production-readiness sign-off lives under the legal-review dependency tracked as [OQ-004](../project/open-questions.md). This PRD does not substitute for legal review; a string can pass plain-language review and still fail legal review, or vice versa.
- **Brief content strategy.** Deciding *what* a brief says (which metric to foreground, which observation leads) is owned by the analyst authoring the brief; this PRD only governs *how* the chosen content is phrased.
- **Visual hierarchy, typography, layout.** Owned by the designer.
- **Localization plumbing / i18n frameworks.** Out of scope at MVP under D-004.

### Increment

**MVP** (PRD §9 Increment 1 — Plain-Language Translation [basic]).

## 5. Success metrics

Tie to PRD §6 where possible.

- **Pre-publication pass rate on first review (target: ≥80% within four weeks of feature launch).** Share of briefs that clear plain-language review without a revision cycle. Measured as: briefs marked *all strings pass* on first reviewer pass ÷ briefs submitted for review. Rising trend indicates the authoring checklist is internalized; falling trend indicates a rule gap or author onboarding gap.
- **Per-brief review time (target: median ≤15 minutes).** Time from review-surface open to reviewer sign-off on a single brief. Directly bounded by PRD §13.1 (brief production scaling risk); if review time exceeds this budget per brief, the checklist is too heavy and must be trimmed.
- **Post-publication audit violation rate (target: zero per month).** Number of plain-language rule violations found by post-hoc audit of shipped briefs. Any positive count triggers a review-process retrospective (not a PDR — a review-process retro is owned by the PM + the analyst lead).
- **Owner-side engagement proxy (indirect, reviewed quarterly).** Time spent per brief and observation click-through rate from PRD §6 Goal 1. These are owner-facing outcomes of a readable brief; degradation triggers a plain-language rule-set review. Not a direct metric of *this* feature but the signal that motivates it.

No metric here measures "readability scores" via algorithmic means (e.g., Flesch-Kincaid Czech analogue). Automated scoring is Increment 4 scope.

## 6. Non-negotiables

The rule set below is the policy. Every user-facing Czech string in the scope of §4 must satisfy all rules that apply to it. Rules cite the PRD principle they enforce.

### P-1 — Verdict-first (PRD §7.2, §7.3)

Every paragraph in a brief resolves to a conclusion the owner can act on or agree with. Raw observation without conclusion is a fail.

- **Pass:** "Vaše hrubá marže je v horní čtvrtině oboru — cenotvorba drží nad průměrem trhu."
- **Fail:** "Hrubá marže v sektoru se v dubnu pohybovala mezi 18 a 34 procenty." *(no conclusion about the owner)*

### P-2 — No statistical notation (PRD §7.3)

No σ, no "p-hodnota", no "konfidenční interval", no "percentil" as a bare term outside the quartile phrasing in P-6. Distributional descriptions use everyday comparatives ("lepší než polovina firem v oboru", "horší než většina").

- **Pass:** "Pětina firem ve vašem oboru roste rychleji než vy."
- **Fail:** "Percentil 80 pro růst tržeb v sektoru je 12 %."

### P-3 — No analyst vocabulary (PRD §7.3, §3)

Words that appear in an analyst report but not in an accountant-to-owner conversation are out. Non-exhaustive block-list at MVP: "kohorta" (use "obor" or "skupina podobných firem"), "medián" (use "prostřední firma v oboru"), "kvartil" except in the fixed phrasing of P-6, "variance", "odchylka", "KPI", "benchmarking" as a noun, "data-driven", "insight" (use "pozorování" — see Czech language convention in the designer IA §2).

- **Pass:** "Polovina firem ve vašem oboru má delší cyklus pracovního kapitálu než vy."
- **Fail:** "Medián kohorty u working capital cyklu je 62 dnů."

### P-4 — Comparisons are always anchored to the owner's reality (PRD §7.2, §7.4)

Any number the owner sees is paired with a comparison against their cohort, their own prior period, or a plain-language reference point. A standalone number without an anchor is a fail.

- **Pass:** "Vaše náklady na zaměstnance tvoří 42 % tržeb — o 6 procentních bodů více než u prostřední firmy ve vašem oboru."
- **Fail:** "Vaše náklady na zaměstnance tvoří 42 % tržeb."

### P-5 — Time horizons are named in Czech words, not abbreviations (PRD §7.3, §8.1)

Time-horizon tags and in-prose time references use the canonical Czech phrases from the designer IA §4.2: "Okamžitě", "Do 3 měsíců", "Do 12 měsíců", "Více než rok". No "Q2", "H1 2026", "FY", "YTD", "YoY" anywhere user-facing. In-prose time references use full Czech ("v příštích třech měsících", "v posledních dvanácti měsících").

- **Pass:** "Do 3 měsíců: prověřte ceny u pěti největších odběratelů."
- **Fail:** "Q2: review top-5 customer pricing." / "YoY růst 8 %."

### P-6 — Frozen terms list

A small set of terms is allowed to appear as-is even though a strict plain-language reading would block them, because (a) the owner recognizes them, (b) we have decided they are the canonical label, or (c) they carry regulatory / brand meaning. The list is **closed** at MVP — additions require a PDR.

| Frozen term | Why | Source |
|---|---|---|
| EBITDA marže | The owner has seen this on their own P&L; rephrasing to "marže před úroky, daněmi a odpisy" is wordier and less recognizable. | D-003; mvp-metric-list.md §2. |
| ROCE — Návratnost vloženého kapitálu | Canonical name freezes the abbreviation plus the plain-language expansion. | mvp-metric-list.md §5. |
| NACE | Only if used to explain the sector cohort in Settings or FAQ, never in the brief body. | PRD §10. |
| horní čtvrtina / druhá čtvrtina / třetí čtvrtina / spodní čtvrtina | Canonical Czech quartile phrasing for the Quartile Position Display feature (PRD §9). Replaces "Q1–Q4" and "kvartil" in narrative. | PRD §9; mvp-metric-list.md §"Product-side constraints" #1. |
| Ziskovost · Náklady a produktivita · Efektivita kapitálu · Růst a tržní pozice | Canonical category names. | D-011. |
| Obsah přehledů · Vaše data v srovnání · Váš poradce ČS · Úvěrové hodnocení | Canonical consent-screen lane headings. | D-008; trust-and-consent-patterns §4. |
| Strategy Radar · Česká Spořitelna · George Business | Brand names. | PRD §11; trust-and-consent-patterns §4. |
| Soukromí | Canonical label for the Settings sub-screen where consent is revoked. | D-008; trust-and-consent-patterns §6. |
| Okamžitě · Do 3 měsíců · Do 12 měsíců · Více než rok | Canonical time-horizon labels. | information-architecture §4.2. |

Any term outside this table that a reviewer believes should be frozen must be escalated via §9 — not silently admitted.

### P-7 — Sentence length and structure (PRD §7.3)

No single sentence in an owner-facing string exceeds roughly 25 Czech words. Sentences use the active voice where Czech register allows; passive constructions are acceptable only when they read more naturally in vykání (a judgment call the reviewer is empowered to make).

- **Pass:** "Cenová síla ve vašem oboru v posledních třech měsících slábne. Firmy, které drží marži, mají předjednané ceny na rok dopředu."
- **Fail:** Any 40-word Czech sentence even if technically grammatical.

### P-8 — No false precision (PRD §7.2, §10)

A surfaced number is rounded to the precision the comparison can bear. Percentiles are shown as integer percentiles paired with a named quartile (per P-6); percentages are shown to at most one decimal place only when the comparison depends on it. Numbers that are suppressed because the cohort cell is below the statistical-validity floor are never softened into a qualitative statement that implies we do have the data (A-017, glossary "Statistical-validity floor suppression").

- **Pass:** "Horní čtvrtina oboru — váš růst tržeb patří mezi nejrychlejších 25 % firem."
- **Fail:** "Percentil 78,3 v růstu tržeb." / "Vaše pozice je přibližně průměrná" *(when the cell is below the floor — the brief must stay silent instead)*.

### P-9 — No cadence promise (A-005, B-001)

Copy does not promise monthly delivery, name a date for the next brief, or imply a subscription. Any phrasing that sounds like "vaši další přehled obdržíte X" is a fail until B-001 reopens.

- **Pass:** "Dostanete e-mail, jakmile bude nový přehled k dispozici."
- **Fail:** "Váš další přehled vás čeká 15. května."

### P-10 — No credit-risk adjacency in any user-facing copy (PRD §4 non-goals, §7.6, A-015, A-016)

No user-facing copy refers to the owner's data in a way that can be read as credit-scoring, risk-flagging, or bank-side evaluation of their business. The only user-facing surface allowed to name credit-risk at MVP is the Lane D consent declaration, which explicitly denies it (trust-and-consent-patterns §4). Any phrasing elsewhere that mentions "hodnocení", "bonita", "úvěrové", or frames the brief as informing the bank's opinion of the owner is a fail and must be escalated — it is a principle violation, not a wording choice.

- **Pass:** (nothing in a brief body mentions credit-risk — silence is the policy)
- **Fail:** "Pokud vaše marže klesá rychleji než v oboru, zohledníme to v dalším hodnocení."

## 7. Authoring checklist (the analyst-side surface this policy produces)

A single checklist shown inside the analyst authoring back-end, per text field the analyst is writing into. The surface itself is owned by the designer and built by the engineer (see §8 downstream artifacts); this PRD freezes the content.

| Checkpoint | Rule |
|---|---|
| Does this string end in a conclusion the owner can act on or agree with? | P-1 |
| Are all numbers paired with a comparison to the cohort or the owner's own prior period? | P-4, P-8 |
| Are time references spelled out in Czech words (no Q2 / YTD / YoY)? | P-5 |
| Is every sentence ≤ 25 Czech words? | P-7 |
| Do any blocked analyst terms appear (kohorta, medián, percentil as bare, variance, KPI, benchmarking, insight)? | P-3 |
| Do any statistical symbols appear (σ, p, CI)? | P-2 |
| Are only frozen terms from §6 P-6 used as jargon? | P-6 |
| Does the string reference credit-risk, bonita, or bank evaluation? | P-10 |
| Does the string promise a cadence or name a future delivery date? | P-9 |
| (Where applicable) Is the number's precision justified by the comparison? | P-8 |

The author ticks each checkpoint before handing the draft to review. The checklist is the same one the reviewer uses in §8 — review is a second pass of the same rules, not a different rubric.

## 8. Review-surface behavior

The review surface is the second operational artifact derived from §6. It lives inside the analyst authoring back-end. Implementation owned by engineer; interaction design owned by designer. Product-side requirements:

- **String extraction scope.** The review surface enumerates every string the brief will render in each delivery surface (email, web, PDF). Strings that are identical across surfaces are reviewed once; strings that differ across surfaces (e.g., the email condensed variant's shortened observation vs. the web variant's full observation — see information-architecture §3 Surface A vs. Surface B) are reviewed separately.
- **Per-string verdict.** Each string is marked *pass* or *fail with reason*. The reviewer cannot mark a brief as "all reviewed" while any string is unmarked or marked *fail*.
- **Failure round-trip.** A *fail with reason* sends the string back to the authoring analyst with the reviewer's note. The analyst edits; the review surface re-extracts; the string re-enters review. No implicit "fix it in PDF after publish" path.
- **Publish gate.** A brief cannot advance to the publish step of the authoring back-end while any string is unmarked, marked *fail*, or mid-revision. The engineer enforces this in the back-end state machine; the PM enforces it in the acceptance-criteria sweep at Phase 3 (build-plan §6).
- **Audit mode.** A shipped brief's strings can be re-extracted and re-run through the checklist as a post-hoc audit without edit rights. The auditor can log a violation but not modify the brief; violations route to the PM for handling per §5 audit-violation metric.
- **Scope enforcement per A-011.** No automated rewrite. The review surface does not propose replacement copy. Reviewers leave free-text notes; authors rewrite by hand.

## 9. Escalation path for uncovered cases

When a reviewer encounters copy the §6 rule set does not obviously cover — a term that might be jargon, a construction that is borderline — the default is **reject and escalate**, not quietly admit.

1. **First line: author + reviewer judgment.** If the reviewer and author agree the string is fine and the rule set is the limiting factor, the reviewer admits the string *and* logs a proposed rule clarification for PM review.
2. **Second line: PM review.** The PM reviews logged clarifications weekly during MVP operation. Three outcomes: (a) rule set amended via changelog entry on this PRD; (b) frozen-terms table amended via PDR (§6 P-6); (c) case rejected, string must be revised.
3. **Third line: principle escalation.** If the uncovered case touches a PRD §7 principle — verdict-first, credit-risk adjacency, or lead-signal framing — the reviewer stops and raises to the PM immediately via `docs/project/open-questions.md`. These are never admitted through line 1.

The three failure modes §9 is designed to prevent are (i) silent admission of a rule-breaking term because it "seemed fine", (ii) proliferation of the frozen-terms table, (iii) principle drift via accumulated micro-exceptions.

## 10. Open questions

None currently block this PRD from proceeding to designer and engineer. Two non-blocking items are flagged for visibility; neither is a decision this PRD must close before downstream work begins.

1. **Reviewer role assignment.** This PRD names "a plain-language reviewer (an analyst or editor peer)" without specifying whether the reviewer role is a dedicated editor, a peer analyst on rotation, or the analyst lead. The operational choice is a ČS-side workflow decision and does not change the rule set. If later operational experience shows the role needs sharpening, this PRD is revised. Not logged in `open-questions.md` because it is not cross-domain — it is an analyst-team workflow item.
2. **Frozen-terms list growth pressure.** The §6 P-6 list is closed at MVP. If ongoing review produces more than two legitimate-looking additions in the first four weeks of operation, that is a signal the rule set under-specifies Czech accountant vocabulary — the PM reopens §6 via changelog. Not logged in `open-questions.md` because it is a self-monitoring trigger, not an unresolved blocker.

## 11. Downstream artifacts

- **Design**: `docs/design/plain-language-translation/` — authoring-checklist surface and review-surface interaction design; not yet drafted. Scope for the designer: how the checklist is rendered inside the analyst authoring back-end (layout, per-field placement, affordance for the per-string *pass* / *fail with reason* verdict), Czech copy for checklist labels, empty/loading/error states. This PRD is the content spec; the designer owns surface + flow.
- **Data**: Not applicable — plain-language translation does not touch the data model, cohort math, or the privacy architecture. No addendum required in `docs/data/`.
- **Engineering**: `docs/engineering/plain-language-translation.md` — analyst back-end state machine for the publish gate (§8), string-extraction logic per delivery surface, audit-mode read path; not yet drafted. Engineer decides whether this is a new ADR or an implementation note under the existing ADR-0002 (brief storage and delivery), since the review gate is a brief-lifecycle concern rather than a new architectural axis.

## Changelog

- 2026-04-20 — initial draft — product-manager
