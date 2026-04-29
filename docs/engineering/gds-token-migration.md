# GDS Token Migration — Engineering

*Owner: engineer · Slug: gds-token-migration · Last updated: 2026-04-23*

## 1. Upstream links
- Product: Not applicable — this is a visual-polish engineering task, not a product feature.
- Design: Colour system from provided screenshot (GDS primary blue header, light-gray page bg, quartile colour system).
- Data: Not applicable — no data model changes.

## 2. Architecture overview

This document covers the migration of hardcoded hex colour values across the v0.2 PoC frontend to George Design System (GDS) tokens, delivered as CSS custom properties in `globals.css`. The migration also:

- Introduces the Inter Variable font via `@font-face` using local `.ttf` files from the GDS prototyping toolkit.
- Adds a mandatory AI-prototype disclaimer footer to the root layout (applies to all pages).

No new services, APIs, or third-party libraries are introduced. All changes are confined to `src/` (CSS, TSX) and `public/fonts/`.

```
globals.css  ←  :root { --gds-* }  ←  GDS _color-generated.scss (hex values extracted manually)
                                     GDS _typography.scss (font family name)
src/app/layout.tsx       ← @font-face served from /public/fonts/
src/components/dashboard/MetricTile.tsx    ← --gds-quartile-* vars
src/components/dashboard/BriefListItem.tsx ← --gds-color-primary, --gds-surface-secondary
src/app/page.tsx          ← --gds-color-primary (header), --gds-page-bg, --gds-heading-color
src/app/brief/[id]/page.tsx ← --gds-* vars throughout
```

Privacy boundaries: unchanged. This migration touches only visual presentation; no data flows are modified.

## 3. ADRs

### ADR-GDS-001 — Use CSS custom properties as the GDS token delivery mechanism

- **Date**: 2026-04-23
- **Context**: The GDS prototyping toolkit ships a Sass/SCSS variable system (`_color-generated.scss`, `_typography.scss`). The application uses Next.js with plain CSS (`globals.css`) and inline styles in TSX components. A Sass build pipeline is not present and would be a new dependency requiring orchestrator approval. The alternative of inlining every hex value directly in components is what we are migrating away from.
- **Decision**: Extract the required GDS hex values from `_color-generated.scss` and define them as CSS custom properties (CSS variables) in `globals.css` `:root`. Components reference `var(--gds-*)` instead of hardcoded hex.
- **Consequences**: No Sass build pipeline needed. Token values are in one place (globals.css), which is the single source of truth for theming. If the GDS SCSS source changes, the hex values in globals.css must be manually re-synced — acceptable at PoC scale, but should be automated (e.g., a token-extraction script) before production.
- **Rejected alternatives**: Import GDS Sass directly via a Sass preprocessor — new build dependency, requires orchestrator approval per CLAUDE.md. Inline all hex values in each component — already the problem being solved.

### ADR-GDS-002 — Serve Inter Variable font from public/fonts (local), not CDN

- **Date**: 2026-04-23
- **Context**: GDS typography spec uses `'Inter var', Inter, sans-serif` (from `_typography.scss` `$theme-font-body`). The GDS prototyping toolkit ships Inter Variable `.ttf` files at `dist/treasury/fonts/`. Options: (a) copy files to `public/fonts/` and serve locally; (b) load from Google Fonts CDN; (c) load from a ČS-hosted CDN (unknown URL).
- **Decision**: Copy `Inter-VariableFont_opsz,wght.ttf` and `Inter-Italic-VariableFont_opsz,wght.ttf` to `public/fonts/` and declare `@font-face` in `globals.css` with `font-display: swap`.
- **Consequences**: Self-hosted — no third-party network request for fonts. No GDPR/tracking concern from a font CDN. Font files add ~370 KB to the `public/` directory (acceptable for a PoC). Fallback stack (`Inter, system-ui, …`) means the page is readable before the font loads.
- **Rejected alternatives**: Google Fonts CDN — introduces a third-party request; GDPR concern for EU product. ČS CDN — URL unknown; would need orchestrator/ČS liaison to obtain.

