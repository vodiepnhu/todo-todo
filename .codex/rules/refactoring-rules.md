# Refactoring Rules

- PRESERVE BEHAVIOR.
- REUSE FIRST.
- MIGRATE INCREMENTALLY.
- VERIFY EACH STEP.
- DO NOT MASS DELETE.
- DO NOT MASS MOVE WITHOUT A MAP.
- DO NOT FIX UNRELATED LEGACY ISSUES DURING MIGRATION.
- DO NOT UPGRADE EVERYTHING AT ONCE.
- Move a working file before rewriting it when ownership is the main problem.
- Extract pure logic before changing behavior.
- Keep compatibility aliases until `rg` and tests show no consumers.
- Treat confirmation execution, auth, RLS, and secret handling as high-risk boundaries.
- Use TDD for feature, bugfix, and refactor code: failing test, minimal change, full focused verification.
- After two similar failed attempts, stop and reassess assumptions and routing before a third attempt.
- Record baseline failures separately from migration regressions.
- Do not copy `.env.local`, `.env.docker`, credentials, `node_modules`, build output, or generated artifacts.
- Docker and deployment remain deferred until local behavior is stable.
