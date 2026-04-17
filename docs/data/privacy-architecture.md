# Privacy Architecture — Strategy Radar MVP

*Owner: data-engineer · Slug: privacy-architecture · Last updated: 2026-04-17*

This is the load-bearing privacy foundation for MVP. It defines the four data lanes, the consent ledger that implements [D-007](../project/decision-log.md) (single opt-in), the revocation semantics that [D-008](../project/decision-log.md) surfaces in Settings, the no-training-on-client-data commitment from PRD §10, the federated-learning + differential-privacy posture (design-forward where MVP does not yet use it), and the dormant RM lane stub so Increment 2 does not require a retrofit.

A cold reader implementing MVP should be able to stand up lane separation, consent capture, and revocation from this document alone. Anything not yet decidable is named as an open question, not hand-waved.

---

## 1. Upstream links

- Build plan: [docs/project/build-plan.md](../project/build-plan.md) §4 (Phase 1 Foundation).
- Backlog: [docs/project/backlog.md](../project/backlog.md) B-001, B-002 (both deferred; MVP is a time-boxed trial <1 month).
- Decisions:
  - [D-001](../project/decision-log.md) — hand-assigned cohorts on pre-populated data at MVP.
  - [D-002](../project/decision-log.md) — no RM lead signal surface at MVP (lane must still exist architecturally, dormant).
  - [D-003](../project/decision-log.md) — 8 MVP ratios.
  - [D-006](../project/decision-log.md) — brief personalization grain = NACE only at MVP; size/region only via embedded snippet.
  - [D-007](../project/decision-log.md) — single opt-in covering all lanes.
  - [D-008](../project/decision-log.md) — single-screen consent UX; revocation in Settings > Soukromí.
- PRD sections: §3 (trust barrier), §4 (non-goals — no credit-risk signaling), §7.5 (privacy as product), §7.6 (opportunity-only RM framing), §8.3 (RM lead signal architecture), §10 (data and technical foundation), §13.3 (lead-generation vs trust-barrier risk).
- Companion: [docs/data/cohort-math.md](cohort-math.md) — cohort segmentation and computation rules referenced here.
- Downstream alignment required: [docs/design/trust-and-consent-patterns.md](../design/trust-and-consent-patterns.md) (designer authors in parallel; this file is the data-side half of that reconciliation per [D-008](../project/decision-log.md) note).

---

## 2. The four data lanes — architectural separation

Separation is enforced at three layers. If any one layer is compromised, the other two must still prevent cross-lane leakage.

| Lane | What it holds | Storage (MVP target) | Pipeline role | May enter base-model training? | RM-visible? | Retention default |
|---|---|---|---|---|---|---|
| **`brief`** | Analyst-authored brief content, sector templates, curated sector intelligence. No per-user data. | `brief_db` (relational; authored via analyst back-end per [ADR-0002](../engineering/adr-0002-brief-storage-and-delivery.md)). | Feeds brief rendering (email / web / PDF); eligible for RAG retrieval in later increments. | **No** — PRD §10 commitment applies to all client-derived data. Brief content itself is authored, not client-derived, and *may* feed RAG retrieval. It does **not** enter base-model training. | Indirectly — same brief an owner reads may be read by their RM in Increment 2+, but the brief is not RM-private content. | Versioned indefinitely (authored content; no personal data). |
| **`user_contributed`** | Onboarding inputs (NACE, size band, region), any future give-to-get responses (not built at MVP per CLAUDE.md guardrail), financial figures the owner supplies, product usage (opens, time-on-brief). | `user_db` (relational, per-user rows keyed by `user_id`). | Feeds cohort computation (anonymized, floored — see [cohort-math.md](cohort-math.md)); feeds personalization of brief selection at MVP grain (NACE only, per D-006). | **No** — hard boundary. Enforced by pipeline allow-list (§3). | **No** at MVP — RM lane is dormant (D-002). Becomes selectively visible in Increment 2+ via the `rm_visible` lane, only for fields with a consented opportunity-framing purpose. | Retained on revocation per [D-012](../project/decision-log.md) Option A; see §5. |
| **`rm_visible`** (dormant at MVP) | Derived opportunity-flavored signals about consented clients. **Empty at MVP**; schema exists, no rows written. | `rm_lead_db` (separate schema/credentials from `user_db`; read-only surface TBD in Increment 2). | Derives from `user_db` via a signal-generation pipeline that does not exist yet (Increment 2). Every row must carry a `consent_event_id` FK — no signal without a consent trace. | **No.** | **Yes** (by definition; gated per-signal by `consent_event_id`). Dormant at MVP means no such rows exist. | TBD in Increment 2 planning. |
| **`credit_risk`** | ČS credit-risk data. **Not in this product's data plane** — architecturally outside Strategy Radar. | Separate ČS credit-risk systems, outside Strategy Radar's network boundary. | No pipeline. No read path from Strategy Radar into credit-risk systems. No write path from Strategy Radar into credit-risk systems. | **No.** | **No.** | N/A — out of product scope. |

