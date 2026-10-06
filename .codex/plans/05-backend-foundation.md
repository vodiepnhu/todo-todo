# Phase 3 Backend Foundation Implementation Plan

> For implementation: use test-driven-development, focused proof after each task, then full acceptance commands.

**Goal:** Establish a small backend package boundary for auth lookup, profiles, workspace membership, authorization, and Home partitioning. No schema or UI migration.

**Architecture:** tgtd-Backend exposes framework-free decisions, repositories, and use cases through one package root. Supabase remains persistence and RLS enforcement. Authenticated callers provide RLS-scoped clients; service-role access stays admin/seed-only.

**Tech Stack:** TypeScript, @supabase/supabase-js, Vitest, npm workspaces, Supabase Postgres/RLS.

**Spec:** Approved Phase 3 design in .codex/plans/02-migration-plan.md.

## Global Constraints

- Backend domain name is workspaces. UI project terminology does not create a projects module.
- Application authorization complements Supabase RLS; it does not replace RLS.
- Preserve signup trigger creation of profiles and personal workspaces.
- Keep tgtd-Backend a package. Add no HTTP server, microservice, Docker, or deployment runtime.
- Keep Next adapters in tgtd-Frontend. Backend code imports no Next, React, or frontend source.
- Do not import @togo-todo/backend/src/... or ../../tgtd-Backend/src/....
- Preserve demo account demo / demo@local.test / 123456, with no bypass or production seed.
- Do not extract Agent, RAG, planner, activities, confirmation, chat, dashboard, MCP, desktop, mobile, or infra code.

## Terminology

Legacy UI/routes call workspaces “projects”. Database and service ownership use workspaces, workspace_members, and workspace_invites. Phase 3 uses workspaces everywhere in backend contracts. No projects module exists unless later evidence proves a distinct backend responsibility.

## File Classification

| Legacy piece | Class | Phase 3 action |
| --- | --- | --- |
| src/types/database.ts | EXTRACT | Copy only Profile, Workspace, WorkspaceMember, WorkspaceType, and MemberRole into contracts/database.ts. Leave unrelated types. |
| src/lib/auth/account.ts | KEEP | Frontend identity-provider presentation; no backend extraction. |
| src/services/workspace-service.ts:listWorkspaces | EXTRACT | Move read-only membership/workspace lookup behind WorkspaceRepository. |
| workspace-service create/update/delete/share/invite functions | KEEP | Defer complete product mutations and invite flows. |
| workspace-service listItems/searchWorkspace | KEEP | Defer to activity/chat phases. |
| src/services/folder-service.ts:partitionHomeTree/listHomeTree | EXTRACT | Move pure Home partitioning into modules/workspaces/home.ts. Do not create generic folders module. |
| src/lib/supabase/admin.ts | KEEP | Existing target admin adapter remains seed/admin-only. |
| src/lib/supabase/server.ts | KEEP | Next cookie/session adapter remains frontend-owned. |
| init.sql and project_sharing.sql migrations | KEEP / EVIDENCE | Preserve schema, trigger, role semantics, active membership, and RLS. Create no migration. |

## Dependency Order

1. Contracts and backend test runner.
2. Pure auth lookup and authorization.
3. Profile repository and use cases.
4. Workspace repository, authorization, and Home use cases.
5. Explicit package exports.
6. Full verification and memory update.

## Review Focus

- Missing user IDs fail before repository access.
- Archived memberships are excluded.
- OWNER and ADMIN administer; MEMBER only accesses; OWNER alone deletes.
- Missing profile differs from profile with null display_name.
- Plain Supabase error objects with message are normalized.

## Task 1: Contracts and Backend Test Harness

**STEP:** Add only shared types required by auth, profiles, and workspaces, plus TypeScript unit-test execution.

**OBJECTIVE:** Give later modules stable types without copying the full legacy database catalog.

**LEGACY SOURCE / EVIDENCE:** src/types/database.ts:1-106,165-173 defines WorkspaceType, MemberRole, Profile, Workspace, and WorkspaceMember. tgtd-Backend/tsconfig.json includes src/**/*.ts but no backend tests. tgtd-Frontend/package.json already uses Vitest ^3.2.7.

**TARGET FILES:**

