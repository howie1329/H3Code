# H3Code Cloud

Hosted coding-agent workbench for H3Code: a React PWA (TanStack Start) backed by Clerk, Convex, and (planned) cloud sandboxes.

**Shipped today:** sign-in, Clerk ↔ Convex auth, GitHub repository sync, workspace landing with a real repo picker.

**Planned next:** agent sessions, Daytona sandboxes, transcript streaming, git/PR workflow. See `docs/h3code-cloud-saas-prd.md` and `docs/h3code-convex-schema.md`.

## Commands

From the repository root:

```bash
npm run dev:cloud
npm run check:cloud
npm run build:cloud
```

From this directory:

```bash
npm run dev          # Vite (port 3000) + convex dev
npm run dev:app      # Frontend only
npm run dev:convex   # Convex only
npm run check        # Prettier check
npm run lint         # ESLint
npm run test         # Vitest
npm run build
```

## Environment

Copy `.env.example` to `.env.local` and fill in:

| Variable | Purpose |
| --- | --- |
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk client key |
| `CLERK_SECRET_KEY` | Clerk server key (TanStack Start server fns, GitHub token retrieval) |
| `CLERK_JWT_ISSUER_DOMAIN` | Clerk Frontend API URL — also set in **Convex dashboard** env for JWT validation |
| `CONVEX_DEPLOYMENT` | Convex deployment name |
| `VITE_CONVEX_URL` | Convex deployment URL |

Clerk redirect URLs (`VITE_CLERK_SIGN_IN_URL`, etc.) are optional when using the default `/sign-in` and `/sign-up` routes.

### GitHub via Clerk

1. Enable GitHub as a social connection in the Clerk dashboard.
2. For production, use custom OAuth credentials and add the `repo` scope when clone/push/PR work lands (listing repos works with read access today).
3. Sign in, open **Settings → Sync GitHub**, then pick a repo on the workspace landing page.

GitHub OAuth tokens are fetched **server-side** only (`src/integrations/github/server.ts`); never expose them to the client.

## Routes

| Path | Purpose |
| --- | --- |
| `/sign-in`, `/sign-up` | Clerk auth |
| `/app` | Workspace landing (repo picker + composer) |
| `/app/settings` | Account and GitHub sync |
| `/app/sessions/$sessionId` | Session workspace (placeholder UI) |

`/app` requires sign-in.

## Stack

- **Frontend:** TanStack Start, TanStack Router, React 19, Tailwind CSS v4
- **UI:** shadcn-compatible components in `src/components/ui/` (`components.json` lives here)
- **Auth:** `@clerk/tanstack-react-start` + `ConvexProviderWithClerk`
- **Backend:** Convex (`convex/schema.ts`, `github.ts`, `users.ts`, `auth.config.ts`)
- **Protocol types:** `@h3code/agent-core` — do not introduce cloud-specific agent wire shapes in UI components

## Convex tables

| Table | Purpose |
| --- | --- |
| `users` | Clerk user profile cache |
| `githubConnections` | GitHub link status and scopes |
| `githubRepositories` | Synced repo list for the repo picker |

Agent session tables (`sessions`, `runs`, `messages`, …) are not defined yet.

## Layout

```txt
src/
  routes/              # TanStack Router file routes
  integrations/
    clerk/             # Clerk provider and header auth
    convex/            # ConvexProviderWithClerk
    github/            # Server fn: Clerk token → GitHub API
  components/
    app-shell/         # Sidebar, header, layout
    workspace/         # Landing repo picker and composer
    ui/                # shadcn components
convex/                # Schema, auth config, queries/mutations
```

## Notes

- Add shadcn components from **this directory** (`npx shadcn@latest add <name>`), not from desktop or web.
- Product specs live under `docs/` (`h3code-cloud-saas-prd.md`, `h3code-unified-client.md`, `h3code-platform-vision.md`).