### 2.1 Three enforcement layers

1. **Storage isolation.** Each lane is a separate database (or, at minimum, a separate schema with its own credentials and network path). `brief_db`, `user_db`, and `rm_lead_db` are three distinct principals. No single service account has read+write on more than one lane. The credit-risk plane is not reachable from any Strategy Radar service account.
2. **Pipeline allow-list.** Every ETL/ELT job declares its `source_lane` and `sink_lane` in a manifest. A deploy-time check fails any job whose `(source, sink)` pair is not on the allow-list (§3). This blocks silent cross-lane joins.
3. **Egress filter on base-model training.** Any training pipeline (at MVP: none; design-forward: RAG embedding refresh) reads only from `brief_db`. A runtime check asserts the dataset manifest has zero rows from `user_db` or `rm_lead_db` before training can proceed. If the product ever acquires a base-model fine-tuning job, the egress filter fails it by default.

### 2.2 Every field names its lane

In every downstream data-model doc (e.g., `docs/data/<feature-slug>.md`), each field declares its lane in the data-model table. This is the policy enforced by the data-engineer agent prompt; it is also the default posture: if a field's lane isn't named, it isn't approved.

---

## 3. Pipelines and lane boundaries at MVP

Named pipelines, in declarative manifest form, with the lane boundary each crosses or does not cross.

| Pipeline | Source lane | Sink lane | Crosses boundary? | Purpose | Gated by |
|---|---|---|---|---|---|
| `brief_author_publish` | `brief` | `brief` | No | Analyst finalizes brief version → published to rendering layer. | Role-based access in analyst back-end ([ADR-0001](../engineering/adr-0001-tech-stack.md)). |
| `brief_render_delivery` | `brief` + `user_contributed` (lookup only: `user_id → NACE`) | (ephemeral render; no sink) | Controlled read-only lookup | Select the correct brief for an owner based on NACE (D-006). | User opt-in (consent event). |
| `user_ingest_onboarding` | user input (direct) | `user_contributed` | No | Capture NACE, size, region, any financial figures the owner supplies. | Consent event stored before first row written. |
| `user_ingest_prepopulated` | ČS pre-populated dataset (MVP seed per D-001) | `user_contributed` | No (brought in under pre-existing ČS data agreements, not a cross-lane flow within the product) | Seed hand-assigned cohort members at MVP. | Separate legal basis: pre-existing ČS data-handling consent from banking relationship. See [OQ-003](../project/open-questions.md). |
| `cohort_compute_batch` | `user_contributed` (anonymized extract) | `cohort_stats` (derived snapshot, treated as `brief`-lane for distribution since it contains no per-user rows) | No per-user data leaves; only cohort-level percentiles leave. | Compute percentile snapshots for the 8 MVP ratios per cell (see [cohort-math.md](cohort-math.md)). | Statistical-validity floor must be met per cell; otherwise cell is suppressed. |
| `rm_signal_generation` | **not run at MVP** | `rm_visible` | Would cross; **disabled at MVP** (D-002). | Increment 2+. | Per-signal `consent_event_id`. |
| `base_model_training` | **`brief` only** | model artifact (external) | No (allow-list excludes `user_contributed` + `rm_visible`) | RAG embedding refresh at later increments. No fine-tuning on client data ever (PRD §10). | Egress filter (§2.1 layer 3). |

**Allow-list (MVP-live only):**
- `brief → brief`
- `brief → (render)`
- `user_contributed (read, NACE only) → (render)`
- `(direct input) → user_contributed`
- `(ČS pre-populated seed) → user_contributed`
- `user_contributed → cohort_stats` (anonymized, floored)

Any job not on this list fails deploy.