- Create tgtd-Backend/src/contracts/database.ts with exact current profile/workspace/member row fields.
- Modify tgtd-Backend/package.json to add backend-owned Vitest dev dependency and a test command that also runs scripts/seed-demo.test.mjs.
- Create tgtd-Backend/vitest.config.ts with Node environment and tests/unit/**/*.test.ts include.
- Do not create a placeholder contracts test unless consumer tests need one.

**PUBLIC CONTRACT:** WorkspaceType, MemberRole, Profile, Workspace, WorkspaceMember, and WorkspaceMembership. WorkspaceMembership contains workspace, role, and archive state required by authorization.

**DEPENDENCIES:** Existing backend TypeScript config and root lockfile. No runtime dependency.

**TESTS:** Later unit tests consume these types. Existing seed-policy test remains in backend test command.

**VERIFICATION:** npm install; npm --workspace tgtd-Backend run typecheck; npm --workspace tgtd-Backend test.

**RISK:** Vitest ownership or lockfile changes alter workspace resolution.

**ROLLBACK:** Remove test-runner/config/contract changes only. Keep existing seed script.

## Task 2: Framework-Free Auth Lookup and Authorization

**STEP:** Add pure identity validation and framework-free Supabase user lookup.

**OBJECTIVE:** Make authentication requirements explicit without duplicating Next server/cookie adapters.

**LEGACY SOURCE / EVIDENCE:** Legacy API routes call auth.getUser() before domain operations. src/lib/supabase/server.ts is Next-specific. src/lib/auth/account.ts:1-23 is frontend provider presentation. RLS uses auth.uid() in supabase/migrations/20260923000000_init.sql:230-257.

**TARGET FILES:**

- Create tgtd-Backend/src/modules/auth/authorization.ts with AuthorizationError and requireAuthenticatedUser(userId: string | null | undefined): string. Add requireAllowedRole only if workspace authorization has a real shared need.
- Create tgtd-Backend/src/modules/auth/authenticated-user.ts with minimal AuthenticatedUserClient and getAuthenticatedUserId(client): Promise<string>.
- Create tgtd-Backend/tests/unit/auth-authorization.test.ts.
- Create tgtd-Backend/tests/unit/authenticated-user.test.ts.

**PUBLIC CONTRACT:** AuthorizationError, requireAuthenticatedUser, getAuthenticatedUserId, and AuthenticatedUserClient. No Next request, cookie, React, or admin-client type crosses boundary.

**DEPENDENCIES:** Task 1. Auth lookup uses a structural client contract, not a deep Supabase mock.

**TESTS:** Null, undefined, and blank IDs throw UNAUTHENTICATED; valid IDs pass unchanged; provider failure throws AUTH_LOOKUP_FAILED; missing returned user throws UNAUTHENTICATED.

**VERIFICATION:** Run focused tests red first, then green; run full backend test and typecheck.

**RISK:** Mixing provider user lookup with frontend session refresh duplicates framework behavior.

**ROLLBACK:** Remove auth modules/exports. Frontend adapters remain unchanged.

## Task 3: Profile Repository and Use Cases

**STEP:** Add RLS-scoped profile lookup and minimal profile application behavior.

**OBJECTIVE:** Preserve trigger-created profile behavior while exposing reusable profile reads and expected-profile checks.

**LEGACY SOURCE / EVIDENCE:** src/types/database.ts:81-90 defines Profile. supabase/migrations/20260923000000_init.sql:64-73 defines profiles and :259-289 creates profile plus personal workspace after signup. tgtd-Backend/scripts/seed-demo.mjs upserts profiles.display_name for the real demo account.

**TARGET FILES:**

- Create tgtd-Backend/src/modules/profiles/profile.repository.ts with ProfileRepository, createProfileRepository(supabase: SupabaseClient), and getByUserId(userId): Promise<Profile | null>. Query profiles by ID with maybeSingle and normalize plain error objects.
- Create tgtd-Backend/src/modules/profiles/profile.ts with getProfile(repository, userId), requireProfile(repository, userId), and getDisplayName(profile: Profile | null): string | null.
- Create tgtd-Backend/tests/unit/profile-use-cases.test.ts using an in-memory repository.
- Create tgtd-Backend/tests/unit/profile-repository.test.ts using a small query-result stub for table/filter/null/error mapping.

