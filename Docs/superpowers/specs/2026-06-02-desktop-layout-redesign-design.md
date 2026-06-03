# H3Code Desktop — Linear IDE Shell Layout Redesign

**Date:** 2026-06-02  
**Status:** Approved for review  
**Scope:** `apps/desktop` (Electron + SvelteKit)

## Summary

Redesign the desktop app shell from a sidebar + workspace + optional right inspector into a **Linear-aesthetic, IDE-capable layout**: activity rail, swappable sidebar slots, session tabs, center split with file preview, right inspector, bottom dock, and a search-first ⌘K palette.

**North star:** Linear (quiet canvas, dense type, hairline seams)  
**Capability target:** Explorer, multi-session tabs, split stage, bottom panel, palette-first chrome, activity bar

**Approach:** Option 1 — “Linear IDE” — panels exist as collapsible slots on one canvas; chrome stays minimal until user intent opens surfaces.

---

## 1. Shell Grid & Resize

### Grid topology

```
columns:  [ rail ] [ sidebar? ] [ main (+ optional inspector) ]
rows:     [ -------- main row -------- ]
          [ -------- bottom dock? ----- ]
```

| Region | Size | Collapsible |
|--------|------|-------------|
| Activity rail | 48px fixed | No (hidden on landing) |
| Sidebar slot | 240px | Yes — ⌘B |
| Main column | flex-1 | — |
| Right inspector | 24rem (`--context-panel-width`) | Yes — ⌘I / ⌘D |
| Bottom dock | 0 / 32px peek / 192px / 288px | Yes — ⌘J |

**Landing (`/`):** Same shell; rail, sidebar, dock, inspector hidden; centered composer.

**Settings (`/settings`):** Rail visible; tab strip hidden; settings content in main.

### layoutState (new module)

UI chrome only — separate from `desktopState` / PI boundary.

```ts
type SidebarSlot = "sessions" | "files" | "search";
type BottomDockTab = "output" | "tools" | "diagnostics" | "terminal";
type WorkspaceMode = "landing" | "workspace" | "settings";

type LayoutState = {
  mode: WorkspaceMode;
  railVisible: boolean;
  sidebarOpen: boolean;
  activeSidebarSlot: SidebarSlot;
  inspectorOpen: boolean;
  activeInspector: "context" | "diff" | null;
  centerSplit: { enabled: boolean; ratio: number };
  secondaryPane: "none" | "file-preview" | null;
  bottomDockOpen: boolean;
  activeBottomTab: BottomDockTab;
  bottomDockHeight: "hidden" | "peek" | "default" | "expanded";
  openSessionTabs: SessionTab[];
  activeSessionTabId: string | null;
};
```

### DesktopSettings extensions

```ts
sidebarSlot: SidebarSlot;
bottomDockOpen: boolean;
bottomDockHeight: "peek" | "default" | "expanded";
centerSplitRatio: number;
lastSidebarSlot: SidebarSlot;
openTabIds: string[];
activeTabId: string | null;
recentlyClosedTabIds: string[];
recentCommands: { id: string; label: string; timestamp: number }[];
autoOpenDockOnError: boolean;
defaultBottomTab: BottomDockTab;
```

Migrate existing: `sidebarOpen`, `contextPanelOpen`, `preferDiffPanel`.

### Keyboard

| Shortcut | Action |
|----------|--------|
| ⌘B | Toggle sidebar |
| ⌘I | Toggle context inspector |
| ⌘D | Toggle diff inspector |
| ⌘J | Toggle bottom dock |
| ⌘\\ | Toggle center split |
| Esc | Close stack: palette → dock → inspector → split |

---

## 2. Session Tabs & Multi-Session

### Model

- Tabs = workspace slots over existing `sessionCaches` (max 20)
- PI: one RPC connection, one live session; tab switch = cache outgoing + reconcile incoming
- No auto-abort on tab switch

```ts
type SessionTab = {
  id: string;              // `${repoPath}::${sessionPath}` or "landing"
  kind: "session" | "landing";
  sessionPath?: string;
  repoPath?: string;
  title: string;
  repoName?: string;
  status: SessionRowStatusKind;
  isPinned?: boolean;
  lastFocusedAt: number;
  paneState: TabPaneState;
};
```

### Tab strip

- Height 32px, `text-[11px]`, horizontal scroll, max ~10 tabs + overflow
- Pinned “New session” tab on landing
- ⌘N / ⌘W / ⌘⇧T / ⌘1–9 / ⌘⌥←→

### Routes (v1)

Keep `/`, `/workspace`, `/settings`. Tab state not in URL (v2 optional `?session=`).

---

## 3. Split Stage & File Preview

### Topology

- Primary (west): `WorkspaceTranscript` + floating `PromptComposer` — always
- Secondary (east): `FilePreviewPane` — on demand
- Right inspector: context + diff — unchanged v1

### Per-tab pane state

```ts
type TabPaneState = {
  splitEnabled: boolean;
  splitRatio: number;
  secondary: { kind: "file"; relativePath: string; absolutePath: string } | null;
};
```

### Files sidebar

- Root: `desktopState.getWorkspaceRoot()`
- Lazy tree, ignore `.git` / `node_modules` / etc. (collapsed by default)
- Click file → open preview + enable split

### File preview

- Read-only v1; monospace text; images supported; 512KB cap
- Syntax highlighting deferred v2

### New shell API