---

## 4. Consent model — implementing D-007 single opt-in

D-007 locks a **single opt-in covering all lanes**. The UX surface is D-008's single-screen plain-language declaration, written as reassurance (what the bank does NOT do, then what it does) with all four lanes represented educationally — not as per-lane toggles.

### 4.1 Consent ledger — schema

Append-only. Each consent event is immutable; revocation is a new event referencing the prior one.

| Field | Type | Notes |
|---|---|---|
| `consent_event_id` | UUID | Primary key. Referenced by every downstream row that depends on consent. |
| `user_id` | UUID | FK to `user_db.users`. |
| `event_type` | enum | `grant` or `revoke`. |
| `ts` | timestamp (UTC) | When the event was captured. |
| `consent_version` | string | E.g. `"v1.0-2026-04"`. Pins which consent text the user saw. The consent-copy corpus is versioned in `consent_copy` table (content owned by design + legal, not data-engineer). |
| `lanes_covered` | array | At MVP: always `["brief","user_contributed","rm_visible","credit_risk"]` — the full four-lane declaration, using the canonical lane identifiers per [D-010](../project/decision-log.md). Array form future-proofs per-lane toggles if D-007 is ever revised. `"credit_risk"` in this array is the declaration that credit data is **not** used — it names the architectural boundary, not a lane the user grants access to. |
| `surface` | enum | `onboarding-screen`, `settings-soukromi`, `rm-introduction-flow` (Increment 2+). |
| `prior_event_id` | UUID, nullable | For `revoke` events, points at the `grant` being revoked. Null for `grant` events. |
| `captured_text_hash` | sha256 | Hash of the consent copy the user actually saw (retrieved from `consent_copy` by `consent_version`). Audit-trail integrity. |
| `ip_prefix` | string, optional | Truncated IP prefix (e.g., /24) for audit only. Full IP not stored. |
| `channel` | enum | `direct-signup`, `rm-referred-george-embed`. |

### 4.2 Downstream reference contract

Every row in any lane whose existence depends on the user's consent **must** carry a `consent_event_id` FK resolvable to a `grant` event that has not been superseded by a `revoke` at read time. Specifically:

- `user_db` rows: `consent_event_id` NOT NULL.
- `rm_lead_db` rows (Increment 2+): `consent_event_id` NOT NULL; additionally resolved to a non-revoked grant at **signal-generation time** and again at **RM-read time**.
- `cohort_stats` snapshots: carry the list of `consent_event_id`s that contributed. A per-user revocation triggers recomputation per §5.

### 4.3 What a consent record *means*

A `grant` event says: "This user, on date X, saw consent copy version V, and granted a single opt-in that (a) permits user-contributed data to exist in `user_db` and feed anonymized cohort computation, (b) permits RM-lane-derived opportunity-framed signals in Increment 2+, (c) acknowledges the architectural boundary against credit-risk data, (d) does **not** permit any training of base models on client data."

(d) is structural, not consentable: the consent copy reassures the user it will not happen; the system cannot offer it even if asked.

---

## 5. Revocation downstream semantics — D-012 Option A (stop future flow only)

D-007 + D-008 lock **one revocation action** (not per-lane). [D-012](../project/decision-log.md) locks **Option A — stop future flow only** as the downstream semantic. This section describes the resulting behavior.

### 5.1 What "revoke" does downstream

When a user fires the single revoke control in Settings > Soukromí, the system writes a `revoke` consent event (schema per §4.1) and from that point forward:

- **Brief delivery stops.** The user is no longer selected for email / web / PDF brief delivery. The `brief_render_delivery` pipeline filters the user out at read time by resolving `consent_event_id` against the ledger and treating any user whose latest event is `revoke` as outside current consent.
- **Ingestion stops.** `user_ingest_onboarding` refuses new writes for this user. `user_ingest_prepopulated` is a one-shot seed and does not re-run per-user, so no ongoing pipeline re-ingests.
- **Future cohort computations exclude the user.** The next run of `cohort_compute_batch` filters out rows whose owning user's latest consent event is `revoke`. If this drops a cell below the statistical-validity floor on that run, the cell degrades per [cohort-math.md](cohort-math.md) §4.1 on the next snapshot — expected behavior, not a bug.
- **Increment 2+ `rm_visible` signals stop.** When the RM lane activates, `rm_signal_generation` filters revoked users out at read time; RM-facing queries additionally re-check `consent_event_id` at RM-read time (§4.2).

