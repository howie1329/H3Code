# H3Code Product Direction

> Status: Strategic product direction and phased plan. The concise product brief is [PRODUCT.md](../PRODUCT.md); the executable sequence is [h3code-roadmap.md](./h3code-roadmap.md).
>
> Date: July 14, 2026
>
> Evidence: [AI SDK 7 Authentication and Execution Research](./h3code-ai-sdk-v7-auth-execution-research.md)

## Direction

H3Code is a subscription-first coding-agent workbench for local and cloud repositories.

The product gives developers one place to work with coding harnesses, repositories, sessions, terminals, previews, diffs, and Git workflows. H3Code owns the workbench and the connective experience. It does not own foundation models, recreate mature agent loops, or make token resale its primary value.

Desktop is the first and strongest product surface. It uses the developer's local repositories, installed runtimes, and existing subscription authentication. The web product follows with an independent Codex-first cloud workspace that remains usable when the desktop is offline.

## Product promise

> Run coding agents against local or cloud repositories from one workbench, using the subscriptions and providers you already have whenever the runtime permits it.

This promise has two parts:

- **One workbench:** a consistent interface for chat, tool activity, sessions, terminals, previews, diffs, and Git operations.
- **Use existing access:** prefer native subscription authentication and BYOK over forcing all inference through H3Code-managed API billing.

H3Code must be honest where subscription portability is unavailable. It should offer an explicit alternative instead of presenting API usage as subscription usage.

## Product surfaces

### H3Code Desktop

Desktop is the flagship subscription-first workbench.

Initial runtimes:

1. **Codex through Codex app-server.** Use native ChatGPT-backed authentication, threads, approvals, tools, diffs, plans, interruption, and resume.
2. **Pi through the Pi SDK.** Use Pi's native authentication and provider/model ecosystem.

Later desktop runtimes are added only when they provide clear user value and have a reliable authentication path. Runtime count is not a launch metric.

Desktop owns:

- Local repository selection and workspace state.
- A unified transcript and tool-activity experience.
- Terminal, development-server, and preview workflows.
- Diff review and local Git actions.
- Runtime selection, status, and capability-aware controls.
- Local session discovery and non-canonical display caching.

Desktop does not own:

- Provider OAuth token formats or refresh logic.
- Canonical native runtime transcripts.
- Model routing that the selected runtime already performs.
- A replacement agent loop.

### H3Code Cloud

Cloud is an independent remote workspace, not merely a remote control for Desktop.

The first cloud runtime is Codex app-server inside a user-scoped sandbox. A user signs into H3Code, selects a GitHub repository and branch, authenticates Codex for the cloud environment, works through the shared H3Code UI, previews changes, and commits or opens a pull request.

Initial execution options:

1. **Codex subscription authentication** through an app-server login flow, subject to successful security and persistence validation.
2. **BYOK** for supported API providers.
3. **AI Gateway** as an optional unified API-billing path.

Managed inference is not the default product thesis. It can be added later for onboarding or teams if its economics and provider terms are acceptable.

Cloud owns:

- Identity and GitHub connection.
- User-scoped sandbox provisioning and lifecycle.
- Repository clone, branch, commit, push, and pull-request workflows.
- Cross-device transcript and product-state persistence.
- Secure, encrypted cloud credential persistence when required.
- Terminal and development-server preview access.

### Desktop relay

Desktop relay is a later optional mode in which the web client controls a running H3Code Desktop host.

It can provide mobile access to local repositories and local subscription-backed runtimes without cloud inference costs. It does not replace the independent cloud workspace because it requires the desktop to remain awake and reachable.

Relay should be evaluated only after the cloud workspace works end to end.

## Shared product architecture

AI SDK 7 is the shared UI, message, and transport foundation. It is not required to be the execution engine for every runtime.

```txt
Shared H3Code workbench
  UIMessage + useChat + AI SDK-compatible transport
                         |
               H3Code execution boundary
                         |
       Desktop                          Cloud
       Codex app-server                 Codex app-server in sandbox
       Pi SDK                           BYOK / AI Gateway adapters
       Local model providers            Optional managed inference
```

The shared boundary should expose only the lifecycle H3Code needs:

