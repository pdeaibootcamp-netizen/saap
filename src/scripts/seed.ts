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
            metric_id: "roe",
            metric_label: "ROE",
            quartile_label: "druhá čtvrtina",
            percentile: 52,
            verdict_text:
              "Vaše ROE vás řadí do druhé čtvrtiny firem ve vašem oboru — 52. percentil.",
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
          minMetric("roe", "ROE"),
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
    title: "Vývoz českého nábytku do Německa — Q1 2026",
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
    title: "Tlak dovozců z jihovýchodní Asie na cenotvorbu",
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

// ─── Furniture brief (NACE 31) — Phase 2.2.e ──────────────────────────────────

/**
 * Layperson opener for the furniture brief (§6.1 of brief-page-v0-2.md).
 * Verbatim — do not paraphrase. Stored as publication.opener_markdown.
 */
const FURNITURE_OPENER_MARKDOWN = `**Český nábytkářský průmysl: stabilizace po dvou letech útlumu, ale bez rychlého návratu k růstu.**

Výroba nábytku v České republice se za posledních patnáct let přibližně zdvojnásobila — z asi 34 miliard korun v roce 2009 na 53 miliard v roce 2022. V roce 2024 obor vyrobil zboží přibližně za 49 miliard korun; je to méně než před pandemií, ale po dvou slabších letech se trh začíná stabilizovat. Klíčové je, že tuto hodnotu dnes drží výrazně méně lidí než dřív: v oboru pracuje zhruba 16 tisíc zaměstnanců, oproti 27 tisícům v roce 2009. Produktivita tedy výrazně vzrostla, zároveň ale obor už nemá kde brát další lidi, pokud by poptávka prudce oživila.

Mzdy v nábytkářství rostou pomaleji než v ostatních průmyslových oborech. Pro firmy v oboru je to krátkodobě výhoda — nákladová strana drží. Střednědobě je to ale signál, že obor je u zaměstnanců méně atraktivní než alternativa ve strojírenství nebo automobilovém průmyslu a že nábor kvalifikovaných pracovníků bude stále obtížnější.

Exportní stránka je silná a drží výrobu nad vodou: obchodní bilance nábytku zůstává dlouhodobě kladná, hlavním odbytištěm je Německo a západní Evropa. Domácí poptávka po nábytku v roce 2025 mírně oživila proti předchozímu roku, ale stále se nedostala na úroveň před pandemií. Ekonomické analýzy České spořitelny i Asociace českých nábytkářů předpokládají, že v roce 2026 bude trh pomalu růst, s rizikem na straně stavebnictví — pokud se odkládá dokončování bytových projektů, odkládají se i objednávky kuchyňských linek a vybavení.

Co z toho plyne pro vás jako majitele firmy v oboru: sledujte objednávkovou knihu na následující kvartál — právě v první polovině roku se ukáže, jestli trh opravdu oživuje, nebo se stabilizace zasekne. Hlídejte vývoj mzdových nákladů v kontextu ostatního průmyslu — rychlejší růst u konkurence ve strojírenství znamená, že budete muset na pozice v dílně nabízet stále víc. A pokud váš odbyt stojí z většiny na jednom zahraničním zákazníkovi, zvažte diverzifikaci dřív, než se sejde objednávkový pokles se změnou směnného kurzu.

*Zdroj: Ekonomické a strategické analýzy České spořitelny — Nábytkářský trh v ČR, březen 2026.*`;

/**
 * Full verbatim ČS publication text extracted from furniture-2026-Q2.docx.
 * Source file: PRD/publications/furniture-2026-Q2.txt (generated in Phase 2.2.e).
 * Stored as publication.full_text_markdown — collapsed by default behind
 * "Číst celou analýzu" disclosure per D-020 / brief-page-v0-2.md §4.
 *
 * Note on table rows: the .docx table cells are extracted one per line since
 * OOXML table cells are each a w:p element. This reads adequately in plain-text
 * paragraph rendering (v0.2 PoC) without a markdown table library.
 */
