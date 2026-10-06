# Migrate Feature

1. Read the selected phase in `.codex/plans/02-migration-plan.md` and the module rows in `.codex/references/legacy-code-map.md`.
2. Confirm target and legacy paths; legacy remains read-only.
3. Copy or move the smallest coherent boundary according to classification.
4. Preserve public route/API contracts and behavior tests.
5. Use TDD for behavior changes; use MOVE/EXTRACT before REWRITE.
6. Run focused tests, typecheck, lint, and build at the phase gate.
7. Record deviations, baseline comparisons, and rollback points.
8. Update backlog status only with verification evidence.

Stop before migrating Docker, experimental sidecars, or unowned demos.
