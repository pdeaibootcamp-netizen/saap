# Button system — GDS variants

*Owner: designer · Slug: button-system · Last updated: 2026-04-28*

## 1. Upstream links

- Token source: `src/app/globals.css` `:root` — `--gds-*` custom properties
- Engineering reference: `docs/engineering/gds-token-migration.md` §7 (token mapping table)
- Uses in the wild: `src/components/dashboard/MetricTile.tsx` (secondary CTA), `src/app/brief/[id]/page.tsx` (primary CTA)

---

## 2. Three variants at a glance

| Variant | When to use | Background | Text | Border |
|---|---|---|---|---|
| **Primary** | Single irreversible primary action per screen (e.g., "Stáhnout PDF", "Potvrdit") | `var(--gds-color-primary)` = `#135ee2` | `#ffffff` | none |
| **Secondary** | Low-stakes invitation; owner can ignore and come back (e.g., "Doplnit hodnotu") | `var(--gds-surface-card)` = `#ffffff` | `var(--gds-color-primary)` = `#135ee2` | `2px solid var(--gds-border-interactive)` = `#a3b5c9` |
| **Ghost** | Cancel / tertiary action alongside a stronger button (e.g., "Zrušit") | transparent | `var(--gds-color-primary)` = `#135ee2` | none |

**Rule:** never put two primary buttons in the same view. Secondary and ghost may coexist (e.g., "Uložit" primary + "Zrušit" ghost).

---

## 3. GDS secondary button — full spec

This is the pattern to use for in-tile CTAs and any other invitation-style action where the owner is not committed.

### 3.1 Visual tokens

| Property | Token | Resolved value |
|---|---|---|
| Background | `var(--gds-surface-card)` | `#ffffff` |
| Text colour | `var(--gds-color-primary)` | `#135ee2` |
| Border | `2px solid var(--gds-border-interactive)` | `2px solid #a3b5c9` |
| Border-radius | — | `9999px` (pill) |
| Font size | — | `14px` |
| Font weight | — | `600` |
| Height | — | `32px` (overrides global 44px floor intentionally) |
| Padding | — | `5px 20px` |

### 3.2 Interactive states

| State | Treatment |
|---|---|
| Default | As §3.1 above |
| Hover (pointer) | `border-color: var(--gds-color-primary)` — border shifts from grey-blue to primary blue; no background change |
| Focus (keyboard) | `outline: 3px solid #1a1a1a; outline-offset: 2px` — visible ring matches GDS focus convention |
| Active / pressed | `transform: scale(0.97)`; suppressed under `prefers-reduced-motion` |
| Disabled | `opacity: 0.5; cursor: not-allowed` — not yet needed in the codebase; add when the first disabled secondary button is introduced |

### 3.3 CSS class

The class `.gds-btn-secondary` in `globals.css` encodes all of the above. Use it with a single inline layout override when context demands it:

```tsx
/* Full-width inside a tile */
<button type="button" className="gds-btn-secondary" style={{ width: "100%" }}>
  Doplnit hodnotu
</button>

/* Natural (auto) width elsewhere */
<button type="button" className="gds-btn-secondary">
  Exportovat
</button>
```

Do **not** inline the visual properties (`backgroundColor`, `color`, `border`, etc.) — the class is the single source of truth.

### 3.4 WCAG contrast

- Text (`#135ee2`) on background (`#ffffff`): **4.7:1 ✓ AA** (passes for normal text ≥ 14 px)
- Border (`#a3b5c9`) on page background (`#eef0f4`): decorative; information not carried by border colour alone
- Focus ring (`#1a1a1a`) on white page background: **18.1:1 ✓ AA**

---

## 4. Primary button — reference spec

Not the focus of this document but included for completeness.

| Property | Value |
|---|---|
| Background | `var(--gds-color-primary)` = `#135ee2` |
| Text | `#ffffff` |
| Border | none |
| Border-radius | `6px` |
| Font | `14px / 600` |
| Min-height | `44px` |
| Padding | `12px 24px` (wider than secondary — signals stronger action weight) |
| Hover | `filter: brightness(0.9)` |
| Focus | `outline: 3px solid #1a1a1a; outline-offset: 2px` |
| Active | `transform: scale(0.97)` |

Currently implemented via inline styles in `brief/[id]/page.tsx`. Refactor to a `.gds-btn-primary` class when a second primary button is introduced (D-R-B-001 deferred).

---

## 5. Ghost button — reference spec

Used for cancel affordances next to a stronger action (e.g., "Zrušit" beside "Uložit" in the MetricTile inline form).

| Property | Value |
|---|---|
| Background | transparent |
| Text | `var(--gds-color-primary)` = `#135ee2` |
| Border | none |
| Font | `14px / 400` (lighter weight signals lower action weight) |
| Height | `36px` (may be shorter than 44 px when paired with a taller primary; ensure combined tap area ≥ 44 px) |
| Hover | `opacity: 0.75` |
| Focus | `outline: 3px solid #1a1a1a; outline-offset: 2px` |

Currently implemented inline in `MetricTile.tsx` (the "Zrušit" button).

---

## 6. Accessibility checklist

- [ ] Every button has a visible text label (no icon-only buttons without `aria-label`)
- [ ] Focus ring is always `3px solid #1a1a1a; outline-offset: 2px` — never `outline: none`
- [ ] Active scale suppressed under `prefers-reduced-motion`
- [ ] Disabled state uses `aria-disabled="true"` (not just `disabled`) if the button must remain in the tab order for context
- [ ] Colour is never the only differentiator between button variants — shape, weight, and padding also vary

---

## 7. Design-system deltas

- `.gds-btn-secondary` is a **new CSS class** introduced in v0.3 (2026-04-28). The MetricTile "Doplnit hodnotu" button is the first consumer.
- Primary and ghost button classes are deferred — existing inline-style implementations are not broken and the refactor adds no PoC value. Logged for v0.4.

---

## Changelog

- 2026-04-28 — initial draft; defines secondary, primary (reference), ghost (reference). Introduces `.gds-btn-secondary` CSS class. — designer
