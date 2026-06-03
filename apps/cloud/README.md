# H3Code Cloud

TanStack Start scaffold for the H3Code Cloud workbench.

This app is the future hosted coding-agent surface: a React PWA on Vercel backed by Clerk, Convex, and cloud sandboxes. It is currently a scaffold only. Product routes, Convex tables, and agent/session workflows will be added in later implementation passes.

## Commands

Run from the repository root:

```bash
npm run dev:cloud
npm run check:cloud
npm run build:cloud
```

Or from this app directory:

```bash
npm run dev
npm run check
npm run build
```

## Environment

Copy `.env.example` to `.env.local` and fill in:

- `VITE_CLERK_PUBLISHABLE_KEY`: Clerk publishable key.
- `CONVEX_DEPLOYMENT`: Convex deployment name.
- `VITE_CONVEX_URL`: Convex deployment URL.

## Current Stack

- TanStack Start and TanStack Router for the React app shell and routing.
- Tailwind CSS v4 and shadcn-compatible component configuration.
- Clerk React provider for authentication wiring.
- Convex client/provider and an intentionally empty schema baseline.

## Notes

- Real H3 Cloud Convex tables are intentionally not defined yet.
- Add shadcn components from `apps/cloud`, where `components.json` lives.
- Keep shared product protocol types in `@h3code/agent-core`; do not introduce cloud-specific agent wire shapes in UI components.
