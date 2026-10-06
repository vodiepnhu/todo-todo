# Incremental Migration Plan

Migration keeps the legacy project read-only and keeps each target phase locally runnable after its foundation exists. No Docker work occurs before Phase 9.

## Phase 0: Understand and baseline

- Objective: record behavior, source map, dependency map, and pre-existing failures.
- Legacy files: `package.json`, `tsconfig.json`, `src/app/**`, `src/components/**`, `src/services/**`, `src/agents/**`, `src/lib/**`, `src/types/database.ts`, `tests/**`.
- Target files: `.codex/references/*`, `.codex/plans/00-project-audit.md`, `.codex/plans/01-target-architecture.md`.
- Dependencies: existing legacy `node_modules`; no install or write in legacy.
- Risk: incomplete understanding or misclassified experimental code.
- Expected behavior: no product behavior changes; audit captures routes, flows, contracts, and baseline.
- Verification: `npm test -- --reporter=dot`, `npm run lint`, safe TypeScript check; compare legacy Git status before/after.
- Rollback/recovery: delete or revise target docs only; legacy remains untouched.

## Phase 1: Target foundation

- Objective: create a minimal target Next app with current package manager, root layout, theme, config, Supabase adapters, and one landing route.
- Legacy -> target mappings:
  - `package.json` -> `package.json`
  - `package-lock.json` -> `package-lock.json`
  - `tsconfig.json` -> `tsconfig.json` with target-only includes
  - `next.config.ts` -> `next.config.ts`
  - `eslint.config.mjs` -> `eslint.config.mjs`
  - `postcss.config.mjs` -> `postcss.config.mjs`
  - `src/app/layout.tsx` -> `src/app/layout.tsx`
  - `src/app/globals.css` -> `src/app/globals.css`
  - `src/app/page.tsx` -> `src/app/page.tsx`
  - `src/lib/env.ts` -> `src/config/env.ts`
  - `src/lib/supabase/{config,client,server,admin,middleware}.ts` -> `src/server/supabase/*`
- Dependencies: npm and current dependency versions; no Docker files.
- Risk: Next 16 config, auth cookie names, and environment boundaries.
- Expected behavior: target landing page runs; configured Supabase client adapters fail clearly when env is absent.
- Verification: target `npm install --ignore-scripts`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, and local `npm run dev` landing smoke check.
- Rollback/recovery: remove only newly created target runtime files; keep `.codex` audit and empty workstream placeholders.
- Status: DONE. `npm run build:webpack` is the verified production path; default `npm run build` remains Turbopack and is environment-limited by worker creation returning `Operation not permitted` in the Codex sandbox.

## Phase 2: Shared primitives and auth

- Objective: move low-risk UI and auth without changing routes or behavior.
- Legacy -> target mappings:
  - `src/components/ui/{button,card,input,planner-wait-panel}.tsx` -> `src/shared/ui/*`
  - `src/components/auth/password-requirements.tsx` -> `src/features/auth/components/PasswordRequirements.tsx`
  - `src/app/(auth)/login/*` -> same route adapters plus `src/features/auth/components/*`
  - `src/app/(auth)/signup/page.tsx` -> same route adapter plus auth feature component
  - `src/app/auth/callback/route.ts` -> same route plus `src/features/auth/server/callback.ts`
  - `src/lib/auth/{account,password-policy}.ts` -> `src/features/auth/{server,domain}/*`
- Dependencies: Phase 1 runtime and Supabase adapters.
- Risk: session redirects, form validation, and password behavior.
- Expected behavior: login/signup/callback work with same redirect and validation semantics.
- Verification: auth unit tests, target lint/typecheck/build, manual local auth smoke test when Supabase is available.
- Rollback/recovery: revert target auth route/component changes; legacy remains reference.

## Phase 3: Services, config, and database contracts

