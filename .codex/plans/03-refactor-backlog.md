# Refactor Backlog

Statuses: TODO, READY, IN_PROGRESS, BLOCKED, DONE, DEFERRED.

## DONE

### W-001 - Correct workspace ownership after foundation

- TASK: Move verified Next foundation into `tgtd-Frontend`, move pure admin Supabase access into `tgtd-Backend`, and convert root package to npm workspace coordination.
- REASON: Root is repository coordination; runtime ownership must be explicit before feature migration.
- DEPENDENCIES: Phase 1 foundation baseline `8e6153a`.
- FILES: Root foundation configs/source/tests, `tgtd-Frontend/*`, `tgtd-Backend/*`, root `package.json`, `package-lock.json`.
- RISK: Medium; path resolution and workspace delegation.
- VERIFICATION: root install, workspace resolution, lint, typecheck, tests, Webpack build, dev smoke.
- STATUS: DONE.

### P2-001 - Establish frontend shared UI and auth slice

- TASK: Move required UI primitives, implement real Supabase login/signup/callback/logout, and add protected `/app` shell.
- REASON: Establish the smallest complete user-entry flow before backend/domain migration.
- DEPENDENCIES: W-001, R-005.
- FILES: `tgtd-Frontend/src/shared/ui/*`, `tgtd-Frontend/src/features/auth/*`, `tgtd-Frontend/src/app/(auth)/*`, `tgtd-Frontend/src/app/auth/callback/route.ts`, `tgtd-Frontend/src/app/app/page.tsx`.
- RISK: High; session cookies and redirect behavior.
- VERIFICATION: frontend tests, lint/typecheck, Webpack build, HTTP route smoke; live auth pending local Supabase.
- STATUS: DONE.

### P2-002 - Add guarded idempotent local demo seed

- TASK: Create `demo@local.test` / `123456` through Supabase Admin API with profile metadata and no production execution path.
- REASON: Provide repeatable local auth testing without a frontend bypass.
- DEPENDENCIES: `tgtd-Backend` admin adapter and local Supabase schema.
- FILES: `tgtd-Backend/scripts/seed-demo.mjs`, `tgtd-Backend/scripts/seed-demo-policy.mjs`, `tgtd-Backend/.env.example`.
- RISK: Critical; service-role secret and accidental production use.
- VERIFICATION: production guard test; live idempotency pending local Supabase.
- STATUS: DONE.

## READY

### R-001 - Create target runtime foundation

- TASK: Copy selective npm/Next configuration and create minimal target app shell.
- REASON: Target needed a runnable application foundation.
- DEPENDENCIES: Audit and architecture approval.
- FILES: `tgtd-Frontend/package.json`, `tgtd-Frontend/tsconfig.json`, `tgtd-Frontend/next.config.ts`, `tgtd-Frontend/src/app/*`, `tgtd-Frontend/src/config/*`, `tgtd-Frontend/src/server/supabase/*`, `tgtd-Backend/src/platform/supabase/*`.
- RISK: High; config and auth cookie boundaries.
- VERIFICATION: target install, lint, typecheck, build, dev smoke.
- STATUS: DONE.

### R-002 - Move shared UI primitives

- TASK: Move Button/Card/Input/planner wait primitives under `src/shared/ui`.
- REASON: Low-risk reuse and stable import boundary.
- DEPENDENCIES: R-001.
- FILES: `src/components/ui/*` -> `tgtd-Frontend/src/shared/ui/*`.
- RISK: Low.
- VERIFICATION: component tests and target build.
- STATUS: DONE.

### R-003 - Establish auth feature boundary

- TASK: Move login/signup/callback behavior behind `features/auth`.
- REASON: Auth is a clear boundary and protects later feature work.
- DEPENDENCIES: R-001, R-002.
- FILES: legacy auth routes/components -> `tgtd-Frontend`; lib auth modules -> `tgtd-Backend/src/modules/auth/*`.
- RISK: High.
- VERIFICATION: password/account tests and local auth smoke.
- STATUS: DONE.

## TODO

### Phase 3 - Backend foundation plan approved

- P3-001: Extract minimal profile/workspace/member contracts from src/types/database.ts.
- P3-002: Add framework-free authenticated-user lookup and authorization decisions.
- P3-003: Add RLS-scoped profile repository/use cases without changing signup trigger behavior.
- P3-004: Add read-only workspace membership repository and active role authorization.
- P3-005: Extract Home workspace partitioning under modules/workspaces; do not create modules/projects or generic folders.
- P3-006: Add explicit @togo-todo/backend root exports; keep platform/admin internals private.
- P3-007: Run full acceptance gate and update verified memory.
- PLAN: .codex/plans/05-backend-foundation.md.
- STATUS: DONE.

### R-004 - Narrow TypeScript project scope

- TASK: Ensure target typecheck includes app source and intended tests only; keep `rag-demo` outside the target app boundary.
- REASON: Legacy root typecheck fails on unrelated nested Vite dependencies.
- DEPENDENCIES: R-001.
- FILES: `tgtd-Frontend/tsconfig.json`, optional separate demo config later.
- RISK: Medium; avoid hiding application files.
- VERIFICATION: target typecheck and explicit file inventory.
- STATUS: DONE.

### R-005 - Extract server Supabase adapters

- TASK: Move browser/server/admin clients and env config into explicit server/config ownership.
- REASON: Prevent server-only imports and scattered env logic.
- DEPENDENCIES: R-001, R-003.
- FILES: framework adapters in `tgtd-Frontend/src/server/supabase/*`; pure admin adapter in `tgtd-Backend/src/platform/supabase/*`.
- RISK: Critical.
- VERIFICATION: auth, middleware, route, and build checks.
- STATUS: DONE.