**What revoke does NOT do:**

- **No deletion of `user_db` rows.** Existing `user_contributed` data is retained.
- **No deletion or recompute of published `cohort_stats` snapshots.** Aggregates the user contributed to before revocation remain intact; already-delivered briefs stay self-consistent.
- **No anonymization step.** Rows keep their `user_id`.

Revocation is reversible: a subsequent `grant` event returns the user to active consent status, and the retained `user_contributed` rows are usable again from that point.

### 5.2 Enforcement point

Downstream pipelines enforce revocation by **checking `consent_event_id` at read time** against the consent ledger. Specifically, for any pipeline that reads from `user_db` or `rm_lead_db`, the read joins to the ledger and filters to rows where the latest event for the owning `user_id` is a `grant` (not `revoke`). This puts the enforcement in the data plane, not in application logic — no pipeline can accidentally process revoked users by forgetting to check.

### 5.3 Trade-off acknowledged (pointer to legal review)

D-012's Option A is the simplest implementation and fits the <1-month MVP trial: no backfill cost, no recompute cost, no historical-brief drift. The accepted trade-off is that a user invoking GDPR Art. 17 "right to erasure" explicitly is not satisfied by the revoke action alone — a separate erasure pathway may need to exist as a distinct Settings action (not "withdraw consent") once this becomes load-bearing. Flagged to legal review via [OQ-004](../project/open-questions.md); see [D-012](../project/decision-log.md) for the full rationale and rejected alternatives (Option B delete-per-user; Option C delete-everything-including-aggregates).

---

## 6. Reconciliation with D-008 — single-screen UX, single revocation action

D-008 specifies: single-screen plain-language four-lane declaration on first brief view; revocation in Settings > Soukromí.

Under D-007's single opt-in, **revocation is a single action, not per-lane.** The Settings > Soukromí surface shows one revoke control that revokes the entire consent grant. The four-lane declaration on both the onboarding screen and the Settings page is **educational** (transparency about what the bank does / does not do with each lane), not a set of toggles.

Confirmed constraints for the designer's [trust-and-consent-patterns.md](../design/trust-and-consent-patterns.md):
- No per-lane toggle UI at MVP. If the designer draws a four-lane layout, each lane is a reassurance statement, not a control.
- One revoke control in Settings > Soukromí. On click → confirmation dialog → fires the `revoke` consent event → downstream semantics per §5 (D-012 Option A: stop future flow only, no deletion).
- Revocation is reversible by a new `grant` event. Under D-012 Option A, retained `user_contributed` rows are usable again from the re-grant forward — re-consent restores active status without any data-restoration step.
- Legal review of consent copy is a Phase 1 dependency flagged in D-008. No consent events are captured in production until legal sign-off. See [OQ-004](../project/open-questions.md).

---

## 7. No-training-on-client-data commitment — how the boundary holds

PRD §10 and Principle 7.5 commit that client data never enters base-model training. This is architectural, not policy-only.

**The boundary:**
1. **Allow-list in pipeline manifest (§3)** excludes `user_contributed` and `rm_visible` as sources for any training sink.
2. **Egress filter** on any training job asserts the dataset manifest contains zero rows from `user_db` or `rm_lead_db`. Failure aborts the job and pages the data-engineer on-call rotation (TBD per Increment 2 ops).
3. **Service-account separation.** The account that can read `user_db` cannot write to any model-training store. The account that runs training cannot read `user_db`.
4. **Brief-lane-only RAG.** At MVP there is no model training at all. When RAG embedding refresh appears in a later increment, its source is `brief_db` only. Per-user personalization of briefs at MVP is sector selection (NACE lookup, D-006) — no per-user LLM context. Client data does not reach a model at inference or training time at MVP.
5. **Audit.** Any training job logs the manifest hash and source-lane inventory into an append-only audit store, retained indefinitely.

If a future increment proposes to change any of layers 1–5, that is a **privacy-architecture change** and must be escalated to the orchestrator before design proceeds.

---

## 8. Federated learning + differential privacy — MVP posture vs design-forward

PRD §10 names federated learning (FL) + differential privacy (DP) as the cohort-computation architecture. Under [D-001](../project/decision-log.md) (hand-assigned cohorts on pre-populated data), MVP does **not** yet exercise FL or DP in the full sense. Being explicit matters.

