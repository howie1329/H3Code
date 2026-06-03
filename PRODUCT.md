# Product

## Register

product

## Users

Solo developers running coding agents against local repositories. They work in long sessions at their own machine, often with an editor nearby, switching between repo context, agent transcript, tool output, and git state. They need fast orientation, not onboarding theater.

## Product Purpose

H3Code is a local desktop workbench for coding agents. The desktop UI talks to a local Agent Server over WebSocket; providers (PI today, others planned) own sessions, messages, and runtime behavior. H3Code owns the local experience: repo selection, connection health, workspace chrome, transcript rendering, capability-gated controls, and lightweight metadata indexing.

Success looks like a developer trusting the shell enough to leave it open all day: sessions and runs are legible, errors are actionable, keyboard paths cover frequent actions, and the UI stays out of the way of the agent work.

## Brand Personality

Fast · Dense · Technical

Voice is direct and utilitarian. Prefer labels that say what happens. Show connection state, run status, and tool activity plainly. Confidence comes from precision and speed, not from marketing language or decorative chrome.

## Anti-references

- SaaS marketing patterns on product surfaces: hero metrics, gradient CTAs, identical feature card grids, section eyebrows on every block.
- Generic AI-tool slop: purple gradients, sparkle motifs, hype copy, "supercharge your workflow" tone.
- Neon, glassmorphism, and heavy atmospheric gradients on the workbench.
- Consumer chat-app chrome (bubbles, avatars, playful empty states) where a dense dev tool is appropriate.

Reference direction for desktop: Linear-like quiet canvas, tight typography, minimal chrome, hierarchy through spacing and type rather than stacked cards.

## Design Principles

1. **Provider truth stays upstream** — The UI speaks H3Code protocol and capabilities; it does not leak provider-specific shapes or copy into the shell.
2. **Density without noise** — Every row and control earns its place for solo-dev flow; avoid empty padding and decorative containers.
3. **Show the work** — Transcript, tools, repo/git context, and connection diagnostics carry the screen; chrome frames them, it does not compete.
4. **Keyboard parity** — Frequent actions (navigation, send, abort, session switch, sidebar toggle) must be reachable without the mouse; shortcuts are part of the product, not an appendix.
5. **Trust through state** — Connection, run lifecycle, and failures are always visible and actionable; never hide uncertainty behind generic loaders.

## Accessibility & Inclusion

Target WCAG 2.2 AA for text contrast, focus visibility, and semantic structure. Keyboard-first power-user flows are non-negotiable for core workbench tasks. Respect `prefers-reduced-motion` for any motion beyond essential feedback (run indicators, subtle state transitions).
