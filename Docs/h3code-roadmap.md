# H3Code Roadmap

> Status: Active working roadmap. This describes product sequencing, not a promise of dates. The [product brief](../PRODUCT.md) defines the product; [product direction](./h3code-product-direction.md) records the strategic and business-model rationale.

## Where we are

H3Code has two partially working surfaces:

- **Desktop:** a usable local PI workbench on Electron + SvelteKit using the legacy H3Code protocol/runtime and WebSocket transport.
- **Cloud:** a usable authenticated workspace shell on TanStack Start + Clerk + Convex with GitHub repository selection, session/message persistence, and Daytona provisioning. It does not yet run a live agent session.

The product is therefore in the **foundation and execution-boundary transition**. New feature work should improve the workbench or move execution behind the shared AI SDK-compatible UI boundary; it should not deepen the legacy runtime stack.

## Roadmap at a glance

| Phase | Focus | Status |
| --- | --- | --- |
| 0 | Product foundation and legacy freeze | In progress |
| 1 | Desktop execution boundary and Codex path | Next |
| 2 | Complete the flagship desktop workbench | Planned |
| 3 | Prove an independent cloud Codex workspace | Planned |
| 4 | Harden and launch the cloud MVP | Planned |
| 5 | Optional expansion | Later |

## Phase 0 — Product foundation and legacy freeze

**Goal:** make the current product understandable, testable, and safe to evolve.

Deliverables:

- Keep README, product brief, architecture notes, and roadmap aligned.
- Treat `agent-protocol`, `agent-runtime`, `agent-runtime-ws`, `agent-runtime-persistence`, and `agent-runtime-server` as migration-only.
- Document desktop and cloud smoke paths and baseline restart/reconnect behavior.
- Harden the local boundary enough for development use: startup authentication, payload validation, and actionable connection errors.
- Define the shared execution lifecycle: start/resume, send turn, stream UI parts, steer, abort, status, and stop.

Exit criteria:

- A new contributor can run the desktop and cloud surfaces from the root README.
- Current behavior and planned behavior are distinguishable in every top-level product document.
- New work has an obvious home outside the legacy runtime packages.

## Phase 1 — Desktop execution boundary and Codex path

**Goal:** establish the product boundary that supports more than PI without rewriting the workbench for each runtime.

Deliverables:

- Add a thin Codex app-server execution adapter for desktop.
- Preserve native Codex authentication, approvals, interruption, plans, diffs, and resume semantics where supported.
- Introduce the shared AI SDK-compatible stream and `UIMessage` transcript boundary.
- Keep PI behavior available while its events are adapted to the same workbench boundary.
- Move runtime-specific controls behind capability detection.

Exit criteria:

- A user can select the runtime and complete a prompt/stream/steer-or-follow-up/abort/resume loop on desktop.
- Codex and PI use the same transcript, composer, session shell, and diagnostics surfaces.
- No new product feature requires extending the legacy protocol projector.

## Phase 2 — Complete the flagship desktop workbench

**Goal:** make H3Code preferable to running multiple agent terminals and tools side by side.

Deliverables:

- Reliable multi-repository and multi-session navigation.
- Integrated terminal lifecycle and useful output presentation.
- Development-server detection and secure local preview access.
- Diff review plus branch, commit, and push workflows.
- Clear runtime/model/authentication state and recovery guidance.
- Crash recovery, restart/reconnect coverage, and launch-quality empty/error states.
- Retire the legacy desktop runtime path once all consumers have migrated.

Exit criteria:

- Routine local coding-agent work can be completed without leaving H3Code for terminal, preview, diff, or Git tasks.
- Desktop sessions recover predictably after renderer and application restarts.
- Legacy runtime packages can be deleted without behavior loss.

## Phase 3 — Prove an independent cloud Codex workspace

**Goal:** validate the remote workspace end to end before broadening cloud scope.

Deliverables:

- Provision one user-scoped Daytona sandbox per session.
- Clone a GitHub repository into an isolated session branch.
- Run the Codex execution path privately inside the sandbox.
- Validate subscription authentication, with BYOK/Gateway fallback where required.
- Stream assistant/tool UI parts to the shared web workbench.
- Persist UI messages and opaque resume state in Convex.
- Add terminal output, secure development-server previews, diffs, commit/push, and pull-request creation.
- Suspend and resume the sandbox without losing the session.

Decision gate:

Continue toward a cloud MVP only if authentication policy, credential isolation, resume behavior, sandbox latency, and cost are acceptable together. Otherwise keep the workspace experience and launch with the supported BYOK/Gateway execution path.

## Phase 4 — Harden and launch the cloud MVP

**Goal:** turn the successful cloud proof into a reliable single-user product.

Deliverables:

- Cross-device session and workspace persistence.
- Sandbox lifecycle controls, deletion, and bounded resource usage.
- Explicit authentication and billing status throughout the UI.
- Secure credential disconnect and workspace deletion flows.
- Error reporting, usage visibility, operational runbooks, and support instrumentation.
- Responsive browser/PWA experience for the intended mobile use cases.
- Production checks for tenancy, GitHub permissions, sandbox isolation, and reconnect behavior.

Exit criteria:

- A user can move between desktop, browser, and mobile without losing product state.
- Cloud sessions recover with bounded cost and clear failure states.
- Repository-to-pull-request flow works for the supported GitHub cases.

## Phase 5 — Optional expansion

Only consider these after the desktop and cloud MVPs are stable:

- Desktop relay and secure device pairing.
- Additional cloud runtimes.
- Local model discovery and routing improvements.
- Teams, organizations, and shared sessions.
- GitHub App migration for finer permissions and webhooks.
- Managed inference plans.
- Native mobile applications if the PWA is insufficient.

## Working decision rules

- Prefer the smallest change that improves the shared workbench or the current product loop.
- Preserve provider-native strengths and authentication semantics.
- Keep H3Code-owned persistence focused on metadata and UI reload state.
- Do not add provider-specific protocol types to shared UI components.
- Do not start the next phase until the preceding exit criteria are demonstrably met.
