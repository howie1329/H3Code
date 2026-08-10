# Domain Docs

How engineering skills consume this repo's domain documentation while exploring the codebase.

## Before exploring

- Read `CONTEXT.md` at the repo root.
- Read ADRs under `docs/adr/` that affect the area being changed.

If these paths do not exist, proceed silently. Domain-modeling workflows create them when terminology or decisions are resolved.

## File structure

This repo uses a single-context layout:

```text
/
├── CONTEXT.md
├── docs/
│   └── adr/
│       ├── 0001-example-decision.md
│       └── 0002-another-decision.md
└── apps/
```

## Use the glossary vocabulary

When output names a domain concept—such as in an issue title, refactor proposal, hypothesis, or test name—use the term defined in `CONTEXT.md`.

If a needed concept is absent, reconsider whether the term belongs to the project or note the gap for domain modeling.

## Flag ADR conflicts

Explicitly surface any proposal that contradicts an existing ADR instead of silently overriding the decision.
