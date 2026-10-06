# Workspace-Aware Migration Plan

Legacy remains read-only. Each phase leaves active workspaces locally runnable. Docker and deployment remain last.

## Phase 0: Understand and baseline — DONE

- Objective: record behavior, baseline failures, dependencies, and ownership evidence.
- Verification: legacy unit tests passed; legacy lint/typecheck failures recorded as pre-existing; no legacy build/install/write performed.
- Recovery: target documentation only; legacy unchanged.

## Phase 1: Temporary foundation — DONE

- Objective: create and verify a minimal Next foundation.
- Temporary location: root application, later corrected by Phase 1.5.
- Verification: install, lint, target typecheck, unit tests, Webpack build, and dev HTTP smoke passed.
- Known environment limit: default Turbopack build cannot create/bind its worker in Codex sandbox; `build:webpack` passes.

## Phase 1.5: Workspace architecture correction — DONE

- Objective: move verified foundation into owning workspaces and convert root to npm coordination.
- Legacy files: none modified; this phase moves only target foundation files.
- Target moves:
  - `src/app/*` -> `tgtd-Frontend/src/app/*`
  - `src/config/*` -> `tgtd-Frontend/src/config/*`
  - `src/shared/navigation/*` -> `tgtd-Frontend/src/shared/navigation/*`
  - `src/middleware.ts` -> `tgtd-Frontend/src/middleware.ts`
  - `src/server/supabase/{client,config,middleware,server}.ts` -> `tgtd-Frontend/src/server/supabase/*`
  - `src/server/supabase/admin.ts` -> `tgtd-Backend/src/platform/supabase/admin.ts`
  - `tests/*` -> `tgtd-Frontend/tests/*`
  - Next/frontend configs -> `tgtd-Frontend/*`
  - `.env.example` -> `tgtd-Frontend/.env.example`
- Root result: private npm coordinator with workspace scripts; no root runtime source or tests.
- Active workspaces: `tgtd-Frontend`, `tgtd-Backend`.
- Planned workspaces: `tgtd-Agent`, `tgtd-AI-RAG`, `tgtd-MCP`.
- Verification: root install, workspace resolution, delegated lint/typecheck/tests, Webpack build, and workspace dev smoke.
- Recovery: revert the Phase 1.5 commit; retain Phase 1 baseline commit.

## Phase 2: Frontend shared, auth, and local demo account — DONE

- Objective: migrate low-risk frontend primitives, real Supabase auth routes, protected shell, logout, and guarded local demo seeding.
- Legacy -> target:
  - `src/components/ui/{button,input,card}.tsx` -> `tgtd-Frontend/src/shared/ui/*`
  - `src/lib/utils.ts` -> `tgtd-Frontend/src/shared/ui/cn.ts`
  - `src/components/auth/password-requirements.tsx` -> `tgtd-Frontend/src/features/auth/components/password-requirements.tsx`
  - `src/lib/auth/password-policy.ts` -> `tgtd-Frontend/src/features/auth/domain/password-policy.ts`
  - `src/app/(auth)/login/*` -> `tgtd-Frontend/src/app/(auth)/login/*` plus `features/auth/components/login-form.tsx`
  - `src/app/(auth)/signup/*` -> `tgtd-Frontend/src/app/(auth)/signup/*` plus `features/auth/components/signup-form.tsx`
  - `src/app/auth/callback/route.ts` -> `tgtd-Frontend/src/app/auth/callback/route.ts`
  - `scripts/seed-demo.sh` -> `tgtd-Backend/scripts/seed-demo.mjs` with Docker paths removed and production guard added
- Dependencies: Phase 1.5 frontend adapters; explicit backend auth contract.
- Risk: high; redirects, cookies, password policy, and OAuth callback.
- Verify: auth domain tests, seed guard test, root lint/typecheck/tests, frontend Webpack build, login/signup HTTP smoke, protected redirect smoke, and live auth when Supabase exists.
- Rollback: keep route adapters and old-compatible contracts until checks pass.
- Result: code checks and route smoke pass. Live demo seed/login/logout remain unverified because local Supabase services are unavailable.

