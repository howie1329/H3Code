# H3Code — Change Explanation

<!-- agentkit:start change-explanation -->
For substantive handoffs, lead with the user-visible outcome and include:

1. What changed and which Pi product slice it advances.
2. The affected boundary: Electron main, `runtime-pi` bridge, preload, renderer, theme, or shadcn source.
3. Important ownership or failure-handling decisions.
4. Commands actually run and their results.
5. Skipped checks, remaining uncertainty, and the next narrow follow-up.

For UI changes, include a screenshot when visual verification materially helps review. For Pi lifecycle work, call out the embedded SDK version, resource loading, canonical session ownership, bridge launch, concurrent Thread behavior, abort, exit, malformed messages, renderer reload, and application restart explicitly. For Shared Checkout work, state whether the diff is Repository-wide and how concurrent-edit risk is presented.
<!-- agentkit:end change-explanation -->
