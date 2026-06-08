# @h3code/agent-provider-pi

PI SDK adapter for the H3Code runtime/read-model architecture.

This package owns PI-specific runtime integration:

- PI SDK session lifecycle.
- PI session references and resume handles.
- PI command mapping for the first-pass runtime command surface.
- PI-native event to `@h3code/agent-protocol` `RuntimeEvent` mapping.
- PI session discovery/deletion helpers used by composition layers.

It does **not** own `SessionReadModel` projection. Runtime event ingestion, bindings, read-model projection, and UI event generation belong in `@h3code/agent-runtime`.

## First-pass scope

- Start session
- Resume session
- Send turn
- Abort turn
- Approval/user-input resolution
- Streaming text events
- Tool events
- Runtime errors
- Stop/dispose

Advanced PI controls such as model changes, thinking level, queue modes, auto-compaction, switch/fork/import, and advanced session management are intentionally deferred.

## Checks

```bash
npm run check --workspace @h3code/agent-provider-pi
npm run test --workspace @h3code/agent-provider-pi
```
