# H3Code — Change Explanation

<!-- agentkit:start change-explanation -->
Use this when handing off completed work to a developer or reviewer.

## What to Include

1. **Summary** — One or two sentences on what changed and why.
2. **Changed surfaces** — List files or areas touched (desktop UI, agent-server protocol, Convex schema, etc.).
3. **Behavior change** — What users or agents will notice; include before/after when helpful.
4. **Checks run** — Commands actually executed and their outcome.
5. **Skipped checks** — Anything not run and why.
6. **Risks and follow-ups** — Edge cases, tech debt, or planned hardening.

## Project-Specific Focus

For **desktop** changes, call out:

- WebSocket protocol or `agent-client` impact
- Provider-neutral vs PI-specific typing
- Electron main vs renderer boundary
- Transcript rendering, session cache, or metadata indexing

For **packages** changes, call out:

- Protocol or contract changes in `@h3code/agent-core`
- Server routing, provider registry, or connection lifecycle in `@h3code/agent-server`

For **cloud** changes, call out:

- Convex schema or function changes
- Clerk auth or permission boundaries
- TanStack Router/Start data loading impact

For **UI** changes, include screenshots or short screen recordings when behavior is visual.

## Tone

- Plain language; explain decisions and trade-offs.
- Distinguish facts from assumptions.
- Do not dump raw diffs when a structured summary is enough.
<!-- agentkit:end change-explanation -->
