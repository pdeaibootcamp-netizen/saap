# Percentile Compute — v0.3

*Owner: data-engineer · Slug: percentile-compute · Last updated: 2026-04-27*

The pure-function spec for `computePercentile()` — the v0.3 replacement for the v0.2 hand-seeded `getBenchmarkSnapshot()` fixture in `src/lib/cohort.ts`. Same return shape (so the dashboard and brief tile components are unchanged), real computation underneath.

This file specifies algorithm, inputs, outputs, floor enforcement, degradation behavior, and the synth-fallback branch. Implementation notes (file location, test layout, perf characteristics) live in the engineer's [cohort-runtime.md](../engineering/cohort-runtime.md).

---

## 1. Upstream links

- Build plan: [docs/project/build-plan.md](../project/build-plan.md) §11.4 Phase 3.1 Track B
- PRD sections: §8.2 (peer position engine), §10 (data foundation), §13.5 (cold-start)
- Decisions:
  - [D-006](../project/decision-log.md) — NACE × size × region segmentation
  - [D-014](../project/decision-log.md) — graceful-degradation, never silent
  - [D-015](../project/decision-log.md) — frozen Czech quartile labels
  - [D-024](../project/decision-log.md) — frozen 8 metrics
  - [D-025](../project/decision-log.md) — synthetic per-NACE quintile fallback
- Companions: [cohort-math.md](cohort-math.md) (canonical floor + ladder rules — reused **verbatim** here, not redefined); [cohort-ingestion.md](cohort-ingestion.md); [synthetic-quintile-policy.md](synthetic-quintile-policy.md); [owner-metrics-schema.md](owner-metrics-schema.md).

---

## 2. Function signature

```ts
export interface PercentileInput {
  metricId:
    | "gross_margin" | "ebitda_margin" | "labor_cost_ratio"
    | "revenue_per_employee" | "working_capital_cycle"
    | "net_margin" | "revenue_growth" | "pricing_power";
  ownerValue: number;          // already-validated, in same unit as cohort_companies (§3 of owner-metrics-schema.md)
  naceDivision: string;        // 2-digit, e.g. "49"
  sizeBand: "S1" | "S2" | "S3";
  region:
    | "Praha" | "Střední Čechy" | "Jihozápad" | "Severozápad"
    | "Severovýchod" | "Jihovýchod" | "Střední Morava" | "Moravskoslezsko"
    | null;                    // null when not yet known (treated as "any region")
}

export interface PercentileResult {
  percentile: number | null;             // 0-100, one decimal; null when below-floor
  quartileLabel:                          // null when below-floor
    | "spodní čtvrtina" | "druhá čtvrtina"
    | "třetí čtvrtina" | "horní čtvrtina"
    | null;
  confidenceState: "valid" | "below-floor" | "empty";
  achievedRung: 0 | 1 | 2 | 3 | 4;        // see cohort-math.md §4.1
  nUsed: number | null;                   // cohort cell size at the rung that won
  source: "real" | "synthetic" | "mixed"; // 'mixed' reserved for v0.4 hybrid
  footnote: string | null;                // canonical Czech rung-footnote, see §5
}

export async function computePercentile(input: PercentileInput): Promise<PercentileResult>;
```

The function is **deterministic given the DB state** — running it twice in the same DB transaction returns the same result. It is async only because it reads from Postgres; the algorithm itself is pure.

---

## 3. Algorithm — real-data path (`source = 'real'`)

When `cohort_companies` has rows for `(naceDivision, …)` with the requested `metricId` populated, the function takes the real-data path. It is the standard percentile-rank with mid-rank tie handling.

### 3.1 Cohort selection (rung 0)

```sql
SELECT <metric_column> AS v
FROM cohort_companies
WHERE nace_division = $1
  AND size_band     = $2
  AND cz_region     = $3        -- skipped at rungs 1, 3
  AND <metric_column> IS NOT NULL;
```

`<metric_column>` is the column on `cohort_companies` matching `metricId` ([cohort-ingestion.md §3](cohort-ingestion.md)). At v0.3 this is `net_margin` or `revenue_per_employee`; the other six metrics never reach this branch (they fall to §6 synth).

### 3.2 Floor check

Per [cohort-math.md](cohort-math.md) §3.1 + §3.2:

