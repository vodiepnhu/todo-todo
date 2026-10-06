# Workspace Ownership

| Workspace | Role | Runtime type | Public boundary | May depend on | Must not depend on | Status |
| --- | --- | --- | --- | --- | --- | --- |
| `tgtd-Frontend` | Next App Router, UI, browser state, framework adapters | APP | Routes, HTTP APIs, public UI | Its own shared code, explicit contracts, backend APIs | Backend/agent/RAG internal source paths | ACTIVE |
| `tgtd-Backend` | Server-only persistence and administrative Supabase adapter | PACKAGE | Future backend exports/contracts | Supabase client, explicit contracts | React, Next UI internals, frontend source | ACTIVE, minimal |
| `tgtd-Agent` | Planner agents and orchestration | PACKAGE | Planned agent contracts | Backend contracts, AI/RAG contracts | Frontend components, direct UI imports | PLANNED |
| `tgtd-AI-RAG` | Retrieval, embeddings, ranking, provider infrastructure | PACKAGE | Planned retrieval/embedding contracts | Standard libraries, provider clients, explicit contracts | Agent orchestration and UI ownership | PLANNED |
| `tgtd-MCP` | MCP tools and integrations | SERVICE or PACKAGE | MCP tool protocol | Explicit integration contracts | Generic application utilities | PLANNED |
| `Chatbot-Frontend` | Existing chat workspace candidate | APP or merge target | Unknown until inspected | None established | Duplicate chat ownership | MERGE_CANDIDATE |
| `tgtd-Desktop` | Desktop runtime | APP | Desktop shell | Explicit shared contracts | Web app internals | PLANNED |
| `tgtd-Mobile` | Mobile runtime | APP | Mobile shell | Explicit shared contracts | Web app internals | PLANNED |
| `tgtd-Infra` | Deployment and infrastructure | DEFERRED | Deployment configuration | Stable workspace artifacts | Product runtime code | DEFERRED |

Only `tgtd-Frontend` and the minimal `tgtd-Backend` package are active npm workspaces. Empty directories remain repository placeholders and receive no package manifest until code proves ownership.

`tgtd-Backend` is a package, not a network service. The current move only places the pure service-role Supabase adapter there; standalone deployment remains undecided.
