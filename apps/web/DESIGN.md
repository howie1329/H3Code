---
version: alpha
name: Linear-design-analysis
description: "A near-black product-focused marketing canvas with restrained accent, light foreground type, and token-driven surfaces. The system reads as software-craft documentation: dense, technical, and quietly luxurious. Display type uses measured negative tracking; cards live as elevated panels with hairline borders. Accent color appears on the brand mark, focus rings, and a few intentional CTAs — never decoratively. Page rhythm leans on product UI screenshots framed in dark panels rather than atmospheric color."
---

## Overview

**Theme source of truth:** All color values live in [apps/web/src/app.css](src/app.css) (`:root`, `.dark`, `@theme inline`). Use Tailwind semantic utilities in markup (`bg-background`, `text-foreground`, `bg-card`, `border-border`, `bg-primary`, `ring-ring`). Do not copy hex or OKLCH into this file or into components.

Linear-inspired marketing canvas uses `bg-background` as the deepest page surface. Hierarchy comes from elevated panels (`bg-card`, `bg-muted`, `bg-accent`) and `border-border` hairlines — not from literal color literals in docs or components.

The brand accent maps to `--primary` / `bg-primary` — used sparingly on the brand mark, focus rings (`ring-ring`), and the primary CTA. Hover and focus states use `hover:bg-primary/90`, `focus-visible:ring-ring`, or extend tokens in `app.css` first. Avoid extra chromatic accents on marketing chrome; use `--destructive` only for danger.

Display type runs at weight 500–700 with negative letter-spacing scaling from -3.0px at 80px down to 0 at body. **Implementation fonts:** `--font-sans` (Inter Variable) and `--font-mono` from `app.css`.

The page rhythm is **dense product screenshots** — high-fidelity product UI captures framed in `bg-card` panels with `rounded-xl` (from `--radius-*` in `app.css`). Chrome stays minimal so screenshots carry the section.

**Key Characteristics:**

- **Dark-canvas marketing system** — `bg-background` anchors the page (enable `.dark` on root when shipping dark marketing).
- **Restrained brand accent** — `bg-primary` / `text-primary-foreground` only for brand mark, primary CTA, focus, link emphasis.
- Surface hierarchy via semantic tokens (`card` → `muted` / `accent`) and borders, not shadow stacks.
- Display tracking pulls aggressively negative (-3.0px at 80px); body holds at -0.05px.
- Cards use `rounded-lg` (derived from `--radius` in `app.css`) with `border border-border`.
- **Product UI screenshots** dominate; marketing chrome is a dark frame for the app.
- No second chromatic accent on chrome. No atmospheric gradients. No spotlight cards.

## Colors

> **Canonical values:** [apps/web/src/app.css](src/app.css). Edit colors only there. In Svelte, use mapped Tailwind utilities from `@theme inline` — never hardcode hex/OKLCH in components or this doc.

Reference inspiration: linear.app (home), /intake, /pricing, /contact/sales, /build — **palette implementation follows web `app.css`, not Linear hex.**

### Semantic token map

| Design role | CSS variable | Typical utility |
| --- | --- | --- |
| Page canvas | `--background` | `bg-background` |
| Primary text | `--foreground` | `text-foreground` |
| Elevated panel / card | `--card` | `bg-card`, `text-card-foreground` |
| Secondary / meta text | `--muted-foreground` | `text-muted-foreground` |
| Subtle fill | `--muted` | `bg-muted` |
| Hover / active fill | `--accent` | `bg-accent`, `text-accent-foreground` |
| Secondary actions | `--secondary` | `bg-secondary`, `text-secondary-foreground` |
| Structural border | `--border` | `border-border` |
| Input border/fill | `--input` | `border-input`, `bg-background` |
| Brand / primary CTA | `--primary` | `bg-primary`, `text-primary-foreground` |
| Focus ring | `--ring` | `ring-ring`, `outline-ring/50` |
| Overlays / popovers | `--popover` | `bg-popover`, `text-popover-foreground` |
| Danger | `--destructive` | `bg-destructive`, `text-destructive-foreground` |
| Sidebar chrome (if used) | `--sidebar`, `--sidebar-*` | `bg-sidebar`, `text-sidebar-foreground`, etc. |
| Charts (if used) | `--chart-1` … `--chart-5` | `text-chart-1`, etc. |

### Legacy Linear roles → web tokens

When translating Linear-style specs, map concepts to the nearest semantic token (extend `app.css` if you need a dedicated step):