### ADR-GDS-003 — Quartile second (25–50 %) maps to GDS $color-carrot (#ff6130), not a fallback hex

- **Date**: 2026-04-23
- **Context**: The screenshot specifies the second-quartile accent colour as ~`#E65100` (Material Design deep-orange). GDS `_color-generated.scss` has no deep-orange token. Closest candidates: `$color-carrot` (#ff6130, warm orange-red), `$color-honey-strong` (#995900, dark amber), `$color-ui-yellow-strong` (#ad5700, warm amber). The brief describes the tone as "amber (~#E65100)".
- **Decision**: Use `$color-carrot` (`#ff6130`) as `--gds-quartile-second`. It is the only GDS warm-orange in the palette and the closest in hue to the target, even though it is brighter than #E65100.
- **Consequences**: The second-quartile accent is visually distinct from the target screenshot colour but stays within the GDS palette. If a closer match is added to the GDS palette in future, update globals.css `:root` only.
- **Rejected alternatives**: Use #E65100 directly — breaks the GDS-token-only constraint. Use `$color-honey-strong` (#995900) — too dark and brownish, low contrast on white badge bg at 12% opacity.

### ADR-GDS-004 — No-data state maps to GDS $color-gray-400 (#537090)

- **Date**: 2026-04-23
- **Context**: The screenshot specifies no-data state as dark blue-gray (~#455A64, Material Design blue-gray 700). GDS has no blue-gray. Closest: `$color-gray-400` (#537090), a desaturated blue.
- **Decision**: Use `$color-gray-400` (`#537090`) as `--gds-quartile-nodata`.
- **Consequences**: Slightly more blue than the target but close in luminosity. No functional impact — the no-data state is already communicated by the em-dash value and the "Zatím nedostatek dat" copy.
- **Rejected alternatives**: Use #455A64 directly — outside GDS palette.

## 4. Data contracts

Not applicable — no data model changes. This migration touches only presentation.

## 5. Test plan

- **Unit**: Existing migration tests (`supabase/migrations/migrations.test.ts`, 12 tests) all pass post-migration — confirmed by `npm test` run.
- **Integration**: Build passes (`npm run build` — 17 static/dynamic routes compiled with zero TypeScript errors) — confirmed.
- **End-to-end**: Manual browser check required — verify that:
  1. Dashboard header is GDS primary blue (#135ee2) with white "Česká Spořitelna · Strategy Radar" wordmark.
  2. Page background is light gray (#eef0f4).
  3. Section headings are dark navy (#0a285c).
  4. Each metric tile has a 4px top border in its quartile colour and a 12%-opacity badge bg.
  5. "Nový" pill is fully rounded, primary blue bg, white text.
  6. "Zobrazit" text in brief list rows is primary blue.
  7. Brief detail page headings are dark navy.
  8. Footer "Tento prototyp byl vygenerován pomocí AI." appears on dashboard and brief pages.
  9. Inter font loads (check DevTools Network tab for font request to /fonts/Inter-VariableFont_opsz,wght.ttf).
- **Privacy invariant tests**: Not applicable — no data flows changed.

## 6. Deployment + rollback

- **Deploy**: `npm run build && npm start` from `src/`. No env var changes. No migrations.
- **Font files**: `public/fonts/Inter-VariableFont_opsz,wght.ttf` and `public/fonts/Inter-Italic-VariableFont_opsz,wght.ttf` must be deployed alongside the app. They are committed to the repo.
- **Rollback**: Git revert of this branch reverts all CSS var changes and removes the font files. No state is lost — purely presentational.
- **Feature flag**: Not applicable — this is a visual-only change with no behaviour behind a flag.

## 7. Token mapping reference

Full mapping from GDS SCSS source to CSS var to usage:

| GDS SCSS variable | Hex | CSS var | Used in |
|---|---|---|---|
| `$color-blue-300` / `$color-ui-blue` | `#135ee2` | `--gds-color-primary` | Dashboard header bg, "Nový" pill bg, "Zobrazit" text, focus outline, PDF download CTA, "Zpět" link, sr-disclosure colour |
| `$color-blue-400` | `#0a285c` | `--gds-heading-color` | Section headings (dashboard + brief page), observation left-border, brief h1 |
| `$color-gray-100` | `#eef0f4` | `--gds-page-bg` | Body bg, `.db-page` bg, bli-row hover state |
| `$color-gray-100` | `#eef0f4` | `--gds-surface-secondary` | NACE badge bg |
| `$color-gray-200` | `#e4eaf0` | `--gds-border-default` | Card border, dividers, tile 1px border, section hr |
| `$color-gray-300` | `#a3b5c9` | `--gds-border-interactive` | Secondary button outline, interactive element borders |
| `$color-white` | `#ffffff` | `--gds-surface-card` | Metric tile bg, BriefListItem bg, brief page bg, screen bg |
| `$color-gray-400` | `#537090` | `--gds-text-secondary` | NACE badge text, publication month, obs body text, sub-labels |
| — (design spec) | `#1a1a1a` | `--gds-text-body` | Tile values (26px bold), title text, action text; no direct GDS token for near-black |
| — (design spec) | `#9e9e9e` | `--gds-text-muted` | Footer disclaimer, percentile sub-label, source attribution; no direct GDS token |
| `$color-blue-300` | `#135ee2` | `--gds-quartile-top` | horní čtvrtina (top 25 %) top-border + badge |
| `$color-ui-green` | `#057f19` | `--gds-quartile-third` | třetí čtvrtina (50–75 %) top-border + badge |
| `$color-carrot` | `#ff6130` | `--gds-quartile-second` | druhá čtvrtina (25–50 %) top-border + badge; closest GDS warm-orange to target #E65100 (ADR-GDS-003) |
| `$color-ui-red` | `#cf2a1e` | `--gds-quartile-bottom` | spodní čtvrtina (0–25 %) top-border + badge |
| `$color-gray-400` | `#537090` | `--gds-quartile-nodata` | No-data tile top-border; closest GDS blue-gray to target #455A64 (ADR-GDS-004) |
| — (design decision) | `12px` | `--gds-radius-card` | MetricTile card `borderRadius` — 12px, not 8px (ADR-GDS-005) |

**Time-horizon pill colours** in `brief/[id]/page.tsx` are intentionally kept as semantic hardcoded values (not GDS tokens). They carry meaning that maps to external semantic conventions (red = immediate, blue = medium-term, green = long-term, purple = multi-year). Replacing them with GDS tokens would require GDS tokens for each semantic state; no such mapping exists in the current token set.

### ADR-GDS-005 — Card border-radius is 12px, not 8px

- **Date**: 2026-04-27
- **Context**: MetricTile was initialised with `borderRadius: "8px"`. Visual review on v0.3 branch confirmed 8px looks insufficiently rounded compared to the target GDS card appearance.
- **Decision**: Use `12px` for all card containers. Codified as `--gds-radius-card: 12px` in globals.css `:root`. Component code uses the hardcoded value `"12px"` in inline styles (CSS vars unreliable in dangerouslySetInnerHTML / inline style contexts — ADR-GDS-001 rationale applies).
- **Consequences**: Cards are more rounded. `collapsedTileStyle` in MetricTile inherits via object spread — no second change needed.
- **Rejected alternatives**: 8px — confirmed visually too tight. 16px — too rounded, card loses its rectangular character.

## 8. Open questions

None blocking. Three token gaps noted above do not require resolution before v0.3 demo (ADR-GDS-003, ADR-GDS-004, ADR-GDS-005).

## Changelog
- 2026-04-27 — ADR-GDS-005: card border-radius 12px; token --gds-radius-card — engineer
- 2026-04-23 — initial draft — engineer
