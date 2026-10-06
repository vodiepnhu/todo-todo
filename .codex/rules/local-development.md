# Local Development

## Current source of truth

Target and legacy package manager: `npm` (`package-lock.json`). Root coordinates active workspaces `tgtd-Frontend` and `tgtd-Backend`.

Next 16 generated repository-level `AGENTS.md`/`CLAUDE.md` during the temporary root app and workspace-level `tgtd-Frontend/AGENTS.md`/`tgtd-Frontend/CLAUDE.md` after relocation. They contain Next-specific guidance and regenerate during `next dev`; retain both levels. `.codex/rules/`, `.codex/plans/`, and `.codex/references/` remain the primary project migration knowledge and do not conflict with them.

## Verified target scripts

| Operation | Command | Status in audit |
| --- | --- | --- |
| Install | `npm install` | PASS; root workspace resolution completed. |
| Dev | `NEXT_PUBLIC_ENABLE_LOCAL_DEMO_ACCOUNT=true npm run dev -- --hostname 127.0.0.1` | PASS; `/login` and `/signup` returned HTTP 200, `/app` redirected to `/login?error=configuration` without Supabase credentials; server stopped. |
| Build | `npm run build:webpack` | PASS; root delegated Webpack production build. |
| Typecheck | `npm run typecheck` | PASS; frontend and backend workspace checks. |
| Lint | `npm run lint` | PASS; frontend workspace. |
| Unit test | `npm test -- --reporter=dot` plus `npm --workspace tgtd-Backend run test` | PASS; frontend 2 files/5 tests and backend demo-seed guard checks. |
| Demo seed guard | `NODE_ENV=production ENABLE_LOCAL_DEMO_ACCOUNT=true npm run seed:demo` | PASS; refuses with `Demo seed is disabled in production`. |
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

Phase 2 target passes root install, workspace resolution, delegated lint, typecheck, frontend tests, backend seed-policy tests, Webpack build, login/signup HTTP smoke, and protected-shell redirect smoke. Live demo account creation/login/logout requires local Supabase services and remains unverified when unavailable. Each later phase reruns focused workspace tests plus the full suite before handoff.

Root `package.json` is coordination-only. Frontend configs live under `tgtd-Frontend`; backend owns the server-only Supabase dependency, demo seed command, and seed-policy test. Do not add empty workspace scripts.
