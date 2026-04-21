/**
 * seed.ts — Idempotent development seed for Strategy Radar MVP trial
 *
 * Run: npm run seed   (from /src directory)
 *
 * Requires env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * AUTH NOTE: src/lib/auth.ts verifyAdminPassword() does a plain string
 * comparison against ADMIN_PASSWORD_HASH. There is no bcrypt in the
 * auth module at MVP trial. To authenticate as analyst:
 *   - Set ADMIN_PASSWORD_HASH=test in your .env.local
 *   - Or omit ADMIN_PASSWORD_HASH entirely — auth.ts falls back to
 *     accepting the literal string "test" when the env var is absent.
 * No hash is generated here because the auth module does not hash.
 *
 * COHORT NOTE: cohort.ts maintains an in-memory SEED_COHORTS array —
 * there is no cohort_stats DB table at MVP. The cohort entries below
 * are seeded via sector_profiles rows; the in-memory array in cohort.ts
 * is the lookup mechanism used by the brief render pipeline.
 * Rung semantics below are descriptive (for test coverage), not DB-enforced.
 *
 * Rung 0 = valid cell (N ≥ 30, all metrics active)
 * Rung 1–3 = partially populated (some metrics suppressed)
 * Rung 4 = below-floor cell (used for negative-path test; no brief suppressed)
 *
 * D-012: no data deleted. Seed is safe to re-run (upsert on conflict).
 * Privacy: consent event written before sector_profile row per §3.1 write-order.
 */

import { createClient } from "@supabase/supabase-js";

// ─── Config ──────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "[seed] ERROR: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local"
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ─── Analyst account ─────────────────────────────────────────────────────────

/**
 * Seed the analyst user.
 * Auth model: plain string comparison in verifyAdminPassword().
 * Action: print instructions for .env.local — no DB row written for admin.
 */
function seedAnalyst(): { created: boolean } {
  console.log("\n[seed] Analyst account:");
  console.log("  Username : analyst");
  console.log("  Password : test");
  console.log(
    "  Action   : Set ADMIN_PASSWORD_HASH=test in your .env.local (or omit it)."
  );
  console.log(
    "             src/lib/auth.ts accepts 'test' when ADMIN_PASSWORD_HASH is absent."
  );
  console.log(
    "  Login    : http://localhost:3000/admin  (password: test)"
  );
  // No DB row — admin auth is env-var based per ADR-0001-D.
  return { created: false }; // already "exists" via env var convention
}

// ─── Cohort cells ─────────────────────────────────────────────────────────────

interface CohortCell {
  label: string;
  nace_sector: string;
  size_band: "S1" | "S2" | "S3";
  region: string;
  rung: number; // descriptive: 0=valid, 1-3=partial, 4=below-floor
  n_firms: number;
}

// 5 cells: 2 valid (rung 0), 3 partially populated (rungs 1-3), 1 below floor (rung 4).
// Note: rung 4 is one of the 5 cells (the 3 partial cells include one rung 4).
const COHORT_CELLS: CohortCell[] = [
  // Rung 0 — valid cells (N >= 30, all metrics active)
  {
    label: "Velkoobchod Praha S2",
    nace_sector: "46",
    size_band: "S2",
    region: "Praha",
    rung: 0,
    n_firms: 42,
  },
  {
    label: "Velkoobchod Praha S1",
    nace_sector: "46",
    size_band: "S1",
    region: "Praha",
    rung: 0,
    n_firms: 38,
  },
  // Rung 1 — partial metrics (some ratios suppressed)
  {
    label: "Potravinářství Jihozápad S2",
    nace_sector: "10",
    size_band: "S2",
    region: "Jihozápad",
    rung: 1,
    n_firms: 22,
  },
  // Rung 2 — mostly suppressed
  {
    label: "IT Střední Čechy S3",
    nace_sector: "62",
    size_band: "S3",
    region: "Střední Čechy",
    rung: 2,
    n_firms: 18,
  },
  // Rung 4 — below floor (negative-path test: N < minimum floor)
  {
    label: "Stavebnictví Severozápad S1",
    nace_sector: "41",
    size_band: "S1",
    region: "Severozápad",
    rung: 4,
    n_firms: 7,
  },
];

// ─── Sector profile rows ──────────────────────────────────────────────────────

