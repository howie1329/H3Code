# H3Code — Code Quality

<!-- agentkit:start code-quality -->
Use the smallest implementation that completes the current Pi product slice.

## Priorities

1. Preserve ownership: Pi owns agent behavior and canonical sessions; H3Code owns the local workbench and Thread supervision.
2. Keep the Electron boundary explicit: privileged operations in main or `runtime-pi`, narrow preload API, browser-safe renderer.
3. Keep the pinned Pi SDK and native translation inside a dedicated `runtime-pi` bridge process.
4. Keep live Thread lifecycles independent of renderer navigation and component lifecycles.
5. Prefer direct Pi-focused code over shared runtime layers without a second real consumer.
6. Reuse Pi's configured resource services instead of reimplementing its authentication, settings, extensions, skills, prompts, themes, or models.
7. Keep generated shadcn primitives upstream-shaped and compose product UI outside `components/ui`.
8. Validate Repository paths, bridge messages, runtime data, and process failures at the boundary where they enter.

## Tests

No test runner exists in the clean baseline. Add focused tests with the first Pi lifecycle or stream-processing module. Prefer deterministic unit tests for bridge framing, session correlation, concurrent Thread state, stream handling, abort, and resume behavior; use integration checks for Pi resources, extensions, sessions, and real-checkout boundaries where unit tests cannot prove behavior.

## Review Checklist

- [ ] The change advances the active milestone in `PRODUCT.md` and uses `CONTEXT.md` terminology.
- [ ] Main/preload/renderer responsibilities remain separated.
- [ ] Pi-native state is not copied into a competing canonical model.
- [ ] Active Turns survive renderer navigation and Shared Checkout behavior is represented honestly.
- [ ] New dependencies solve a concrete need.
- [ ] Semantic theme classes and existing shadcn components are used.
- [ ] `npm run check`, `npm run lint`, and `npm run build` pass when relevant.
<!-- agentkit:end code-quality -->