- Start or resume a session.
- Send a turn.
- Stream AI SDK-compatible UI parts.
- Steer or follow up when supported.
- Abort an active turn.
- Read runtime status and capabilities.
- Stop or destroy a session.

The boundary must remain small. It is not a new universal agent protocol.

## Product principles

### Own the workbench

H3Code should be excellent at the experience shared across runtimes: navigation, session organization, chat, tool visibility, terminal access, previews, diffs, Git actions, and moving between local and cloud work.

### Preserve native runtime strengths

Codex, Pi, and future runtimes retain their native authentication, agent loops, tools, permissions, compaction, and session semantics. H3Code adapts their output at the UI boundary.

### Subscription first, honest fallback

Use existing user subscriptions where the provider and runtime support third-party integration. Otherwise offer BYOK or clearly labeled managed API usage.

### Desktop and cloud share an experience, not an implementation

The two surfaces should share message rendering, interaction patterns, and product concepts. Their execution and persistence systems remain appropriate to their environments.

### Earn multi-runtime complexity

Codex and Pi are enough to prove the product. Additional harnesses must justify their authentication, maintenance, UI, and support costs.

## Phased plan

### Phase 0: Resolve the execution choices

Goal: remove technical uncertainty before restructuring the desktop application.

Deliverables:

- Test the community Codex app-server provider with AI SDK 7.
- Confirm subscription-backed Codex execution with no ambient API or Gateway credential.
- Verify streamed messages, reasoning, commands, file changes, plans, approvals, interruption, and thread resume.
- Confirm Pi SDK sessions reuse Pi's native auth storage without H3Code copying credentials.
- Define the minimal execution boundary required by both runtimes.

Exit criteria:

- Codex completes a multi-turn coding session using ChatGPT subscription authentication.
- Pi completes a multi-turn coding session using its native authentication.
- Both streams can be represented as public AI SDK `UIMessage` parts.
- The integration path does not depend on private AI SDK internals.

Decision gate:

- Adopt the community Codex provider if it is compatible and maintainable.
- Otherwise build a narrow app-server adapter owned by H3Code.

### Phase 1: Establish the shared client boundary

Goal: make the renderer independent from the current legacy runtime protocol.

Deliverables:

- Define `UIMessage` as the transcript boundary.
- Introduce one desktop chat transport consumed through AI SDK UI patterns.
- Render text, reasoning, commands, file changes, approvals, errors, and completion states from message parts.
- Keep runtime-specific session and control details behind the execution boundary.
- Preserve current desktop behavior while the old protocol remains available during migration.

Exit criteria:

- The renderer does not require `SessionReadModel` or provider-native message types.
- A fixture stream can drive the complete transcript and tool UI.
- Existing repo selection, session switching, prompt, steer, abort, and diff workflows remain usable.

### Phase 2: Ship Codex on Desktop

Goal: make subscription-backed Codex the first production runtime on the simplified architecture.

Deliverables:

- Start and supervise Codex app-server from Electron main or a utility process.
- Detect existing Codex authentication and provide native login when needed.
- Support thread creation, resume, interruption, approvals, and model discovery.
- Connect Codex events to the shared desktop transport.
- Integrate Codex file changes with the existing diff and Git experience.
- Keep credentials and runtime processes outside the renderer.

Exit criteria:

- A user can open a local repository, use an existing ChatGPT subscription, complete a coding task, review the diff, and continue the same thread after restarting H3Code.
- H3Code clearly shows which authentication and billing path is active.

### Phase 3: Bring Pi onto the shared boundary

Goal: preserve Pi's flexibility without preserving the legacy H3Code runtime stack.

Deliverables:

- Host Pi through its SDK and native `AuthStorage`.
- Convert Pi events into the same UI stream used by Codex.
- Preserve Pi session ownership, queueing, compaction, extensions, and model selection where they remain product-relevant.
- Add runtime selection without duplicating the workbench UI.
- Retire legacy protocol and runtime packages after their final consumers migrate.

Exit criteria:

- Codex and Pi use one transcript, composer, session shell, diff surface, and transport contract.
- Runtime-specific controls appear only when supported.
- No canonical Pi or Codex transcript is duplicated into H3Code-owned local storage.
- The legacy runtime path can be deleted without behavior loss.

