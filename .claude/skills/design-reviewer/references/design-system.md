# Design System Reference — e-tady dokotera

> Distilled from `docs/DESIGN.md`. Use this as the authoritative checklist when reviewing
> any React component for design compliance.

---

## 1. Color Tokens (Tailwind v4 — defined in `apps/web/src/index.css`)

| Token | Hex | Usage |
|-------|-----|-------|
| `primary` | `#005387` | Main CTA backgrounds, dominant brand color |
| `primary-container` | `#1b6ca8` | Gradient start, secondary tinted backgrounds |
| `on-primary` | `#ffffff` | Text/icons on primary backgrounds |
| `on-primary-container` | `#d9e9ff` | Accent text on hero spans |
| `surface` | `#f8f9ff` | Level 0 — main canvas background |
| `surface-container-lowest` | `#ffffff` | Level 2 — cards, critical patient data |
| `surface-container-low` | `#f2f3f9` | Level 1 — secondary grouping sections |
| `surface-container` | `#eceef3` | Base for elevated cards |
| `surface-container-high` | `#e6e8ed` | Input field backgrounds |
| `on-surface` | `#191c20` | Default text — NEVER use `#000000` |
| `on-surface-variant` | `#414750` | Body/long-form text to reduce eye strain |
| `outline-variant` | `#c0c7d1` | Ghost border fallback at 20% opacity |
| `secondary-container` | `#bee1fe` | Secondary button backgrounds |
| `secondary-fixed` | `#c3e8ff` | "Available Today" chips |

---

## 2. The No-Line Rule ⛔

**Hard violation**: `border border-gray-*`, `border-t`, `border-b`, `divide-y`, or ANY `1px solid` used to section content.

**Correct pattern**: Use background color shifts to define boundaries.
```tsx
// ❌ Violation
<div className="border-b border-gray-200">

// ✅ Correct — background shift defines the boundary
<div className="bg-surface-container-low">   {/* section */}
  <div className="bg-surface-container-lowest">  {/* card inside */}
```

**Exception — forms only**: A "ghost border" is allowed for accessibility in form elements using
`outline-variant` at 20% opacity. It should be felt, not seen.

---

## 3. Surface Hierarchy

Components must respect the three-level surface stack:

```
Level 0 — bg-surface (#f8f9ff)          → Page canvas, body background
  └── Level 1 — bg-surface-container-low (#f2f3f9)   → Sections, grouping areas
        └── Level 2 — bg-surface-container-lowest (#ffffff) → Cards, doctor data
```

Placing a `surface-container-lowest` card on a `surface-container` background creates the
visual "border" through contrast — no border needed.

---

## 4. Typography

### Fonts in use
- **Headline font**: `font-headline` (Plus Jakarta Sans) — for h1, h2, doctor names
- **Body/UI font**: `font-body` / `font-label` (Manrope) — for all other text

> Note: DESIGN.md says "Open Sans" but the project implemented Manrope + Plus Jakarta Sans
> as equivalent choices. Flag if any component uses system fonts or deviates from these two.

### Rules
| Style | Usage | Requirements |
|-------|-------|--------------|
| Display/Headline | Welcome messages, doctor names | `font-headline`, `-tracking-tight` (`-0.02em`), `font-extrabold` |
| Title | Section headers | Never underlined; minimum `mt-8` above (spacing-8 of top margin) |
| Body | Long-form text, instructions | `text-on-surface-variant` to reduce eye strain — NOT `text-on-surface` |
| Label/Metadata | "Specialty", "Availability" tags | `text-xs`/`label-md`, `uppercase`, `tracking-widest` (+0.05em) |

### Don't
- Never use `text-black` or `#000000` — use `text-on-surface` (`#191c20`)
- Never underline section titles

---

## 5. Elevation — Tonal Layering, No Drop-Shadows

**Reject** the 2010s drop-shadow approach. Depth comes from layered surface colors.

```tsx
// ❌ Old-style depth
<div className="shadow-md border border-gray-200">

// ✅ Tonal depth
<div className="bg-surface-container">       {/* outer */}
  <div className="bg-surface-container-lowest">  {/* card pops via contrast */}
```

**Exception — floating elements only** (FABs, "Book Now" buttons, modals):
Use a primary-tinted ambient shadow:
```
shadow: rgba(0, 83, 135, 0.08), blur: 32px, Y-offset: 12px
```
In Tailwind: `shadow-[0_12px_32px_rgba(0,83,135,0.08)]`

---

## 6. Glassmorphism — Floating Navigation & Modal Overlays

Applies to: fixed navbars, modal overlays, floating panels.

```tsx
// Correct glassmorphism pattern
className="bg-surface/80 backdrop-blur-[20px]"

// Or via the .glass-nav utility (defined in index.css)
className="glass-nav"
```