- **Global floor:** `n >= 30`.
- **Stricter per-metric floor:** `n >= 50` for `working_capital_cycle` and `pricing_power`.

These rules are reused verbatim from `cohort-math.md`; this file does not redefine them.

If `n` does not meet the relevant floor, drop to the next rung (§5).

### 3.3 Winsorization

Per [cohort-math.md](cohort-math.md) §5.2: winsorize the cohort values at the 1st and 99th percentile **within the cell** before computing the owner's rank. This protects against data-entry typos in `cohort_companies` distorting the cell. Winsorized firms still count toward `n`.

### 3.4 Percentile rank — Hyndman & Fan type 4 (SAS-equivalent definition 1)

The mid-rank percentile rank of the owner's value `x` against a cohort of `n` winsorized values `v_1, …, v_n`:

```
rank(x) = #{ i : v_i  <  x }
        + 0.5 * #{ i : v_i  =  x }       // mid-rank for ties
percentile(x) = (rank(x) / n) * 100
```

Equivalently: the share of cohort values strictly less than `x`, plus half the share equal to `x`, scaled by 100.

This corresponds to **Hyndman & Fan (1996) type 4** quantile-inverse / percentile-rank definition (the SAS `PROC RANK PERCENT` definition with mid-tie handling). Chosen over the average-rank definition in [cohort-math.md](cohort-math.md) §6.2 (which uses `(rank − 0.5) / N`) because it is the canonical method when the input is the owner's own raw value (not their position among already-collected firms) and avoids edge effects at the cohort extremes — the v0.3 owner is not a member of `cohort_companies`.

**Important consistency note.** [cohort-math.md](cohort-math.md) §6.2's average-rank method assumes the owner's row is one of the cohort rows being ranked; v0.3's compute treats the owner as an external query against `cohort_companies` (the owner is in `owner_metrics`, not `cohort_companies`). Both methods agree to within 1/N when n ≥ 30; the type-4 form is the right algebra for the v0.3 query shape. Cross-link logged as [OQ-PC-01](#9-open-questions).

Output: `percentile` rounded to one decimal place.

### 3.5 Percentile → quartile label

Per [cohort-math.md](cohort-math.md) §6.1, frozen Czech labels per [D-015](../project/decision-log.md). Boundaries inclusive on the upper side:

| Range | Label |
|---|---|
| `percentile < 25` | `"spodní čtvrtina"` |
| `25 ≤ percentile < 50` | `"druhá čtvrtina"` |
| `50 ≤ percentile < 75` | `"třetí čtvrtina"` |
| `75 ≤ percentile ≤ 100` | `"horní čtvrtina"` |

`percentile = 25` → druhá čtvrtina; `percentile = 75` → horní čtvrtina; `percentile = 100` → horní čtvrtina. Implementer note: a value exactly at a boundary is rare given mid-rank arithmetic but the rule is fixed regardless.

### 3.6 Inverted-direction metrics

Two of the eight metrics' "verdict polarity" runs opposite to a higher percentile being better:

- `working_capital_cycle` — fewer days are better (lower percentile is the strong end).
- `labor_cost_ratio` — lower ratio is better.

`computePercentile()` does **not** invert the percentile or the quartile label — it returns the raw rank against the cohort distribution. The brief / tile copy layer applies the direction-of-good-ness when generating verdict text. This keeps the function single-purpose and matches the cohort-math.md §5.1 contract ("Quartile mapping is therefore inverted for this metric in the verdict-copy layer, not in the computation.").

---

## 4. Confidence state and `confidenceState` field

| Outcome | `confidenceState` | `percentile` | `quartileLabel` | `achievedRung` |
|---|---|---|---|---|
| Real or synth cell at any rung clears the floor and a percentile was computed. | `"valid"` | computed value | computed label | 0 / 1 / 2 / 3 |
| All four rungs fail the floor (or no real cohort data + no synth row exists). | `"below-floor"` | `null` | `null` | `4` |
| `cohort_companies` has zero rows for that NACE **and** `cohort_aggregates` has no row for `(naceDivision, metricId)`. | `"empty"` | `null` | `null` | `4` (degenerate) |

