# Target Architecture

## Target tree

```text
src/
  app/                         # Next route adapters and route composition
    (auth)/
    account/
    api/
    auth/
    join/
    projects/
    layout.tsx
    page.tsx
    globals.css
  features/
    auth/
      components/
      domain/
      server/
    home/
      components/
      domain/
      server/
    workspaces/
      components/
      domain/
      server/
    activities/
      components/
      domain/
      server/
    chat/
      components/
      domain/
      server/
    planner/
      components/
      domain/
      server/
    account/
      components/
      server/
    agentops/
      components/
      domain/
      server/
  shared/
    ui/                        # genuinely cross-feature visual primitives
    navigation/                # canonical paths and navigation helpers
    formatting/                # cross-feature formatting only
  server/
    supabase/                  # browser/server/admin client adapters
    db/                        # database types and narrow repository helpers
    http/                      # shared server response/error helpers
  config/                      # validated runtime configuration
  types/                       # only cross-feature contracts that need central ownership
```

The target does not create `utils`, `helpers`, `common`, or `misc` dumping grounds. A new shared module requires at least two real consumers and an ownership explanation.

## Responsibilities

- `app`: URL mapping, Next metadata/layouts, HTTP method entry points, and page composition. No business workflow or table-heavy query logic.
- `features/*/components`: feature UI and feature hooks. Components may call feature-owned hooks and route APIs, but do not name Supabase tables directly.
- `features/*/domain`: pure types, parsers, ranking, policies, payload builders, and state transitions owned by one feature.
- `features/*/server`: feature use cases, repositories, external service adapters, and authorization-aware workflows.
- `shared/ui`: Button/Card/Input-like primitives with no product concepts.
- `server/supabase`: SSR/browser/admin clients and cookie/config handling. Server-only modules stay server-only.
- `server/db`: database row contracts and narrowly scoped cross-feature DB helpers. Feature behavior remains in features.
- `config`: validated env and runtime flags. Secret values never enter client bundles or `.codex` docs.

## Feature ownership

| Behavior | Owner |
| --- | --- |
| Login, signup, OAuth callback, password policy | `features/auth` |
| Home project tree, folders, Home creation presentation | `features/home` |
| Membership, invites, project settings, shell/navigation | `features/workspaces` |
| Activity, plan, event, confirmation behavior | `features/activities` |
| Project/Home messages, history, recent chat context | `features/chat` |
| Planner, AI providers, Places, RAG, recommendation | `features/planner` |
| User LLM settings and account pages | `features/account` |
| Agent traces, stats, payload visibility | `features/agentops` |

## Dependency direction

```text
app -> features -> server adapters
app -> shared
features/domain -> types and standard library only
features/components -> own domain, own hooks, shared UI
features/server -> own domain, server/db, server/supabase, external clients
shared -> no feature imports
server/db -> no UI imports
```

Feature-to-feature imports require a stable contract and explicit reason. Prefer a server use case or shared domain contract over importing another feature's internals.

## State rules

- Server components own initial auth/membership and initial data needed for route composition.
- Feature hooks own browser loading, realtime subscription, refresh, and optimistic state for that feature.
- Pending confirmation is durable server state; the provider is a view/controller over the confirmation API.
- Do not add a global store until two independent features need the same mutable client state and event-based refresh is insufficient.
- Server cache/revalidation strategy comes after preserving current realtime and `planner:refresh` behavior.

## Service/API rules

- API routes validate input, authenticate, check authorization, call one feature use case, and serialize a stable response.
- Supabase table names and RPC calls belong in feature repositories or `server/db`, never in presentational components.
- External AI, Maps, embeddings, and LangSmith calls belong behind server adapters with explicit mock/degraded results.
- Preserve current API paths and response fields while moving internals.
- Split `confirmation-service.ts` by action executor only after tests cover CREATE, UPDATE, DELETE, LOG_EVENT, and CREATE_PROJECT.

## Type ownership

- Keep database row/enums in one source of truth during initial migration.
- Move planner request/draft, RAG hit, place resolution, confirmation payload, and AgentOps contracts next to their owning feature.
- Avoid `Record<string, unknown>` at feature boundaries when a stable schema already exists; retain it only for intentionally extensible payloads.
- Keep TODO/TOGO compatibility types until database history and callers prove removal safe.

## Import and naming rules

- Use `@/features/<feature>/...`, `@/shared/...`, `@/server/...`, `@/config/...` aliases.
- Use `PascalCase` for React components, `camelCase` for functions, and noun-oriented repository/use-case names.
- Prefer `Activity`, `Project`, and `Planner` in new names; keep `workspace` where it maps directly to the database contract.
- Name route adapters after URL behavior; name feature functions after business actions.
- One module has one clear responsibility. A file over roughly 250 lines needs a reason; large UI files are split by behavior, not arbitrary line count.

## Concrete legacy examples

- `src/components/home/home-shell.tsx` becomes a Home screen plus Home-owned project/folder/chat components; its Supabase reads move to `features/home/server`.
- `src/agents/orchestrator.ts` becomes `features/planner/server/orchestrate.ts`; pure route decisions stay in `features/planner/domain`.
- `src/services/confirmation-service.ts` becomes an activities confirmation coordinator with separate action executors and an embedding side-effect adapter.
- `src/lib/supabase/server.ts` and `client.ts` move to `server/supabase`; call sites keep the same cookie contract.
- `src/components/ui/button.tsx` moves to `shared/ui/button.tsx`; it stays free of project/activity concepts.
