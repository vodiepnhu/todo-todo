# Architecture Map

## Current dependency map

```text
Browser
  -> App Router page/layout
      -> client component
          -> direct Supabase browser query (several modules)
          -> Next API route

API route
  -> Supabase SSR auth and membership check
  -> service / agent / lib
      -> Supabase table or RPC
      -> OpenRouter / mock AI
      -> Google Maps / degraded lookup
      -> pgvector / keyword retrieval
```

## Current planner request

```text
Project chat or Home chat
  -> /api/ai/planner or /api/ai/home
      -> auth + membership
      -> save user message
      -> recent chat context + member projects
      -> ingest agent
      -> policy agent
          -> refuse -> communication reply
          -> allow
      -> RAG route for list/recommend/help intents
      -> mutation route
          -> project scope resolution
          -> places agent
          -> guardrail validation
          -> pending_actions insert
      -> communication reply
      -> agent trace + usage + AI message insert
```

## Current confirmation request

```text
ConfirmProvider / client
  -> /api/confirm
      -> confirmation-service
          -> pending action state/TTL/version checks
          -> workspace or project creation
          -> item / event / plan child writes
          -> place association
          -> embedding update/delete
          -> audit log and workspace message
          -> pending action terminal state
```

## Proposed dependency map

```text
src/app route adapter
  -> feature page composition
      -> feature component
          -> feature hook / query client
              -> feature server use case
                  -> feature repository / external adapter
                      -> Supabase, AI provider, Maps, LangSmith

src/shared/ui and src/shared/navigation
  -> imported by features only

src/server/supabase and src/config
  -> server use cases and route adapters
  -> never imported by browser-only modules when server-only
```

## Proposed feature ownership

- `auth`: login, signup, callback, password policy, account identity.
- `home`: project tree, folders, project cards, Home-specific creation and sharing presentation.
- `workspaces`: membership gates, project settings, invites, shell navigation, project metadata.
- `activities`: activity rows, plan details, list filters, events/history, confirmation UI and action execution.
- `chat`: project/Home message transport, history, recent context, realtime message behavior.
- `planner`: structured ingest, policy, mutation draft, places, RAG/recommendation, AI providers, orchestration, usage.
- `account`: account shell, LLM settings, AgentOps views; data access delegates to feature server modules.
- `agentops`: trace persistence, stats, formatting, privacy flags.

## Unusual coupling to remove gradually

1. `confirmation-service.ts` imports guardrail code from `agents`, plan persistence, workspace creation, RAG embedding, and Supabase writes.
2. `orchestrator.ts` imports recommendation logic from `services` and runtime environment directly.
3. `lib/ai/*` imports `services/llm-settings-service` and planner agents, so `lib` is not pure infrastructure.
4. `rag-service.ts` imports the `RagHit` type from `agents/rag-agent`, creating a service-to-agent type dependency.
5. UI clients combine rendering, browser queries, mutation calls, realtime subscriptions, and cache refresh events.
6. The same planner setup is assembled in project and Home API routes.

## Boundary rules for migration

- Route files authenticate and translate HTTP only.
- Feature server use cases own authorization-sensitive workflows.
- Repositories/adapters own Supabase and external API calls.
- Domain functions remain pure and do not import React, Next, or Supabase.
- Browser components use feature hooks or route APIs; no direct table names in UI.
- Shared code must have two real consumers and no feature-specific assumptions.
