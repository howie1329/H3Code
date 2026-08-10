# H3Code — Code Quality

<!-- agentkit:start code-quality -->
Use the smallest implementation that completes the current PI product slice.

## Priorities

1. Preserve ownership: PI owns agent behavior and canonical sessions; H3Code owns the workbench.
2. Keep the Electron boundary explicit: privileged operations in main, narrow preload API, browser-safe renderer.
3. Prefer direct code over provider-neutral layers, registries, or abstractions without a second real consumer.
4. Keep generated shadcn primitives upstream-shaped and compose product UI outside `components/ui`.
5. Validate external data and process failures at the boundary where they enter.

## Tests

No test runner exists in the clean baseline. Add focused tests with the first PI lifecycle or stream-processing module. Prefer deterministic unit tests for process framing, command correlation, state transitions, and reconnect behavior; use integration checks for Electron/PI boundaries only where unit tests cannot prove behavior.

## Review Checklist

- [ ] The change advances the active milestone in `PRODUCT.md`.
- [ ] Main/preload/renderer responsibilities remain separated.
- [ ] PI-native state is not copied into a competing canonical model.
- [ ] New dependencies solve a concrete need.
- [ ] Semantic theme classes and existing shadcn components are used.
- [ ] `npm run check`, `npm run lint`, and `npm run build` pass when relevant.
<!-- agentkit:end code-quality -->