- Objective: establish feature-owned server boundaries before moving large UI.
- Legacy -> target mappings:
  - `src/types/database.ts` -> `src/server/db/types.ts` plus feature contracts
  - `src/services/workspace-service.ts` -> `src/features/workspaces/server/{repository,use-cases}.ts`
  - `src/services/folder-service.ts` -> `src/features/home/server/folder-repository.ts`
  - `src/services/home-chat-service.ts` -> `src/features/chat/server/home-messages.ts`
  - `src/services/chat-context-service.ts` -> `src/features/chat/server/recent-context.ts`
  - `src/lib/paths.ts` -> `src/shared/navigation/paths.ts`
  - `src/lib/{utils,when-local}.ts` -> named shared/config modules only where consumers justify them
- Dependencies: target auth and Supabase adapters.
- Risk: accidental change to RLS query shape, membership checks, or table contracts.
- Expected behavior: route handlers can call feature repositories while responses and database writes remain unchanged.
- Verification: move pure tests first; run all 164 legacy behavior tests adapted to target; add repository contract checks for membership and error propagation.
- Rollback/recovery: keep old target adapters temporarily behind feature exports; remove only after consumers migrate.

## Phase 4: Planner and mutation pipeline

- Objective: move the highest-risk business logic with stable interfaces and preserved golden tests.
- Legacy -> target mappings:
  - `src/agents/{types,ingest-agent,policy-agent,mutation-agent,places-agent,guardrail-agent,rag-agent,communication-agent}.ts` -> `src/features/planner/{domain,server}/*`
  - `src/agents/orchestrator.ts` -> `src/features/planner/server/orchestrate.ts`
  - `src/services/recommendation-service.ts` -> `src/features/planner/domain/recommendation.ts`
  - `src/services/rag-service.ts` -> `src/features/planner/server/retrieval-service.ts`
  - `src/services/embedding-service.ts` -> `src/features/planner/server/embedding.ts`
  - `src/lib/ai/*` -> `src/features/planner/server/ai/*`
  - `src/lib/maps/maps.ts` -> `src/features/planner/server/maps.ts`
  - `src/schemas/planner.ts` -> `src/features/planner/domain/planner-schema.ts`
- Dependencies: Phase 3 database contracts; existing provider env names; planner/unit/golden tests.
- Risk: wrong scope, wrong pending payload, unsafe URL handling, changed mock/degraded behavior.
- Expected behavior: project and Home planner APIs produce identical intent, reply, pending, and mock metadata for existing tests.
- Verification: run planner, policy, guardrail, RAG, enrichment, provider, and AgentOps tests; compare representative responses before/after.
- Rollback/recovery: preserve old orchestrator behind a temporary target adapter until golden tests and API smoke checks pass.

## Phase 5: Activities and confirmation

- Objective: migrate activity UI and durable mutation execution around the planner contract.
- Legacy -> target mappings:
  - `src/services/plan-persist-service.ts` -> `src/features/activities/server/plan-repository.ts`
  - `src/services/confirmation-service.ts` -> `src/features/activities/server/confirm-action.ts` plus action executors
  - `src/components/confirmations/confirm-provider.tsx` -> `src/features/activities/components/ConfirmationProvider.tsx`
  - `src/components/items/{item-list-client,quick-add-modal,edit-item-modal,activity-plan-panel}.tsx` -> `src/features/activities/components/*`
  - `src/components/plans/add-to-plan-form.tsx` -> `src/features/activities/components/PlanEditor.tsx` and owned subcomponents
  - `src/lib/plans/*`, `src/lib/items/*` -> `src/features/activities/domain/*`
  - `src/app/api/confirm/route.ts` -> thin adapter calling activities confirmation use case