**PUBLIC CONTRACT:** ProfileRepository, createProfileRepository, getProfile, requireProfile, getDisplayName, and Profile. requireProfile throws stable profile-not-found error and never writes schema data.

**DEPENDENCIES:** Tasks 1-2. Caller supplies authenticated/RLS-scoped Supabase client. createAdminClient is not used for normal profile reads.

**TESTS:** Existing profile returns unchanged; missing profile returns null; required profile rejects missing record; null display name returns null; repository maps row and plain { message } failure.

**VERIFICATION:** Focused red/green tests; npm --workspace tgtd-Backend test; backend typecheck.

**RISK:** Future caller could accidentally use privileged client and bypass RLS.

**ROLLBACK:** Remove profile modules. Leave signup trigger and demo seed unchanged; no data rollback exists.

## Task 4: Workspace Membership Repository and Authorization

**STEP:** Extract read-only workspace/membership lookup and explicit membership/role decisions.

**OBJECTIVE:** Establish persistence boundary future workspace/project UI and APIs can call without scattered supabase.from calls.

**LEGACY SOURCE / EVIDENCE:** src/services/workspace-service.ts:10-21 lists active memberships with nested workspaces. src/services/folder-service.ts:16-37 consumes that result. init.sql:76-93 defines tables. project_sharing.sql:13-43 makes membership/admin checks active-member-only. RLS policies at init.sql:317-328 remain enforcement.

**TARGET FILES:**

- Create tgtd-Backend/src/modules/workspaces/workspace.repository.ts with WorkspaceRepository, createWorkspaceRepository(supabase: SupabaseClient), listMemberships(userId), getMembership(userId, workspaceId), and getWorkspace(workspaceId). Map nested workspaces(*), preserve is("archived_at", null), and add no mutation/invite methods.
- Create tgtd-Backend/src/modules/workspaces/authorization.ts with requireWorkspaceMembership, canAccessWorkspace, canAdministerWorkspace, and canDeleteWorkspace. Enforce active membership, OWNER/ADMIN administration, and OWNER-only deletion; leave final checks to RLS.
- Create tgtd-Backend/src/modules/workspaces/workspace.ts with listUserWorkspaces(repository, userId) and getUserWorkspaceMembership(repository, userId, workspaceId).
- Create tgtd-Backend/tests/unit/workspace-authorization.test.ts.
- Create tgtd-Backend/tests/unit/workspace-repository.test.ts.

**PUBLIC CONTRACT:** WorkspaceRepository, createWorkspaceRepository, WorkspaceMembership, listUserWorkspaces, getUserWorkspaceMembership, canAccessWorkspace, canAdministerWorkspace, canDeleteWorkspace, and membership/authorization errors.

**DEPENDENCIES:** Tasks 1-2. Repository uses caller-provided SupabaseClient and never imports platform/supabase/admin.ts.

**TESTS:** Missing/archived membership denies access; MEMBER accesses but cannot administer/delete; ADMIN administers but cannot delete; OWNER accesses/administers/deletes; repository excludes archived rows, maps nested workspace, and preserves error message.

**VERIFICATION:** Focused red/green tests; backend typecheck/test; rg check for no frontend or legacy-source imports.

**RISK:** Legacy createProject name may tempt premature mutation extraction. Only read boundary is in scope.

**ROLLBACK:** Keep legacy mutation callers untouched. Remove new repository/use-case files without database or RLS changes.

## Task 5: Home Workspace Partition

**STEP:** Extract pure Home tree partition under canonical workspaces module.

**OBJECTIVE:** Preserve the one Home rule future migration needs without creating generic folders domain.

**LEGACY SOURCE / EVIDENCE:** src/services/folder-service.ts:5-32 defines HomeMembership, HomeTree, and partitionHomeTree; :34-36 composes listWorkspaces. src/app/projects/page.tsx and src/components/home/home-shell.tsx consume listHomeTree.

**TARGET FILES:**

- Create tgtd-Backend/src/modules/workspaces/home.ts with HomeTree, partitionHomeTree(userId, memberships), and listHomeTree(repository, userId); preserve owner/shared partition and alphabetical sorting.
- Create tgtd-Backend/tests/unit/home-workspaces.test.ts.

**PUBLIC CONTRACT:** HomeTree, partitionHomeTree, and listHomeTree. No folder-service compatibility alias because no target frontend caller migrates in Phase 3.

