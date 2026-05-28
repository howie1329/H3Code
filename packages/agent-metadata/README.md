# @h3code/agent-metadata

SQLite-backed metadata index and desktop preferences for H3Code. Stores recent repos, indexed session summaries, worktree mappings, and UI settings — not transcripts or messages.

## Setup

```ts
import { configureMetadataStore, getPreferences } from "@h3code/agent-metadata";

configureMetadataStore({ dataDir: "/path/to/user-data" });
// database: /path/to/user-data/h3code.sqlite

const preferences = getPreferences();
```

Call `configureMetadataStore` before any other API. Electron configures this with `app.getPath("userData")`; the Agent Server uses `dataDir` from `startAgentServer` options or `H3CODE_DATA_DIR`.

## Checks

```bash
npm run check --workspace @h3code/agent-metadata
npm run test --workspace @h3code/agent-metadata
```