interface SectorProfileSeed {
  userId: string;
  email: string;
  nace_sector: string;
  size_band: "S1" | "S2" | "S3";
  region: string;
  source: "prepopulated" | "user_entered";
  label: string; // for logging
}

// 15 sector_profile rows:
// 3 NACE divisions (46, 10, 62) × 2 size bands × 2 regions = 12,
// plus 3 additional in the 41/Severozápad/rung-4 cell and extras.
// All have stable UUIDs so re-runs are idempotent.
const SECTOR_PROFILE_SEEDS: SectorProfileSeed[] = [
  // NACE 46 (Velkoobchod) — Praha — S1 and S2
  { userId: "00000000-5eed-0001-0000-000000000001", email: "user01@example.cz", nace_sector: "46", size_band: "S1", region: "Praha", source: "prepopulated", label: "46/S1/Praha" },
  { userId: "00000000-5eed-0001-0000-000000000002", email: "user02@example.cz", nace_sector: "46", size_band: "S1", region: "Praha", source: "prepopulated", label: "46/S1/Praha" },
  { userId: "00000000-5eed-0001-0000-000000000003", email: "user03@example.cz", nace_sector: "46", size_band: "S2", region: "Praha", source: "prepopulated", label: "46/S2/Praha" },
  { userId: "00000000-5eed-0001-0000-000000000004", email: "user04@example.cz", nace_sector: "46", size_band: "S2", region: "Praha", source: "user_entered", label: "46/S2/Praha" },
  // NACE 46 — Jihozápad — S1 and S2
  { userId: "00000000-5eed-0002-0000-000000000001", email: "user05@example.cz", nace_sector: "46", size_band: "S1", region: "Jihozápad", source: "prepopulated", label: "46/S1/Jihozápad" },
  { userId: "00000000-5eed-0002-0000-000000000002", email: "user06@example.cz", nace_sector: "46", size_band: "S2", region: "Jihozápad", source: "prepopulated", label: "46/S2/Jihozápad" },
  // NACE 10 (Potravinářství) — Praha — S1 and S2
  { userId: "00000000-5eed-0010-0000-000000000001", email: "user07@example.cz", nace_sector: "10", size_band: "S1", region: "Praha", source: "prepopulated", label: "10/S1/Praha" },
  { userId: "00000000-5eed-0010-0000-000000000002", email: "user08@example.cz", nace_sector: "10", size_band: "S2", region: "Praha", source: "user_entered", label: "10/S2/Praha" },
  // NACE 10 — Jihozápad — S1 and S2
  { userId: "00000000-5eed-0010-0000-000000000003", email: "user09@example.cz", nace_sector: "10", size_band: "S1", region: "Jihozápad", source: "prepopulated", label: "10/S1/Jihozápad" },
  { userId: "00000000-5eed-0010-0000-000000000004", email: "user10@example.cz", nace_sector: "10", size_band: "S2", region: "Jihozápad", source: "prepopulated", label: "10/S2/Jihozápad" },
  // NACE 62 (IT) — Praha — S2 and S3
  { userId: "00000000-5eed-0062-0000-000000000001", email: "user11@example.cz", nace_sector: "62", size_band: "S2", region: "Praha", source: "user_entered", label: "62/S2/Praha" },
  { userId: "00000000-5eed-0062-0000-000000000002", email: "user12@example.cz", nace_sector: "62", size_band: "S3", region: "Praha", source: "prepopulated", label: "62/S3/Praha" },
  // NACE 62 — Střední Čechy — S2 and S3
  { userId: "00000000-5eed-0062-0000-000000000003", email: "user13@example.cz", nace_sector: "62", size_band: "S2", region: "Střední Čechy", source: "prepopulated", label: "62/S2/Střední Čechy" },
  { userId: "00000000-5eed-0062-0000-000000000004", email: "user14@example.cz", nace_sector: "62", size_band: "S3", region: "Střední Čechy", source: "prepopulated", label: "62/S3/Střední Čechy" },
  // NACE 41 (Stavebnictví) — Severozápad — S1 (rung-4 / below-floor cell)
  { userId: "00000000-5eed-0041-0000-000000000001", email: "user15@example.cz", nace_sector: "41", size_band: "S1", region: "Severozápad", source: "prepopulated", label: "41/S1/Severozápad (below-floor)" },
];

// ─── Sample brief benchmark snippet ──────────────────────────────────────────

