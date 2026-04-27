# PDR P-001 — Quintilové barevné schéma pro dashboardové dlaždice "Vaše pozice v kohortě"

*Date: 2026-04-27 · Author: product-manager · Feature: dashboard-v0-2*

**Decision**: Dlaždice v sekci "Vaše pozice v kohortě" na dashboardu (`/`) v0.2 přecházejí z kvartilového barevného schématu (4 barvy podle Q1–Q4) na **quintilové barevné schéma (5 barev)** odvozené z přesného percentilu, plus šestá barva pro stav nedostatek dat. Frozen barvy + popisky níže. Frozen kvartilové **textové popisky** ([D-015](../project/decision-log.md): horní / třetí / druhá / spodní čtvrtina) zůstávají beze změny — toto rozhodnutí mění **pouze barevnou vrstvu**, ne pojmenovaný kvartilový label.

| Quintil | Percentilové pásmo | Barva (hex) | Popisek (Czech, owner-facing) |
|---|---|---|---|
| Q5 | 80–100. percentil | `#1565C0` (modrá) | Vedoucí pozice |
| Q4 | 60–79. percentil | `#2E7D32` (zelená) | Nadprůměr |
| Q3 | 40–59. percentil | `#E65100` (amber) | Průměr |
| Q2 | 20–39. percentil | `#BF360C` (tmavší amber) | Podprůměr |
| Q1 | 0–19. percentil | `#C62828` (červená) | Výrazný podprůměr |
| nodata | rung-4 below-floor | `#455A64` (šedomodrá) | Nedostatek dat |

**Context**: 

Dashboard v0.2 ([dashboard-v0-2.md](dashboard-v0-2.md)) používá pro každou ze 8 D-015 metrik dlaždici, která kombinuje raw value + percentil + pojmenovaný kvartil. Designerovo vizuální zpracování ([docs/design/dashboard-v0-2/tile-states.md](../design/dashboard-v0-2/tile-states.md)) doposud používalo 4 barvy mapované 1:1 na frozen kvartilové popisky z [quartile-position-display.md](quartile-position-display.md) §6.

Z designerova konzultačního výstupu (PD) vznikla dvě související pozorování:

1. **Granularita.** Kvartilové barvy nedokáží vizuálně odlišit hraniční případy — 51. percentil a 74. percentil dostanou stejnou barvu (Q3), přestože owner-relevantní rozdíl je vidět už v percentilovém čísle. Quintily (5 pásem po 20 percentilech) mapují vizuál o stupeň blíž k tomu, co dlaždice už vypisuje číslem.
2. **Asymetrie kraje.** "Vedoucí pozice" (Q5: 80–100) a "Výrazný podprůměr" (Q1: 0–19) dávají owner-čitelný signál na obou koncích, který kvartilové schéma rozmazává tím, že "horní čtvrtina" pokrývá 75–100 a "spodní čtvrtina" 0–25.

