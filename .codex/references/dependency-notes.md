# Dependency Notes

| Dependency | Current use | Retain? | Migration risk | Decision |
| --- | --- | --- | --- | --- |
| `next@16.3.6` | App Router, route handlers, middleware, redirects | Yes | High | Copy current config selectively; do not upgrade during structure migration. |
| `react@19.2.8`, `react-dom@19.2.8` | Client/server components and hooks | Yes | High | Preserve client boundaries and current behavior before lint cleanup. |
| `@supabase/ssr` | Browser/server cookie-aware clients | Yes | Critical | Keep one explicit server/client adapter boundary. |
| `@supabase/supabase-js` | Auth, table queries, RPC, realtime | Yes | Critical | Preserve RLS, RPC signatures, and membership checks. |
| `zod@4.6.5` | Planner schemas, API validation, env validation | Yes | Medium | Keep schemas as feature contracts; avoid duplicate validators. |
| `lucide-react` | UI icons | Yes | Low | Move with shared UI. |
| `date-fns` | Relative/date formatting | Yes | Low | Keep only where behavior needs it. |
| `recharts` | Dashboard charts | Yes | Medium | Keep dashboard output stable; isolate chart UI from query/aggregation. |
| `sonner` | Toast notifications | Yes | Low | Preserve root toaster and feature notifications. |
| `class-variance-authority`, `clsx`, `tailwind-merge` | Shared class composition | Yes | Low | Keep existing `cn`/variant behavior. |
| `tailwindcss@4`, `@tailwindcss/postcss` | CSS utility build | Yes | Medium | Copy PostCSS and theme tokens; no UI redesign. |
| `langsmith` | Optional AgentOps stats/tracing integration | Yes, optional | Medium | Keep behind server adapter; degrade when unset. |
| `vitest` | Unit test runner | Yes | Medium | Preserve existing test projects and aliases. |
| `@testing-library/react`, `@testing-library/dom`, `jsdom` | Component tests | Yes | Medium | Retain tests that pin behavior during moves. |
| `@playwright/test` | E2E smoke test | Yes | Medium | Run after target dev server exists. |
| `@vitejs/plugin-react`, nested `rag-demo` Vite packages | Separate RAG demo | Uncertain | High | Do not pull into target app. Root TypeScript currently sees it accidentally. |

No dependency upgrade is justified by this audit. The duplicate Vite/React type errors are a scope/configuration problem, not a reason to upgrade packages.

`agentation@3.1.2` is a target-only development dependency installed by explicit user request. It is not imported by the Phase 1 shell and has no discovered Codex skill definition.