/**
 * Builds the benchmark_snippet JSONB for the sample brief.
 * Exercises all four D-011 categories:
 *   - Category 1 (ziskovost): both ratios fully populated -> fully valid
 *   - Category 2 (naklady-produktivita): one ratio suppressed (below-floor)
 *   - Category 3 (efektivita-kapitalu): both ratios suppressed (empty category)
 *   - Category 4 (rust-trzni-pozice): both ratios valid
 */
function buildSampleBenchmarkSnippet() {
  return {
    cohort_id: "cohort-46-S2-Praha",
    resolved_at: "2026-04-01T08:00:00.000Z",
    categories: [
      // Category 1: fully populated — both ratios valid
      {
        category_id: "ziskovost",
        category_label: "Ziskovost",
        metrics: [
          {
            metric_id: "gross_margin",
            metric_label: "Hrubá marže",
            quartile_label: "třetí čtvrtina",
            percentile: 68,
            verdict_text:
              "Vaše hrubá marže vás řadí do třetí čtvrtiny kohorty ve vašem oboru — 68. percentil.",
            confidence_state: "valid",
            rung_footnote: null,
            is_email_teaser_snippet: true,
          },
          {
            metric_id: "ebitda_margin",
            metric_label: "EBITDA marže",
            quartile_label: "druhá čtvrtina",
            percentile: 44,
            verdict_text:
              "Vaše EBITDA marže vás řadí do druhé čtvrtiny kohorty ve vašem oboru — 44. percentil.",
            confidence_state: "valid",
            rung_footnote: null,
            is_email_teaser_snippet: false,
          },
        ],
      },
      // Category 2: one ratio suppressed (below-floor for that metric)
      {
        category_id: "naklady-produktivita",
        category_label: "Náklady a produktivita",
        metrics: [
          {
            metric_id: "labor_cost_ratio",
            metric_label: "Podíl mzdových nákladů",
            quartile_label: null,
            percentile: null,
            verdict_text: null,
            confidence_state: "below-floor",
            rung_footnote:
              "Tato hodnota není k dispozici — počet firem v kohortě je zatím příliš nízký pro spolehlivé srovnání.",
            is_email_teaser_snippet: false,
          },
          {
            metric_id: "revenue_per_employee",
            metric_label: "Tržby na zaměstnance",
            quartile_label: "třetí čtvrtina",
            percentile: 57,
            verdict_text:
              "Vaše tržby na zaměstnance vás řadí do třetí čtvrtiny kohorty ve vašem oboru — 57. percentil.",
            confidence_state: "valid",
            rung_footnote: null,
            is_email_teaser_snippet: false,
          },
        ],
      },
      // Category 3: both ratios suppressed — exercises empty-category empty-state copy
      {
        category_id: "efektivita-kapitalu",
        category_label: "Efektivita kapitálu",
        metrics: [
          {
            metric_id: "working_capital_cycle",
            metric_label: "Obratový cyklus",
            quartile_label: null,
            percentile: null,
            verdict_text: null,
            confidence_state: "below-floor",
            rung_footnote:
              "Tato hodnota není k dispozici — počet firem v kohortě je zatím příliš nízký pro spolehlivé srovnání.",
            is_email_teaser_snippet: false,
          },
          {
            metric_id: "roce",
            metric_label: "ROCE",
            quartile_label: null,
            percentile: null,
            verdict_text: null,
            confidence_state: "below-floor",
            rung_footnote:
              "Tato hodnota není k dispozici — počet firem v kohortě je zatím příliš nízký pro spolehlivé srovnání.",
            is_email_teaser_snippet: false,
          },
        ],
      },
      // Category 4: both ratios valid
      {
        category_id: "rust-trzni-pozice",
        category_label: "Růst a tržní pozice",
        metrics: [
          {
            metric_id: "revenue_growth",
            metric_label: "Růst tržeb",
            quartile_label: "horní čtvrtina",
            percentile: 78,
            verdict_text:
              "Váš růst tržeb vás řadí do horní čtvrtiny firem ve vašem oboru — 78. percentil.",
            confidence_state: "valid",
            rung_footnote: null,
            is_email_teaser_snippet: false,
          },
          {
            metric_id: "pricing_power",
            metric_label: "Cenová síla",
            quartile_label: "druhá čtvrtina",
            percentile: 52,
            verdict_text:
              "Vaše cenová síla vás řadí do druhé čtvrtiny firem ve vašem oboru — 52. percentil.",
            confidence_state: "valid",
            rung_footnote: null,
            is_email_teaser_snippet: false,
          },
        ],
      },
    ],
  };
}