- Dependencies: planner contracts, Supabase repositories, database migrations, shared UI.
- Risk: data loss, duplicate execution, optimistic UI mismatch, child-plan writes, embedding side effects.
- Expected behavior: CREATE, UPDATE, DELETE, LOG_EVENT, and CREATE_PROJECT retain TTL, authorization, version, audit, and refresh behavior.
- Verification: confirmation service tests, plan persistence tests, item/list UI tests, end-to-end create/confirm smoke flow.
- Rollback/recovery: keep action executors behind old API response contract; stop migration before deleting old target modules if any action diverges.

## Phase 6: Home, workspaces, chat, dashboard, history, account

- Objective: migrate feature screens and remove direct table access from UI incrementally.
- Legacy -> target mappings:
  - `src/components/home/*` -> `src/features/home/components/*`
  - `src/components/workspace/{app-shell,workspace-layout-client,settings-client,onboarding-client,join-client,project-appearance-picker}.tsx` -> `src/features/workspaces/components/*`
  - `src/components/chat/*` -> `src/features/chat/components/*`
  - `src/components/dashboard/*`, `src/components/history/history-client.tsx` -> `src/features/activities/components/{dashboard,ActivityHistory}/*`
  - `src/components/account/*`, `src/components/workspace/{agentops-card,llm-settings-card}.tsx` -> `src/features/account/components/*` and `src/features/agentops/components/*`
  - matching `src/app/projects/*`, `src/app/account/*`, and API routes remain stable route adapters
- Dependencies: phases 2-5; feature repositories and API contracts.
- Risk: broad UI files hide behavior coupling; realtime and refresh behavior may regress.
- Expected behavior: same URLs, project selection, chat scope, live updates, charts, settings, and account visibility.
- Verification: focused component tests per feature, full unit suite, target lint/typecheck/build, Playwright smoke tests.
- Rollback/recovery: migrate one route at a time; keep route pointing to legacy-shaped target component until its replacement is verified.

## Phase 7: Shell integration and compatibility cleanup

- Objective: connect all migrated features through one shell and remove only proven obsolete adapters.
- Legacy -> target mappings:
  - `src/app/projects/[projectId]/layout.tsx` -> target workspace layout using feature membership gate and shell
  - `src/app/app/*` -> retained redirects until compatibility evidence allows removal
  - deprecated workspace/item aliases -> remove only after `rg` and tests show no consumer
- Dependencies: all feature phases.
- Risk: navigation regressions, deep links, stale compatibility consumers.
- Expected behavior: canonical `/projects/*` paths work and legacy `/app/*` redirects remain until explicitly retired.
- Verification: route matrix, Playwright navigation smoke, `rg` consumer scan, full test/lint/typecheck/build.
- Rollback/recovery: retain redirects and aliases; restore route adapter imports without changing domain behavior.

## Phase 8: Stabilize and validate

- Objective: distinguish migration regressions from the recorded legacy baseline and close high-risk gaps.
- Legacy -> target mappings: test files under `tests/unit/**` -> target feature tests; `tests/e2e/smoke.spec.ts` -> target E2E suite.
- Dependencies: complete target feature migration.
- Risk: false confidence from unit-only coverage, missing Supabase runtime coverage, unresolved lint/type boundary issues.
- Expected behavior: target tests cover preserved contracts and all intentional differences are documented.
- Verification: target install, lint, typecheck, build, unit, E2E, auth/member checks, planner confirmation flow, and clean target status.
- Rollback/recovery: retain a known-good target commit per phase; do not delete legacy reference.

## Phase 9: Docker and deployment (DEFERRED)

- Objective: none in current work.
- Legacy files: `Dockerfile`, `docker-compose.yml`, `.env.docker`, `docker-up.sh`, `vercel.json`.
- Target files: none now.
- Dependencies: stable local target, confirmed environment contract, deployment decision.
- Risk: high; container networking and secret handling can hide local regressions.
- Expected behavior: no Docker files or workflows are introduced during current migration.
- Verification: deferred until Phase 8 passes.
- Rollback/recovery: no action required; infrastructure remains in legacy reference.