### R-006 - Extract workspace and Home repositories

- TASK: Split workspace membership/CRUD and Home folder queries from UI.
- REASON: Direct Supabase queries currently live in screens.
- DEPENDENCIES: R-005.
- FILES: `src/services/workspace-service.ts`, `src/services/folder-service.ts`, `src/components/home/home-shell.tsx`.
- RISK: High.
- VERIFICATION: project creation, membership, folder tree, sharing tests.
- STATUS: DONE; Phase 3 read-only workspace/Home foundation delivered. Full workspace mutations and sharing remain deferred.

### R-007 - Consolidate planner route setup

- TASK: Share project/Home planner request setup while keeping scope differences explicit.
- REASON: `src/app/api/ai/planner/route.ts` and `src/app/api/ai/home/route.ts` duplicate auth, trace, usage, and orchestrator wiring.
- DEPENDENCIES: R-005, R-006.
- FILES: both planner routes, `src/agents/orchestrator.ts`, AgentOps services.
- RISK: High.
- VERIFICATION: planner and golden tests plus project/Home API contract tests.
- STATUS: TODO.

### R-008 - Split planner orchestration

- TASK: Separate pure routing decisions from I/O and response persistence.
- REASON: 528-line orchestrator owns too many concerns.
- DEPENDENCIES: R-007.
- FILES: `src/agents/orchestrator.ts`, all planner agents, planner schema.
- RISK: Critical.
- VERIFICATION: existing orchestrator tests must remain green before and after each split.
- STATUS: TODO.

### R-009 - Split confirmation execution

- TASK: Separate pending state handling, action authorization, item/plan writes, project creation, embeddings, and audit writes.
- REASON: Current service is highest data integrity risk.
- DEPENDENCIES: R-005, R-008.
- FILES: `src/services/confirmation-service.ts`, `src/services/plan-persist-service.ts`, confirm API.
- RISK: Critical.
- VERIFICATION: CREATE/UPDATE/DELETE/LOG_EVENT/CREATE_PROJECT and idempotency/version tests.
- STATUS: TODO.

### R-010 - Split Home and plan editor UI

- TASK: Break `home-shell.tsx` and `add-to-plan-form.tsx` by behavior while preserving user flow.
- REASON: Highest UI maintenance cost.
- DEPENDENCIES: R-006, R-009.
- FILES: `src/components/home/home-shell.tsx`, `src/components/plans/add-to-plan-form.tsx`.
- RISK: High.
- VERIFICATION: existing Home/plan component tests plus manual smoke.
- STATUS: TODO.

### R-011 - Move dashboard/history/account feature ownership

- TASK: Move data queries and view composition into feature-owned modules.
- REASON: Reduce direct database access and improve boundaries.
- DEPENDENCIES: R-006, R-009.
- FILES: dashboard/history/account/workspace clients and routes.
- RISK: Medium.
- VERIFICATION: focused tests, lint/typecheck/build, route smoke.
- STATUS: TODO.

### R-012 - Preserve compatibility and remove dead code

- TASK: Audit legacy redirects, deprecated aliases, unused `ProjectCard`, and TODO/TOGO compatibility after migration.
- REASON: Prevent premature deletion and stale ownership.
- DEPENDENCIES: R-010, R-011.
- FILES: `src/app/app/*`, `src/services/workspace-service.ts`, `src/lib/items/activity.ts`, `src/components/home/home-shell.tsx`.
- RISK: Medium.
- VERIFICATION: `rg` consumer scan, route matrix, full tests.
- STATUS: TODO.

## UNCERTAIN / BLOCKED

### R-013 - Decide ownership of RAG demo and Python sidecars

- TASK: Decide whether `rag-demo/`, root Python modules, `services/`, `tools/`, and registries are supported products or archival references.
- REASON: They are not imported by the Next app but affect root tooling and typecheck scope.
- DEPENDENCIES: Product/repository ownership decision.
- FILES: `rag-demo/`, `*.py`, `services/`, `tools/`, `registry/`, `demo-tool-registry/`.
- RISK: Medium.
- VERIFICATION: import/deployment inventory after decision.
- STATUS: UNCERTAIN.

## Fast migration status

- Runtime move takes priority over granular cleanup.
- R-007 through R-012 remain post-migration refactor work, not prerequisites for product development.
- `tgtd-Agent` and `tgtd-AI-RAG` now own copied active runtime; preserve compatibility exports until consumers and behavior are fully consolidated.
- Legacy Python sidecars, Docker files, and RAG demo remain historical/deferred unless later runtime evidence proves active use.

## DEFERRED INFRASTRUCTURE

### D-001 - Docker runtime

- TASK: Recreate or update `Dockerfile`, `docker-compose.yml`, `.env.docker`, and `docker-up.sh`.
- REASON: Docker comes after stable local migration.
- DEPENDENCIES: All local phases and deployment decision.
- FILES: legacy Docker/deploy files only for later reference.
- RISK: High.
- VERIFICATION: Deferred until Phase 9.
- STATUS: DEFERRED.

### D-002 - Vercel/deployment configuration

- TASK: Reassess `vercel.json` and production environment contract.
- REASON: Deployment is outside current scope.
- DEPENDENCIES: Stable local app and secret review.
- FILES: `vercel.json`, env docs.
- RISK: High.
- VERIFICATION: Deferred until Phase 9.
- STATUS: DEFERRED.
