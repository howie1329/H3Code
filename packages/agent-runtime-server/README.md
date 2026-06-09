# @h3code/agent-runtime-server

Desktop composition server for the H3Code runtime architecture.

This package wires together:

- `@h3code/agent-runtime`
- `@h3code/agent-runtime-ws`
- `@h3code/agent-provider-pi`

It does not own runtime bindings, runtime event ingestion, or `SessionReadModel` projection. Those stay in `@h3code/agent-runtime`.
