# H3Code Cloud

Hosted coding-agent workbench for H3Code: a React PWA (TanStack Start) backed by Clerk, Convex, and Daytona sandboxes.

**Shipped today:** sign-in, Clerk ↔ Convex auth, GitHub connection verify, curated workspace repositories (sidebar + landing), session create/list/open with user messages persisted in Convex, **async Daytona sandbox provisioning** (create → clone repo → probe).

**Planned next:** in-sandbox PI agent runtime, assistant/tool streaming, git/PR workflow. See `docs/h3code-cloud-saas-prd.md` and `docs/h3code-convex-schema.md`.

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

| Variable                     | Purpose                                                                          |
| ---------------------------- | -------------------------------------------------------------------------------- |
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk client key                                                                 |
| `CLERK_SECRET_KEY`           | Clerk server key (TanStack Start server fns, GitHub token retrieval)             |
| `CLERK_JWT_ISSUER_DOMAIN`    | Clerk Frontend API URL — also set in **Convex dashboard** env for JWT validation |
| `CONVEX_DEPLOYMENT`          | Convex deployment name                                                           |
| `VITE_CONVEX_URL`            | Convex deployment URL                                                            |

Clerk redirect URLs (`VITE_CLERK_SIGN_IN_URL`, etc.) are optional when using the default `/sign-in` and `/sign-up` routes.

### Daytona (Convex dashboard)

Sandbox provisioning runs in Convex actions (`convex/sandboxProvision.ts`). Set these in the **Convex dashboard** environment (not `.env.local`):

| Variable | Purpose |
| --- | --- |
| `DAYTONA_API_KEY` | Daytona API key from [app.daytona.io](https://app.daytona.io/) |
| `DAYTONA_TARGET` | Optional region (e.g. `us`) |
| `CLERK_SECRET_KEY` | Same secret as TanStack Start — fetches GitHub OAuth token for `git clone` inside the sandbox |

When a session is created, status starts as `provisioning`, then moves to `ready` (with `sandboxId`) or `error` (with `provisionError`).

#### Manual provision test

1. Set Convex env vars above, then `npm run dev:cloud`.
2. Sign in, verify GitHub in Settings, add a workspace repo.
3. Start a session from `/app` — you land on the session page with provisioning status.
4. Within ~30–90s: status becomes ready, a system message shows probe output, inspector shows `sandboxId`.
5. Confirm the sandbox in the [Daytona dashboard](https://app.daytona.io/dashboard/sandboxes).
6. Negative cases: missing GitHub token or `DAYTONA_API_KEY` → session `error` with a clear message.

### GitHub via Clerk

1. Enable GitHub as a social connection in the Clerk dashboard.
2. For private repos, add the `repo` scope on the Clerk GitHub connection (required for sandbox `git clone`).
3. Sign in, open **Settings → Verify GitHub**, then use **Add repository** in the sidebar to choose repos for your workspace.

GitHub OAuth tokens are fetched **server-side** only (`src/integrations/github/server.ts`); never expose them to the client. The add-repository dialog loads repos from GitHub on demand — they are not bulk-stored in Convex.

## Routes

| Path                       | Purpose                                                                |
| -------------------------- | ---------------------------------------------------------------------- |
| `/sign-in`, `/sign-up`     | Clerk auth                                                             |
| `/app`                     | Workspace landing (workspace repo picker + composer; creates sessions) |
| `/app/settings`            | Account and GitHub connection verify                                   |
| `/app/sessions/$sessionId` | Session workspace (transcript + composer; user messages persisted)     |

`/app` requires sign-in.

## Stack

- **Frontend:** TanStack Start, TanStack Router, React 19, Tailwind CSS v4
- **UI:** shadcn-compatible components in `src/components/ui/` (`components.json` lives here)
- **Auth:** `@clerk/tanstack-react-start` + `ConvexProviderWithClerk`
- **Backend:** Convex (`convex/schema.ts`, `github.ts`, `workspaceRepositories.ts`, `sessions.ts`, `users.ts`, `auth.config.ts`)
- **Protocol types:** `@h3code/agent-protocol` — do not introduce cloud-specific agent wire shapes in UI components

## Convex tables

| Table                   | Purpose                                                                         |
| ----------------------- | ------------------------------------------------------------------------------- |
| `users`                 | Clerk user profile cache                                                        |
| `githubConnections`     | GitHub connection status and scopes (metadata only)                             |
| `workspaceRepositories` | User-curated repos for sidebar and landing                                      |
| `sessions`              | Cloud agent sessions (repo, branch, status, title)                              |
| `messages`              | Session transcript rows (user messages today; assistant/tool via sandbox later) |

Deferred: `runs`, `control`, `diffs`, `usageEvents`.

## Layout

```txt
src/
  routes/              # TanStack Router file routes
  integrations/
    clerk/             # Clerk provider and header auth
    convex/            # ConvexProviderWithClerk
    github/            # Server fn: Clerk token → GitHub API (on demand)
  lib/session/         # Transcript types, Convex mappers, repo helpers
  components/
    app-shell/         # Sidebar, header, layout
    workspace/         # Landing repo picker, add-repository dialog
    ui/                # shadcn components
convex/                # Schema, auth config, queries/mutations
```

## Notes

- **Session ↔ sandbox:** each cloud session owns one Daytona sandbox (`sessions.sandboxId`). Multiple sessions on the same repo run in parallel with isolated sandboxes; each will use its own work branch and PR—GitHub handles merge conflicts. See `docs/h3code-cloud-saas-prd.md` (Execution model).
- Add shadcn components from **this directory** (`npx shadcn@latest add <name>`), not from desktop or web.
- Product specs live under `docs/` (`h3code-cloud-saas-prd.md`, `h3code-unified-client.md`, `h3code-platform-vision.md`).