## Phase 3: Backend domain and persistence boundary

- Status: DONE; pure/unit verification passed. Live Supabase integration remains unverified.
- Objective: establish minimal tgtd-Backend package boundary for framework-free auth lookup, profile access, workspace membership/authorization, and Home partitioning.
- Canonical backend domain: workspaces; legacy UI/routes use project terminology, but schema and membership ownership are workspaces and workspace_members. No projects module unless later evidence proves a distinct domain.
- Legacy evidence: src/types/database.ts, src/services/workspace-service.ts:listWorkspaces, src/services/folder-service.ts:partitionHomeTree/listHomeTree, supabase/migrations/20260923000000_init.sql, and supabase/migrations/20260923190000_project_sharing.sql.
- Target modules: contracts/database.ts, modules/auth/{authorization,authenticated-user}.ts, modules/profiles/{profile,profile.repository}.ts, modules/workspaces/{authorization,workspace,workspace.repository,home}.ts, and explicit src/index.ts exports.
- Persistence rule: repositories use caller-provided authenticated/RLS-scoped Supabase clients; existing service-role admin adapter remains internal to admin/seed paths.
- Authorization rule: pure application decisions require authenticated user, active membership, and role; Supabase RLS remains database enforcement.
- No schema, trigger, RLS, UI, HTTP service, Agent, RAG, planner, activity, confirmation, chat, dashboard, MCP, desktop, mobile, or Docker work.
- Detailed implementation plan: .codex/plans/05-backend-foundation.md.
- Dependencies: Phase 2 auth foundation and current Supabase schema evidence.
- Risk: high; RLS, active membership filtering, role semantics, nested Supabase response mapping, and package export resolution.
- Verified: backend 30 unit tests plus seed-policy checks, backend typecheck, root install, root lint, root typecheck, frontend 5 tests, Webpack build, import safety, diff/secrets/generated-file checks.
- Rollback: remove new backend modules/package export changes and retain legacy source/database behavior; do not rewrite commits 8e6153a, 235c1e2, or 4e05743.

## Phase 4: Explicit shared contracts, only if proven necessary

- Objective: create `packages/contracts` or an equivalent explicit package only after two real consumers require it.
- Candidate contracts: IDs, API DTOs, planner input/output, pending actions.
- Risk: premature coupling and duplicated types.
- Verify: consumer import graph, package typechecks, contract tests.
- Rollback: keep contracts workspace-local until a second consumer is real.

## Fast migration pass — ACTIVE

- Strategy changed from granular extraction to move-first compatibility migration.
- `tgtd-Frontend` now contains active Next routes, React components, browser features, and legacy-shaped browser service adapters required by current UI.
- `tgtd-Backend` now contains copied server/domain services plus Phase 3 auth, profile, workspace, and Home foundation. Server routes use `@togo-todo/backend`.
- `tgtd-Agent` now contains active planner/orchestration, guardrails, policy, maps, AI provider, AgentOps, and compatibility exports.
- `tgtd-AI-RAG` now contains active embedding, retrieval, hybrid ranking, and recommendation runtime.
- Frontend browser compatibility copies remain for `workspace-service`, `folder-service`, `home-chat-service`, and `plan-persist-service` because current client components call Supabase directly. Refactor later; behavior preserved.
- No `packages/contracts` workspace created: current package boundaries compile with local legacy-shaped types; introduce shared contracts only when a stable cross-workspace contract cannot remain structural.
- No projects backend module created. UI “project” terminology maps to canonical `workspaces` ownership.
- Docker, Desktop, Mobile, Infra, MCP, live Supabase integration, schema changes, RLS changes, and auth-trigger changes remain deferred.
- Acceptance target: target-only normal development, with remaining meaningful active-code gap scan at zero blocking files.