`"empty"` is distinct from `"below-floor"` for analyst debugging — the former says "we have nothing for this NACE × metric at all"; the latter says "we have data but it does not pass the validity bar". Tile UI ([in-tile-prompts.md §3](../product/in-tile-prompts.md)) renders both as the same below-floor state — the distinction is internal.

---

## 5. Degradation rungs

Reused **verbatim** from [cohort-math.md](cohort-math.md) §4.1. The function applies the ladder in order and uses the first rung that clears the relevant floor. The owner-facing footnote is canonical Czech, frozen here so the dashboard and brief renderers do not have to re-author it.

| Rung | Cohort scope | Floor check | `footnote` (canonical Czech) |
|---|---|---|---|
| 0 | `(naceDivision, sizeBand, region)` | global N≥30; metric-strict N≥50 for working_capital_cycle / pricing_power | `null` |
| 1 — drop region | `(naceDivision, sizeBand)` | same floors | `"Srovnání s českými firmami vaší velikosti v oboru — bez regionálního rozlišení."` |
| 2 — drop size | `(naceDivision, region)` | same floors | `"Srovnání s firmami ve vašem regionu a oboru — napříč velikostmi."` |
| 3 — drop both | `(naceDivision)` | same floors | `"Srovnání s českými firmami ve vašem oboru."` |
| 4 — suppress | n/a | floor failed at every rung | `"Tato hodnota není k dispozici — počet firem v kohortě je zatím příliš nízký pro spolehlivé srovnání."` |

The footnote at rung 0 is `null` because the snippet at rung 0 needs no qualifier — it already implies "your NACE, your size, your region". The tile / brief renderer uses the footnote verbatim when present.

If `region` arrives as `null` in the input, rungs 0 and 2 are skipped (they require region); the function starts at rung 1 and falls through to rung 3 / 4 from there.

---

## 6. Synth-fallback path (`source = 'synthetic'`)

Per [D-025](../project/decision-log.md). When `cohort_companies` has insufficient real data for a `(naceDivision, metricId)` cell at every rung, the function reads the synth row from `cohort_aggregates` (see [synthetic-quintile-policy.md](synthetic-quintile-policy.md)) and computes the percentile by linear interpolation between the stored quintile boundaries.

### 6.1 Synth lookup

```sql
SELECT q1, q2, median, q3, q4, n_proxy
FROM cohort_aggregates
WHERE nace_division = $1
  AND metric_id     = $2
  AND source        = 'synthetic';
```

The synth row has no size or region partition at v0.3 — it is per-`(naceDivision, metricId)` only. Refining the synth grain to size × region is an explicit non-goal at v0.3; the synth row applies to any rung that the real path could not satisfy.

### 6.2 Interpolation algorithm

The synth row stores 4 quintile cut-points (q1=20th, q2=40th, median=50th, q3=60th, q4=80th percentile). Plus implicit endpoints — see §6.4. Compute the owner's percentile by piecewise-linear interpolation:

```
boundaries = [
  (-Infinity,   0),     // implicit lower endpoint
  (q1,         20),
  (q2,         40),
  (median,     50),
  (q3,         60),
  (q4,         80),
  (+Infinity, 100),     // implicit upper endpoint
]

For owner_value x:
  find the segment (v_lo, p_lo), (v_hi, p_hi) such that v_lo <= x <= v_hi.
  if v_lo == -Infinity: percentile = max(0, min(20, linear extrapolation)).
                         clamp to [0, 20] — owner below q1 sits in spodní čtvrtina.
  if v_hi == +Infinity: percentile = clamp(80 + linear extrapolation toward 100, 80, 100).
  otherwise:
    percentile = p_lo + (x - v_lo) / (v_hi - v_lo) * (p_hi - p_lo).
```

In words: the percentile rises linearly between adjacent stored quintiles. The endpoints clamp so an owner far below `q1` reads as the floor of the lowest quintile band rather than a runaway negative percentile.

### 6.3 Determinism

The interpolation has no random component. Re-running on the same (q1, q2, median, q3, q4, owner_value) tuple returns the same percentile to floating-point precision. Round to one decimal in the result.

### 6.4 Floor on synth path

[D-025](../project/decision-log.md) treats both sources uniformly at the consumer. The synth row's `n_proxy` column ([synthetic-quintile-policy.md §2](synthetic-quintile-policy.md)) is the "claimed-equivalent" cohort size. v0.3 sets `n_proxy = 200` on every DE-authored synth row — large enough to clear any floor, signaling explicitly that the synth row is not gated by the same statistical-validity logic that gates real cells. **Synth rows never trigger rung 4**; if a synth row exists for the cell, it always returns a percentile.

