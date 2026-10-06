# Local Development

## Current source of truth

Target and legacy package manager: `npm` (`package-lock.json`). Target Phase 1 foundation is locally runnable.

Next 16 generated `AGENTS.md` and `CLAUDE.md` during `next dev`. `AGENTS.md` contains Next-specific guidance and `CLAUDE.md` references it. Retain both because Next regenerates them; `.codex/rules/`, `.codex/plans/`, and `.codex/references/` remain the primary project migration knowledge and do not conflict with these files.

## Verified target scripts

| Operation | Command | Status in audit |
| --- | --- | --- |
| Install | `npm install --ignore-scripts` | PASS; target dependencies installed. |
| Dev | `npm run dev -- --hostname 127.0.0.1` | PASS; `/` returned HTTP 200. |
| Build | `npm run build:webpack` | PASS; verified Webpack production build. |
| Typecheck | `npm run typecheck` | PASS; target-only project scope. |
| Lint | `npm run lint` | PASS. |
| Unit test | `npm test -- --reporter=dot` | PASS; 1 file and 2 tests. |
| E2E | `npm run test:e2e` | Not run; no feature flows exist yet. |
| Start | `npm start` | Not run; Webpack production build passed. |

Legacy baseline remains separate: root typecheck and lint fail on pre-existing issues, while 164 unit tests pass. Legacy build/dev were not run because the legacy workspace is read-only.

`npm run build` uses default Turbopack and is environment-limited in the Codex sandbox because its worker cannot create or bind the required process. This is not a target source or configuration regression. Use `npm run build:webpack` for the close-out gate.

## Native local model

Legacy documentation expects Supabase CLI for local database/auth:

```bash
npx supabase start
npx supabase migration up
npm install
npm run dev
```

Use `.env.example` as a variable-name template. Never copy secret values into `.codex`. Docker is not the local development path in the current migration.

## Target verification gate

Phase 1 target passes install, lint, typecheck, Webpack build, and a dev landing-page smoke check. Each later phase reruns focused tests plus the full suite before handoff.
