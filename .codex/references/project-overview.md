# Project Overview

## APPLICATION PURPOSE

Shared Planner helps couples and families plan activities across private or shared projects. It combines activity lists, project chat, Home chat across projects, optional AI planning, place lookup, plan details, history, and lightweight AgentOps visibility.

## TECH STACK

- Next.js `16.3.6` App Router
- React `19.2.8` and TypeScript `^5`
- Supabase SSR/browser clients with Postgres, GoTrue, PostgREST, RLS, and pgvector migrations
- Tailwind CSS v4 through `@tailwindcss/postcss`
- Vitest unit tests and Playwright E2E tests
- OpenRouter-compatible AI providers with deterministic mock fallbacks
- Optional Google Maps, LangSmith, and OpenAI-compatible embeddings

## PACKAGE MANAGER

`npm`, evidenced by `package-lock.json` and legacy scripts. Do not switch package managers during migration.

## FRAMEWORK

Next.js App Router with server components for route-level auth/data loading and client components for interactive UI.

## APPLICATION ENTRY POINT

- Root route: `src/app/page.tsx`
- Root layout: `src/app/layout.tsx`
- Middleware: `src/middleware.ts`
- Target Phase 1 shell currently exposes `/` only; feature routes remain unmigrated.
- Canonical signed-in entry: `src/app/projects/page.tsx`
- Project shell: `src/app/projects/[projectId]/layout.tsx`

## PRIMARY FEATURES

- Email/password auth and optional Google OAuth callback
- Personal/shared projects and project membership
- Project folders and Home project tree
- Activity CRUD, quick add, plan enrichment, plan child records, and activity history
- Project chat and cross-project Home chat
- Planner intents: create, update, delete, log event, list, recommend, help, and refusal cases
- Two-step confirmation before mutations
- Google Maps/place resolution with degraded behavior when unavailable
- Hybrid RAG from pgvector, keyword search, and recent chat keyword matching
- Account settings, encrypted user LLM keys, AgentOps traces/stats, and LangSmith stats

## PRIMARY USER FLOWS

1. Visit landing page, sign in or sign up, then enter `/projects`.
2. Create a first project through onboarding or create additional projects from Home.
3. Open a project dashboard, add activities directly or through Quick Add.
4. Open project Lists, Chat, History, or Settings.
5. Send normal chat messages for shared conversation; prefix planner requests with `@planner` or use planner mode.
6. Planner parses input, checks scope and safety, optionally resolves a place, and creates a pending action.
7. Confirm the pending action twice; persist the activity/plan/event and refresh clients through local events or Supabase realtime.
8. Use Home chat to search or mutate across projects; mutations ask for a project or support `new project: <name>`.

## ROUTING

- Public: `/`, `/login`, `/signup`, `/auth/callback`
- Home: `/projects`
- Project: `/projects/[projectId]`, `/chat`, `/lists`, `/settings`, plus compatibility redirects for `/today`, `/history`, and `/dashboard`
- Account: `/account`, `/account/llm`, `/account/agentops`
- Invite: `/join/[token]`
- API: `/api/ai/*`, `/api/chat/messages`, `/api/confirm`, `/api/home/messages`, `/api/join`, `/api/maps`, `/api/settings/*`, `/api/health`
- Legacy compatibility: `/app/*` redirects into canonical `/projects/*` paths

## STATE MANAGEMENT

No global state library. State is held in React client components, loaded through Supabase browser queries, and refreshed through `planner:refresh` events or Supabase realtime channels for items/events/messages. Server components own initial auth and membership checks. Pending confirmation state is persisted in `pending_actions` and exposed through `ConfirmProvider`.

## API / DATA FLOW

Browser clients call Next API routes for chat, planner, confirmation, enrichment, join, settings, and maps. Route handlers authenticate with the server Supabase client, check membership, call services/agents, and write domain records. Direct client reads still query Supabase tables from several UI components. Key tables include `profiles`, `workspaces`, `workspace_members`, `items`, `item_events`, plan child tables, `workspace_messages`, `home_messages`, `pending_actions`, `audit_logs`, places/link tables, `item_embeddings`, `agent_runs`, and `agent_spans`.

## AUTHENTICATION

Supabase Auth with SSR cookies. `src/lib/supabase/middleware.ts` refreshes sessions and redirects unauthenticated users from protected paths. Server pages call `getUser()`. RLS policies enforce project membership and owner/admin access. `src/lib/supabase/admin.ts` is server-only and bypasses RLS for explicit administrative needs.

## IMPORTANT DEPENDENCIES

Retain current versions during migration unless a failing verification requires change: `next`, `react`, `@supabase/ssr`, `@supabase/supabase-js`, `zod`, `lucide-react`, `date-fns`, `recharts`, `sonner`, `class-variance-authority`, `clsx`, `tailwind-merge`, `langsmith`, Vitest, Testing Library, and Playwright.
- `agentation@3.1.2` is retained as a target development dependency because it was explicitly installed; no runtime integration exists yet.

## LOCAL DEVELOPMENT MODEL

Local first. Target uses npm:

```bash
npx supabase start
npx supabase migration up
npm install --ignore-scripts
npm run dev
npm run lint
npm run typecheck
npm test
npm run build:webpack
```

Target Phase 1 verified install, lint, typecheck, unit tests, Webpack build, and dev smoke. `npm run build` remains the default Turbopack path and is environment-limited in the Codex sandbox; use `npm run build:webpack` for reproducible verification. Legacy documentation also expects Supabase CLI plus `npx supabase start` and `npx supabase migration up`; those commands remain unverified in the target. Docker is deferred.

## IMPORTANT ARCHITECTURAL CONSTRAINTS

- Preserve RLS, membership checks, auth cookie behavior, and server/client Supabase URL separation.
- Preserve pending-action confirmation before mutation.
- Preserve mock/degraded behavior when optional keys are absent.
- Preserve project and Home chat scope semantics.
- Keep route handlers thin and move feature use cases behind feature ownership.
- Do not expose secrets in source, docs, or `.codex`.
- Keep compatibility with legacy TODO/TOGO values until database migration proves safe removal.

## KNOWN PROBLEM AREAS

- Large UI modules and planner/persistence modules mix presentation, domain decisions, and data access.
- Direct Supabase queries appear in client components.
- Root TypeScript scope includes an unrelated RAG demo with conflicting dependencies.
- Lint fails on current React effect patterns and smaller hygiene issues.
- Naming mixes project/workspace and activity/TODO/TOGO concepts.
- Legacy and experimental Python/RAG surfaces are not clearly owned by the Next app.

## BEHAVIOR THAT MUST BE PRESERVED

- Auth redirects and membership authorization.
- Project creation, folders, sharing, invite acceptance, and project selection for Home mutations.
- Activity creation/update/delete/event logging through pending confirmation.
- Plan child data and place associations.
- Project chat persistence and Home chat persistence/clear behavior.
- Planner policy refusal, clarification, recommendation, mock fallback, and degraded Maps paths.
- Hybrid retrieval scope and cross-project project labels.
- AgentOps trace persistence and user/admin visibility rules.