PRD reference: [§7.2 Verdicts, not datasets](../../PRD/PRD.md#7-product-principles) (barva slouží verdiktu, ne datasetu — ostřejší pásmo = ostřejší verdikt), [§7.3 Plain language](../../PRD/PRD.md#7-product-principles) (popisky "Vedoucí pozice" / "Nadprůměr" / "Průměr" / "Podprůměr" / "Výrazný podprůměr" jsou owner-legible bez statistické notace), [§3 Trust barriers](../../PRD/PRD.md#3-personas-and-jobs-to-be-done-jtbd) — bankovní kontext + červená barva = dependence na trust barrier #1 (klient si nesmí přečíst "banka mě hodnotí pro úvěr").

**Rationale**: 

- **Quintilové pásmo lépe odráží to, co už dlaždice ukazuje číslem.** Owner už vidí přesný percentil ("68. percentil"); pět barevných pásem je s tím vizuálně konzistentnější než čtyři. Verdict-dataset párování (§7.2) zůstává neporušené.
- **Krajní pásma (Q5 modrá / Q1 červená) dávají ostřejší signál tam, kde je owner-relevance nejvyšší.** Vedoucí pozici a výrazný podprůměr je smysl rozeznat na první pohled; středová pásma (Q2/Q3/Q4) jsou přechodová a sdílí teplé barevné spektrum (amber → tmavší amber → zelená).
- **Šedá pro nodata zachovává D-014 graceful-degradation.** Below-floor stav má vlastní barvu (`#455A64`), takže se vizuálně neplete s žádným ze 5 výkonnostních pásem. Owner nedostane "tichou nízkou-confidence barvu"; dostane jasně odlišený stav "nemáme dost dat" doprovázený frozen empty-state copy z [dashboard-v0-2.md](dashboard-v0-2.md) §5.2.
- **Frozen kvartilové textové popisky D-015 zůstávají.** Brief detail page ([brief-page-v0-2.md](brief-page-v0-2.md)) a embedded BenchmarkSnippet uvnitř briefů dál používají "horní / třetí / druhá / spodní čtvrtina" jako pojmenovaný kvartilový label per [D-015](../project/decision-log.md) a [quartile-position-display.md](quartile-position-display.md) §6. Toto rozhodnutí mění **pouze barevnou vrstvu** dashboardových dlaždic — textový quartile label v dlaždici zůstává frozen Czech kvartilový popisek (label) a quintilové popisky výše ("Vedoucí pozice" atd.) jsou voliteľný **doplňkový owner-facing string** pro vizuální legendu, ne náhrada za D-015 label. Konkrétní render contract dlaždice (zda quintil-popisek nahrazuje, doplňuje, nebo se renderuje vedle kvartilového labelu) je designer-lane decision v [docs/design/dashboard-v0-2/tile-states.md](../design/dashboard-v0-2/tile-states.md); PM constraint je, že kvartilový label z D-015 nesmí z dlaždice zmizet.

### Trust-barrier guardrail (load-bearing, non-negotiable)

Červená barva (`#C62828`) v bankovním kontextu naráží přímo na trust barrier #1 z [PRD §3](../../PRD/PRD.md#3-personas-and-jobs-to-be-done-jtbd) ("klient nesmí číst Strategy Radar jako banku, která ho hodnotí pro úvěrové riziko"). Aby Q1-červená v dlaždici **nečetla** jako "banka mě hodnotí," je následující framing-pravidlo součástí tohoto rozhodnutí a downstream specialisté ho implementují bez výjimky:

1. **Sekční nadpis dashboardového bloku zůstává "Vaše pozice v kohortě"** — frame je explicitně **srovnání s vrstevníky**, ne hodnocení banky. Designer ani engineer tuto headline za žádných okolností nemění bez nového PDR.
2. **Volitelná section sub-header** ("Jak si vedete ve srovnání s podobnými českými firmami." per dashboard-v0-2.md §5.2) **musí být vykreslena**, pokud sekce obsahuje alespoň jednu Q1- nebo Q2-barevnou dlaždici — designer ji v takovém případě nesmí vypustit kvůli vizuální hustotě. Tím je červená/tmavě-amber barva před prvním očním kontaktem zarámována jako peer-srovnání.
3. **Každá Q1 (red) a Q2 (dark-amber) dlaždice má povinně doprovodný kontextualizující řádek** "ve srovnání s firmami ve vašem oboru a velikostní kategorii" (nebo equivalent owner-legible Czech string — finální copy designer fixuje v `tile-states.md` se schválením PM). Engineer prosadí tento string jako render-time validátor: red/dark-amber dlaždice bez peer-context stringu je render-time failure, dlaždice degraduje na nodata-stav.
4. **Žádný brand-marker ČS uvnitř dlaždice.** Header band na dashboardu nese "Česká Spořitelna · Strategy Radar" wordmark per [D-018](../project/decision-log.md), ale uvnitř samotné dlaždice se barva, ikonky, ani copy nepojí s ČS-brand markerem (logo, "ČS hodnotí"). Toto je jediná architektonická obrana, kterou má PM proti tomu, aby owner přečetl Q1-červenou jako "banka mě hodnotí pro úvěr" namísto "stojím v dolní pětině oboru."
5. **Žádné slovo "hodnocení" / "rating" / "skóre" v copy dlaždice** — ani v label, ani v tooltip (pokud designer tooltip přidá per OQ-DV02-02), ani v aria-label. "Pozice", "srovnání", "kohorta" jsou frozen vocabulary.

Tento guardrail je závazný pro veškerou implementaci v0.2 i pro budoucí redesign dashboardu nebo přenos quintilového schématu do briefu / emailu / PDF. Jakýkoli návrh, který některou z těchto pěti zásad poruší (např. "vedle Q1 dlaždice ukázat malou ČS-bank ikonu"), je escalation k PM, ne design-lane decision.

**Rejected alternatives**:

- **Ponechat 4 kvartilové barvy (status quo).** Rejected: kvartilová granularita je hrubší, než co dlaždice už číselně sděluje; krajní pásma (75–100, 0–25) jsou pro owner-relevance příliš široká.
- **Pětibarevné schéma s červenou rozšířenou na Q1 + Q2 (3 negativní pásma místo 2).** Rejected: zhoršuje trust barrier #1 — víc červené v bankovním kontextu = vyšší riziko, že owner přečte dashboard jako credit-risk hodnocení, ne peer-srovnání. Dvě negativní pásma (Q1 red, Q2 dark-amber) udržují signál bez eskalace toho rizika.
- **Quintilové pásmo s neutrální (šedou) prostřední barvou pro Q3.** Rejected: šedá je v tomto rozhodnutí vyhrazená pro nodata-stav. Dvojí význam šedé barvy ("průměr" vs. "nemáme data") je legitimita-degraduující kolize, kterou by owner musel rozlišit kontextem — to je rozhodnutí proti §7.2.
- **Evaluative popisky typu "Výborný / Dobrý / Průměrný / Slabý / Nejhorší".** Rejected: editorializují tam, kde positional verdict ("Vedoucí pozice / Nadprůměr / Průměr / Podprůměr / Výrazný podprůměr") nese stejnou informaci bez moralizujícího tónu. Konzistentní s [quartile-position-display.md](quartile-position-display.md) §6 rozhodnutím použít positional ordinals ("horní / spodní čtvrtina"), ne evaluative ("nejlepší / nejhorší").
- **Quintilové schéma s akcentem na barvy přístupné pro daltonismus (např. ColorBrewer 5-class diverging).** Rejected pro v0.2 PoC scope: navržené hex hodnoty (modrá / zelená / amber / dark-amber / červená) nejsou color-blind-safe v plné míře a accessibility-revize barev je samostatný design-lane úkol pro v0.3+. Pro PoC — kde každá dlaždice nese **také textový quartile label a číselný percentil** — je barva redundantní vizuální signál, ne nositel významu, takže bezpečně degraduje pro daltonika na čistě textový verdict (§7.2 stále drží). Logováno jako nový OQ-DV02-03 níže.

**Consequences**:

- **Downstream — Designer (`docs/design/dashboard-v0-2/tile-states.md`).** Aktualizuje barevnou vrstvu z 4 kvartilových na 5 quintilových barev + nodata. Zachovává frozen kvartilové textové popisky (D-015) na dlaždici. Implementuje povinný peer-context string pro Q1 a Q2 dlaždice (Trust-barrier guardrail bod 3). Zafixuje volitelnou section sub-header jako povinnou, pokud je v sekci alespoň jedna Q1/Q2 dlaždice (bod 2). Žádný ČS brand marker uvnitř dlaždice (bod 4).
- **Downstream — Engineer (`src/components/dashboard/MetricTile.tsx` + token sourcing).** Render contract dlaždice rozšiřuje `colorBand` enum z `top|third|second|bottom|nodata` (4 + nodata) na `q5|q4|q3|q2|q1|nodata` (5 + nodata). Mapování `percentile → colorBand` je čistá funkce z percentilového čísla per pásma v tabulce výše; nodata-stav vstupuje výhradně z below-floor signálu z `cohort-math.md` §4 rung 4. Render-time validátor odmítá renderování `q1` nebo `q2` dlaždice bez peer-context stringu (Trust-barrier guardrail bod 3) — degraduje na nodata. Žádné slovo "hodnocení" / "rating" / "skóre" nikde v render path (bod 5) — engineer enforce-uje jako lint pravidlo nebo runtime check podle preference.
- **Downstream — Data engineer (`docs/data/dummy-owner-metrics.md`).** Žádná změna v dummy datech ani v cohort-math kontraktu. Quintile mapping je presentation-vrstva; cohort-math dál emituje percentile (1–99) a Q1/Q2/Q3/Q4 enum per [cohort-math.md](../data/cohort-math.md) §6.1. Quintilová pásma z toho odvozuje pouze render layer.
- **Downstream — Brief detail page (`brief-page-v0-2.md`) a embedded BenchmarkSnippet.** **Žádná změna.** Toto rozhodnutí je dashboard-only. Briefy dál používají frozen kvartilové barvy + frozen kvartilové popisky per [quartile-position-display.md](quartile-position-display.md). Pokud bude post-PoC navrženo přenést quintilové schéma do briefů / emailu / PDF, je to nový PDR a nový design-pass — Trust-barrier guardrail (zejména body 1, 3, 4) musí být znovu posouzen v každém z těchto kontextů.
- **Upstream — non-goals.** Rozhodnutí nepřináší standalone benchmark dashboard (PRD §4 non-goal); dashboard zůstává v0.2 PoC instrument per [dashboard-v0-2.md](dashboard-v0-2.md) §0. Nezavádí give-to-get capture (A-013); barvy se mění výlučně na presentation-vrstvě již existujících metrik.
- **Upstream — assumption-log.** Žádná nová asumpce; rozhodnutí konzumuje existující A-003 (osm metrik), A-012 (briefy = atomic unit, dashboard = PoC scaffold), A-017 (tiché supresování pod floorem — nodata barva s frozen empty-state copy).
- **Glossary update obligation.** [glossary.md](glossary.md) získává nový užší termín "kohortní pásmo" / "quintile band" (interní), aby se nesplétal s D-015 "kvartil" (kanonický pojem v briefech). PM doplní v příští copy-pass; non-blocking pro implementaci.

### Open question vyplývající z tohoto rozhodnutí

- **OQ-DV02-03 — Color-blind-safe quintilové schéma pro v0.3+.** Quintilové hex hodnoty zvolené pro v0.2 PoC nejsou color-blind-safe v plné míře. Pro PoC je akceptováno (každá dlaždice nese také textový kvartilový label a číselný percentil — barva je redundantní signál, ne nositel významu). Před promotion mimo PoC scope (jakýkoli ne-PoC widening dashboardu, přenos quintilových barev do briefu / emailu / PDF) je třeba provést design-lane audit a navrhnout color-blind-safe variantu. Owner: designer. Trigger: jakýkoli návrh promotion. Logováno do [`docs/project/open-questions.md`](../project/open-questions.md) s odpovídajícím ID při příští orchestrator gate.

**Revisit when**: 

- Customer-testing PoC (build-plan §10 Phase 2.3) přinese signál, že Q1-červená je čtena jako bankovní hodnocení i přes Trust-barrier guardrail (body 1–5). Trigger: ≥1 testovací participant v moderátorské poznámce explicitně zmíní "banka mě hodnotí" / "kreditní riziko" / equivalent při setkání s Q1 dlaždicí.
- Návrh přenést quintilové schéma na další surface (brief detail page, email teaser, PDF, RM-visible view až D-002 vyprší). Každý takový přenos je nový PDR.
- Promotion z v0.2 PoC do MVP / Increment 2 standalone dashboard surface — vyžaduje rePM-review tohoto schématu v širším product kontextu (PRD §4 non-goal je dnes pevný).
- Color-blind-safe redesign per OQ-DV02-03.
- Cohort-math změní contract `percentile` precision (z dnešní 1-decimal-allowed na něco jiného) — pásma 60–79 / 80–100 jsou off-by-one citlivá u hraničních hodnot a konkrétní rounding rule mezi cohort-math a render layer je třeba revalidovat.
