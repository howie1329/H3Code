# H3Code — Design Guidance

<!-- agentkit:start design -->
H3Code uses a restrained, Linear-influenced desktop-tool baseline. The interface should feel precise and calm during long PI sessions: clear hierarchy, compact controls, continuous surfaces, and minimal decoration.

## Token Mapping

`apps/desktop/src/app.css` is the canonical theme source. Its `:root` and `.dark` variables define the palette; `@theme inline` maps them to Tailwind.

| Role | Use |
| --- | --- |
| App canvas and text | `bg-background text-foreground` |
| Secondary copy | `text-muted-foreground` |
| Structural separation | `border-border` |
| Primary actions | `bg-primary text-primary-foreground` |
| Quiet interaction states | `bg-muted`, `bg-accent`, and their foreground tokens |
| Floating surfaces | `bg-popover text-popover-foreground` |
| Dangerous actions and errors | `text-destructive` or shadcn destructive variants |
| Keyboard focus | `ring-ring` |

Use semantic utilities. Literal OKLCH, RGB, and hex values belong only in the theme file.

## Composition

- Prefer a continuous `background` canvas with borders between major regions.
- Use `card` and `popover` tokens only for genuinely elevated or grouped content.
- Keep primary actions sparse. Most tool controls should use outline or ghost variants.
- Use compact spacing and control sizes for session chrome; use comfortable line height for transcript content.
- Maintain a visible keyboard focus state and useful minimum pointer targets.
- Support light and dark mode through the existing semantic variables.

## Typography

- Inter Variable is the UI font loaded by `apps/desktop/src/app.css`.
- Use weight and modest size changes for hierarchy; avoid marketing-scale headlines in the workbench.
- Use monospace for repository paths, commands, tool output, diffs, IDs, and logs.
- Keep helper text readable; do not shrink information to compensate for crowded layouts.

## Components

- Install shadcn-svelte components only when a real feature needs them.
- Keep generated primitives in `apps/desktop/src/lib/components/ui/` and product composition outside that directory.
- Use component variants before overriding component colors or typography.
- Use `gap-*` for layout spacing, `size-*` for square elements, and semantic color utilities.
- Avoid decorative gradients, glass effects, oversized radii, chat avatars, and card grids that do not help the PI workflow.

## Motion

Use short transitions only to explain state changes such as opening a panel, updating tool status, or revealing streaming content. Respect reduced-motion preferences and avoid ambient animation.
<!-- agentkit:end design -->
