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
```

## Feature ownership after foundation

- `tgtd-Frontend`: route adapters, pages, React components, feature hooks, browser state, navigation, Next adapters.
- `tgtd-Backend`: authorization, repositories, persistence, domain use cases, server contracts, service-role access.
- `tgtd-Agent`: ingest, policy, mutation, guardrail, communication, places, orchestration.
- `tgtd-AI-RAG`: retrieval, embeddings, ranking, ingestion, provider abstractions.
- `tgtd-MCP`: actual MCP servers and tools only.

## Coupling to remove gradually

1. Legacy confirmation execution crosses workspace, plan, embedding, guardrail, audit, and chat writes.
2. Legacy orchestration mixes agent routing, persistence, provider calls, and response formatting.
3. Legacy `lib/ai` and RAG code cross agent and service boundaries.
4. Legacy UI combines rendering, direct Supabase reads, realtime, mutations, and refresh events.

## Boundary rules

- Framework adapters stay with `tgtd-Frontend` when they depend on Next runtime APIs.
- Pure server/database adapters stay with `tgtd-Backend`.
- Agent behavior stays with `tgtd-Agent`; reusable retrieval stays with `tgtd-AI-RAG`.
- Shared contracts are created only after at least two real workspace consumers exist.
- Future extraction uses strangler migration: contract, implementation, caller update, verification, compatibility removal.