| Linear-style role | Use instead |
| --- | --- |
| Canvas | `--background` / `bg-background` |
| Surface 1 (cards, screenshot panels) | `--card` / `bg-card` |
| Surface 2–4 (lifted / hover / sub-nav) | `--muted`, `--accent`, `--secondary` (pick by contrast need) |
| Ink / headlines | `--foreground` / `text-foreground` |
| Ink muted / subtle / tertiary | `--muted-foreground` (weight/size for hierarchy) |
| Hairline borders | `--border` / `border-border` |
| Primary CTA / brand accent | `--primary` |
| Primary hover / focus | `hover:` / `focus-visible:ring-ring`; add vars in `app.css` if needed |
| Inverse CTA (white pill) | `--primary-foreground` on `--primary`, or add inverse tokens in `app.css` |
| Success status | No dedicated token — use `--chart-*` or add `--success` in `app.css` |
| Modal scrim | `bg-background/80` or add overlay token in `app.css` |

**Do not** invent hex values in DESIGN.md for gaps — extend [apps/web/src/app.css](src/app.css) first.

## Typography

### Font Family

- **Display / marketing headlines** — `--font-sans` from `app.css` (Inter Variable via `@fontsource-variable/inter`). Linear used a custom display cut; **Inter** at 500–700 is the project substitute.
- **Body / UI** — same `--font-sans` stack.
- **Mono** — `--font-mono` for code in screenshots and ID/status tokens.

### Hierarchy

| Token                     | Size | Weight | Line Height | Letter Spacing | Use                                         |
| ------------------------- | ---- | ------ | ----------- | -------------- | ------------------------------------------- |
| `{typography.display-xl}` | 80px | 600    | 1.05        | -3.0px         | Largest hero headline                       |
| `{typography.display-lg}` | 56px | 600    | 1.10        | -1.8px         | Section opener headlines                    |
| `{typography.display-md}` | 40px | 600    | 1.15        | -1.0px         | Sub-section headlines                       |
| `{typography.headline}`   | 28px | 600    | 1.20        | -0.6px         | Pricing tier titles, CTA banner heading     |
| `{typography.card-title}` | 22px | 500    | 1.25        | -0.4px         | Feature card title                          |
| `{typography.subhead}`    | 20px | 400    | 1.40        | -0.2px         | Lead body, intro paragraphs                 |
| `{typography.body-lg}`    | 18px | 400    | 1.50        | -0.1px         | Hero subhead, lead paragraphs               |
| `{typography.body}`       | 16px | 400    | 1.50        | -0.05px        | Default body                                |
| `{typography.body-sm}`    | 14px | 400    | 1.50        | 0              | Card body, footer columns                   |
| `{typography.caption}`    | 12px | 400    | 1.40        | 0              | Captions, meta, status                      |
| `{typography.button}`     | 14px | 500    | 1.20        | 0              | All button labels                           |
| `{typography.eyebrow}`    | 13px | 500    | 1.30        | 0.4px          | Section eyebrow (slight positive tracking)  |
| `{typography.mono}`       | 13px | 400    | 1.50        | 0              | Mono for code in product screenshots        |

### Principles

- **Aggressive negative tracking on display** (-3.0px at 80px ≈ 4% of size).
- **Single voice from display to body.** Display-xl at 600 → body at 400 — same family, narrower weights.
- **Eyebrow uses positive tracking** (+0.4px) — contrast against the negative-tracked display marks the eyebrow as taxonomy.
- **Mono only in code contexts** — not on marketing chrome.

### Note on Font Substitutes

Linear's custom typeface isn't publicly distributed. This project uses **Inter Variable** per `app.css`. **Geist Sans** is an acceptable alternate if you change `--font-sans` in `app.css` only.

## Layout

### Spacing System

- **Base unit**: 4px.
- **Tokens (front matter)**: `{spacing.xxs}` 4px · `{spacing.xs}` 8px · `{spacing.sm}` 12px · `{spacing.md}` 16px · `{spacing.lg}` 24px · `{spacing.xl}` 32px · `{spacing.xxl}` 48px · `{spacing.section}` 96px.
- Card interior padding: `{spacing.lg}` 24px on feature/pricing cards; `{spacing.xl}` 32px on testimonial cards; `{spacing.xxl}` 48px on CTA banners.
- Pill button padding: 8px vertical · 14px horizontal — Linear's compact button spec.
- Form input padding: 8px vertical · 12px horizontal.

### Grid & Container

- Max content width sits around 1280px.
- Card grids are 3-up at desktop, 2-up at tablet, 1-up at mobile.
- Pricing tier grid is 3-up; comparison strip below shows checkmarks per tier.
- Product screenshot panels span full content width — they're the protagonist.

