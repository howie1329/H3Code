# H3Code Unified Client

> Status: Draft. Implementation guide for one TanStack Start app served from **Vercel (cloud)** and **Electron (desktop)**.
>
> Parent: [h3code-platform-vision.md](./h3code-platform-vision.md). Cloud scope: [h3code-cloud-saas-prd.md](./h3code-cloud-saas-prd.md). Data model: [h3code-convex-schema.md](./h3code-convex-schema.md).

## Goal

Build **one** web UI that:

- On **Vercel** behaves as the cloud product (login, GitHub repos, remote sessions).
- Inside **Electron** behaves as the desktop product (local folder, local agent)—without maintaining two separate component trees.

Same app shell (sidebar, transcript, composer, diffs). Different **runtime adapters** for onboarding, workspace selection, and `sendMessage` / subscriptions.

## Runtime Model

```ts
type Runtime = "desktop" | "cloud";
```

| `runtime` | Host | Workspace | Agent backend | Auth |
|-----------|------|-----------|---------------|------|
| `cloud` | Browser / PWA on Vercel | GitHub repo + branch | Convex → Daytona sandbox | Clerk |
| `desktop` | Electron `BrowserWindow` | Local `repoPath` (native picker) | Local Agent Server (WS or IPC) + PI | Optional Clerk later; none for MVP desktop |

**Do not** scatter `if (isCloud)` across components. Resolve runtime once at the root and inject via context.

## Detecting Runtime

### Cloud (Vercel build)

Set at build time:

```bash
VITE_RUNTIME=cloud
```

Deploy only the cloud bundle to Vercel. Default routes assume Clerk + Convex.

### Desktop (Electron)

Inject before the page loads (preload):

```ts
contextBridge.exposeInMainWorld("__H3_RUNTIME__", "desktop" as const);
```

```ts
declare global {
  interface Window {
    __H3_RUNTIME__?: "desktop";
  }
}

export function getRuntime(): Runtime {
  if (typeof window !== "undefined" && window.__H3_RUNTIME__ === "desktop") {
    return "desktop";
  }
  if (import.meta.env.VITE_RUNTIME === "cloud") {
    return "cloud";
  }
  // Safer default for unknown web: cloud (or throw in dev)
  return "cloud";
}
```

Hostname (`app.h3code.com`) may reinforce cloud mode but must not be the only signal—Electron dev uses `127.0.0.1`.

## Electron Integration

Electron is a **host**, not a separate UI codebase.

```txt
apps/desktop/electron/
  main.ts       — window, preload, start/stop Agent Server, IPC handlers
  preload.ts    — __H3_RUNTIME__, pickFolder, getAgentServerUrl, revealInFinder

apps/desktop/ (or embedded dist from apps/cloud build)
  loads TanStack SPA — dev: VITE_DEV_SERVER_URL; prod: static dist/
```

### Electron responsibilities (unchanged from today)

- Native **folder picker** → `repoPath`.
- Start/stop **local Agent Server** (`@h3code/agent-runtime-server` + `PiProviderAdapter`).
- Optional: expose `agent.*` IPC that mirrors mutations (send, abort, subscribe events).
- Window chrome, deep links, auto-update (later).

### SPA responsibilities

- Never call Daytona or cloud provision mutations when `runtime === "desktop"`.
- Never assume `repoPath` exists when `runtime === "cloud"`.

## Package Layout (Target)

```txt
packages/
  app-shell/           # AppLayout, Sidebar, Transcript, Composer, DiffPanel
                       # Props/callbacks only — no Convex or WS imports

  runtime-cloud/       # useCloudSession(), useCloudMessages(), useRepos(), Clerk guards
  runtime-desktop/     # useLocalRepo(), useDesktopAgent(), folder picker bridge

apps/
  cloud/               # TanStack Start: routes, providers, VITE_RUNTIME=cloud
                       # Depends: app-shell, runtime-cloud, agent-protocol, convex

  desktop/             # Electron wrapper; VITE_RUNTIME=desktop build of same SPA
                       # Depends: app-shell, runtime-desktop, agent-protocol
```

**Rule:** `app-shell` imports only `agent-protocol` types and generic hooks interfaces—not Convex or `ws`.

## Routing & Guards

Use TanStack Router `beforeLoad` (or equivalent) per runtime.

### Cloud routes (example)

| Path | Purpose |
|------|---------|
| `/` | Clerk sign-in (public) |
| `/app` | Workspace landing (app shell; no active session) |
| `/app/sessions/$sessionId` | Active cloud workspace |
| `/app/settings` | Account and GitHub integrations |