```ts
listDirectory(rootPath, relativePath): Promise<DirectoryEntry[]>
readFilePreview(rootPath, relativePath): Promise<FilePreviewResult>
```

Path traversal guarded in Electron main; wire through zero-native shim in `app.html`.

### Transcript spine

Keep `max-w-[46rem]` on transcript; split reclaims width for preview only.

---

## 4. Bottom Dock

Spans rail + sidebar + main (not right inspector).

### Tabs

| Tab | v1 content |
|-----|------------|
| **Output** | `composerPhase`, `statusStripLines`, widgets, notifications, errors |
| **Tools** | Structured tool log from `sessionReadModel.tools` |
| **Diagnostics** | Pi connection, session, tokens, transport, app version |
| **Terminal** | Placeholder; v2 = node-pty + xterm.js |

Default collapsed; peek strip on working/error; auto-open on error (setting).

Dock reflects **active session tab** only in v1.

---

## 5. Command Palette (⌘K)

Replace static `AppCommandMenu` dialog with shadcn `command` palette.

### Groups

Recent → Sessions → Layout → Agent → Navigation → Settings

### Dynamic items

- Open tabs + searchable sessions (metadata index)
- Fuzzy files (index on first Files sidebar open, max 10k paths)

### Boundaries

- ⌘K = app navigation / layout / files / sessions
- Composer `/` = PI slash commands only (palette may focus composer + insert `/name`)

Add `command` component via shadcn CLI in `apps/desktop`.

---

## 6. Migration Plan

### Phase 0 — Foundation

1. Add `layout-state.svelte.ts` + extend `DesktopSettings` / Electron prefs migration
2. Add `AppShell.svelte` grid; refactor `+layout.svelte` to use it
3. Add shadcn `command` + `command-registry.ts`

### Phase 1 — Shell regions (no new data)

1. `ActivityRail.svelte` — 4 icons
2. Refactor `AppSidebar` → `SessionsSidebar.svelte`; slot host `SidebarSlotHost.svelte`
3. `SessionTabStrip.svelte` — UI only, single session initially
4. Move `WorkspaceShell` content into `MainStage.svelte`
5. Keep `ContextPanel` / `SessionDiffPanel` — wire toggles to `layoutState`

**Delete/replace:** `PageShell` header logic absorbed into tab strip + slim `WorkspaceHeader` (sidebar trigger, title, inspector toggles).

### Phase 2 — Multi-session tabs

1. Tab open/close/activate orchestration with `desktopState.handleSwitchSession`
2. Persist tab ids in prefs; restore on launch
3. Remove redirect guard friction on `/workspace` where tabs handle empty state

### Phase 3 — Files & split

1. Electron FS IPC + `FilesSidebar` + `FilePreviewPane` + `SplitDivider`
2. File index for ⌘K search
3. Per-tab pane state persistence

### Phase 4 — Bottom dock

1. `BottomDock.svelte` + Output / Tools / Diagnostics tabs
2. Terminal placeholder tab
3. Settings rows for dock prefs; migrate old workspace layout toggles

### Phase 5 — Command palette

1. Full `AppCommandMenu` rewrite with registry + dynamic providers
2. Recent commands persistence
3. Deprecate sidebar search button behavior → unified palette

### Component mapping

| Current | After |
|---------|-------|
| `+layout.svelte` (Sidebar.Provider) | `AppShell.svelte` |
| `AppSidebar.svelte` | `SessionsSidebar.svelte` |
| `WorkspaceShell.svelte` | `MainStage.svelte` + `WorkspaceHeader.svelte` |
| `PageShell.svelte` | Removed or settings-only wrapper |
| `SessionLanding.svelte` | Rendered inside `MainStage` landing mode |
| `SettingsShell.svelte` | Keep; hide tab strip via `layoutState.mode` |
| `AppCommandMenu.svelte` | Rewritten command palette |
| `AppHeader.svelte` | Slimmed → `WorkspaceHeader.svelte` |

### desktopState changes (minimal)

- Move `activeInspector` / panel open prefs orchestration to `layoutState` (call desktopState for diff/context data)
- Add `getWorkspaceRoot()` consumers; no tab state in desktopState
- Keep `sessionCaches`, `handleSwitchSession`, `enterLanding` — layout calls these

### Settings page

Replace “Workspace layout” switches with:

- Open sidebar on launch
- Default sidebar slot
- Bottom panel on launch / auto-open on error / default tab
- Remove redundant inspector toggles if palette + shortcuts suffice (or keep as defaults)

### Risk & testing

| Risk | Mitigation |
|------|------------|
| Layout regression on small windows | Min-width 640px; sidebar offcanvas on narrow |
| Tab switch during streaming | Existing `switchGeneration` + cache |
| FS security | Path resolve under repo root only |
| Scope creep | Terminal PTY, syntax highlight, URL session sync → v2 |

### Out of scope (v2)

- Integrated terminal (PTY)
- Shiki syntax highlighting
- Diff in center split
- `/workspace/:sessionId` routes
- Transcript path links → preview
- Prefix modes in palette (`>`, `@`, `#`)

---

## Approval checklist

- [x] Section 1 — Shell grid
- [x] Section 2 — Session tabs
- [x] Section 3 — Split & file preview
- [x] Section 4 — Bottom dock
- [x] Section 5 — Command palette
- [x] Section 6 — Migration

**Next step after spec approval:** Invoke `writing-plans` skill for phased implementation plan.
