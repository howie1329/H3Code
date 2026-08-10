# H3Code

H3Code is a desktop interface for running Pi against local Git repositories. This glossary defines the product language used across the V2 application and its documentation.

## Language

**Pi**:
The coding-agent runtime that owns agent behavior, tools, models, authentication, and canonical conversation state.
_Avoid_: Py, provider, agent backend

**Repository**:
A local Git checkout selected as the working directory for one or more Threads.
_Avoid_: Project, workspace

**Thread**:
A user-facing continuous conversation backed by exactly one canonical Pi session and associated with one Repository.
_Avoid_: Chat, conversation, H3Code session

**Turn**:
One unit of work beginning with a user prompt and ending when Pi finishes, is aborted, or pauses for user input.
_Avoid_: Request, generation

**Active Turn**:
A Turn that Pi is currently processing, including model calls and tool execution.
_Avoid_: Running Thread

**Shared Checkout**:
A Repository used concurrently by two or more Threads, with all Threads observing and modifying the same files and Git state.
_Avoid_: Shared workspace
