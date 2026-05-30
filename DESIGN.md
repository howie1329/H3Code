---
name: H3Code
description: Dense local agent workbench UI — engineered neutrals, tactile controls, Linear-inspired continuous canvas.
colors:
  canvas-light: "#ffffff"
  ink-light: "#050505"
  primary-ink: "#080808"
  primary-on-ink: "#f5f5f5"
  muted-fill: "#dfdfdf"
  muted-ink: "#3c3c3c"
  structural-border: "#dfdfdf"
  sidebar-canvas: "#f5f5f5"
  destructive: "#763330"
  focus-ring: "#8f8f8f"
  canvas-dark: "#080808"
  ink-dark: "#f5f5f5"
  elevated-dark: "#0f0f0f"
typography:
  display:
    fontFamily: "'Inter Variable', ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.01em"
  title:
    fontFamily: "'Inter Variable', ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "normal"
  body:
    fontFamily: "'Inter Variable', ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "'Inter Variable', ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 500
    lineHeight: 1.35
    letterSpacing: "0.04em"
  mono:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "0.625rem"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "normal"
rounded:
  sm: "4px"
  md: "6px"
  lg: "7px"
  xl: "10px"
  full: "9999px"
spacing:
  unit: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  panel: "24rem"
components:
  button-primary:
    backgroundColor: "{colors.primary-ink}"
    textColor: "{colors.primary-on-ink}"
    rounded: "{rounded.md}"
    padding: "0 8px"
    height: "28px"
  button-primary-hover:
    backgroundColor: "{colors.primary-ink}"
    textColor: "{colors.primary-on-ink}"
    rounded: "{rounded.md}"
    padding: "0 8px"
    height: "28px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-light}"
    rounded: "{rounded.md}"
    padding: "0 8px"
    height: "28px"
  button-ghost-hover:
    backgroundColor: "{colors.muted-fill}"
    textColor: "{colors.ink-light}"
    rounded: "{rounded.md}"
    padding: "0 8px"
    height: "28px"
  input-default:
    backgroundColor: "{colors.canvas-light}"
    textColor: "{colors.ink-light}"
    rounded: "{rounded.md}"
    padding: "0 8px"
    height: "32px"
  nav-row-active:
    backgroundColor: "{colors.muted-fill}"
    textColor: "{colors.ink-light}"
    rounded: "{rounded.md}"
    padding: "0 8px"
    height: "28px"
---

# Design System: H3Code

## Overview

**Creative North Star: "The Operator's Bench"**

H3Code desktop is a long-session workbench for solo developers running agents on local repos. The interface optimizes for orientation speed: connection health, run lifecycle, transcript, tools, and git context stay legible without decorative chrome. Visual hierarchy comes from engineered neutrals, tight type at `text-xs` / `text-[11px]`, and structural hairlines—not card stacks or marketing gradients.

The system follows a **continuous canvas** philosophy (see `DESIGN-SYSTEM.md`): routine content sits on `background`; sidebars use `sidebar` tokens; overlays use `popover` / `card` only when elevation is required. Primary ink (`--primary`) is sparse: brand actions, focus, and run-state indicators.

**Canonical token source:** `apps/desktop/src/app.css` (`:root`, `.dark`, `@theme inline`). Consume colors via Tailwind semantic utilities (`bg-background`, `text-muted-foreground`, `border-border`). Never hardcode OKLCH or hex in components.

**Marketing surface:** `apps/web` has its own `apps/web/DESIGN.md` (darker campaign canvas). This root file governs **product** surfaces: desktop workbench and shared shadcn primitives.

**Key Characteristics:**

- Engineered achromatic neutrals with near-zero chroma (OKLCH in source; hex in frontmatter for tooling)
- Dense operator layout: `h-7` sidebar rows, `text-xs` controls, `text-[11px]` meta
- Hairline borders + micro-shadows on overlays only; no ghost-card stacks
- Tactile hover/active on interactive rows and ghost buttons; primary buttons used sparingly
- Inter Variable + Geist Mono; fixed rem scale, not fluid display type
- Keyboard-first focus rings (`ring-2 ring-ring`); `prefers-reduced-motion` respected

## Colors