Check that `glass-nav` (defined as `background-color: rgba(255,255,255,0.9); backdrop-filter: blur(20px)`) is
used on the Navbar, not a solid background or a plain `bg-white`.

---

## 7. Buttons — The Signature Pill

All buttons **must** use `rounded-full`. No exceptions.

| Variant | Background | Text | Border | Notes |
|---------|-----------|------|--------|-------|
| Primary | `bg-primary` with gradient | `text-on-primary` | None | Use `hero-gradient` or CSS gradient on hover |
| Secondary | `bg-secondary-container` | `text-secondary` | None — no border |  |
| Ghost/Icon | Transparent | `text-on-surface` | None | Icon-only buttons need ARIA label |

```tsx
// ❌ Sharp or semi-rounded
<button className="rounded-md bg-primary">

// ✅ Correct pill button
<button className="rounded-full bg-primary text-on-primary px-10 py-4 font-bold">
```

---

## 8. Input Fields

- **Never** use bottom-line-only (`border-b`) styling.
- Background: `bg-surface-container-high` (`#e6e8ed`)
- Corners: `rounded-full`
- Padding: generous horizontal — `px-4` minimum (`spacing-4`)

```tsx
// ❌ Bottom-line input (strictly prohibited)
<input className="border-b border-gray-300">

// ✅ Correct pill input
<input className="bg-surface-container-high rounded-full px-4 py-3 outline-none">
```

The `.field-input` class in `index.css` uses `rounded-lg` (0.75rem) — this is acceptable for
auth forms but search inputs and main UI should prefer `rounded-full`.

---

## 9. Cards — No-Divider Rule

For medical listings (doctor cards, appointment cards):
- **No** `<hr>` or `divide-y` between "Price", "Location", "Time" sections
- Use vertical white space (`gap-4` / `space-y-4`) to separate data buckets
- Use `text-xs uppercase tracking-widest` (label-sm) for metadata labels

```tsx
// ❌ Divider between sections
<div className="border-t border-gray-100 pt-2">Price</div>

// ✅ Spacing-only separation
<div className="space-y-4">
  <span className="text-xs uppercase tracking-widest text-on-surface-variant">Prix</span>
  <p className="text-on-surface font-semibold">15 000 Ar</p>
</div>
```

---

## 10. Doctor Profile Cards — Asymmetrical Layout

The signature card pattern:
- Doctor image in a `rounded-full` container that **overlaps the card edge** — breaks the grid intentionally
- Place image with a negative margin or absolute positioning to overlap the card boundary
- Card background: `bg-surface-container-lowest` on top of `bg-surface-container`

---

## 11. Chips / Badges

| Type | Color | Usage |
|------|-------|-------|
| "Available Today" | `bg-secondary-fixed` (`#c3e8ff`) | Calm, hopeful light blue |
| Specialty tags | `bg-surface-container-low` | Neutral grouping |
| Error/Urgent | `bg-error-container` text `text-on-error-container` | Medical alerts only |

---

## 12. Spacing & Page Margins

- Page-level horizontal padding: `px-12` or `px-16` minimum (luxury = space you don't use)
- Section top margins for titles: at least `mt-8` (`spacing-8`)
- Card internal spacing: `p-6` minimum, `gap-4` between content buckets

---

## 13. Corner Radius — ROUND_FULL Philosophy

| Element | Minimum radius | Preferred |
|---------|---------------|-----------|
| Buttons | `rounded-full` | `rounded-full` |
| Input fields | `rounded-full` | `rounded-full` |
| Avatar images | `rounded-full` | `rounded-full` |
| Any image | `rounded-lg` (2rem) | `rounded-2xl` or `rounded-full` |
| Cards | `rounded-2xl` | `rounded-3xl` |

**Hard violation**: `rounded-none` or no `rounded-*` on interactive/card elements.
**Hard violation**: Any `<img>` without at least `rounded-lg`.

---

## 14. Hero Section — Glass & Gradient Rule

```tsx
// ✅ Correct hero
<div className="hero-gradient">  {/* linear-gradient(135deg, primary-container → on-primary-fixed-variant) */}
```

The `.hero-gradient` utility in `index.css` must be used, not a flat hex color background.
Equivalent CSS: `background: linear-gradient(135deg, #1b6ca8 0%, #004a78 100%)`

---

## 15. What Never to Do

| Rule | Violation pattern |
|------|------------------|
| No pure black text | `text-black`, `text-[#000000]`, `color: #000` |
| No 1px solid separators | `border`, `border-gray-*`, `divide-y` on non-form elements |
| No sharp corners | `rounded-none`, `rounded-sm` on cards/buttons/images |
| No flat primary color on hero | `bg-primary` without gradient on hero/banner |
| No drop-shadow on flat cards | `shadow-md`, `shadow-lg` on non-floating cards |
| No bottom-line inputs | `border-b` on input fields |
| No system fonts | `font-sans` (Tailwind default), `Arial`, `system-ui` without fallback |