### Phase 4: Complete the Desktop workbench

Goal: make H3Code preferable to running several terminals and harness applications side by side.

Deliverables:

- Reliable multi-repository and multi-session navigation.
- Integrated terminal lifecycle and output.
- Development-server detection and preview access.
- Clear runtime, model, authentication, and connection state.
- Diff review, commit, branch, and push workflows.
- Robust restart, reconnect, crash recovery, and empty/error states.

Exit criteria:

- The complete local coding loop can be performed without leaving H3Code for routine terminal, preview, diff, or Git work.
- Codex and Pi sessions recover predictably after renderer or application restarts.

### Phase 5: Prove an independent cloud Codex workspace

Goal: validate the original work-anywhere product without committing to broad cloud scope.

Deliverables:

- Provision one user-scoped sandbox for one session.
- Clone a GitHub repository into a session branch.
- Run Codex app-server privately inside the sandbox.
- Complete device-code authentication through the H3Code UI.
- Persist encrypted Codex credential state and verify revocation.
- Stream the session into the shared web transcript.
- Run a development server and expose a secure preview.
- Commit, push, and open a pull request.
- Suspend and resume the sandbox without losing the workspace or Codex thread.

Exit criteria:

- A user can start on a phone or second computer while H3Code Desktop is offline.
- The user can authenticate once, resume later, preview the result, and deliver changes through GitHub.
- Credential isolation, deletion, and sandbox lifecycle behavior pass security review.
- Measured sandbox cost and resume latency are acceptable.

Decision gate:

- Continue to a cloud MVP only if subscription authentication, persistence, security, and economics are viable together.
- Otherwise launch cloud with BYOK and Gateway execution while retaining the same workspace experience.

### Phase 6: Cloud MVP

Goal: turn the successful cloud prototype into a reliable single-user product.

Deliverables:

- Cross-device session and transcript persistence through Convex.
- Repository, branch, session, and sandbox lifecycle management.
- Codex subscription, BYOK, and Gateway execution choices.
- Terminal, preview, diff, commit, push, and pull-request workflows.
- Usage visibility for sandbox compute and any managed inference.
- Secure credential disconnect and workspace deletion flows.
- Responsive browser and installable mobile PWA experience.

Exit criteria:

- A user can move between desktop, browser, and mobile without losing product state.
- Cloud sessions have reliable recovery, bounded cost, and explicit authentication status.
- Support burden is understood before adding additional cloud runtimes.

### Phase 7: Optional expansion

Consider only after the desktop and cloud MVPs are stable:

- Desktop relay and secure device pairing.
- Additional cloud harnesses.
- Local model discovery and routing improvements.
- Teams and shared workspaces.
- GitHub App migration for finer repository permissions.
- Managed inference plans.
- Native mobile clients if PWA constraints become material.

## MVP boundaries

### Desktop MVP

Included:

- Local repositories.
- Codex app-server with subscription authentication.
- Pi SDK with native authentication.
- Shared AI SDK UI message rendering.
- Session lifecycle, steer, abort, diff, terminal, preview, and core Git actions.

Deferred:

- Claude subscription integration.
- A broad plugin marketplace.
- Cloud synchronization of local transcripts.
- Desktop relay.
- Teams and collaboration.

### Cloud MVP

Included:

- Solo accounts.
- GitHub repositories.
- One sandbox per session.
- Codex-first execution.
- Subscription authentication if the Phase 5 gate passes.
- BYOK and Gateway fallback.
- Cross-device sessions, terminal, preview, diff, branch, commit, and pull request.

Deferred:

- General multi-provider cloud routing.
- Managed inference as the default.
- Claude subscription authentication.
- Teams, organizations, and shared sessions.
- Native mobile applications.
- Desktop relay.

## Business model boundary

H3Code should charge for value it owns rather than trying to compete with provider-subsidized inference.

Potential paid value:

- Cloud sandbox compute and persistence.
- Cross-device workspace access.
- Team and collaboration features.
- Operational limits such as concurrent cloud sessions.
- Optional managed inference with transparent usage pricing.