### Whitespace Philosophy

The dark canvas IS the whitespace. Sections separate by lift onto `bg-card` panels, not by gaps in white. Within a panel, generous `{spacing.lg}` 24px gaps between content blocks; `{spacing.section}` 96px between sections.

## Elevation & Depth

| Level | Treatment | Use |
| --- | --- | --- |
| 0 (flat) | No shadow, no border | Default for body type, hero text, footer |
| 1 (card lift) | `bg-card` on `bg-background`, `border border-border` | Default cards, product panels |
| 2 (muted lift) | `bg-muted` or `bg-accent`, `border-border` | Featured pricing card, hovered cards |
| 3 (popover) | `bg-popover` | Sub-nav, dropdown menus |
| 4 (focus ring) | `focus-visible:ring-2 focus-visible:ring-ring` | Focused input, focused button |

Depth is carried by semantic surface tokens and hairline borders. Avoid drop shadows on dark marketing surfaces unless defined in `app.css`.

### Decorative Depth

- **Product UI screenshots** dominate as decorative depth.
- **No atmospheric gradients, no spotlight cards.**
- Optional subtle top-edge highlight on lifted panels — implement with border or pseudo-element tokens in `app.css`, not ad hoc hex.

## Shapes

### Border Radius Scale

Radius **values** live in [apps/web/src/app.css](src/app.css) (`--radius`, `--radius-sm` … `--radius-4xl` via `@theme inline`). Use Tailwind `rounded-sm`, `rounded-md`, `rounded-lg`, `rounded-xl`, etc. — do not hardcode px radii in components.

| Token / utility | Typical use |
| --- | --- |
| `rounded-sm` | Small chips, status badges |
| `rounded-md` | Buttons, form inputs |
| `rounded-lg` | Pricing cards, feature cards, testimonial cards |
| `rounded-xl` | Product screenshot panels |
| `rounded-2xl` | Oversized CTA banners (rare) |
| `rounded-full` | Pricing tab toggles, status pills, avatars |

> Web theme currently sets `--radius: 0rem` in `app.css`. For Linear-style 8–16px corners on marketing, adjust `--radius` in `app.css` — not in this doc.

### Photography & Illustration Geometry

- Product UI screenshots dominate; frame with `rounded-xl` and `{spacing.lg}` outer padding.
- Customer logo tiles at ~24px logo height on `bg-background` with no border.
- Avatar circles in testimonial cards: `rounded-full` at 32–40px.

## Components

### Buttons

**`button-primary`** — Primary CTA.

- `bg-primary text-primary-foreground`, type `{typography.button}`, padding 8px 14px, `rounded-md`.
- Hover: `hover:bg-primary/90` or add hover token in `app.css`.
- Focus: `focus-visible:ring-2 focus-visible:ring-ring`.

**`button-secondary`** — Secondary CTAs ("Sign in", "Read changelog").

- `bg-card text-foreground`, type `{typography.button}`, padding 8px 14px, `rounded-md`, `border border-border`.

**`button-tertiary`** — Plain text button.

- `bg-background text-foreground`, type `{typography.button}`, `rounded-md`, padding 8px 14px.

**`button-inverse`** — High-contrast CTA on dark sections.

- Prefer `bg-primary-foreground text-primary` or add dedicated inverse tokens in `app.css` — do not hardcode white/black.

### Pricing Tabs

**`pricing-tab-default`** + **`pricing-tab-selected`** — Pill-toggle on `/pricing`.

- Default: `bg-background text-muted-foreground`, `rounded-full`, padding 6px 14px.
- Selected: `bg-muted text-foreground` — selected = surface lift.

### Cards & Containers

**`pricing-card`**

- `bg-card text-foreground`, type `{typography.body}`, `rounded-lg`, padding 24px, `border border-border`.

**`pricing-card-featured`**

- `bg-muted` or `bg-accent`, otherwise identical.

**`feature-card`**

- `bg-card text-foreground`, type `{typography.body}`, `rounded-lg`, padding 24px.

**`product-screenshot-card`**

- `bg-card text-foreground`, type `{typography.body}`, `rounded-xl`, padding 24px.

**`testimonial-card`**

- `bg-card text-foreground`, type `{typography.body-lg}`, `rounded-lg`, padding 32px.

**`customer-logo-tile`**

- `bg-background text-muted-foreground`, type `{typography.caption}`, `rounded-sm`, padding 16px.

**`cta-banner`**

- `bg-card text-foreground`, type `{typography.headline}`, `rounded-lg`, padding 48px.

