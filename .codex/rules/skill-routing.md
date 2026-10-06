# Skill Routing

Before meaningful analysis or coding, check whether a verified skill reduces repository scanning, repeated reasoning, repetitive edits, debugging loops, or user explanation enough to justify its overhead.

- Start of meaningful work: use `superpowers:using-superpowers`.
- Architecture, new subsystem, or structural behavior change: use `superpowers:brainstorming` and wait at its design gate when the next action would implement behavior.
- Multi-step implementation: use `superpowers:writing-plans` before code; ask for plan review and execution method.
- Feature, bugfix, or refactor implementation: use `superpowers:test-driven-development` before production code.
- Any failure: use `superpowers:systematic-debugging` before proposing a fix.
- Before completion, merge, or status claim: use `superpowers:verification-before-completion` with fresh command output.
- Before merge or major completed change: request `superpowers:requesting-code-review` when review tooling is available.
- Architecture/workflow diagram request: use `archify`; skip it for text-only maps.

AUTO skills are deterministic process or verification steps within user scope. ASK skills have design, external, expensive, or architecture-changing effects. Never route to `ponytail`, `caveman`, or `agentation` until an actual instruction file is found and read.

After two similar failed attempts, apply the two-failure rule: stop, inspect assumptions and references, narrow the context, and select a different strategy.