**DEPENDENCIES:** Tasks 1, 2, and 4.

**TESTS:** Creator-owned workspace is owned; OWNER role is owned even when creator differs; non-owner is sharedWithMe; both partitions sort by name; list composition validates user ID.

**VERIFICATION:** Focused red/green test; full backend test; backend typecheck.

**RISK:** Project UI wording could lead to a second domain model. Keep this in workspaces.

**ROLLBACK:** Leave legacy folder-service.ts untouched and remove only new Home module if verification fails.

## Task 6: Explicit Backend Package Boundary

**STEP:** Expose intentional contracts/use cases through the @togo-todo/backend package root.

**OBJECTIVE:** Give future server consumers a supported import path without a giant barrel or network service.

**TARGET FILES:**

- Create tgtd-Backend/src/index.ts with explicit exports for auth lookup/decisions, profile use cases/repository factory, workspace use cases/repository factory, Home use case, and required public types only.
- Modify tgtd-Backend/package.json with an exports root map targeting src/index.ts. Do not export src internals or platform/supabase/admin.
- Create tgtd-Backend/tests/unit/public-boundary.test.ts importing supported symbols from src/index.ts.

**PUBLIC CONTRACT:** Consumers use @togo-todo/backend. No consumer is added in Phase 3; future frontend server code uses package root, never source reach-through.

**DEPENDENCIES:** Tasks 2-5. No frontend dependency or source reach-through is added.

**TESTS:** Public imports typecheck; root exports test; rg -n 'tgtd-Backend/src|@togo-todo/backend/src' . --glob '!node_modules/**' --glob '!.next/**' returns no matches.

**VERIFICATION:** npm install; backend test/typecheck; frontend lint/typecheck/tests; npm run build:webpack because package metadata changed.

**RISK:** Package export maps can affect workspace resolution with no current consumer.

**ROLLBACK:** Remove export map and root entry. Keep or remove modules only after focused verification shows whether boundary design is valid.

## Task 7: Close-Out Memory and Verification

**STEP:** Run complete acceptance gate, inspect diff/secrets/generated files, and record verified Phase 3 conclusions.

**OBJECTIVE:** Prove no frontend regression, no secret tracking, no legacy writes, and no unverified live-auth claim.

**TARGET FILES:**

- Modify .codex/plans/02-migration-plan.md with actual Phase 3 status and verified commands.
- Modify .codex/plans/03-refactor-backlog.md with task status and deferred mutation scope.
- Modify .codex/references/architecture-map.md, dependency-notes.md, and workspace-ownership.md only for stable verified boundary facts.

**PUBLIC CONTRACT:** Documentation records actual exports and package ownership. It never claims live Supabase verification unless local services are available and tested.

**DEPENDENCIES:** Tasks 1-6 complete.

**TESTS:** Full root and backend suites; live integration is separately classified.

**VERIFICATION:** Run exact acceptance commands below and record exit status/output before commit.

**RISK:** Documentation can overstate verification or include secrets.

**ROLLBACK:** Revert only documentation edits if implementation is not accepted. Never rewrite 8e6153a, 235c1e2, or 4e05743.

## Phase 3 Acceptance Commands

Run from /Users/nhuvo/togo-todo:

~~~bash
npm install
npm run lint
npm run typecheck
npm test
npm --workspace tgtd-Backend test
npm --workspace tgtd-Backend run typecheck
npm run build:webpack
git diff --check
git grep -n -I -E '(sb_secret_[A-Za-z0-9]+|sk-[A-Za-z0-9]{20,}|eyJ[A-Za-z0-9_-]{40,})' -- . ':!*.md' ':!*.example' ':!package-lock.json'
git ls-files | rg '(^|/)(\.env($|\.)|\.next/|dist/|build/)' || true
git status --short
~~~

Expected:

- Install, lint, typecheck, frontend tests, backend tests, backend typecheck, and Webpack build exit 0.
- git diff --check prints no errors.
- Secret scan prints no credential matches.
- Tracked-file check prints no .env secrets or generated output.
- Live Supabase integration remains UNAVAILABLE unless local services are independently started and verified.

## Git Checkpoint

- Baseline: 4e05743 feat: establish authentication foundation.
- Planned implementation commit: refactor: establish backend domain foundation.
- Planning step creates no commit. Earlier commits remain unchanged.
