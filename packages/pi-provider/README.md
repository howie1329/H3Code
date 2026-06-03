# @h3code/pi-provider

`@h3code/pi-provider` is the SDK-backed PI provider package for H3Code.

It owns the PI SDK runtime path and includes the `PiAgentProvider` adapter used by `@h3code/agent-server` through the shared `@h3code/agent-core` provider contract.

## Owns

- PI SDK runtime creation with `createAgentSessionRuntime()`.
- Persistent PI session targets through `SessionManager`.
- PI session discovery and deletion helpers used by Agent Server platform commands.
- Prompt, steer, follow-up, abort, session switching, and new-session flows.
- PI SDK event mapping into H3Code session domain events.
- Agent Core compatibility through `PiAgentProvider`.
- Extension UI request/response bridging.

## Does Not Own

- Agent Server WebSocket routing.
- Provider-neutral WebSocket protocol definitions.
- Desktop IPC.
- Worktree creation or cleanup.
- Git diff collection.
- SQLite preferences, recents, or sidebar metadata.

## Session Helpers

`listPiSessionsForRepo` and `deletePiSessionForRepo` keep PI SDK session-file behavior in this package while still recording plain metadata rows through `@h3code/agent-metadata`. Agent Server calls these helpers for PI-backed platform session commands.

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