const FURNITURE_FULL_TEXT_MARKDOWN = `Přehled trhu výrobců

Výroba nábytku (CZ-NACE 31) je součástí zpracovatelského průmyslu a zahrnuje produkci nábytku z různých materiálů, zejména dřeva a materiálů na jeho bázi, ale také kovů, plastů, textilu, kůže či skla. Výrobní procesy spočívají především ve zpracování materiálů a montáži dílů (řezání, tvarování, laminování), přičemž významnou roli hraje design nábytku vycházející z estetických a funkčních požadavků.

Tržby firem ve výrobě nábytku v Česku po propadu během hospodářské krize (34,4 mld. Kč v roce 2009) postupně rostly a v roce 2022 dosáhly historického maxima 53,3 mld. Kč. Mimořádně vysoká úroveň tržeb v roce 2022 byla ovlivněna především výrazným růstem cen vstupů – zejména dřeva, dalších surovin a energií – a celkovým inflačním prostředím, které vedlo k růstu cen finálních výrobků v nábytkářském průmyslu. V roce 2023 však tržby se stagnací ekonomiky klesly na 47,6 mld. Kč. V roce 2024 naopak mírně vzrostly na 49,4 mld. Kč. Ziskovost sektoru se pohybuje v řádu jednotek miliard korun – výsledek hospodaření po zdanění činil v roce 2024 přibližně 2,5 mld. Kč (dlouhodobý vrchol byl v roce 2021 ve výši 3,3 mld. Kč).

Zdroj: MPO, Panorama zpracovatelského průmyslu

Současně je v oddílu Výroba nábytku patrný dlouhodobý pokles zaměstnanosti. Průměrný evidenční počet zaměstnanců se snížil z 27,3 tisíce v roce 2008 na 16,3 tisíce v roce 2024. Počet aktivních podnikatelských subjektů v odvětví rovněž postupně klesá, v roce 2024 činil 4 882 (916 právnických osob a 3 966 pracujících majitelů).

Zdroj: MPO, Panorama zpracovatelského průmyslu

Průměrná mzda ve výrobě nábytku dlouhodobě roste, avšak nadále zůstává pod úrovní průměru zpracovatelského průmyslu. Zatímco v roce 2008 činila ve výrobě nábytku 17 076 Kč (oproti 21 713 Kč ve zpracovatelském průmyslu), v roce 2024 dosáhla 35 207 Kč. Ve stejném období vzrostla průměrná mzda ve zpracovatelském průmyslu na 44 851 Kč.

Zdroj: MPO, Panorama zpracovatelského průmyslu

Hodnotu výroby nábytku v ČR za rok 2025 očekává Asociace českých nábytkářů (AČN) meziročně přibližně o 2 % nižší, a to 51,38 mld. Kč z předchozích 52,62 mld. Kč v roce 2024. Současně AČN předpokládá mírný pokles exportu z 38,75 mld. Kč na 37,98 mld. Kč. Podobný vývoj se očekává také u dovozu nábytku, který by měl meziročně klesnout z 30,73 mld. Kč na 29,8 mld. Kč. Odhady AČN vycházejí z výsledků prvního pololetí a předpokládají, že si trh udrží stejnou dynamiku i ve druhé polovině roku, což odpovídá trendu posledních let.

Zdroj: Asociace českých nábytkářů; data za rok 2025 jsou odhadem AČN na základě výsledků prvního pololetí roku 2025

AČN zároveň předpokládá pokles podílu tuzemských výrobců na trhu s nábytkem v České republice v roce 2025 z 13,87 mld. Kč (31,1 %) v roce 2024 na 13,4 mld. Kč (31,0 %). Podíl dováženého nábytku na spotřebě by měl naopak mírně vzrůst na 69 %. Celková hodnota spotřebovaného nábytku v roce 2025 činila 43,2 mld. Kč (o zhruba 3 % meziročně méně).

Zdroj: data Asociace českých nábytkářů; vlastní zpracování

Data z kartových transakcí České spořitelny

V roce 2021 lze kvůli pandemii koronaviru (uzavření prodejen) pozorovat v online útratách za nábytek v Česku výrazný nárůst o 58,6 %, který byl doprovázen téměř 20% propadem útrat na POS terminálech, tedy v kamenných prodejnách. Tento trend se však v roce 2022 obrátil; útraty přes POS terminály vzrostly o 51,5 %, zatímco e-commerce zaznamenala pokles o 12,8 %. To ukazuje na silnou preferenci zákazníků vrátit se po uvolnění omezení zpět do kamenných prodejen.

V posledních letech se trh stabilizoval. Kamenné prodejny (POS) si nadále drží dominantní podíl na celkovém objemu transakcí, nicméně jejich růst je nyní pozvolný (1,7 % v roce 2024 a 1,2 % v roce 2025). Naproti tomu e-commerce od roku 2023 opět nabrala silnou dynamiku a roste dvouciferným tempem (23,5 % v roce 2024 a 17,5 % v roce 2025).

Zdroj: data České spořitelny; vlastní zpracování

Z dat o kartových transakcích dále vyplývá, že průměrná útrata při online nákupu je zhruba dvojnásobná oproti nákupu na prodejně (POS). To naznačuje, že zákazníci v kamenných prodejnách častěji kupují drobné vybavení a doplňky, zatímco přes internet objednávají větší a dražší kusy nábytku.

Průměrná hodnota nákupu v kamenných prodejnách se v průběhu šesti let chová velmi stabilně a pohybuje se v úzkém rozmezí od zhruba 2 260 Kč (rok 2020) po 2 540 Kč (roky 2022 a 2023). U e-commerce je patrný dlouhodobě rostoucí trend s mírnými výkyvy. Z hodnoty 4 160 Kč v roce 2020 průměrná online útrata postupně vyrostla a v roce 2025 činila 5 100 Kč.

Zdroj: Česká spořitelna; vlastní zpracování

Výrobci nábytku v ČR

Výrobce nábytku v České republice lze rozdělit například podle zaměření produkce na výrobce nábytkových materiálů (zejména desek) a komponentů (nábytkových dílů), samotného bytového nábytku, nábytku pro komerční prostory (mj. kanceláře, hotely, školy, sociální služby), vybavení obchodů a prodejen či regálových systémů a průmyslového nábytku pro sklady a výrobní haly. V ČR působí subjekty zaměřující se jak na sériovou, tak zakázkovou výrobu. A z hlediska velikosti se jedná na jedné straně spektra o firmy s miliardovými obraty, uprostřed o společnosti střední velikosti, tak o malé truhlářské dílny a živnostníky.

Tabulka níže ukazuje podle obratu seřazené firmy z oddílu CZ NACE 31 Výroba nabídku, doplněné o společnosti, jež jsou členy Asociace českých nábytkářů. Jedná se o 68 subjektů, jejichž roční obrat přesahuje 100 mil. Kč. Z finančního přehledu plyne, že necelá pětina (celkem 13) z nich skončila za poslední dostupný finanční rok (nejčastěji 2024) ve ztrátě.

Největší výrobci nábytku v ČR (seřazeno podle obratu): KRONOSPAN CR (4 564 mil. Kč), KOVONA SYSTEM (2 494 mil. Kč), BJS Czech (2 103 mil. Kč), Dřevozpracující družstvo (1 869 mil. Kč), ITAB Shop Concept CZ (1 786 mil. Kč), umdasch Story Design (1 718 mil. Kč), B2B Partner (1 710 mil. Kč), Ahrend (1 455 mil. Kč), INTERLIGNUM (1 239 mil. Kč), BLANÁŘ NÁBYTEK (1 153 mil. Kč) a další.

Zdroj: Databáze Magnusweb Dun and Bradstreet, justice.cz, internetové stránky společností

Prodejci nábytku v ČR

Český trh prodejců nábytku je poměrně koncentrovaný do rukou velkých obchodních domů se zahraničními vlastníky – IKEA, XXXLutz (+Möbelix), SCONTO, ASKO a také JYSK. Vedle nich stojí segment větších online prodejců nábytku (BONAMI). V další řadě pak v ČR působí zhruba 15 středně velkých regionálních či specializovaných prodejců nábytku s obratem 100–400 mil. Kč.

Největší prodejci nábytku v ČR (seřazeno podle obratu): IKEA Česká republika (13 090 mil. Kč), XLCZ Nábytek/XXXLutz (5 793 mil. Kč), JYSK (5 197 mil. Kč), SCONTO Nábytek (3 659 mil. Kč), BONAMI.CZ (1 635 mil. Kč), ASKO – NÁBYTEK (1 437 mil. Kč) a další.

Zdroj: Databáze Magnusweb Dun and Bradstreet, justice.cz, internetové stránky společností

Evropský trh s nábytkem

Polsko je v rámci Evropské unie jednoznačně největším centrem nábytkářského průmyslu (NACE C31) jak z hlediska počtu podniků, tak zaměstnanosti. V roce 2024 tam působilo přibližně 25 tisíc firem a sektor zaměstnával téměř 189 tisíc pracovníků. Významné postavení mají také Itálie, Německo a Francie, které patří mezi hlavní evropské producenty nábytku. Česká republika se s přibližně 4,9 tisíci podniky a zhruba 21 tisíci pracovníky řadí do střední části evropského žebříčku. Data zároveň ukazují, že nábytkářský průmysl je v EU silně koncentrován ve střední a jižní Evropě.

Z hlediska ekonomické výkonnosti nábytkářského průmyslu dosahuje v Evropské unii nejvyššího čistého obratu Itálie, která v roce 2024 vykázala čistý obrat ve výši 26,6 mld. eur. Následuje Německo s 22,4 mld. eur a Polsko s 15,6 mld. eur, které zároveň patří mezi země s největší zaměstnaností v tomto odvětví. Významnou pozici mají také Španělsko a Francie. Česká republika se s obratem kolem 2 mld. eur řadí do střední části evropského žebříčku.

Zdroj: Eurostat

Autoři: Tomáš Kozelský, Radek Novák, Tereza Hrtúsová — Ekonomické a strategické analýzy České spořitelny

Tato publikace je považována za doplňkový zdroj informací. Na informace uvedené v ní nelze pohlížet tak, jako by šlo o údaje nezvratné a nezměnitelné. Publikace je založena na nejlepších informačních zdrojích dostupných v době vydání. Použité informační zdroje jsou všeobecně považované za spolehlivé, avšak Česká spořitelna, a.s. ani její pobočky či zaměstnanci neručí za správnost a úplnost informací. Důležitá upozornění jsou k dispozici na: https://www.csas.cz/cs/research/dulezita-upozorneni`;