// ─── Sample brief content sections ────────────────────────────────────────────

/**
 * Build the single `brief_content` section the UI consumes. Both the analyst
 * edit page (src/app/admin/briefs/[id]/edit/page.tsx ~L948) and the owner
 * view page (src/app/brief/[id]/page.tsx ~L309) expect exactly one section
 * with section_id === "brief_content" whose body is a JSON-stringified
 * BriefContent object. Any other shape renders as empty.
 */
function buildSampleBriefContentSections() {
  const benchmarkCategories = buildSampleBenchmarkSnippet().categories;

  const content = {
    title: "Měsíční přehled — Velkoobchod (NACE 46)",
    publication_month: "Duben 2026",
    opening_summary:
      "Velkoobchodní sektor zaznamenal v prvním čtvrtletí 2026 mírný pokles poptávky ze strany maloobchodních odběratelů. Dodací lhůty se zkrátily o 8 % oproti předchozímu roku, náklady na přepravu však meziročně vzrostly o 12 %. Firmy s diverzifikovanou odběratelskou základnou vykazují lepší odolnost.",
    observations: [
      {
        headline: "Marže pod tlakem napříč sektorem",
        body:
          "Průměrná hrubá marže firem v NACE 46 klesla v posledních 12 měsících o 1,4 procentního bodu. Hlavními příčinami jsou rostoucí vstupní ceny a nižší vyjednávací síla vůči zahraničním dodavatelům. Firmy, které diverzifikovaly dodavatele do více zemí, si udržely marže na vyšší úrovni.",
        time_horizon: "Do 3 měsíců",
        is_email_teaser: true,
      },
      {
        headline: "Digitalizace objednávkových procesů přináší úspory",
        body:
          "Podniky, které přešly na plně digitální zpracování objednávek, vykázaly o 7 % nižší provozní náklady na objednávku. Adopce EDI systémů a automatizovaných fakturačních řešení se v sektoru meziročně zdvojnásobila.",
        time_horizon: "Do 12 měsíců",
        is_email_teaser: false,
      },
      {
        headline: "Vaše pozice v kohortě",
        body:
          "Vaše hrubá marže vás řadí do třetí čtvrtiny firem ve vašem oboru. Zhruba třetina srovnatelných podniků vykazuje vyšší marže — prostor pro zlepšení existuje, ale nejste mezi nejslabšími. Vaše tržby na zaměstnance jsou nadprůměrné (57. percentil), což naznačuje dobrou produktivitu.",
        time_horizon: "Okamžitě",
        is_email_teaser: false,
      },
    ],
    closing_actions: [
      {
        action_text:
          "Zkontrolujte smlouvy s klíčovými dodavateli a identifikujte, kde lze sjednat množstevní slevy nebo delší platební lhůty. I malé úpravy podmínek mohou zlepšit cash flow o několik týdnů.",
        time_horizon: "Okamžitě",
        category: "naklady-produktivita",
      },
      {
        action_text:
          "Zvažte pilotní nasazení elektronické fakturace (e-faktura) pro top 5 odběratelů. Podniky, které to zavedly, ušetřily průměrně 2–3 hodiny administrativy týdně na fakturu.",
        time_horizon: "Do 3 měsíců",
        category: "naklady-produktivita",
      },
      {
        action_text:
          "Připravte střednědobý plán diverzifikace dodavatelů pro produktové kategorie s nejvyšší závislostí na jediném zdroji. Cílem je snížit riziko výpadku dodávek a posílit vyjednávací pozici.",
        time_horizon: "Do 12 měsíců",
        category: "rust-trzni-pozice",
      },
    ],
    benchmark_categories: benchmarkCategories,
    pdf_footer_text:
      "Strategy Radar — Česká spořitelna. Data k dubnu 2026. Kontakt: strategyradar@csas.cz",
    email_teaser_observation_index: 0,
  };

  return [
    {
      section_id: "brief_content",
      heading: "Obsah přehledu",
      body: JSON.stringify(content),
      order: 0,
    },
  ];
}

// ─── NACE 31 placeholder briefs (Phase 2.2.c) ────────────────────────────────

