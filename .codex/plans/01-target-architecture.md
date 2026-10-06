# Target Workspace Architecture

Phase 1.5 corrects repository ownership before product migration. Root coordinates workspaces; it is not an application.

## Target tree

```text
.
├── .codex/
├── Chatbot-Frontend/       # merge candidate; no active package yet
├── tgtd-Frontend/          # active Next APP
│   ├── package.json
│   ├── next.config.ts
│   ├── tsconfig.json
│   ├── src/
│   │   ├── app/
│   │   ├── config/
│   │   ├── server/supabase/
│   │   └── shared/navigation/
│   └── tests/
├── tgtd-Backend/           # active server-only PACKAGE
│   ├── package.json
│   ├── tsconfig.json
│   └── src/platform/supabase/
├── tgtd-Agent/             # planned PACKAGE
├── tgtd-AI-RAG/            # planned PACKAGE
├── tgtd-MCP/               # planned PACKAGE/SERVICE
├── tgtd-Desktop/           # planned APP
├── tgtd-Mobile/            # planned APP
├── tgtd-Infra/             # deferred infrastructure
├── package.json             # npm workspace coordination
├── package-lock.json
├── .gitignore
├── AGENTS.md
└── CLAUDE.md
```

Empty workspace directories receive no package manifest until runtime ownership is proven.

## Workspace responsibilities

### `tgtd-Frontend`

Owns Next App Router, pages, layouts, React UI, browser state, navigation, frontend features, and Next adapters that require `next/headers`, `NextRequest`, `NextResponse`, or middleware runtime.

Current foundation ownership:

- `src/app/*`
- `src/config/env.ts`
- `src/shared/navigation/paths.ts`
- `src/server/supabase/{config,client,server,middleware}.ts`
- `src/middleware.ts`
- frontend configs and tests

Future feature shape: `src/features/*`, `src/components/*`, `src/hooks/*`, and `src/shared/*` only when ownership and reuse are proven.

### `tgtd-Backend`

Owns server-only persistence, authorization, domain use cases, repositories, backend contracts, and administrative/database adapters. It is currently a package, not a deployed network service.

Current foundation ownership:

- `src/platform/supabase/admin.ts`
- `src/platform/supabase/config.ts`

Future modules include auth policy, workspaces, activities, confirmations, chat persistence, and database contracts.

### `tgtd-Agent`

Owns planner orchestration and agent behavior: ingest, policy, mutation, guardrail, communication, places, and agent-specific providers. It remains planned; no legacy agent implementation moves in Phase 1.5.

### `tgtd-AI-RAG`

Owns reusable retrieval, embeddings, ranking, ingestion, and provider abstractions. It remains planned; no legacy RAG implementation moves in Phase 1.5.

### Other workspaces

- `tgtd-MCP`: planned until actual MCP runtime exists.
- `Chatbot-Frontend`: merge candidate for future frontend chat ownership, not a second active frontend by default.
- `tgtd-Desktop` and `tgtd-Mobile`: planned application runtimes.
- `tgtd-Infra`: deferred deployment and Docker ownership.

## Dependency boundaries

```text
tgtd-Frontend
  -> public HTTP/API or explicit contracts
  -> tgtd-Backend

tgtd-Backend
  -> explicit contracts
  -> tgtd-Agent and tgtd-AI-RAG when required

tgtd-Agent
  -> public tgtd-AI-RAG retrieval/embedding contracts
```

Forbidden: `../../tgtd-Backend/src/*`, `../../tgtd-Agent/src/*`, or equivalent internal-source imports. Workspaces expose public exports or explicit HTTP/API contracts.

## Shared-code rules

- Root contains no runtime `src/` or `tests/`.
- Shared contracts require at least two real consumers.
- Do not create `common`, `utils`, `helpers`, or `misc` dumping grounds.
- Keep frontend navigation and presentation inside `tgtd-Frontend`.
- Keep persistence and authorization inside `tgtd-Backend`.

## Supabase ownership

- Browser client: `tgtd-Frontend`; it uses `@supabase/ssr` and browser runtime.
- Next server client: `tgtd-Frontend`; it uses `next/headers` and owns route/session adaptation.
- Middleware adapter: `tgtd-Frontend`; it uses `NextRequest`/`NextResponse` and preserves current redirects.
- Service-role/admin client: `tgtd-Backend`; it is pure server/database access and has no frontend import.

Do not migrate middleware to `proxy` during this correction. Preserve behavior and record the Next deprecation warning.

## Configuration and naming

- Root package: private npm workspace coordinator.
- Workspace package manifests own runtime dependencies.
- Workspace configs stay beside the workspace they configure.
- Root `.gitignore`, `AGENTS.md`, `CLAUDE.md`, `.codex/`, and lockfile are repository-wide.
- `tgtd-Frontend/.env.example` owns current Next environment names; no secret values are committed.
- Use `@/` only inside `tgtd-Frontend`; backend package uses explicit relative/public package imports until contracts exist.

## Migration rule

Use strangler migration for every future extraction: identify behavior, define contract, move implementation, update caller, test, verify, then remove compatibility code only after replacement is proven.