## Phase 5: Agent extraction — SUPERSEDED BY FAST MIGRATION PASS

- Objective: establish `tgtd-Agent` package boundary and migrate planner behavior incrementally.
- Legacy -> target:
  - `src/agents/orchestrator.ts` -> `tgtd-Agent/src/orchestrator/orchestrator.ts`
  - `src/agents/{ingest,policy,mutation,places,guardrail,communication}-agent.ts` -> `tgtd-Agent/src/agents/*/*-agent.ts`
  - `src/lib/ai/*` -> `tgtd-Agent/src/providers/ai/*`
- Dependencies: backend contracts and planner API contract.
- Risk: critical; policy, guardrails, pending payloads, mock behavior.
- Verify: planner golden tests, refusal/clarification tests, API response comparison.
- Rollback: route through compatibility orchestrator until replacement is proven.

## Phase 6: AI/RAG extraction — SUPERSEDED BY FAST MIGRATION PASS

- Objective: establish reusable `tgtd-AI-RAG` package boundary.
- Legacy -> target:
  - `src/services/rag-service.ts` -> `tgtd-AI-RAG/src/retrieval/rag-service.ts`
  - `src/services/embedding-service.ts` -> `tgtd-AI-RAG/src/embeddings/embedding-service.ts`
  - `src/services/recommendation-service.ts` -> `tgtd-AI-RAG/src/retrieval/recommendation.ts`
  - selected `src/lib/rag/*` -> `tgtd-AI-RAG/src/*`
- Dependencies: agent retrieval contract and backend persistence contract.
- Risk: high; vector scope, RPC fallback, embedding side effects.
- Verify: retrieval fixtures, embedding mock/degraded paths, planner comparison.
- Rollback: retain legacy-shaped retrieval adapter.

## Phase 7: Domain feature migration — FAST PASS COMPLETE; REFACTOR LATER

- Objective: move activities, confirmation, workspaces, and Home behavior by owned boundary.
- Legacy -> target:
  - `src/services/confirmation-service.ts` -> `tgtd-Backend/src/modules/confirmations/*`
  - `src/services/plan-persist-service.ts` -> `tgtd-Backend/src/modules/activities/*`
  - `src/components/items/*` -> `tgtd-Frontend/src/features/activities/components/*`
  - `src/components/confirmations/*` -> `tgtd-Frontend/src/features/activities/components/*`
  - `src/components/home/*` -> `tgtd-Frontend/src/features/home/components/*`
  - `src/components/workspace/*` -> `tgtd-Frontend/src/features/workspaces/components/*`
- Dependencies: backend and agent contracts.
- Risk: critical data integrity and broad UI coupling.
- Verify: confirmation action matrix, RLS/membership tests, focused UI tests, route smoke.
- Rollback: preserve old API adapters and pending action response shape.

## Phase 8: Chat and integration — FAST PASS COMPLETE; REFACTOR LATER

- Objective: migrate project/Home chat and integrate feature shell.
- Legacy -> target:
  - `src/components/chat/*` -> `tgtd-Frontend/src/features/chat/components/*`
  - `src/services/home-chat-service.ts` -> `tgtd-Backend/src/modules/chat/*`
  - chat API routes -> `tgtd-Frontend/src/app/api/*` adapters calling public backend contracts
- Risk: realtime, scope, persistence, and planner coupling.
- Verify: project/Home chat scope, history, clear, realtime, planner handoff.

## Phase 9: MCP — PLANNED

Migrate only actual MCP servers/tools into `tgtd-MCP`. No generic utilities.

## Phase 10: Desktop and mobile — PLANNED

Create app-specific runtimes only after public contracts exist.

## Phase 11: Infrastructure and Docker — DEFERRED

Move Docker/deployment files to `tgtd-Infra` only after local workspaces and behavior are stable.

## Strangler rule

For every extraction: identify behavior, define public contract, migrate implementation, update caller, run focused checks, compare behavior, then remove compatibility code. Never import another workspace's internal source tree.
