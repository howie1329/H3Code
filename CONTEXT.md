# H3Code

H3Code is a local desktop workbench for supervising coding-agent runtimes across local Git repositories. It presents and controls runtime-owned work without becoming an agent runtime itself.

## Language

**Agent Runtime**:
An external coding-agent system, such as Pi, Codex, or Claude Code, that owns agent execution, authentication, tools, and canonical conversation state.
_Avoid_: Provider, agent provider

**Model Provider**:
An inference service used through an Agent Runtime. H3Code does not integrate model providers directly.
_Avoid_: Runtime, agent

**Runtime Integration**:
The H3Code package that connects one Agent Runtime to the workbench, using its AI SDK harness where suitable and runtime-specific code for required behavior the harness does not expose.
_Avoid_: Provider integration, universal agent protocol

**Repository**:
A local Git checkout registered with H3Code and used as the working directory for one or more Threads.
_Avoid_: Project, workspace

**Thread**:
A durable H3Code workstream backed by exactly one canonical session owned by its Agent Runtime. Multiple Threads may run concurrently, including against the same Repository.
_Avoid_: Chat, task, session

**Turn**:
One user prompt and the resulting Agent Runtime execution within a Thread.
_Avoid_: Request, job

**Active Turn**:
A Turn the Agent Runtime is currently processing, including model calls, tool execution, and pauses for required approval.
_Avoid_: Running Thread

**Shared Checkout**:
A Repository used concurrently by two or more Threads, with every Thread observing and modifying the same files, branch, and Git state.
_Avoid_: Shared workspace

**Attention State**:
The current user-visible condition of a Thread: Idle, Running, Waiting for Approval, Follow-up Queued, Failed, or Interrupted. Turn completion returns its Thread to Idle rather than completing the durable Thread.
_Avoid_: Thread status, session status

**Archived Thread**:
A Thread hidden from normal H3Code navigation while its canonical runtime session remains intact.
_Avoid_: Deleted Thread

**Thread Title**:
Editable H3Code-owned navigation metadata associated with a Thread without replacing or altering its canonical runtime session identity.
_Avoid_: Session ID, prompt

**Unread Thread**:
A background Thread with unseen completion, failure, or approval-required activity. Unread state is H3Code-owned navigation metadata cleared when the Thread is viewed.
_Avoid_: Unread session, notification
