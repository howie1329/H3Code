# @h3code/pi-provider

`@h3code/pi-provider` is the SDK-backed PI provider package for H3Code.

It is intentionally independent from `@h3code/agent-core` for v1. The package proves the PI SDK runtime path first, then a later milestone can adapt or rewrite the shared Agent Core contracts with real provider behavior in hand.

## Owns

- PI SDK runtime creation with `createAgentSessionRuntime()`.
- Persistent PI session targets through `SessionManager`.
- Prompt, steer, follow-up, abort, session switching, and new-session flows.
- PI SDK event mapping into provisional H3Code-friendly provider events.
- Extension UI request/response bridging.

## Does Not Own

- Agent Server WebSocket routing.
- Agent Core compatibility wrappers.
- Desktop IPC.
- Worktree creation or cleanup.
- Git diff collection.
- SQLite preferences, recents, or sidebar metadata.

## Checks

```bash
npm run check --workspace @h3code/pi-provider
npm run test --workspace @h3code/pi-provider
```

## Manual Smoke

The smoke script uses real PI configuration and may require valid model credentials:

```bash
PI_PROVIDER_SMOKE_CWD=/path/to/repo PI_PROVIDER_SMOKE_PROMPT="Say hello." npm run smoke --workspace @h3code/pi-provider
```
