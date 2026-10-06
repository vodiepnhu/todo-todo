# Architecture Map

## Repository boundary

```text
Repository root
  -> npm workspace coordination, Git, .codex, shared agent guidance
  -> tgtd-Frontend (active Next APP)
  -> tgtd-Backend (active server-only PACKAGE, currently admin adapter)
  -> tgtd-Agent (planned PACKAGE)
  -> tgtd-AI-RAG (planned PACKAGE)
  -> tgtd-MCP (planned integration PACKAGE/SERVICE)
  -> Chatbot-Frontend (MERGE_CANDIDATE)
  -> tgtd-Desktop / tgtd-Mobile (planned APPs)
  -> tgtd-Infra (deferred infrastructure)
```

Root has no application `src/` or `tests/`. Every runtime file belongs to a workspace.

## Current Phase 1.5 flow

```text
tgtd-Frontend/src/app/page.tsx
  -> tgtd-Frontend/src/shared/navigation/paths.ts

tgtd-Frontend/src/middleware.ts
  -> tgtd-Frontend/src/server/supabase/middleware.ts
      -> tgtd-Frontend/src/server/supabase/config.ts
      -> Supabase SSR and Next request/cookie runtime

tgtd-Frontend/src/server/supabase/{client,server}.ts
  -> tgtd-Frontend/src/server/supabase/config.ts
  -> Supabase SSR

tgtd-Backend/src/platform/supabase/admin.ts
  -> tgtd-Backend/src/platform/supabase/config.ts
  -> Supabase service-role client
```

## Phase 2 auth flow

```text
tgtd-Frontend/src/app/(auth)/login
  -> features/auth/components/login-form.tsx
  -> browser Supabase client
  -> email/password session
  -> tgtd-Frontend/src/app/app/page.tsx
  -> LogoutButton -> signOut -> /login
```

`tgtd-Backend/scripts/seed-demo.mjs` uses the admin client to create or update `demo@local.test`, upsert its profile display name, and refuses production execution. It is not imported by frontend code.

## Phase 3 backend foundation

authenticated caller
  -> framework-free auth lookup/authorization
  -> profile or workspace use case
  -> domain repository
  -> caller-provided RLS-scoped SupabaseClient
  -> Supabase RLS

Public package entry: @togo-todo/backend.

Public modules:

- modules/auth: authenticated user ID lookup and authorization errors.
- modules/profiles: profile lookup, required-profile check, display-name access, and RLS-scoped repository.
- modules/workspaces: membership/workspace lookup, active role decisions, and Home workspace partitioning.
- contracts/database.ts: only Profile, Workspace, WorkspaceMember, WorkspaceMembership, WorkspaceType, and MemberRole.

platform/supabase/admin.ts, seed scripts, and platform internals are not public exports. Backend has no HTTP runtime and no frontend consumer yet.

## Future dependency graph

```text
tgtd-Frontend APP
  -> public HTTP/API contracts
  -> tgtd-Backend package or backend API boundary

tgtd-Backend package
  -> explicit domain/contracts
  -> tgtd-Agent package when planner use cases require it
  -> tgtd-AI-RAG package when retrieval/embedding contracts require it

tgtd-Agent package
  -> explicit agent contracts
  -> tgtd-AI-RAG public retrieval/embedding contracts

tgtd-AI-RAG package
  -> provider clients and standard libraries

No workspace may import another workspace's internal `src` path.

## Fast migration runtime graph

```text
tgtd-Frontend Next routes
  -> @togo-todo/backend
  -> @togo-todo/agent
  -> @togo-todo/ai-rag

tgtd-Frontend browser components
  -> local legacy-shaped compatibility adapters for direct Supabase flows

tgtd-Backend server/domain services
  -> @togo-todo/agent for guardrails/contracts
  -> @togo-todo/ai-rag for retrieval/embedding behavior
  -> caller-scoped Supabase or private admin adapter

tgtd-Agent
  -> @togo-todo/ai-rag
  -> local provider/agent contracts
```

Fast migration preserves legacy directory shape inside owning workspaces. Compatibility copies are temporary and marked for later consolidation; no cross-workspace source-path imports exist.
```

## Feature ownership after foundation

- `tgtd-Frontend`: route adapters, pages, React components, feature hooks, browser state, navigation, Next adapters.
- `tgtd-Backend`: framework-free auth decisions, profile/workspace repositories and use cases, server contracts, and service-role access for admin/seed paths.
- `tgtd-Agent`: ingest, policy, mutation, guardrail, communication, places, orchestration, provider and AgentOps runtime.
- `tgtd-AI-RAG`: retrieval, embeddings, hybrid ranking, recommendation runtime.
- `tgtd-MCP`: actual MCP servers and tools only.

## Coupling to remove gradually

1. Legacy confirmation execution crosses workspace, plan, embedding, guardrail, audit, and chat writes.
2. Legacy orchestration mixes agent routing, persistence, provider calls, and response formatting.
3. Legacy `lib/ai` and RAG code cross agent and service boundaries.
4. Legacy UI combines rendering, direct Supabase reads, realtime, mutations, and refresh events.

5. Browser compatibility adapters duplicate a small set of legacy-shaped backend services until client calls move behind route/API boundaries.

## Boundary rules

- Framework adapters stay with `tgtd-Frontend` when they depend on Next runtime APIs.
- Pure server/database adapters stay with `tgtd-Backend`.
- Agent behavior stays with `tgtd-Agent`; reusable retrieval stays with `tgtd-AI-RAG`.
- Shared contracts are created only after at least two real workspace consumers exist.
- Future extraction uses strangler migration: contract, implementation, caller update, verification, compatibility removal.