/**
 * Minimal benchmark snippet for placeholder briefs (NACE 31).
 * Four categories populated at the bare minimum required to pass validation.
 * List UI does not render benchmarks, so values are placeholders only.
 */
function buildPlaceholderBenchmarkSnippet() {
  const minMetric = (id: string, label: string) => ({
    metric_id: id,
    metric_label: label,
    quartile_label: null,
    percentile: null,
    verdict_text: null,
    confidence_state: "below-floor" as const,
    rung_footnote: "Placeholder — data pro tento přehled nejsou k dispozici.",
    is_email_teaser_snippet: false,
  });

  return {
    cohort_id: "cohort-31-S2-Praha",
    resolved_at: "2026-04-01T08:00:00.000Z",
    categories: [
      {
        category_id: "ziskovost",
        category_label: "Ziskovost",
        metrics: [
          minMetric("gross_margin", "Hrubá marže"),
          minMetric("ebitda_margin", "EBITDA marže"),
        ],
      },
      {
        category_id: "naklady-produktivita",
        category_label: "Náklady a produktivita",
        metrics: [
          minMetric("labor_cost_ratio", "Podíl mzdových nákladů"),
          minMetric("revenue_per_employee", "Tržby na zaměstnance"),
        ],
      },
      {
        category_id: "efektivita-kapitalu",
        category_label: "Efektivita kapitálu",
        metrics: [
          minMetric("working_capital_cycle", "Obratový cyklus"),
          minMetric("roce", "ROCE"),
        ],
      },
      {
        category_id: "rust-trzni-pozice",
        category_label: "Růst a tržní pozice",
        metrics: [
          minMetric("revenue_growth", "Růst tržeb"),
          minMetric("pricing_power", "Cenová síla"),
        ],
      },
    ],
  };
}

interface PlaceholderBriefDef {
  /** Stable idempotency key: author_id + nace_sector + title */
  title: string;
  publication_month: string;
  opening_summary: string;
  observations: { headline: string; body: string; time_horizon: string; is_email_teaser: boolean }[];
  closing_actions: { action_text: string; time_horizon: string; category: string }[];
  /** ISO timestamp for published_at — controls ordering and "Nový" flag */
  published_at: string;
}

