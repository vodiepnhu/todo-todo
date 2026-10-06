# Project Audit

Audit date: 2026-10-06

## Scope and safety

- TARGET_PROJECT_ROOT: `/Users/nhuvo/togo-todo`
- LEGACY_PROJECT_ROOT: `/Users/nhuvo/Library/CloudStorage/OneDrive-UTS(2)/My_PhD/001_Coding/08_Personal/togo_todo_yn`
- Legacy was inspected read-only. No legacy files were edited, formatted, deleted, or installed into.
- Target contains the Phase 1.5 workspace foundation, `.codex` project memory, and Git history. Root is coordination-only; `tgtd-Frontend` owns the Next app.
- Docker and deployment work are deferred.

## Product understanding

Shared Planner is a lightweight shared activity planner for couples and families. Users authenticate, create or join private/shared projects, record activities, enrich them with plans and places, chat inside a project, use Home chat across projects, and ask an AI planner to recommend or propose mutations.

The core mutation contract is deliberate: planner input is parsed into a structured request, checked by policy and guardrails, then stored as a pending action. The database changes only after confirmation. Recommendations read existing activities through heuristic and optional vector retrieval. Missing AI, Maps, and embedding keys degrade to deterministic mock or reduced behavior.

## Current architecture

```text
Next App Router pages
  -> client components
      -> browser Supabase client and direct table queries

Next API route handlers
  -> auth and membership checks
  -> agents / services / lib
      -> server Supabase client
      -> OpenRouter or mock AI
      -> Google Maps or degraded place handling
      -> pgvector and keyword retrieval
```

Important flows:

1. Auth middleware refreshes Supabase sessions and protects `/app`, `/projects`, and `/account`.
2. `/projects` loads memberships and folders, then renders Home or onboarding.
3. `/projects/[projectId]/*` verifies membership in the server layout and mounts a shared workspace shell.
4. Project chat saves user messages, optionally routes `@planner` messages through the planner, then saves the AI reply.
5. Home chat uses the same orchestrator with cross-project scope and stores messages in `home_messages`.
6. Planner requests run ingest -> policy -> RAG or mutation routing -> place resolution -> guardrail -> pending action -> communication.
7. `/api/confirm` executes pending actions through `confirmation-service`, persists plans and embeddings, writes audit/chat records, and invalidates pending state.

## Baseline checks

Commands ran against existing legacy `node_modules`; no package install occurred.

| Check | Result | Baseline interpretation |
| --- | --- | --- |
| `./node_modules/.bin/tsc --noEmit --incremental false` | FAIL, exit 2 | Root `tsconfig.json` includes `rag-demo/frontend`; errors occur in `rag-demo/frontend/src/main.tsx` and `rag-demo/frontend/vite.config.ts`, including duplicate Vite/React dependency types. Pre-existing legacy/configuration issue. |
| `npm run lint` | FAIL, 17 errors and 16 warnings | React `set-state-in-effect` errors across client components; hook dependency warnings; unused values and one `prefer-const`. Pre-existing legacy issue. |
| `npm test -- --reporter=dot` | PASS, 51 files and 164 tests | Unit behavior baseline is green. |
| `npm run build` | NOT RUN | Next build writes `.next` in legacy; safety rule forbids modifying the read-only reference workspace. |
| `npm run dev` | NOT RUN | Interactive server check was unnecessary for this audit and would depend on local Supabase configuration. |
| `npm run test:e2e` | NOT RUN | Requires a running application and browser/runtime state; no target app exists yet. |

Legacy status remained clean after checks. Later migration reports must separate these failures from target regressions.

## Technical debt by priority

### CRITICAL

- Phase 1 target runtime now exists; feature migration remains intentionally incomplete.
- Planned agent/RAG workspaces are not active yet; root TypeScript does not include legacy demos or sidecars.
- Pending action execution crosses confirmation, workspace, plan persistence, embeddings, places, audit logs, and chat writes in one `confirmation-service.ts` module. This is the highest data-loss and authorization risk during migration.

### HIGH

- `src/components/home/home-shell.tsx` (743 lines) owns project listing, folder presentation, creation, sharing, activity stats, edit flow, navigation, and Home chat composition.
- `src/components/plans/add-to-plan-form.tsx` (791 lines) owns a large plan editor and domain payload shaping.
- `src/agents/orchestrator.ts` (528 lines) owns routing, scope resolution, policy outcomes, place enrichment, guardrails, pending creation, and response formatting.
- `src/services/plan-persist-service.ts` and `src/services/confirmation-service.ts` mix domain decisions, Supabase mutations, plan child-table persistence, and embedding side effects.
- UI clients contain direct Supabase queries. The current list includes `home-shell`, `home-page-client`, `item-list-client`, `history-client`, `dashboard-client`, `settings-client`, account clients, and confirmation UI.
- Planner API routes duplicate orchestration setup between project and Home chat.

