# Metodika pro generování sekce **Pulz oboru**

Tento dokument zachycuje obsahovou logiku, podle které je v demu (`demo/pulz-oboru-demo.html`) sestavena sekce *Pulz oboru*. Slouží jako podklad pro agenty, které budou v budoucnu obsah generovat automaticky.

Sekce má **tři pevné stavební bloky**, každý s jasným úkolem v rétorické struktuře "co se v oboru děje → co to znamená → co s tím udělat". Agent musí všechny tři pokrývat — vynechání kteréhokoli bloku rozbíjí logiku.

---

## 1. Tři dlaždice s grafy (Chart tiles)

Každá dlaždice je **jeden závěr o oboru, podepřený jedním grafem**. Ne graf s popiskem — závěr s důkazem.

**Pravidla pro výběr tří závěrů:**

- Závěry musí pokrývat **různé úhly pohledu** na obor. Ověřený mix:
  1. **Velikost a vývoj trhu** (tržby, zisk, růst v čase)
  2. **Strukturální posun v poptávce** (kanály, segmenty, chování zákazníků)
  3. **Konkurenční prostředí** (tržní podíl tuzemska vs. dovoz, koncentrace, exportní závislost)
- Tři dlaždice nesmí říkat tutéž věc třemi různými způsoby. Pokud dva závěry směřují ke stejné akci, jeden zahodit a hledat jiný úhel.
- Závěr **vždy obsahuje konkrétní číslo** z grafu (49 mld. Kč, 18 %, 31 %), ne kvalitativní vágnosti typu "trh roste".

**Forma textu závěru (chart-tile__verdict):**

- Jedna věta, max. dva řádky.
- Začíná **stavem nebo trendem** ("Tržby odvětví se stabilizovaly...", "E-commerce roste dvouciferným tempem..."), ne čistým číslem.
- Obsahuje **kontrast nebo napětí** — co je zajímavé na tom čísle. Např. "...stabilizovaly na 49 mld. Kč, **ale ziskovost zůstává pod úrovní 2021**." Ten "ale" je nositelem hodnoty.
- Žádný žargon, žádné statistické značení. Píše se pro majitele firmy, ne pro analytika.

**Zdroj** (chart-tile__caption) — vždy uveden, kratký, na úrovni instituce ne dokumentu (MPO, ČSÚ, asociace). Pokud zdroj agent neumí uvést, závěr nepatří do dlaždice.

---

## 2. Souhrnný text (Summary block)

Jeden odstavec, **3–4 věty**, který svazuje tři dlaždice do jednoho příběhu o oboru.

**Pravidla:**

- Není to opakování dlaždic. Je to **vyšší úroveň abstrakce** — co tři pozorování dohromady říkají o oboru jako celku.
- Píše se jako "ekonom kolega vám popisuje obor" — souvislý text, žádné odrážky.
- **Začíná makro-rámcem** ("Výroba nábytku v Česku se po rekordním roce 2022 vrátila..."), pak **identifikuje hlavní trend** ("Klíčovým trendem je..."), pak **přidává napětí nebo komplikaci** ("Zároveň čeští výrobci pokrývají jen třetinu...").
- Čísla z dlaždic se mohou opakovat, ale jen tehdy, když nesou tezi odstavce. Žádné nové číslo, které není v dlaždicích nebo v PDF analýze.

---

## 3. Páry Zjištění → Doporučení (Action cards)

Tři páry, kde **každý pár je nezávislý** — majitel může přijmout jedno doporučení a ostatní ignorovat.

**Pravidlo extrakce zjištění:**

- Zjištění **není závěr z dlaždice**. Je to **konkrétní fakt o oboru**, který si žádá akci. Často je to prohloubení nebo důsledek závěru z dlaždice.
- Zjištění obsahuje **číslo + důsledek pro firmu**. Např. "Vývoz tvoří 73 % hodnoty výroby — větší výrobci primárně prodávají do zahraničí. Pokud vaše tržby závisí jen na domácím trhu, nesete koncentrační riziko."
- **Vždy 2–3 věty**: (1) fakt s číslem, (2) co to znamená v oboru, (3) implicitní mezera, kterou doporučení uzavírá.

**Pravidlo formulace doporučení:**

- **Jedna věta v rozkazovacím způsobu.** "Otevřete přímý online kanál ještě tento rok." Ne "Doporučujeme zvážit otevření..."
- **Konkrétní akce, nikoli téma.** "Nastavte exportní strategii pro příští rok" ano; "věnujte pozornost exportu" ne.
- **Časový rámec, kde má smysl.** "Ještě tento rok", "pro příští rok" — dává to akci ostří.
- Doporučení **smí být kratší než zjištění**. Většinou je. Krátké doporučení po dlouhé evidence působí rozhodně.

**Pravidlo párování:**

- Mezi zjištěním a doporučením musí být **logický skok**, ne tautologie. Špatně: "trh roste online → růst online." Správně: "online zákazník utrácí 2× více → otevřete vlastní e-shop."
- Tři páry by měly volit **různé strategické páky** (kanál, geografie, diferenciace). Ne tři varianty té samé rady.

---

## 4. Hierarchie napříč sekcí — co kam patří

| Úroveň | Obsah | Funkce |
|---|---|---|
| Dlaždice | Číslo + jednověté pozorování | "Tady je důkaz" |
| Souhrn | Příběh oboru ve 3–4 větách | "Tady je rámec" |
| Páry | Fakt + akce | "Tady je co s tím" |

Pokud se obsah opakuje napříč úrovněmi, sekce ztrácí gradient. Číslo se může vyskytnout dvakrát, **závěr a tvrzení nesmí**.

---

## 5. Co agent NESMÍ produkovat

- Závěr bez čísla. ("Trh se mění" — vyhodit.)
- Doporučení bez konkrétní akce. ("Sledujte vývoj cen" — vyhodit.)
- Pár, kde doporučení nepřímo vyplývá ze zjištění. (Napsat lépe nebo zahodit.)
- Stejný strategický směr ve dvou párech. (Slít do jednoho, najít jiný úhel pro druhý.)
- Statistický žargon ("medián", "konfidenční interval", "p-value"). Ani v náznaku.
- Pasivní hedge ("mohlo by být vhodné zvážit"). Píše se důrazně, jako by analytik volal majiteli.

---

## Postup agenta při generování pro nový obor

1. Vybrat **3 nezávislé úhly** s daty (velikost trhu, posun poptávky, konkurence) → 3 dlaždice.
2. Napsat **souhrnný odstavec** o oboru jako celku, který svazuje úhly do jednoho příběhu.
3. Z každého úhlu (nebo z hlubších dat za ním) vytěžit **jeden pár Zjištění → Doporučení**, hlídat strategickou diverzitu napříč třemi páry.
4. Před výstupem zkontrolovat: žádný závěr bez čísla, žádné doporučení bez akce, žádné dva páry s totožnou pákou.
