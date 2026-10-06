# Local Development

## Current source of truth

Target and legacy package manager: `npm` (`package-lock.json`). Root coordinates active workspaces `tgtd-Frontend` and `tgtd-Backend`.

Next 16 generated repository-level `AGENTS.md`/`CLAUDE.md` during the temporary root app and workspace-level `tgtd-Frontend/AGENTS.md`/`tgtd-Frontend/CLAUDE.md` after relocation. They contain Next-specific guidance and regenerate during `next dev`; retain both levels. `.codex/rules/`, `.codex/plans/`, and `.codex/references/` remain the primary project migration knowledge and do not conflict with them.

## Verified target scripts

| Operation | Command | Status in audit |
| --- | --- | --- |
| Install | `npm install --ignore-scripts` | PASS; root workspace resolution completed. |
| Dev | `npm run dev -- --hostname 127.0.0.1` | PASS; root delegated to `tgtd-Frontend`, `/` returned HTTP 200. |
| Build | `npm run build:webpack` | PASS; root delegated Webpack production build. |
| Typecheck | `npm run typecheck` | PASS; frontend and backend workspace checks. |
| Lint | `npm run lint` | PASS; frontend workspace. |
| Unit test | `npm test -- --reporter=dot` | PASS; frontend 1 file and 2 tests. |
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

Phase 1.5 target passes root install, workspace resolution, delegated lint, typecheck, unit tests, Webpack build, and a dev landing-page smoke check. Each later phase reruns focused workspace tests plus the full suite before handoff.

Root `package.json` is coordination-only. Frontend configs live under `tgtd-Frontend`; backend currently exposes only a typecheck script for its admin adapter. Do not add empty workspace scripts.
