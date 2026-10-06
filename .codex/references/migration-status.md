# Fast Migration Status

## MIGRATED

- Frontend: active Next App Router pages, API routes, React components, browser hooks, shared UI, auth foundation, chat, Home, workspace, dashboard, history, account, plans, confirmation UI, Maps route adapters.
- Backend: active server/domain services for workspaces, profiles, chat, plans, confirmation, AgentOps, settings, and Supabase persistence copied into `tgtd-Backend`.
- Agent: active ingest, orchestrator, policy, mutation, guardrail, communication, places, Maps search, provider, planner extraction, and AgentOps runtime copied into `tgtd-Agent`.
- AI/RAG: active embedding, deterministic mock embedding, retrieval, hybrid RRF, ranking, recommendation, and RAG persistence runtime copied into `tgtd-AI-RAG`.
- Tests: relevant unit tests moved to owning workspaces; target frontend retains frontend/UI tests.
- Boundaries: server consumers use `@togo-todo/backend`, `@togo-todo/agent`, and `@togo-todo/ai-rag`; no workspace source-path reach-through.

## PARTIAL

- Browser Supabase calls still use local compatibility copies in `tgtd-Frontend/src/services/{workspace-service,folder-service,home-chat-service,plan-persist-service}.ts`.
- Database-facing types remain duplicated in workspace-local legacy-shaped files; no shared contracts package yet.
- Legacy directory shape remains in migrated packages for behavior preservation.

## NOT MIGRATED

- None blocking normal target development. Deep feature-owned reorganization remains intentionally absent.

## DEFERRED

- MCP, Desktop, Mobile, Infra, Docker, live Supabase integration, schema/RLS/auth-trigger changes, shared-contract redesign, and deep service/orchestrator refactors.

## LEGACY ONLY

- Python sidecars, `rag-demo`, `demo-tool-registry`, Docker/deployment files, and unreferenced experiments remain read-only historical material.

## Verification Boundary

- Code verification covers target typechecks, unit tests, lint, and Webpack build.
- Live Supabase auth/database integration remains unverified because local Supabase services are unavailable.