/**
 * Benchmark snippet for NACE 31 furniture brief.
 * All metrics are below-floor — no real cohort data exists for NACE 31 at MVP.
 * Kept for analyst-admin completeness per D-020; not rendered on the brief page
 * (benchmarks live on the dashboard per brief-page-v0-2.md §7).
 */
function buildFurnitureBenchmarkSnippet() {
  const belowFloor = (id: string, label: string) => ({
    metric_id: id,
    metric_label: label,
    quartile_label: null,
    percentile: null,
    verdict_text: null,
    confidence_state: "below-floor" as const,
    rung_footnote:
      "Data pro nábytkářský sektor nejsou pro toto srovnání k dispozici.",
    is_email_teaser_snippet: false,
  });

  return {
    cohort_id: "cohort-31-S2-Praha",
    resolved_at: "2026-04-21T08:00:00.000Z",
    categories: [
      {
        category_id: "ziskovost",
        category_label: "Ziskovost",
        metrics: [
          belowFloor("gross_margin", "Hrubá marže"),
          belowFloor("ebitda_margin", "EBITDA marže"),
        ],
      },
      {
        category_id: "naklady-produktivita",
        category_label: "Náklady a produktivita",
        metrics: [
          belowFloor("labor_cost_ratio", "Podíl mzdových nákladů"),
          belowFloor("revenue_per_employee", "Tržby na zaměstnance"),
        ],
      },
      {
        category_id: "efektivita-kapitalu",
        category_label: "Efektivita kapitálu",
        metrics: [
          belowFloor("working_capital_cycle", "Obratový cyklus"),
          belowFloor("roce", "ROCE"),
        ],
      },
      {
        category_id: "rust-trzni-pozice",
        category_label: "Růst a tržní pozice",
        metrics: [
          belowFloor("revenue_growth", "Růst tržeb"),
          belowFloor("roe", "ROE"),
        ],
      },
    ],
  };
}

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

