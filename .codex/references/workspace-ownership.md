# Workspace Ownership

| Workspace | Role | Runtime type | Public boundary | May depend on | Must not depend on | Status |
| --- | --- | --- | --- | --- | --- | --- |
| `tgtd-Frontend` | Next App Router, UI, browser state, framework adapters | APP | Routes, HTTP APIs, public UI | Its own shared code, explicit contracts, backend APIs | Backend/agent/RAG internal source paths | ACTIVE |
| `tgtd-Backend` | Framework-free auth decisions, profile/workspace repositories/use cases, and administrative Supabase adapter | PACKAGE | `@togo-todo/backend` root contracts/use cases | Supabase client, explicit contracts | React, Next UI internals, frontend source, platform/admin internals as consumers | ACTIVE |
| `tgtd-Agent` | Planner agents, orchestration, guardrails, maps, AI provider runtime | PACKAGE | `@togo-todo/agent` root | AI/RAG package, explicit contracts | Frontend components, direct UI imports | ACTIVE |
| `tgtd-AI-RAG` | Retrieval, embeddings, hybrid ranking, recommendations | PACKAGE | `@togo-todo/ai-rag` root | Standard libraries, provider clients, explicit contracts | Agent orchestration and UI ownership | ACTIVE |
| `tgtd-MCP` | MCP tools and integrations | SERVICE or PACKAGE | MCP tool protocol | Explicit integration contracts | Generic application utilities | PLANNED |
| `Chatbot-Frontend` | Existing chat workspace candidate | APP or merge target | Unknown until inspected | None established | Duplicate chat ownership | MERGE_CANDIDATE |
| `tgtd-Desktop` | Desktop runtime | APP | Desktop shell | Explicit shared contracts | Web app internals | PLANNED |
| `tgtd-Mobile` | Mobile runtime | APP | Mobile shell | Explicit shared contracts | Web app internals | PLANNED |
| `tgtd-Infra` | Deployment and infrastructure | DEFERRED | Deployment configuration | Stable workspace artifacts | Product runtime code | DEFERRED |

`tgtd-Frontend`, `tgtd-Backend`, `tgtd-Agent`, and `tgtd-AI-RAG` are active npm workspaces after fast migration. MCP, Desktop, Mobile, and Infra remain placeholders/deferred.

`tgtd-Backend` is a package, not a network service. Its Phase 3 public root exports auth/profile/workspace/Home contracts and use cases. Service-role admin and seed internals remain private. Repositories use caller-provided RLS-scoped clients; live Supabase integration remains unverified.
Phase 3 backend boundary: package root exposes auth, profile, workspace, and Home contracts/use cases. Service-role admin and seed internals stay private. Repositories use caller-provided RLS-scoped clients. Live Supabase integration remains unverified.

Fast migration boundary: server Next routes use package roots; browser components retain four local compatibility adapters until direct Supabase calls are moved behind API boundaries. No internal `src` reach-through is present.
