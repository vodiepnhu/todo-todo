# Coding Conventions

- Use TypeScript strict mode and the existing npm/Next toolchain.
- Use `PascalCase` for React components and `camelCase` for functions/variables.
- Prefer domain nouns in new code: `Project`, `Activity`, `Planner`, `PendingAction`.
- Keep `workspace` when referring to the database/API contract; do not rename fields casually.
- Keep server-only modules visibly under `server` or a feature `server` directory.
- Validate untrusted HTTP, AI, Maps, and database payloads at boundaries with existing Zod schemas or narrow parsers.
- Preserve meaningful error messages and return appropriate HTTP status codes.
- Keep loading, empty, error, and degraded states explicit in feature UI.
- Keep accessibility semantics, keyboard behavior, focus behavior, and confirmation text during moves.
- Add comments only for non-obvious constraints such as cookie naming, RLS assumptions, or compatibility behavior.
- Do not upgrade dependencies, rename database fields, or redesign UI during structural migration.
- Keep tests close to the behavior they protect under `tests/unit` and retain E2E coverage for core flows.