/**
 * Seed the furniture sector brief (NACE 31) with full v0.2 content.
 * Phase 2.2.e — production-ready Czech content from brief-page-v0-2.md §6.
 *
 * Idempotency: match on nace_sector="31" + author_id="csas-analyst-radek-novak".
 * State: published (the furniture brief is the real demo brief for the v0.2 PoC).
 */
async function seedFurnitureBrief(summary: SeedSummary): Promise<string | null> {
  const AUTHOR_ID = "csas-analyst-radek-novak";

  const { data: existing } = await supabase
    .from("briefs")
    .select("id")
    .eq("nace_sector", "31")
    .eq("author_id", AUTHOR_ID)
    .maybeSingle();

  if (existing) {
    summary.briefsExisted++;
    console.log(`  [seed] Furniture brief (NACE 31) already exists (id: ${existing.id})`);
    return existing.id as string;
  }

  // BriefContent shape per briefs.ts — v0.2 with publication block (D-020).
  const content = {
    title: "Nábytkářský sektor — duben 2026",
    publication_month: "Duben 2026",
    // opening_summary is left empty — the publication.opener_markdown supersedes it
    // for v0.2 briefs. The v0.1 fallback path uses this field; here it is empty
    // because the Sektorová analýza block carries the opener.
    opening_summary: "",
    publication: {
      heading: "Sektorová analýza",
      opener_markdown: FURNITURE_OPENER_MARKDOWN,
      full_text_markdown: FURNITURE_FULL_TEXT_MARKDOWN,
      source:
        "Ekonomické a strategické analýzy České spořitelny — Nábytkářský trh v ČR, březen 2026",
    },
    observations: [
      {
        // Observation 1 — paired with Action 1 (paired_observation_index: 0)
        headline: "Objednávky nábytku se letos stabilizují po dvouletém propadu.",
        body:
          "Domácí poptávka se v roce 2025 mírně zvedla proti předchozímu roku a ekonomické analýzy předpokládají, že v roce 2026 bude pokračovat pomalý růst. Zásadní období rozhodnou první dva kvartály — pokud zakázky nepřijdou v první polovině roku, oživení se posune.",
        time_horizon: "Do 3 měsíců",
        is_email_teaser: false,
      },
      {
        // Observation 2 — paired with Action 2 (paired_observation_index: 1)
        // is_email_teaser: true per §6.3 of brief-page-v0-2.md
        headline:
          "Mzdy v nábytkářství rostou pomaleji než ve zbytku průmyslu — krátkodobá výhoda, střednědobě problém.",
        body:
          "Obor má nižší tempo růstu osobních nákladů než strojírenství a automobilový průmysl. Pro vaši nákladovou stranu je to dnes plus, ale znamená to, že při hledání nových lidí do dílny budete nabízet proti stále zajímavější konkurenci.",
        time_horizon: "Do 12 měsíců",
        is_email_teaser: true,
      },
      {
        // Observation 3 — paired with Action 3 (paired_observation_index: 2)
        headline: "Export drží výrobu nad vodou; domácí poptávka se probouzí opatrně.",
        body:
          "Obchodní bilance oboru je dlouhodobě kladná a hlavním odbytištěm je Německo a západní Evropa. Pokud vaše tržby stojí z většiny na jednom zahraničním zákazníkovi, koncentrace se v dobrých letech neprojeví — v horších letech může zaskočit.",
        time_horizon: "Více než rok",
        is_email_teaser: false,
      },
    ],
    closing_actions: [
      {
        // Action 1 — paired with Observation 1
        action_text:
          "Zkontrolujte objednávkovou knihu na nadcházející dva kvartály a porovnejte ji se stejným obdobím loni. Pokud zakázky neoživují podle sektorového trendu, prověřte, jestli ztrácíte podíl u stávajících odběratelů, nebo jestli jde o plošný problém trhu.",
        time_horizon: "Okamžitě",
        category: "rust-trzni-pozice",
        paired_observation_index: 0,
      },
      {
        // Action 2 — paired with Observation 2
        action_text:
          "Srovnejte své mzdové náklady s průměrem zpracovatelského průmyslu — nejen s nábytkářstvím. Pokud chystáte nábor v dílně v nejbližších měsících, připravte mzdovou nabídku, která odpovídá širšímu průmyslu, ne jen oborovému mediánu.",
        time_horizon: "Do 3 měsíců",
        category: "naklady-produktivita",
        paired_observation_index: 1,
      },
      {
        // Action 3 — paired with Observation 3
        action_text:
          "Projděte si odbytové kanály za poslední dva roky. Pokud jeden zákazník nebo jedna země tvoří víc než polovinu tržeb, začněte připravovat druhou odbytovou nohu — oslovení dalšího zahraničního trhu nebo posílení domácího prodeje trvá nejméně dva až tři kvartály.",
        time_horizon: "Do 12 měsíců",
        category: "rust-trzni-pozice",
        paired_observation_index: 2,
      },
    ],
    // benchmark_categories: [] per D-020 — benchmarks moved to dashboard
    benchmark_categories: [],
    pdf_footer_text: "Strategy Radar · Česká spořitelna",
    // email_teaser_observation_index: 1 — Observation 2 is the teaser per §6.3
    email_teaser_observation_index: 1,
  };

  const contentSections = [
    {
      section_id: "brief_content",
      heading: "Obsah přehledu",
      body: JSON.stringify(content),
      order: 0,
    },
  ];

  const benchmarkSnippet = buildFurnitureBenchmarkSnippet();

  const { data: inserted, error } = await supabase
    .from("briefs")
    .insert({
      nace_sector: "31",
      publish_state: "published",
      author_id: AUTHOR_ID,
      published_at: "2026-04-21T08:00:00.000Z",
      content_sections: contentSections,
      benchmark_snippet: benchmarkSnippet,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    console.error("[seed] Error inserting furniture brief:", error);
    return null;
  }
  summary.briefsCreated++;
  console.log(`  [seed] Furniture brief (NACE 31) created (id: ${inserted.id})`);
  return inserted.id as string;
}

// ─── v0.3 Demo owner — owner_metrics seed ────────────────────────────────────

/**
 * The demo owner UUID — matches DEMO_OWNER_USER_ID in src/lib/demo-owner.ts.
 */
const DEMO_OWNER_USER_ID_SEED = "00000000-5eed-0000-0000-000000000001";

/**
 * Demo IČOs for NACE 49.41 (Silniční nákladní doprava).
 * These are plausible 8-digit Czech IČOs; reconciled with actual ingested
 * IČOs from the NACE 49.41 Excel once Track B's ingest runs.
 *
 * Default firm (cookie-default) = DEMO_ICO_MISSING_DATA — the PoC's central
 * probe is the in-tile prompt UX; a happy-path first impression undersells
 * the give-to-get mechanic (in-tile-prompts.md §9.2 last para).
 *
 * Selection criteria (in-tile-prompts.md §9.2):
 *   DEMO_ICO_MISSING_DATA  — large firm; most data missing → 6 ask tiles
 *   DEMO_ICO_NO_EMPLOYEES  — mid-size; employee count missing → ask on Tržby/zam
 *   DEMO_ICO_NO_PROFIT     — mid-size; profit missing → ask on Čistá marže
 *   DEMO_ICO_FULL_DATA     — small firm; all available data present (happy path)
 *
 * IČO reconciliation: update these constants to real IČOs from the NACE 49.41
 * Excel after Track B's ingestion script has run and committed cohort_companies rows.
 */
const DEMO_ICO_MISSING_DATA  = "27195855"; // Default — large NACE 49.41; most data missing
const DEMO_ICO_NO_EMPLOYEES  = "45786553"; // Mid-size; employee count missing
const DEMO_ICO_NO_PROFIT     = "25514697"; // Mid-size; hospodářský výsledek missing
const DEMO_ICO_FULL_DATA     = "63999498"; // Small; all available data present (happy path)

const FROZEN_METRIC_IDS = [
  "gross_margin", "ebitda_margin", "net_margin", "labor_cost_ratio",
  "revenue_per_employee", "working_capital_cycle", "revenue_growth", "roe",
] as const;

/**
 * Pre-populated values for the default demo firm (DEMO_ICO_MISSING_DATA).
 * Seed 2 values (gross_margin + revenue_growth) so the dashboard cold-loads
 * with 2 valid + 6 ask tiles — matching the design intent.
 *
 * Rationale for choice: gross_margin and revenue_growth are the highest-priority
 * metrics from in-tile-prompts.md §7 order. Having 2 valid tiles proves the
 * data read path works while leaving 6 ask tiles as the PoC's primary probe.
 *
 * Values are plausible for a large NACE 49.41 freight transport firm.
 */
const DEFAULT_FIRM_SEED_VALUES: Record<string, { raw_value: number; raw_value_display: string }> = {
  gross_margin: { raw_value: 18.2, raw_value_display: "18,2 %" },
  revenue_growth: { raw_value: 4.1, raw_value_display: "+4,1 %" },
};

interface V03SeedSummary {
  demoConsentCreated: boolean;
  ownerMetricsCreated: number;
  ownerMetricsExisted: number;
}

async function seedV03DemoOwner(): Promise<V03SeedSummary> {
  const result: V03SeedSummary = {
    demoConsentCreated: false,
    ownerMetricsCreated: 0,
    ownerMetricsExisted: 0,
  };

  console.log(`\n[seed] v0.3 demo owner (${DEMO_OWNER_USER_ID_SEED})...`);
  console.log(`  Default demo IČO: ${DEMO_ICO_MISSING_DATA} (large NACE 49.41; 2 values seeded, 6 ask)`);
  console.log(`  Other demo IČOs: ${DEMO_ICO_NO_EMPLOYEES}, ${DEMO_ICO_NO_PROFIT}, ${DEMO_ICO_FULL_DATA}`);

  // Step 1: Ensure a grant consent event exists for the demo owner.
  // The owner_metrics table requires a NOT NULL consent_event_id FK.
  const { data: existingConsent, error: existingConsentError } = await supabase
    .from("consent_events")
    .select("consent_event_id")
    .eq("user_id", DEMO_OWNER_USER_ID_SEED)
    .eq("event_type", "grant")
    .order("ts", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingConsentError) {
    console.error("[seed] Error checking demo owner consent:", existingConsentError.message);
    return result;
  }

  let consentEventId: string;

  if (existingConsent) {
    consentEventId = existingConsent.consent_event_id;
    console.log(`  [seed] Demo owner consent event exists (${consentEventId})`);
  } else {
    const { data: newConsent, error: consentError } = await supabase
      .from("consent_events")
      .insert({
        user_id: DEMO_OWNER_USER_ID_SEED,
        event_type: "grant",
        consent_copy_version: "v1.0-2026-04",
        lanes_covered: ["brief", "user_contributed", "rm_visible", "credit_risk"],
        surface: "onboarding-screen",
        channel: "rm-referred-george-embed",
        prior_event_id: null,
        captured_text_hash: "placeholder-hash-demo-owner-v0.3",
        ip_prefix: null,
      })
      .select("consent_event_id")
      .single();

    if (consentError || !newConsent) {
      console.error("[seed] Error creating demo owner consent:", consentError?.message);
      return result;
    }

    consentEventId = newConsent.consent_event_id;
    result.demoConsentCreated = true;
    console.log(`  [seed] Demo owner consent event created (${consentEventId})`);
  }

  // Step 2: Seed owner_metrics rows for the default demo firm.
  // 8 rows total: 2 with values (demo_seed for the default firm), 6 with null raw_value.
  // The null rows drive the "ask" CTA tiles on cold-load.
  //
  // Note: owner_metrics PK is (user_id, metric_id) — not per-IčO.
  // Switching firms via the IčO switcher does NOT clear these rows; it reuses them.
  // This is the v0.3 design (OQ-OM-03 in owner-metrics-schema.md) — per-firm scoping
  // is a v0.4 concern.

  for (const metricId of FROZEN_METRIC_IDS) {
    const { data: existing } = await supabase
      .from("owner_metrics")
      .select("metric_id, raw_value")
      .eq("user_id", DEMO_OWNER_USER_ID_SEED)
      .eq("metric_id", metricId)
      .maybeSingle();

    if (existing) {
      result.ownerMetricsExisted++;
      continue;
    }

    // Insert row: seeded metrics get values, others get null raw_value
    const seedValue = DEFAULT_FIRM_SEED_VALUES[metricId];
    const { error: insertError } = await supabase
      .from("owner_metrics")
      .insert({
        user_id: DEMO_OWNER_USER_ID_SEED,
        metric_id: metricId,
        raw_value: seedValue?.raw_value ?? null,
        raw_value_display: seedValue?.raw_value_display ?? null,
        source: "demo_seed",
        consent_event_id: consentEventId,
        data_lane: "user_contributed",
      });

    if (insertError) {
      console.error(`  [seed] Error inserting owner_metrics ${metricId}:`, insertError.message);
    } else {
      result.ownerMetricsCreated++;
      const label = seedValue
        ? `value=${seedValue.raw_value_display}`
        : "null (ask state)";
      console.log(`  [seed] owner_metrics ${metricId}: ${label}`);
    }
  }

  return result;
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

  // NACE 31 furniture brief (Phase 2.2.e) — the real v0.2 PoC brief
  console.log("[seed] Seeding furniture brief (NACE 31, v0.2 with publication block)...");
  const furnitureBriefId = await seedFurnitureBrief(summary);

  // v0.3 demo owner — owner_metrics seed (Phase 3.2.A5)
  console.log("[seed] Seeding v0.3 demo owner metrics (owner_metrics table)...");
  const v03Summary = await seedV03DemoOwner();

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
  console.log(`Briefs:            created=${summary.briefsCreated}, already existed=${summary.briefsExisted}`);
  console.log(`  (NACE 46 draft + 2 NACE 31 placeholders + 1 NACE 31 furniture brief)`);
  if (briefId) {
    console.log(`\nSample brief ID:   ${briefId}`);
    console.log(`View at:           http://localhost:3000/brief/${briefId}`);
  }
  if (furnitureBriefId) {
    console.log(`\nFurniture brief ID: ${furnitureBriefId}`);
    console.log(`View at:            http://localhost:3000/brief/${furnitureBriefId}`);
    console.log(`  Expected render:   Sektorová analýza opener → "Číst celou analýzu" → 3 paired obs+action cards`);
  }
  console.log("\n--- v0.3 Demo owner ---");
  console.log(`Demo consent event: ${v03Summary.demoConsentCreated ? "created" : "already existed"}`);
  console.log(`Owner metrics:      created=${v03Summary.ownerMetricsCreated}, already existed=${v03Summary.ownerMetricsExisted}`);
  console.log(`  Default demo IČO: ${DEMO_ICO_MISSING_DATA} (2 seeded values: gross_margin + revenue_growth)`);
  console.log(`  Dashboard cold-load: 2 valid tiles + 6 ask tiles`);
  console.log(`  Other demo IČOs: ${DEMO_ICO_NO_EMPLOYEES} (no employees), ${DEMO_ICO_NO_PROFIT} (no profit), ${DEMO_ICO_FULL_DATA} (happy path)`);
  console.log("\nDone. Safe to re-run — all operations are idempotent.");
}

main().catch((err) => {
  console.error("[seed] Fatal error:", err);
  process.exit(1);
});
