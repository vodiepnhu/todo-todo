# Audit Command

Use for a fresh legacy/target audit.

1. Resolve `$PWD` and confirm it is not the legacy path.
2. Read `.codex/references/project-overview.md`, `.codex/rules/context-budget.md`, and `.codex/rules/local-development.md`.
3. Inspect target Git status without destructive commands.
4. Inspect legacy entry points, package/config files, routes, tests, and direct dependencies with `rg`.
5. Run only safe existing checks in legacy; never install, build, format, or write there.
6. Record new stable findings in `.codex/plans/00-project-audit.md` or the narrowest reference file.

Output: evidence-backed status, baseline separation, and next phase recommendation.