### 8.1 What MVP actually does

- Cohort assignment is **manual** (hand-assigned per D-001) against a **pre-populated seed dataset** supplied by ČS under pre-existing client data agreements.
- Cohort statistics are computed as a **centralized batch** over the `user_db` extract, with the statistical-validity floor enforced (see [cohort-math.md](cohort-math.md) §3–§4).
- No federated rounds. No DP noise injection at MVP. The cohort stats pipeline reads per-user rows in a single trusted environment and emits anonymized cohort-level aggregates (no per-user rows leave the pipeline's trust boundary).
- The trust boundary at MVP is: cohort-compute runs inside the same data plane that already holds `user_db` — no new trust boundary is crossed, so DP's purpose (bounding information leakage across a boundary) is not yet load-bearing. The **floor** does the privacy work at MVP: below the floor, no percentile is emitted; at or above, the aggregate is low-re-identification-risk by construction.

### 8.2 What is design-forward (Increment 2+)

- When user count grows and computation moves toward per-client-device or per-branch enclaves, **federated aggregation** replaces the centralized batch. Per-user gradients / partial sums leave their local environment; only aggregated stats leave a round.
- **Differential privacy** (calibrated ε, TBD per-metric) is injected at the aggregation step to bound the information any single user contributes to a published stat. This becomes necessary once we are publishing stats from a population that crosses multiple trust boundaries, or as cohorts shrink toward the floor and the marginal contribution of one user becomes re-identifying.
- The ε budget per metric, the global ε budget per user per month, the noise mechanism (Gaussian vs Laplace), and how DP interacts with the floor are all **Increment 2 decisions**. Flagged as [OQ-017](../project/open-questions.md).

### 8.3 What MVP design must preserve so Increment 2 is not a retrofit

- Cohort stats are written as **snapshots** (versioned per run), not as a mutable table. FL/DP rollouts will add new snapshot producers; the consumer contract stays stable.
- Cohort stats schema includes `method` (`centralized-batch-v1` at MVP; `federated-dp-v1` in Increment 2) and `epsilon` (null at MVP; populated in Increment 2) from day one.
- The statistical-validity floor is enforced by the snapshot producer, not by the consumer — so swapping producers does not weaken the floor.

---

## 9. RM lane dormant state — architectural presence without MVP exposure

D-002 defers the RM lead signal surface. The **lane must still exist architecturally** so Increment 2 does not require a retrofit (which would be the worst case: a schema change at the exact moment consent framing is stress-tested by real RM use).

### 9.1 What MVP ships for the RM lane

- `rm_lead_db` schema created and deployed, with zero rows.
- Schema includes `consent_event_id` (NOT NULL, FK), `signal_type`, `signal_payload` (opportunity-framed text per PRD §7.6 / §8.3), `derived_from_snapshot_id` (cohort-stats snapshot FK), `created_at`, `framing_review_status` (enum — enforces the opportunity-only rule; see §9.2).
- Separate service account / credentials from `user_db` and `brief_db`. Separate network path. At MVP, no service has write access; only a stub health-check has read access to confirm the empty schema is reachable.
- No UI surface at MVP — there is no RM-facing view until Increment 2.
- The consent ledger already captures `rm_visible` in `lanes_covered` under D-007's single opt-in, so when Increment 2 activates the lane, existing grants cover it (per D-007's acknowledged trade-off that a re-consent event may or may not be needed — Phase 1 legal review is expected to confirm whether D-007's text is broad enough; see [OQ-004](../project/open-questions.md)).

### 9.2 Framing-review gate (stub at MVP, active in Increment 2)

The `framing_review_status` enum (values: `pending`, `opportunity-approved`, `rejected-risk-flavored`) is the mechanism that enforces PRD §7.6 in data. At Increment 2:
- Every `rm_lead_db` row starts `pending`.
- A human review step (designer + PM co-own the review process) flips it to `opportunity-approved` or `rejected-risk-flavored`.
- RM-facing read queries filter on `framing_review_status = 'opportunity-approved'` — a risk-flavored signal cannot accidentally reach an RM.

At MVP this field exists and is indexed; no rows populate it.

### 9.3 What MVP must NOT do (to keep the lane dormant but retrofit-free)

- No pipeline job produces `rm_lead_db` rows at MVP.
- No service-account grant allows writing to `rm_lead_db` at MVP.
- No UI surface, no API endpoint, no analyst back-end view exposes `rm_lead_db` at MVP.

---

## 10. Consent dependencies (summary, for cross-artifact traceability)

Every MVP feature whose data path touches `user_db` depends on a `grant` consent event being present and non-revoked at the time of the data operation. At MVP that is effectively every feature except pure brief authoring (`brief_db` only).

| Feature (from build plan §5) | Consent dependency |
|---|---|
| Sector Profile Configuration | `grant` required before first `user_db` write. |
| Monthly Briefing Generation | `grant` required before brief delivery (even though brief content is brief-lane, delivery personalizes via `user_db` NACE lookup). |
| Observation Generation | No direct dependency — content is brief-lane. |
| Plain-Language Translation | No direct dependency. |
| Action Specificity Framing | No direct dependency. |
| Percentile Position Calculation | `grant` required — cohort computation reads from `user_db`. |
| Quartile Position Display | Inherits from Percentile Position Calculation. |
| Category-Based Layout | No direct dependency (presentation of already-computed snippets). |
| Multi-Format Delivery | Inherits from Monthly Briefing Generation. |

Consent copy itself is owned by the designer + legal, not this document.

---

## 11. Open questions

Cross-referenced with [docs/project/open-questions.md](../project/open-questions.md). This file proceeds under the listed assumption for each; a resolution may require a revision.

| ID | Question | Assumed-for-now | Blocks |
|---|---|---|---|
| OQ-001 | Revocation downstream semantics. | **Resolved — [D-012](../project/decision-log.md) Option A (stop future flow only, no deletion).** See §5. | Closed. |
| OQ-003 | Legal basis for the ČS pre-populated seed dataset used for hand-assigned cohorts (D-001). Does existing ČS banking-relationship consent cover Strategy Radar ingestion, or is a new consent required? | Covered by existing ČS agreements. | Phase 2 data ingestion. |
| OQ-009 | When an MVP user revokes, do we **delete** their `user_db` rows or **irreversibly anonymize**? | **Moot under [D-012](../project/decision-log.md) Option A — no deletion occurs.** | Closed. |
| OQ-004 | Legal review of D-007 consent copy: is the single-opt-in text in the onboarding screen broad enough to cover `rm_visible` activation in Increment 2 without a re-consent event? Also covers the GDPR Art. 17 erasure-pathway gap flagged in §5.3 under D-012. | Assume re-consent may be required in Increment 2; design consent copy to be forward-compatible. | Phase 1 consent-copy drafting; Increment 2 RM activation. |
| OQ-017 | ε (differential privacy budget) per metric and per user per month for Increment 2. | Not set at MVP; snapshot schema reserves the `epsilon` field. | Increment 2 FL/DP rollout. |

---

## Changelog

- 2026-04-17 — initial draft — data-engineer. Defines four lanes with three enforcement layers, consent ledger schema implementing D-007, revocation options (A/B/C) with Option B recommended and escalated to orchestrator via Q-001, D-008 reconciliation (single revoke action under single opt-in), no-training-on-client-data boundary, MVP-vs-Increment-2 FL/DP posture, dormant RM lane schema with framing-review gate stub.
- 2026-04-17 — applied [D-010](../project/decision-log.md) (canonical lane identifiers `brief` / `user_contributed` / `rm_visible` / `credit_risk`) to §2 four-lane table, §3 pipeline + allow-list, §4.1 `lanes_covered` ledger field, §7 egress-filter allow-list prose, §9 RM lane reference; infrastructure namespace names (`brief_db`, `user_db`, `rm_lead_db`) left unchanged per D-010. Applied [D-012](../project/decision-log.md) (Option A — stop future flow only) to §5: removed A/B/C options-selection apparatus and Option B recommendation + escalation; replaced with locked semantics (no deletion, no anonymization, retention of `user_contributed` rows and published cohort aggregates, read-time `consent_event_id` enforcement), and flagged the GDPR Art. 17 erasure-pathway gap to [OQ-004](../project/open-questions.md). Updated §6 D-008 reconciliation to match. Updated §11 open-questions table to reflect OQ-001 / OQ-009 resolved; realigned stale `Q-NNN` inline links to canonical `OQ-NNN` IDs. — data-engineer
