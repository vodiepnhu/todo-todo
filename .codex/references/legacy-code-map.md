# Legacy Code Map

Target paths identify owning workspaces. Phase 1.5 moves only the verified foundation rows marked phase `1.5`; all feature rows remain planned.

| Legacy path | Purpose | Dependencies / consumers | Classification | Target path | Phase | Risk / notes |
| --- | --- | --- | --- | --- | --- | --- |
| `src/app/layout.tsx` | Root metadata, toaster, global CSS | Next, sonner; all routes | MOVE | `tgtd-Frontend/src/app/layout.tsx` | 1.5 | Framework-owned; preserve metadata and toast behavior. |
| `src/app/globals.css` | Theme tokens and global styles | Tailwind; all UI | MOVE | `tgtd-Frontend/src/app/globals.css` | 1.5 | No redesign. |
| `src/app/page.tsx` | Landing page | Next Link; public users | MOVE | `tgtd-Frontend/src/app/page.tsx` | 1.5 | Verified HTTP smoke route. |
| `src/middleware.ts` | Session refresh and protected redirects | Next, Supabase SSR; all requests | MOVE | `tgtd-Frontend/src/middleware.ts` | 1.5 | Preserve cookie behavior; proxy migration deferred. |
| `src/config/env.ts` | Validated runtime environment | Zod; frontend server/runtime | MOVE | `tgtd-Frontend/src/config/env.ts` | 1.5 | Safe names only in env template. |
| `src/server/supabase/config.ts` | Supabase URL, key, cookie naming | Supabase adapters | MOVE | `tgtd-Frontend/src/server/supabase/config.ts` | 1.5 | Framework adapter boundary. |
| `src/server/supabase/client.ts` | Browser Supabase client | `@supabase/ssr`; browser modules | MOVE | `tgtd-Frontend/src/server/supabase/client.ts` | 1.5 | Frontend-owned browser adapter. |
| `src/server/supabase/server.ts` | Next server Supabase client | `next/headers`, SSR cookies | MOVE | `tgtd-Frontend/src/server/supabase/server.ts` | 1.5 | Frontend-owned Next adapter. |
| `src/server/supabase/middleware.ts` | Middleware session refresh | `NextRequest`, `NextResponse`, SSR | MOVE | `tgtd-Frontend/src/server/supabase/middleware.ts` | 1.5 | Keep with Next runtime. |
| `src/server/supabase/admin.ts` | Service-role Supabase client | `@supabase/supabase-js`; future server callers | MOVE / EXTRACT | `tgtd-Backend/src/platform/supabase/admin.ts` | 1.5 | Pure administrative adapter; no frontend import. |
| `src/shared/navigation/paths.ts` | Canonical route builders | Landing and future routes | MOVE | `tgtd-Frontend/src/shared/navigation/paths.ts` | 1.5 | Frontend navigation ownership. |
| `tests/unit/foundation.test.ts` | Foundation adapter checks | Supabase config exports | MOVE | `tgtd-Frontend/tests/unit/foundation.test.ts` | 1.5 | Test follows frontend ownership. |
| `src/components/ui/{button,card,input}.tsx` | Shared visual primitives | Tailwind/CVA; many UI features | MOVE | `tgtd-Frontend/src/shared/ui/*` | 2 | Do not migrate yet. |
| `src/app/(auth)/*` | Login/signup routes and forms | Browser Supabase, auth UI | MOVE | `tgtd-Frontend/src/app/(auth)/*` plus `tgtd-Frontend/src/features/auth/*` | 2 | Auth behavior high risk. |
| `src/services/workspace-service.ts` | Membership, project CRUD, invites | Supabase; routes, Home, planner | EXTRACT | `tgtd-Backend/src/modules/workspaces/workspace.service.ts` | 3 | Backend package boundary; preserve authorization. |
| `src/services/folder-service.ts` | Home folder tree | Workspace service; Home | MOVE | `tgtd-Backend/src/modules/workspaces/folder.service.ts` | 3 | Keep partition behavior tested. |
| `src/types/database.ts` | Database rows and enums | Most server modules | REFACTOR | `tgtd-Backend/src/contracts/database.ts` | 3 | Keep one source of truth during move. |
| `src/services/confirmation-service.ts` | Pending action execution | Workspace, plans, RAG, agents | REFACTOR | `tgtd-Backend/src/modules/confirmations/confirmation.service.ts` | 7 | Critical data integrity boundary. |
| `src/services/plan-persist-service.ts` | Activity and plan child writes | Supabase, embeddings; confirmation | REFACTOR | `tgtd-Backend/src/modules/activities/plan-repository.ts` | 7 | Preserve child-table and idempotency behavior. |
| `src/agents/orchestrator.ts` | Planner routing and response assembly | All planner agents; API routes | REFACTOR | `tgtd-Agent/src/orchestrator/orchestrator.ts` | 5 | Agent package; preserve injected dependencies. |
| `src/agents/policy-agent.ts` | Planner policy decisions | Orchestrator, schemas | MOVE | `tgtd-Agent/src/agents/policy/policy-agent.ts` | 5 | Keep refusal and clarification behavior. |
| `src/agents/guardrail-agent.ts` | Mutation safety checks | Orchestrator, confirmation | MOVE | `tgtd-Agent/src/agents/guardrail/guardrail-agent.ts` | 5 | No UI dependency. |
| `src/agents/{ingest,mutation,communication,places}-agent.ts` | Planner stages | Orchestrator, provider contracts | MOVE | `tgtd-Agent/src/agents/*/*-agent.ts` | 5 | Split only after contracts are pinned. |
| `src/services/rag-service.ts` | Hybrid retrieval and embedding lookup | Supabase RPC; planner | EXTRACT | `tgtd-AI-RAG/src/retrieval/rag-service.ts` | 6 | RAG package; preserve RPC fallbacks. |
| `src/services/embedding-service.ts` | Remote/mock embeddings | Fetch, env; RAG and confirmation | MOVE | `tgtd-AI-RAG/src/embeddings/embedding-service.ts` | 6 | Keep deterministic degraded path. |
| `src/services/recommendation-service.ts` | Candidate ranking | Database types; RAG agent | MOVE | `tgtd-AI-RAG/src/retrieval/recommendation.ts` | 6 | Pure logic, test before move. |
| `src/lib/ai/*` | AI providers and parsing | Zod, settings, planner | EXTRACT | `tgtd-Agent/src/providers/ai/*` | 5 | Keep agent behavior separate from reusable retrieval. |
| `src/lib/auth/*` | Password/account policy | Supabase, Zod; auth/account | MOVE | `tgtd-Backend/src/modules/auth/*` | 3 | Backend owns policy; frontend owns forms. |
| `src/components/home/home-shell.tsx` | Home projects, folders, sharing, chat | Many services/components | REFACTOR | `tgtd-Frontend/src/features/home/components/HomeScreen.tsx` | 7 | Large UI; no move in 1.5. |
| `src/components/chat/*` | Project and Home chat UI | Supabase, chat APIs | MOVE | `tgtd-Frontend/src/features/chat/components/*` | 8 | `Chatbot-Frontend` remains merge candidate. |
| `src/components/items/*` | Activity list and edit UI | Confirmation, plan persistence | REFACTOR | `tgtd-Frontend/src/features/activities/components/*` | 7 | Preserve realtime and pending flows. |
| `src/components/confirmations/confirm-provider.tsx` | Confirmation UI controller | Confirm API, toast | MOVE | `tgtd-Frontend/src/features/activities/components/ConfirmationProvider.tsx` | 7 | Backend owns execution; frontend owns view. |
| `src/lib/agentops/*`, `src/services/agentops-service.ts` | Traces and stats | Supabase, LangSmith | EXTRACT | `tgtd-Backend/src/modules/agentops/*` | 7 | Preserve privacy and RLS. |
| `rag-demo/` and Python sidecars | Separate demos/experiments | Python/Vite dependencies | UNCERTAIN | Outside active npm workspaces | 6+ | Ownership decision required. |
| Docker/deploy files | Container/deployment runtime | Docker/Vercel | DEFERRED | `tgtd-Infra/*` later | 11 | No current migration. |