Repo selection and “add repository” live in the **sidebar** (modal/popover), not a dedicated route.

Post-login redirect → `/app`. Protect the `/app` layout route:

```ts
beforeLoad: async () => {
  if (getRuntime() !== "cloud") return;
  if (!await isSignedIn()) throw redirect({ to: "/" });
};
```

### Desktop routes (example)

| Path | Purpose |
|------|---------|
| `/open-folder` | No repo selected |
| `/session/$sessionId` | Local session (or workspace root) |
| `/` | Redirect: has repoPath → workspace; else open-folder |

```ts
beforeLoad: () => {
  if (getRuntime() !== "desktop") return;
  if (!getDesktopRepoPath()) throw redirect({ to: "/open-folder" });
};
```

Same session URL **shape** under each runtime’s app prefix is fine; loaders call different runtime hooks (cloud: `/app/sessions/$sessionId`, desktop: e.g. `/session/$sessionId`).

## Data Hooks Pattern

Shared components consume stable hooks; implementations swap by runtime.

```tsx
// packages/app-shell — Transcript.tsx
function Transcript({ sessionId }: { sessionId: string }) {
  const { messages, status } = useSessionMessages(sessionId);
  // render from H3Code message shapes only
}
```

```ts
// apps/cloud wires:
export function useSessionMessages(sessionId: string) {
  return useQuery(api.messages.list, { sessionId }); // Convex
}

// apps/desktop wires:
export function useSessionMessages(sessionId: string) {
  return useDesktopMessages(sessionId); // WS events + optional Convex cache
}
```

Register the implementation in a root provider:

```tsx
<SessionMessagesProvider value={runtime === "cloud" ? cloudImpl : desktopImpl}>
```

## Cloud Path (Recap)

1. Clerk sign-in + GitHub connection (`repo` scope).
2. List repos (Convex action + GitHub API via Clerk token).
3. `createSession` mutation → `execution: "cloud"`, status `provisioning`, schedule provision action → **one Daytona sandbox per session** (clone repo, session `workBranch` when git workflow lands).
4. Sandbox adapter writes coalesced chunks → Convex; UI subscribes.
5. Steer/abort → control mutation; sandbox subscribes to control query.

See [cloud PRD](./h3code-cloud-saas-prd.md) and [Convex schema](./h3code-convex-schema.md).

## Desktop Path (Recap)

1. Electron: user picks folder → `repoPath` in memory / light storage.
2. Connect to local Agent Server; PI `connect({ repoPath })`.
3. Stream: WS (today) or IPC events → map with existing adapter patterns → UI.
4. Optional: mirror chunks to Convex (`execution: "local"`) for instant reload on next launch.
5. On send: ensure provider reconnected using stored `providerSessionRef` on session row.

## Build & Deploy

| Artifact | Command / host | `VITE_RUNTIME` |
|----------|----------------|----------------|
| Cloud production | Vercel ← `apps/cloud` | `cloud` |
| Desktop production | Electron packages `apps/cloud` dist (or desktop imports cloud build output) | `desktop` |
| Local dev cloud | `npm run dev` in `apps/cloud` | `cloud` |
| Local dev desktop | Electron + dev server URL | preload sets `desktop` |

Consider **two Vite build targets** from one package if tree-shaking cloud-only routes matters; otherwise lazy `import()` cloud routes behind `runtime === "cloud"`.

## Bundle & Security Notes

- **Lazy-load** Clerk and cloud-only routes on desktop builds to avoid shipping unused auth UI.
- **CSP / cookies:** test Clerk + Convex inside Electron early (`https://localhost` or custom protocol).
- **Secrets:** desktop never embeds managed inference keys in the renderer; cloud injects into sandbox server-side only.

## Phased Rollout

1. **Ship `apps/cloud` only** (`runtime=cloud`) on Vercel—no Electron integration.
2. Extract **`app-shell`** once transcript/composer stabilize.
3. **Electron loads SPA** with preload + desktop routes + Agent Server bridge.
4. **Optional:** desktop “Cloud” mode = same cloud hooks inside Electron (no local repo).

## Testing

- **Runtime detection:** unit test `getRuntime()` with mocked `window` and `import.meta.env`.
- **Guards:** router tests redirect unauthenticated cloud users and desktop users without `repoPath`.
- **app-shell:** storybook/tests with fake `useSessionMessages` fixture—no Convex/WS.

## Related Docs

- Desktop local agent host (IPC, in-process): [h3code-desktop-evolution.md](./h3code-desktop-evolution.md)
- Convex tables and indexes: [h3code-convex-schema.md](./h3code-convex-schema.md)