Achromatic palette with one ink accent. Warmth and saturation stay near zero; brand presence is typography and density, not chroma.

### Primary

- **Operator Ink** (`#080808` / `oklch(0.205 0 0)` light): Primary buttons, active run indicators, key emphasis. Used on ≤10% of any workbench screen.
- **On-Ink** (`#f5f5f5` / `oklch(0.985 0 0)`): Text and icons on primary fills.

### Neutral

- **Canvas Light** (`#ffffff` / `oklch(1 0 0)`): App background; transcript and workspace main column.
- **Canvas Dark** (`#080808` / `oklch(0.205 0 0)`): Dark mode app background.
- **Elevated Dark** (`#0f0f0f` / `oklch(0.165 0 0)`): Dark mode card/popover step above canvas.
- **Ink** (`#050505` / `oklch(0.145 0 0)` light, `#f5f5f5` dark): Headlines, body, composer text.
- **Muted Fill** (`#dfdfdf` / `oklch(0.95 0 0)`): Hover rows, segmented control tracks, subtle fills.
- **Muted Ink** (`#3c3c3c` / `oklch(0.556 0 0)`): Secondary labels, timestamps, helper copy. Bump toward ink if contrast fails on tinted fills.
- **Structural Border** (`#dfdfdf` light / dark steps via `--border`): Sidebar seam, toolbar `border-b`, input outlines.
- **Sidebar Canvas** (`#f5f5f5` / `oklch(0.985 0 0)` light): Left rail; pairs with `--sidebar-accent` for hover/active.
- **Destructive** (`#763330` / `oklch(0.577 0.245 27.33)`): Errors, failed runs, dangerous confirms only.
- **Focus Ring** (`#8f8f8f` / `oklch(0.708 0 0)`): `ring-ring` on keyboard focus.

### Named Rules

**The One Ink Rule.** `--primary` is the only brand chroma on product chrome. Chart tokens and destructive are semantic exceptions, not decoration.

**The Canvas-Not-Card Rule.** Transcript, lists, and settings rows live on `background`. Do not wrap routine content in `bg-card` panels.

**The Muted-Ink Floor Rule.** `text-muted-foreground` on `background` or `muted` must meet 4.5:1. If a meta label feels faint, darken muted ink toward foreground, not smaller type.

## Typography

**Display / UI Font:** Inter Variable (`--font-sans` in `@theme inline`; loaded via `@fontsource-variable/inter`)

**Mono Font:** Geist Mono (`--font-mono`) for paths, IDs, session metadata, diff hunks

**Character:** Utilitarian and compact. Headlines are quiet (`text-xl font-semibold` at landing, `text-xs font-medium` in chrome). Hierarchy is weight and size steps at 1.125–1.2 ratio, not display scale drama.

### Hierarchy

- **Display** (600, `text-xl` / 1.25rem, tight leading): Session landing headline only ("What should Pi work on?").
- **Title** (600, `text-base` / 1rem): Section headers in settings, panel titles.
- **Body** (400–500, `text-xs` / 0.75rem, 1.5 leading): Composer, transcript prose, button labels.
- **Label** (500, `text-[11px]` / 0.6875rem, uppercase + tracking-wide): Nav group labels, compact meta, table headers.
- **Mono meta** (400, `text-[10px]`–`text-[11px]`): Repo paths, session IDs, diff stats.

### Named Rules

**The Fixed Scale Rule.** Product UI uses fixed rem sizes. No `clamp()` hero type on workbench surfaces.

**The Eleven-Pixel Meta Rule.** Secondary information defaults to `text-[11px]`. Do not shrink below `text-[10px]` except mono IDs in sidebars.

## Elevation

Hairline borders carry structure; shadows are reserved for floating layers. Routine surfaces stay flat. Depth reads as tonal steps: `background` → `muted` / `accent` hover → `popover` / `card` for dialogs.

### Shadow Vocabulary

- **Micro** (`0 1px 3px hsl(0 0% 0% / 0.1)`): Popovers, dropdowns, rare elevated panels (`--shadow-sm`).
- **Overlay** (`0 4px 6px -1px hsl(0 0% 0% / 0.1)`): Modals only when needed (`--shadow-lg`).

### Named Rules