### MEDIUM

- `src/lib` is a broad bucket containing feature logic, server adapters, AI integrations, policy, paths, crypto, and formatting.
- Root `src/services` mixes workspace CRUD, chat persistence, plan persistence, embeddings, RAG, settings, LangSmith, and confirmation workflows.
- Database types are centralized but domain types such as planner drafts, RAG hits, and agent trace payloads are distributed across agents, services, and lib.
- Legacy `/app/[workspaceId]` redirects remain useful for compatibility but should be isolated and removed only after route telemetry or tests show no consumers.
- TODO/TOGO compatibility remains embedded in types, schemas, migrations, and ranking code after the product moved toward `ACTIVITY`.
- Lint rules are stricter than current component patterns, so migration must not silently normalize behavior while fixing style.

### LOW

- `ProjectCard` is defined but unused in `home-shell.tsx`.
- Several compatibility aliases are marked deprecated but still required by tests or callers.
- Naming is mixed between `workspace`, `project`, `item`, `activity`, and legacy TODO/TOGO vocabulary.

## Scope outside the main app

- `rag-demo/` is a separate Python/Vite demonstration with its own dependency tree. It is not imported by the Next application. Keep it outside the first migration until ownership is confirmed.
- Root Python files, `services/`, `tools/`, `registry/`, and `demo-tool-registry/` are sidecars or experiments with no evidence of runtime imports from `src/`. Classify them as UNCERTAIN and do not copy them blindly.
- `Dockerfile`, `docker-compose.yml`, `.env.docker`, `docker-up.sh`, and `vercel.json` are deferred infrastructure. Do not migrate them in the current phases.

## Reuse estimate

Module-level estimate for 142 files under legacy `src/`; not line-weighted:

| Classification | Approx. modules |
| --- | ---: |
| KEEP | 28 |
| MOVE | 52 |
| EXTRACT | 25 |
| REFACTOR | 22 |
| MERGE | 4 |
| REWRITE | 0 |
| REMOVE | 5 |
| UNCERTAIN | 6 |
| Total | 142 |

The estimate favors preserving working behavior. `REWRITE` is intentionally zero until a concrete behavioral or security requirement proves reuse impossible.

## Open questions

- `tgtd-Frontend` is the active Next application workspace. Root remains npm/Git/Codex coordination.
- Should the separate `rag-demo` and Python sidecars become supported products, archived references, or independent repositories? This affects only later scope, not the first app migration.
- Which Supabase migration history is authoritative for a fresh target environment? Preserve the current schema contract first; decide migration packaging before foundation implementation.

## Phase 1 implementation record

Create a minimal local Next foundation in the target and copy only the required application configuration, with no feature migration.

- Legacy files: `package.json`, `package-lock.json`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `postcss.config.mjs`, `src/app/layout.tsx`, `src/app/globals.css`, `src/app/page.tsx`, `src/lib/env.ts`, `src/lib/supabase/config.ts`.
- Target files: `package.json`, `package-lock.json`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `postcss.config.mjs`, `src/app/layout.tsx`, `src/app/globals.css`, `src/app/page.tsx`, `src/config/env.ts`, `src/server/supabase/config.ts`.
- Verification: `npm install`, `npm run lint`, `npm test`, `npm run build`, and `npm run dev` smoke check in target; preserve the legacy baseline as a reference.
- This phase was approved and completed. The next phase requires separate approval.

## Phase 1 completion

- Status: DONE.
- Target install: `npm install --ignore-scripts` passed; 531 packages audited, with 8 reported vulnerabilities retained for later dependency review.
- Target lint: `npm run lint` passed.
- Target typecheck: `npm run typecheck` passed with target-only TypeScript includes.
- Target tests: `npm test -- --reporter=dot` passed, 1 file and 2 tests.
- Target Webpack build: `npm run build:webpack` passed; default `npm run build` uses Turbopack and is environment-limited by worker `Operation not permitted` in the Codex sandbox.
- Target dev smoke: `npm run dev -- --hostname 127.0.0.1` served `/` with HTTP 200 and expected landing content.
- Known warning: Next 16 reports the deprecated `middleware` convention; migration to `proxy` is deferred with auth behavior unchanged.

## Phase 1.5 completion

- Status: DONE.
- Root package is a private npm workspace coordinator for `tgtd-Frontend` and minimal `tgtd-Backend`.
- Root `src/` and `tests/` were removed after verified moves.
- Frontend foundation moved under `tgtd-Frontend`; service-role Supabase adapter moved under `tgtd-Backend`.
- Root install, workspace resolution, delegated lint/typecheck/unit tests, Webpack build, and workspace dev smoke passed.
- Architecture commit: this Phase 1.5 close-out commit; Phase 1 baseline remains rollback point `8e6153a`.
