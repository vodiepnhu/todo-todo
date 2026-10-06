# Start Feature

1. Identify the feature boundary from `.codex/references/legacy-code-map.md`.
2. Read `.codex/references/project-overview.md`, `.codex/references/architecture-map.md`, and relevant `.codex/rules/*`.
3. Run the skill-router check.
4. Read only the route, feature files, direct dependencies, and tests needed.
5. Write a micro-plan:
   - GOAL
   - FILES LIKELY AFFECTED
   - BEHAVIOR TO PRESERVE
   - RISKS
   - VERIFICATION
6. Use TDD before production code.
7. Implement one coherent change.
8. Run focused verification, then the project suite when required.
9. Update stable `.codex/references` only when knowledge changed.

Do not expand scope without evidence.