Desktop subscription-backed model usage remains between the user and the model provider. Cloud Codex subscription usage should remain tied to the user's own authenticated Codex account where supported.

Pricing is intentionally deferred until the cloud prototype produces real compute, storage, and support-cost measurements.

## Success measures

### Product fit

- Users choose H3Code instead of keeping several harness terminals open.
- Codex and Pi feel like native parts of one workbench rather than embedded terminal sessions.
- A session can move between local and cloud workflows through Git without confusion.

### Desktop reliability

- Successful authentication detection and clear recovery when signed out.
- Predictable thread/session resume after application restart.
- Low failure rate for prompt, stream, steer, abort, terminal, preview, and Git actions.

### Cloud viability

- Acceptable sandbox start and resume latency.
- Bounded compute and storage cost per active session.
- Reliable credential isolation and revocation.
- Successful completion of the repository-to-pull-request workflow from mobile.

Specific numeric targets should be set after Phase 0 and Phase 5 establish baseline behavior.

## Explicit non-goals

- Building a new foundation model or general-purpose agent framework.
- Replacing Codex, Pi, or other mature harness agent loops.
- Owning or transforming provider OAuth tokens unnecessarily.
- Reselling top-tier model tokens as the primary business.
- Supporting every harness before the core workbench is excellent.
- Making the desktop depend on cloud availability.
- Making the web product depend on a running desktop.
- Maintaining two unrelated transcript and interaction systems.

## Risks

### Community provider compatibility

The Codex app-server community provider may lag AI SDK 7 or expose incomplete stream semantics. Mitigation: validate it before migration and keep a narrow direct app-server adapter as the fallback.

### Experimental Harness APIs

Official Harness packages can change independently of stable AI SDK UI. Mitigation: depend on public UI types at the renderer boundary and isolate Harness-specific code inside execution adapters.

### Subscription policy changes

Providers can change third-party authentication rules. Mitigation: preserve BYOK and Gateway paths, label billing modes clearly, and avoid promising unsupported subscription portability.

### Cloud credential custody

Persisting Codex authentication in cloud sandboxes creates significant security responsibility. Mitigation: user-scoped encryption, strict isolation, explicit revocation, private control transports, short retention where possible, and a dedicated security review before launch.

### Scope expansion

Terminals, previews, Git, cloud sandboxes, multiple runtimes, and mobile access can expand simultaneously. Mitigation: enforce the phase gates and keep Codex-first cloud scope.

## Decisions established by this direction

- H3Code remains both a desktop and web product.
- Desktop is the first implementation priority and primary subscription-backed surface.
- Codex app-server and Pi SDK are the initial desktop runtime paths.
- AI SDK 7 remains the shared UI and transport foundation.
- Official AI SDK Harness adapters are optional execution implementations, not a universal requirement.
- Independent cloud workspaces are the primary web product.
- Cloud starts Codex-first instead of multi-provider-first.
- BYOK and AI Gateway are explicit fallbacks.
- Desktop relay is deferred until after the independent cloud workflow is proven.
- H3Code does not advertise Claude subscription support without explicit provider approval.

## Documentation impact

This direction supersedes or narrows several earlier assumptions:

- [Platform Vision](./h3code-platform-vision.md): relax the requirement that every runtime use `HarnessAgent`.
- [AI SDK Harness Architecture](./h3code-ai-sdk-harness-architecture.md): retain `UIMessage`, `useChat`, and the simplified client boundary, but allow native SDK and app-server execution adapters.
- [Cloud SaaS PRD](./h3code-cloud-saas-prd.md): replace multi-provider and managed-inference-first cloud scope with Codex-first execution and subscription/BYOK/Gateway choices.
- [Unified Client](./h3code-unified-client.md): preserve the shared workbench while allowing different native execution adapters behind desktop and cloud transports.
- [Desktop MVP](./h3code-desktop-mvp.md): preserve Pi behavior during migration, then add Codex and move both runtimes onto the shared UI boundary.

The product brief and roadmap now govern product priority and sequencing. The linked documents remain detailed architecture or implementation references; their status notes identify which assumptions are current, transitional, or superseded.