**The Hairline-First Rule.** Prefer `border-border` or `border-border/50` over shadow to separate regions. Toolbars use bottom hairline, not a second background block.

**The No Ghost-Card Rule.** Never pair `border: 1px solid` with wide soft shadows (blur ≥16px) on the same element.

## Components

Tactile feedback on interactive elements; default density is operator-grade.

### Buttons

- **Shape:** Medium corners (`rounded-md`, ~7px from `--radius` 0.45rem).
- **Primary:** `bg-primary text-primary-foreground`, default height `h-7` (28px), `text-xs font-medium`. No shadow.
- **Hover / Focus:** Primary `hover:bg-primary/80`; ghost `hover:bg-muted`; `focus-visible:ring-2 focus-visible:ring-ring/30`; subtle `active:translate-y-px` on press.
- **Ghost / Outline:** Default for toolbar and sidebar actions; outline uses `border-border` and `hover:bg-input/50`.
- **Destructive:** Tinted fill `bg-destructive/10`, text `text-destructive`, never solid destructive except confirm dialogs.
- **Icon:** `size-6`–`size-7` ghost targets; 12–14px icons (`[&_svg]:size-3` in dense rows).

### Inputs

- **Style:** `h-8` default, `border-input`, `bg-background`, `text-xs`.
- **Focus:** `ring-2 ring-ring`; invalid states use `ring-destructive/20` and `border-destructive`.
- **Labels:** Above field; no floating labels.

### Navigation (App Sidebar)

- **Canvas:** `bg-sidebar` with right `border-sidebar-border`.
- **Rows:** `h-7`, `text-[11px]`, `rounded-md`; hover `bg-sidebar-accent`; active stronger fill + `font-medium`.
- **Group labels:** `text-[11px] uppercase tracking-wide text-sidebar-foreground/70`.
- **Collapse:** 15rem expanded / 3rem icon-only; `Cmd+B` toggle per `DESIGN-SYSTEM.md`.

### Lists & transcript

- **Rows:** Single-line default; hover `bg-accent/40` on tool blocks; selected session uses sidebar accent fill.
- **Status:** 6px dots (`bg-primary` running, `bg-destructive` error, muted idle)—not avatars or bubbles.
- **Code blocks:** `font-mono`, max height `--transcript-code-max-height` (280px).

### Panels

- **Context / diff inspector:** Fixed width `--context-panel-width` (24rem), same canvas family, left border seam.
- **Settings:** Split nav + form; meta badges `rounded-md bg-muted text-[11px]`.

### Chips / segmented controls

- **SegmentedControl:** `border-border/50` track, `h-6` segments, `text-[11px]`, active fill on `bg-background`.

## Do's and Don'ts

Grounded in `PRODUCT.md` anti-references and product register rules.

### Do:

- **Do** edit colors only in `apps/desktop/src/app.css` (and `apps/web/src/app.css` when touching marketing).
- **Do** use semantic Tailwind tokens (`bg-background`, `text-muted-foreground`, `bg-sidebar-accent`) in all components.
- **Do** keep sidebar and transcript rows at `h-7` with `text-[11px]`–`text-xs` for density.
- **Do** show connection, run, and error state in plain language with visible focus rings for keyboard paths.
- **Do** use skeletons for content loading and reserve spinners for inline actions.
- **Do** respect `prefers-reduced-motion: reduce` (150ms transitions collapse to instant).

### Don't:

- **Don't** use SaaS marketing patterns on product surfaces: hero metrics, gradient CTAs, identical feature card grids, section eyebrows on every block.
- **Don't** ship generic AI-tool slop: purple gradients, sparkle motifs, hype copy, or decorative gradients on the workbench.
- **Don't** use neon, glassmorphism, or heavy atmospheric backgrounds on desktop chrome.
- **Don't** use consumer chat bubbles, avatars, or playful empty states where a dense dev tool is appropriate.
- **Don't** wrap routine transcript or list content in elevated cards; nested cards are forbidden.
- **Don't** use side-stripe borders (`border-left` >1px) on rows or callouts.
- **Don't** use gradient text, numbered section eyebrows (01/02/03) on product UI, or `border-radius` above 16px on panels.
- **Don't** hardcode font families or literal colors in `.svelte` files.