### Inputs & Forms

**`text-input`** + **`text-input-focused`**

- `bg-card text-foreground border border-input`, type `{typography.body}`, `rounded-md`, padding 8px 12px.
- Focused: `focus-visible:ring-2 focus-visible:ring-ring`.

### Status & Build Page

**`changelog-row`**

- `bg-background text-foreground`, type `{typography.body}`, `rounded-sm`, padding 24px 0, `border-b border-border`.

**`status-badge`**

- `bg-muted text-muted-foreground`, type `{typography.caption}`, `rounded-full`, padding 2px 8px.

### Navigation

**`top-nav`**

- `bg-background text-foreground`, type `{typography.body-sm}`, height 56px. Wordmark left, links center, `button-secondary` + `button-primary` right.

### Footer

**`footer`**

- `bg-background text-muted-foreground`, type `{typography.caption}`, padding 64px 32px.

## Do's and Don'ts

### Do

- Treat `bg-background` as the anchor surface; tune only in `app.css`.
- Use `--primary` / `bg-primary` only for: brand mark, primary CTA, focus ring, link emphasis.
- Build hierarchy with `card`, `muted`, `accent`, and `border-border` — avoid skipping contrast steps.
- Pair display weight 600 with body weight 400.
- Apply negative letter-spacing aggressively on display.
- Use product UI screenshots as the protagonist of every section.
- Use `rounded-md` for CTAs (after setting `--radius` in `app.css` if you want non-zero corners).

### Don't

- Don't hardcode hex, OKLCH, or RGB in components or DESIGN.md.
- Don't use `bg-primary` as a section or card fill.
- Don't add second chromatic accents on marketing chrome without new tokens in `app.css`.
- Don't add atmospheric gradients or spotlight cards.
- Don't pill-round primary CTAs (reserve `rounded-full` for tabs and badges).
- Don't use pure black outside the theme — use `--background`.
- Don't combine multiple bright accents in screenshot mockups beyond product UI itself.

## Responsive Behavior

### Breakpoints

| Name       | Width  | Key Changes                                         |
| ---------- | ------ | --------------------------------------------------- |
| Desktop-XL | 1440px | Default desktop layout                              |
| Desktop    | 1280px | Card grid 3-up maintained                           |
| Tablet     | 1024px | Card grid 3-up → 2-up                               |
| Mobile-Lg  | 768px  | Pricing comparison becomes accordion; nav hamburger |
| Mobile     | 480px  | Single-column; display-xl scales 80px → ~36px       |

### Touch Targets

- CTAs hold ≥40px tap height across viewports.
- Pricing tab pills hold ≥36px tap height; touch viewports grow to ≥44px.
- Form inputs hold ≥44px tap target on touch.

### Collapsing Strategy

- **Top nav**: links collapse to hamburger below 768px.
- **Card grids**: 3-up → 2-up at 1024px → 1-up below 768px.
- **Pricing comparison**: per-tier accordion below 768px.
- **Display type**: `{typography.display-xl}` 80px scales toward `{typography.display-md}` 40px on mobile.

### Image Behavior

- Product UI screenshots maintain aspect ratio and never crop.
- Customer logos in the marquee may collapse from 6-up to 3-up below 768px.

## Iteration Guide

1. Focus on ONE component at a time and reference it by its `components:` token name.
2. When introducing a section, decide first which semantic surface it lives on (`background` vs `card` vs `muted`).
3. Default body to `{typography.body}` at weight 400.
4. Change colors only in [apps/web/src/app.css](src/app.css), then verify in the browser.
5. Run `npx @google/design.md lint DESIGN.md` after edits (may warn if `colors:` block is omitted).
6. Add new variants as separate component entries.
7. Keep `--primary` scarce: brand mark, primary CTA, focus, link emphasis.
8. Lead every section with a product UI screenshot.

## Known Gaps

- Multi-step Linear surface ladder (surface-2–4, inverse palette, dedicated success green) is not mirrored 1:1 in `app.css` — map to nearest semantic token or extend `app.css`.
- Form-field error and validation styling: use `--destructive` or add tokens in `app.css`.
- Light mode exists in `app.css` (`:root`); dark marketing uses `.dark` overrides — document per-page if you ship both.
- In-product screenshot mockups may show richer label colors than marketing chrome; those stay inside screenshots, not new marketing accents.
- Linear proprietary display fonts are not bundled; project uses Inter via `--font-sans`.
- Color values are maintained only in [apps/web/src/app.css](src/app.css) — this file describes roles and utilities, not literals.
