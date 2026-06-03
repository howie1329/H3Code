# @h3code/agent-metadata

SQLite-backed metadata index and desktop preferences for H3Code. Stores recent repos, indexed session summaries, worktree mappings, UI settings, and renderer message-cache rows — not canonical transcripts.

This package accepts plain metadata row inputs and does not import provider SDK types. Provider-specific packages are responsible for translating SDK session objects before recording metadata.

## Setup

```ts
import { configureMetadataStore, getPreferences } from "@h3code/agent-metadata";

configureMetadataStore({ dataDir: "/path/to/user-data" });
// database: /path/to/user-data/h3code.sqlite

const preferences = getPreferences();
```

Call `configureMetadataStore` before any other API. Electron configures this with `app.getPath("userData")`; the Agent Server uses `dataDir` from `startAgentServer` options or `H3CODE_DATA_DIR`.

Use `recordRepoSessionRows` for indexed session summaries. Use `getIndexedSessionsForRepo` when a caller only needs cached session rows for one repo instead of a full preferences snapshot.

## Checks

```bash
npm run check --workspace @h3code/agent-metadata
npm run test --workspace @h3code/agent-metadata
```