const NACE_31_PLACEHOLDER_BRIEFS: PlaceholderBriefDef[] = [
  {
    // Published 10 days ago — "Nový" pill will render
    title: "[Placeholder] Vývoz českého nábytku do Německa — Q1 2026",
    publication_month: "Duben 2026",
    opening_summary:
      "Vývoz nábytku z České republiky do Německa vzrostl v prvním čtvrtletí 2026 o 4,2 % meziročně. Poptávka po zakázkové výrobě ze segmentu kuchyní a kancelářského nábytku zůstává stabilní, zatímco poptávka po standardizovaném sortimentu mírně klesá v důsledku silné asijské konkurence.",
    observations: [
      {
        headline: "Německý trh roste, ale konkurence sílí",
        body: "Čeští výrobci nábytku udržují silnou pozici v segmentu zakázkové výroby pro německé odběratele. Standardizované produkty čelí rostoucímu tlaku od asijských dovozců, kteří nabízejí srovnatelnou kvalitu za nižší cenu. Firmy se silnou designovou identitou a kratšími dodacími lhůtami si udržují marže lepší než průměr sektoru.",
        time_horizon: "Do 3 měsíců",
        is_email_teaser: true,
      },
      {
        headline: "Logistické náklady rostou pomaleji než v roce 2025",
        body: "Přepravní náklady na dopravu do Německa vzrostly v Q1 2026 o 3,1 % — výrazně méně než v roce 2025 (+18 %). Stabilizace cen pohonných hmot a obnovení kapacit přepravců přispívají k lepší předvídatelnosti logistických výdajů.",
        time_horizon: "Do 12 měsíců",
        is_email_teaser: false,
      },
      {
        headline: "Kurz eura zůstává příznivý",
        body: "Průměrný kurz EUR/CZK v Q1 2026 (24,85 Kč/EUR) je pro exportéry příznivý. Při zachování tohoto kurzu si firmy fakturující v eurech udržují marže na stabilní korunové úrovni bez nutnosti zajišťovacích operací.",
        time_horizon: "Okamžitě",
        is_email_teaser: false,
      },
    ],
    closing_actions: [
      {
        action_text:
          "Zkontrolujte podíl zakázkové vs. standardizované výroby ve vašem exportním portfoliu a zvažte, zda mix odpovídá poptávkovým trendům na německém trhu.",
        time_horizon: "Okamžitě",
        category: "rust-trzni-pozice",
      },
      {
        action_text:
          "Prověřte možnosti uzavření rámcových přepravních smluv s klíčovými dopravci pro zajištění kapacity a ceny v Q2 a Q3 2026.",
        time_horizon: "Do 3 měsíců",
        category: "naklady-produktivita",
      },
    ],
    published_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    // Published 35 days ago — outside the 30-day "Nový" window
    title: "[Placeholder] Tlak dovozců z jihovýchodní Asie na cenotvorbu",
    publication_month: "Březen 2026",
    opening_summary:
      "Dovoz nábytku z jihovýchodní Asie do České republiky vzrostl v roce 2025 o 11 % a trend pokračuje i v roce 2026. Český trh zaznamenává výrazné snížení maloobchodních cen ve standardizovaných kategoriích. Výrobci s vlastními značkami a přímými distribučními kanály udržují lepší marže.",
    observations: [
      {
        headline: "Asijské dovozy stlačují maloobchodní ceny",
        body: "Průměrná maloobchodní cena standardizovaného sedacího nábytku klesla v roce 2025 o 7 % meziročně. Hlavním faktorem jsou dovozy z Vietnamu a Malajsie, které kombinují nižší výrobní náklady s vylepšenou logistikou (zkrácení doby přepravy z Asie na 22–28 dní).",
        time_horizon: "Okamžitě",
        is_email_teaser: true,
      },
      {
        headline: "Přímý prodej B2C jako ochrana marží",
        body: "Výrobci s vlastními e-shopy nebo showroomy vykazují o 12–18 % vyšší marže oproti těm, kteří distribuují výhradně přes maloobchodní řetězce. Přímý kontakt se zákazníkem umožňuje lépe vysvětlit hodnotu a kvalitu výrobku.",
        time_horizon: "Do 12 měsíců",
        is_email_teaser: false,
      },
    ],
    closing_actions: [
      {
        action_text:
          "Analyzujte cenové pozicování vašich klíčových produktových kategorií vůči asijské konkurenci a identifikujte, kde lze zvýraznit diferenciaci (materiály, design, záruky, servis).",
        time_horizon: "Okamžitě",
        category: "rust-trzni-pozice",
      },
      {
        action_text:
          "Zvažte otevření nebo posílení přímého prodejního kanálu (e-shop, showroom) pro segmenty, kde máte silnou designovou identitu.",
        time_horizon: "Do 12 měsíců",
        category: "rust-trzni-pozice",
      },
      {
        action_text:
          "Proveďte srovnání výrobních nákladů na vaše tři největší produktové kategorie a identifikujte komponenty, kde lze substitucí materiálu nebo dodavatele snížit náklady bez ztráty kvality.",
        time_horizon: "Do 3 měsíců",
        category: "naklady-produktivita",
      },
    ],
    published_at: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

// ─── Seed functions ───────────────────────────────────────────────────────────

interface SeedSummary {
  consentEventsCreated: number;
  consentEventsExisted: number;
  sectorProfilesCreated: number;
  sectorProfilesExisted: number;
  prepopulatedSeedCreated: number;
  prepopulatedSeedExisted: number;
  briefsCreated: number;
  briefsExisted: number;
}

async function seedConsentAndProfiles(summary: SeedSummary): Promise<void> {
  for (const profile of SECTOR_PROFILE_SEEDS) {
    // Step 1: Write consent event first (§3.1 write-order constraint).
    // Check if a grant event already exists for this user_id.
    const { data: existingConsent, error: existingConsentError } = await supabase
      .from("consent_events")
      .select("consent_event_id")
      .eq("user_id", profile.userId)
      .eq("event_type", "grant")
      .order("ts", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingConsentError) {
      console.error(`[seed] Error checking consent for ${profile.label}:`, existingConsentError);
      continue;
    }

    let consentEventId: string;

    if (existingConsent) {
      consentEventId = existingConsent.consent_event_id;
      summary.consentEventsExisted++;
    } else {
      const { data: newConsent, error: consentError } = await supabase
        .from("consent_events")
        .insert({
          user_id: profile.userId,
          event_type: "grant",
          consent_copy_version: "v1.0-2026-04",
          lanes_covered: ["brief", "user_contributed", "rm_visible", "credit_risk"],
          surface: "onboarding-screen",
          channel: "rm-referred-george-embed",
          prior_event_id: null,
          captured_text_hash: "placeholder-hash-v1.0-2026-04",
          ip_prefix: null,
        })
        .select("consent_event_id")
        .single();

      if (consentError || !newConsent) {
        console.error(`[seed] Error inserting consent for ${profile.label}:`, consentError);
        continue;
      }
      consentEventId = newConsent.consent_event_id;
      summary.consentEventsCreated++;
    }

    // Step 2: Upsert sector_profile row (consent event exists — FK constraint satisfied).
    const { data: existingProfile } = await supabase
      .from("sector_profiles")
      .select("id")
      .eq("user_id", profile.userId)
      .maybeSingle();

    if (existingProfile) {
      summary.sectorProfilesExisted++;
    } else {
      const { error: profileError } = await supabase.from("sector_profiles").insert({
        user_id: profile.userId,
        nace_sector: profile.nace_sector,
        size_band: profile.size_band,
        region: profile.region,
        source: profile.source,
        consent_event_id: consentEventId,
        email: profile.email,
      });

      if (profileError) {
        console.error(`[seed] Error inserting sector_profile for ${profile.label}:`, profileError);
        continue;
      }
      summary.sectorProfilesCreated++;
    }

    // Step 3: Upsert prepopulated_seed row for profiles with source=prepopulated.
    if (profile.source === "prepopulated") {
      const { data: existingSeed } = await supabase
        .from("prepopulated_seed")
        .select("id")
        .eq("user_id", profile.userId)
        .maybeSingle();

      if (existingSeed) {
        summary.prepopulatedSeedExisted++;
      } else {
        const { error: seedError } = await supabase.from("prepopulated_seed").insert({
          user_id: profile.userId,
          nace_sector: profile.nace_sector,
          size_band: profile.size_band,
          region: profile.region,
          email: profile.email,
          source: "cs_seed",
        });

        if (seedError) {
          console.error(`[seed] Error inserting prepopulated_seed for ${profile.label}:`, seedError);
        } else {
          summary.prepopulatedSeedCreated++;
        }
      }
    }
  }
}

async function seedSampleBrief(summary: SeedSummary): Promise<string | null> {
  // Idempotency: match on NACE+author regardless of state. The brief starts as
  // a draft so the trial analyst can exercise the edit → publish flow on it.
  const { data: existing } = await supabase
    .from("briefs")
    .select("id")
    .eq("nace_sector", "46")
    .eq("author_id", "analyst")
    .maybeSingle();

  if (existing) {
    summary.briefsExisted++;
    return existing.id as string;
  }

  const contentSections = buildSampleBriefContentSections();
  const benchmarkSnippet = buildSampleBenchmarkSnippet();

  const { data: inserted, error } = await supabase
    .from("briefs")
    .insert({
      nace_sector: "46",
      publish_state: "draft",
      author_id: "analyst",
      published_at: null,
      content_sections: contentSections,
      benchmark_snippet: benchmarkSnippet,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    console.error("[seed] Error inserting sample brief:", error);
    return null;
  }
  summary.briefsCreated++;
  return inserted.id as string;
}

/**
 * Seed two NACE 31 placeholder briefs for the v0.2 brief list (Phase 2.2.c).
 * Idempotency: match on author_id + nace_sector + title (via the first
 * content_sections element whose section_id === 'brief_content', body JSON .title).
 * Because title matching on JSONB is expensive, we use a stable author_id
 * suffix derived from the brief index so the pair is identifiable on re-run.
 */
async function seedNace31PlaceholderBriefs(summary: SeedSummary): Promise<void> {
  const benchmarkSnippet = buildPlaceholderBenchmarkSnippet();

  for (let i = 0; i < NACE_31_PLACEHOLDER_BRIEFS.length; i++) {
    const def = NACE_31_PLACEHOLDER_BRIEFS[i];
    // Stable author_id suffix: "placeholder-31-0", "placeholder-31-1" — unique per slot.
    const authorId = `placeholder-31-${i}`;

    const { data: existing } = await supabase
      .from("briefs")
      .select("id")
      .eq("nace_sector", "31")
      .eq("author_id", authorId)
      .maybeSingle();

    if (existing) {
      summary.briefsExisted++;
      console.log(`  [seed] NACE 31 placeholder ${i + 1} already exists (id: ${existing.id})`);
      continue;
    }

    const content = {
      title: def.title,
      publication_month: def.publication_month,
      opening_summary: def.opening_summary,
      observations: def.observations,
      closing_actions: def.closing_actions,
      benchmark_categories: benchmarkSnippet.categories,
      pdf_footer_text:
        "Strategy Radar — Česká spořitelna. Kontakt: strategyradar@csas.cz",
      email_teaser_observation_index: 0,
    };

    const contentSections = [
      {
        section_id: "brief_content",
        heading: "Obsah přehledu",
        body: JSON.stringify(content),
        order: 0,
      },
    ];

    // Publish the placeholder directly (skip draft step — placeholders exercise
    // the list rendering, not the publish flow). Set published_at explicitly.
    const { data: inserted, error } = await supabase
      .from("briefs")
      .insert({
        nace_sector: "31",
        publish_state: "published",
        author_id: authorId,
        published_at: def.published_at,
        content_sections: contentSections,
        benchmark_snippet: benchmarkSnippet,
      })
      .select("id")
      .single();

    if (error || !inserted) {
      console.error(`  [seed] Error inserting NACE 31 placeholder ${i + 1}:`, error);
    } else {
      summary.briefsCreated++;
      console.log(`  [seed] NACE 31 placeholder ${i + 1} created (id: ${inserted.id})`);
    }
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("=== Strategy Radar — development seed ===");
  console.log("Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY\n");

  const summary: SeedSummary = {
    consentEventsCreated: 0,
    consentEventsExisted: 0,
    sectorProfilesCreated: 0,
    sectorProfilesExisted: 0,
    prepopulatedSeedCreated: 0,
    prepopulatedSeedExisted: 0,
    briefsCreated: 0,
    briefsExisted: 0,
  };

  // Analyst
  const analystResult = seedAnalyst();
  void analystResult; // env-var based, always idempotent

  // Consent events + sector_profiles + prepopulated_seed
  console.log(`\n[seed] Seeding ${SECTOR_PROFILE_SEEDS.length} sector profiles...`);
  await seedConsentAndProfiles(summary);

  // Sample brief
  console.log("[seed] Seeding sample brief for NACE 46...");
  const briefId = await seedSampleBrief(summary);

  // NACE 31 placeholder briefs for v0.2 brief list (Phase 2.2.c)
  console.log("[seed] Seeding 2 NACE 31 placeholder briefs...");
  await seedNace31PlaceholderBriefs(summary);

  // Summary
  console.log("\n=== Seed summary ===");
  console.log(`Analyst:           env-var based (set ADMIN_PASSWORD_HASH=test in .env.local)`);
  console.log(`Cohort cells:      ${COHORT_CELLS.length} defined (in-memory in cohort.ts; descriptive only)`);
  console.log(`  - Rung 0 (valid): ${COHORT_CELLS.filter((c) => c.rung === 0).length}`);
  console.log(`  - Rung 1-3 (partial): ${COHORT_CELLS.filter((c) => c.rung >= 1 && c.rung <= 3).length}`);
  console.log(`  - Rung 4 (below-floor): ${COHORT_CELLS.filter((c) => c.rung === 4).length}`);
  console.log(`Consent events:    created=${summary.consentEventsCreated}, already existed=${summary.consentEventsExisted}`);
  console.log(`Sector profiles:   created=${summary.sectorProfilesCreated}, already existed=${summary.sectorProfilesExisted}`);
  console.log(`Prepopulated seed: created=${summary.prepopulatedSeedCreated}, already existed=${summary.prepopulatedSeedExisted}`);
  console.log(`Briefs:            created=${summary.briefsCreated}, already existed=${summary.briefsExisted} (includes NACE 46 draft + 2 NACE 31 placeholders)`);
  if (briefId) {
    console.log(`\nSample brief ID:   ${briefId}`);
    console.log(`View at:           http://localhost:3000/brief/${briefId}`);
  }
  console.log("\nDone. Safe to re-run — all operations are idempotent.");
}

main().catch((err) => {
  console.error("[seed] Fatal error:", err);
  process.exit(1);
});
