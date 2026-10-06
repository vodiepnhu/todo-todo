# Context Budget

Use progressive disclosure.

## Level 1 - Project memory

Read compact knowledge from `.codex/references/`, `.codex/rules/`, and `.codex/plans/` before rediscovering the repository.

## Level 2 - Feature context

Read only the current feature and direct dependencies. Start with route entry points, public exports, tests, and server contracts.

## Level 3 - Implementation context

Read only files needed for the immediate change. Prefer `rg` for symbols/imports and line-count scans before opening large files.

## Level 4 - Expanded investigation

Expand across the repository only when evidence requires it: cross-feature behavior, auth/RLS, shared contracts, or unexplained failures.

Ignore generated/dependency directories by default: `node_modules`, `.next`, `dist`, `build`, `coverage`, `.cache`, Python caches, and binary artifacts.

Persist stable conclusions, API contracts, mappings, verified commands, and migration decisions in `.codex/references`. Never persist private chain-of-thought or raw repository dumps.

Large files require focused slices. Start with exports/imports and tests, then read the smallest implementation region that answers the question.