This is a deliberate v0.3 simplification: the floor protects against insufficient real data, and a synth row is, by construction, designed to be sector-plausible at any cell size. The synthetic-quintile-policy treats the question of "synth quality at small cells" structurally instead, by capping per-NACE quintile spread.

---

## 7. Output examples

### 7.1 Real-data, rung 0

```ts
{
  percentile: 47.0,
  quartileLabel: "druhá čtvrtina",
  confidenceState: "valid",
  achievedRung: 0,
  nUsed: 84,
  source: "real",
  footnote: null,
}
```

### 7.2 Real-data, rung 2 (size dropped)

```ts
{
  percentile: 71.5,
  quartileLabel: "třetí čtvrtina",
  confidenceState: "valid",
  achievedRung: 2,
  nUsed: 142,
  source: "real",
  footnote: "Srovnání s firmami ve vašem regionu a oboru — napříč velikostmi.",
}
```

### 7.3 Synth fallback (any rung — synth ignores rung partitioning)

```ts
{
  percentile: 38.0,
  quartileLabel: "druhá čtvrtina",
  confidenceState: "valid",
  achievedRung: 3,                  // synth applies at NACE-only grain
  nUsed: 200,                        // n_proxy
  source: "synthetic",
  footnote: "Srovnání s českými firmami ve vašem oboru.",
}
```

### 7.4 Below-floor (no real data, no synth row)

```ts
{
  percentile: null,
  quartileLabel: null,
  confidenceState: "below-floor",
  achievedRung: 4,
  nUsed: null,
  source: "real",                    // no synth was found
  footnote: "Tato hodnota není k dispozici — počet firem v kohortě je zatím příliš nízký pro spolehlivé srovnání.",
}
```

---

## 8. Privacy posture

`computePercentile()` reads from `cohort_companies` and `cohort_aggregates` — both industry-data tables, neither user-contributed in the consent sense. The `ownerValue` argument arrives in-process from `owner_metrics` (which is consent-bound); the function does not itself read or write `owner_metrics`. The function emits cohort-level percentiles only — no per-firm IČO, name, or row leaks into the result.

The function is a candidate for `analyst_aggregate_role` SECURITY DEFINER wrapping for the analyst debug view ([owner-metrics-schema.md §4](owner-metrics-schema.md)); raw `cohort_companies` rows stay non-readable from that role.

---

## 9. Open questions

| ID | Question | Assumed-for-now | Blocks |
|---|---|---|---|
| OQ-PC-01 | Reconcile percentile-rank algebra: cohort-math.md §6.2 specifies average-rank `(rank − 0.5)/N`; this file specifies Hyndman & Fan type 4 mid-rank for the external-owner case. They agree to within 1/N. | Type-4 at v0.3 (external owner is the right conceptual fit). Update cohort-math.md §6.2 with a forward-pointer in a future edit. | None — both methods produce the same quartile label at n≥30 in 99 %+ of cases. |
| OQ-PC-02 | Does the synth path eventually need its own floor, or is `n_proxy` enough as a uniformity signal? | `n_proxy = 200` uniformly; floor is real-only at v0.3. | v0.4 mixed-source statistics. |
| OQ-PC-03 | When real-data rung 3 clears for a metric but a synth row also exists, which wins? | **Real always supersedes synth** when both exist (per D-025). The function checks `cohort_companies` first; only if all four rungs fail does it consult `cohort_aggregates`. | None at v0.3 (mutually exclusive coverage by metric for NACE 49). |

---

## Changelog

- 2026-04-27 — initial draft for v0.3. Specifies `computePercentile()` pure-function contract: input/output types, real-data path with Hyndman & Fan type 4 mid-rank percentile and 1st/99th winsorization, floor enforcement reusing cohort-math.md §3.1–§3.3 verbatim, four-rung degradation ladder with canonical Czech footnotes, synth-fallback path via piecewise-linear interpolation across stored quintile boundaries with `n_proxy = 200` uniformly, deterministic-on-DB-state guarantee, and three open questions logged. — data-engineer
