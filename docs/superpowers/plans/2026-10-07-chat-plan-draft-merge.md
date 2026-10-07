# Project Chat Plan Draft Merge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Project Chat create one visible plan draft, merge follow-up corrections into the same pending action, resolve Maps URLs through the Continue with Planner flow, and save only after `CONFIRM`.

**Architecture:** Keep `PlanSchema` as canonical data. Extend shared extraction to accept an optional base plan and return display metadata; let the orchestrator decide create-versus-merge; let Backend scope and update the existing pending row. Render only trusted Maps URLs as links in chat.

**Tech Stack:** TypeScript, Zod, Vitest, Next.js 16 route handler, Supabase JSONB `pending_actions.payload_json`.

**Spec:** `docs/superpowers/specs/2026-10-07-chat-plan-draft-merge-design.md`

## Global Constraints

- Project Chat only; Home Chat behavior remains unchanged.
- Existing Add / Continue with Planner extraction contract remains source of truth for plan fields.
- Reuse existing `pending_actions.payload_json`; no migration.
- Latest explicit user input wins; unchanged fields remain unchanged.
- Google Maps URL comes only from trusted pasted input or existing search result; never fabricate.
- Only exact `CONFIRM` persists; no automatic save.
- No new dependency, provider, API key, or multi-draft UI.

## Review Focus

- Follow-up changes one field while preserving arrays and metadata; test merge keeps untouched fields.
- Follow-up changes place; test Maps search refreshes URL/place ID without retaining old place metadata.
- Pending payload is malformed or expired; test orchestrator creates a new draft instead of corrupting existing data.
- LLM returns invalid merged plan; test pending update is not called.
- Chat contains untrusted URL; test UI leaves it non-clickable and backend does not store it.

---

### Task 1: Extend Shared Plan Extraction and Draft Reply

**Files:**
- Modify: `tgtd-Agent/src/lib/ai/extract-plan.ts`
- Modify: `tgtd-Agent/src/agents/communication-agent.ts`
- Modify: `tgtd-Agent/src/agents/types.ts`
- Test: `tgtd-Agent/tests/unit/extract-plan.test.ts`
- Test: `tgtd-Agent/tests/unit/agents-m19.test.ts`

**Interfaces:**
- Produces `PlanExtractionResult` with `draft: PlanDraft`, optional `extracted` and `suggestions` field summaries, `missing`, and existing fallback/Maps metadata.
- Extends `extractPlanFromChat(input)` with optional `basePlan?: PlanDraft`; existing callers without `basePlan` keep current behavior.
- Extends `OrchestratorDeps.extractPlan` to return the display metadata while keeping `draft` required.
- Extends `formatMutationReply` to accept `plan`, `extracted`, `suggestions`, and `missing`; output remains plain text with existing `pending:<id>` marker.

- [ ] **Step 1: Write failing tests**
  - Add test that extraction with `basePlan` sends existing plan plus latest request and returns complete merged draft.
  - Add test that nested model envelope `{ plan, extracted, suggestions }` normalizes to canonical `PlanSchema` data.
  - Add test that mutation reply contains `Extracted`, `Suggestions`, `Missing or uncertain`, `Type CONFIRM`, and pending marker.
- [ ] **Step 2: Run focused tests to verify failure**

  Run: `npm --workspace tgtd-Agent test -- extract-plan.test.ts agents-m19.test.ts`

  Expected: FAIL because base-plan input, extraction metadata, and reply sections are absent.
- [ ] **Step 3: Implement minimum shared contract**
  - Add the optional base-plan prompt input and instruct model to return a complete plan preserving fields not changed by latest request.
  - Accept both the new envelope and existing flat model output; validate only the canonical plan with `PlanSchema`.
  - Keep fallback output valid when metadata is absent; default metadata to empty arrays and existing `missing` calculation.
  - Format readable sections from metadata and canonical plan without exposing provider keys or raw errors.
- [ ] **Step 4: Run focused tests to verify pass**

  Run: `npm --workspace tgtd-Agent test -- extract-plan.test.ts agents-m19.test.ts`

  Expected: PASS.

### Task 2: Add Scoped Active-Pending Load and Update Services

**Files:**
- Modify: `tgtd-Backend/src/services/confirmation-service.ts`
- Modify: `tgtd-Backend/src/index.ts`
- Test: `tgtd-Backend/tests/unit/confirmation-service.test.ts`

**Interfaces:**
- Produces `findActivePlanPending(supabase, workspaceId, userId): Promise<PendingAction | null>`.
- Produces `updatePendingPlan(supabase, pendingId, workspaceId, userId, payload): Promise<PendingAction>`.
- Both methods require `action_type = "CREATE"`, `state = "AWAITING_CONFIRM_2"`, matching `workspace_id` and `initiated_by`, and an unexpired `expires_at`.
- Update preserves pending ID, action type, initiator, workspace, and execution state; refreshes `payload_json` and `expires_at`.

- [ ] **Step 1: Write failing tests**
  - Assert active lookup includes workspace, user, action, state, and expiry filters.
  - Assert update writes new JSON payload and refreshed expiry while scoping ID, workspace, user, and state.
  - Assert missing row returns `null` or throws a clear update error without broad update scope.
- [ ] **Step 2: Run focused tests to verify failure**

  Run: `npm --workspace tgtd-Backend test -- confirmation-service.test.ts`

  Expected: FAIL because service exports do not exist.
- [ ] **Step 3: Implement minimal Supabase service methods**
  - Reuse `PendingAction` and confirmation TTL from existing service.
  - Validate payload shape only at the orchestrator boundary; service remains a scoped persistence helper.
- [ ] **Step 4: Run focused tests to verify pass**

  Run: `npm --workspace tgtd-Backend test -- confirmation-service.test.ts`

  Expected: PASS.

### Task 3: Merge Project Chat Drafts in Orchestrator

**Files:**
- Modify: `tgtd-Agent/src/agents/orchestrator.ts`
- Modify: `tgtd-Agent/src/agents/types.ts`
- Test: `tgtd-Agent/tests/unit/orchestrator.test.ts`

**Interfaces:**
- Extends `OrchestratorDeps` with optional `findActivePlanPending(workspaceId, userId)` and `updatePendingPlan(pendingId, workspaceId, userId, payload)` callbacks.
- Active pending structural input contains `id`, `workspace_id`, `action_type`, `payload_json`, `state`, and `expires_at`.
- CREATE plan branch returns existing pending ID after merge, otherwise creates one as today.

- [ ] **Step 1: Write failing tests**
  - Add create → correction test: first request creates `p1`; second request loads `p1`, returns merged canonical plan, calls update once, and does not call create.
  - Assert untouched fields survive correction and latest explicit date/time replaces prior values.
  - Add place-change test asserting injected Maps search result replaces old URL, place ID, coordinates, and address.
  - Add malformed-pending test asserting new draft creation and no update call.
  - Add invalid-merge test asserting existing pending payload is unchanged and update callback is not called.
- [ ] **Step 2: Run focused tests to verify failure**

  Run: `npm --workspace tgtd-Agent test -- orchestrator.test.ts`

  Expected: FAIL because orchestrator always creates a new pending action and does not load or update drafts.
- [ ] **Step 3: Implement minimum merge path**
  - Load active pending only for Project Chat CREATE flow.
  - Parse current `payload.plan` with `PlanSchema`; pass it as `basePlan` to extraction together with recent chat and latest request.
  - Call extraction with Maps lookup enabled so unchanged places preserve metadata and changed places use `runMapsSearchAgent`; retain trusted pasted URLs only.
  - Validate merged plan, rebuild `schema: "plan"` payload, and update same pending row; create a row only when no valid active plan exists.
  - Preserve existing non-plan mutations, guardrails, confirmation marker, and fallback behavior.
- [ ] **Step 4: Run focused tests to verify pass**

  Run: `npm --workspace tgtd-Agent test -- orchestrator.test.ts`

  Expected: PASS.

### Task 4: Wire Planner Route and Message Thread Linkage

**Files:**
- Modify: `tgtd-Frontend/src/app/api/ai/planner/route.ts`
- Create: `tgtd-Frontend/tests/unit/planner-route.test.ts`

**Interfaces:**
- Route injects Backend `findActivePlanPending` and `updatePendingPlan` into `runPlannerOrchestrator`.
- AI reply insert sets `reply_to_message_id` to the current user message and keeps `linked_entity_id` equal to the current pending ID.
- Confirmation continues selecting newest active pending action and executing canonical `PlanSchema` payload.

- [ ] **Step 1: Read Next route-handler guidance**

  Read: `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md` and `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md` before editing the route.
- [ ] **Step 2: Write failing route assertions**
  - Add `planner-route.test.ts` with mocked Supabase, Agent, and Backend modules; assert orchestrator receives both pending callbacks.
  - Assert AI insert payload sets `reply_to_message_id` to inserted user-message ID and preserves returned pending ID for a follow-up.
- [ ] **Step 3: Run focused tests to verify failure**

  Run: `npm test -- planner-route.test.ts`

  Expected: FAIL because route does not inject pending callbacks or set message linkage.
- [ ] **Step 4: Implement route wiring**
  - Import/export the two Backend helpers.
  - Pass scoped callbacks using current Supabase client.
  - Link each AI response to the triggering user message; do not change Home Chat route.
- [ ] **Step 5: Run focused tests to verify pass**

  Run: `npm test -- planner-route.test.ts && npm --workspace tgtd-Frontend typecheck`

  Expected: PASS.

### Task 5: Render Trusted Maps Links in Project Chat

**Files:**
- Create: `tgtd-Frontend/src/lib/chat/chat-content.ts`
- Modify: `tgtd-Frontend/src/components/chat/chat-client.tsx`
- Test: `tgtd-Frontend/tests/unit/chat-content.test.ts`

**Interfaces:**
- Produces `splitChatContent(content: string): Array<{ text: string; href?: string }>`.
- The helper turns only URLs accepted by existing `safeMapsHref` into `href`; all other text remains plain text.
- Chat preserves whitespace/newlines and opens trusted Maps links in a new tab with `rel="noreferrer"`.

- [ ] **Step 1: Write failing tests**
  - Assert trusted `https://www.google.com/maps/...` becomes a link segment.
  - Assert `https://example.com` and `javascript:` remain plain text.
  - Assert surrounding text and newlines remain present.
- [ ] **Step 2: Run focused tests to verify failure**

  Run: `npm test -- chat-content.test.ts`

  Expected: FAIL because helper does not exist.
- [ ] **Step 3: Implement minimum renderer/helper**
  - Split URL tokens, validate with `safeMapsHref`, and render trusted segments as anchors in the existing message bubble.
  - Keep current confirmation button and chat send behavior unchanged.
- [ ] **Step 4: Run focused tests to verify pass**

  Run: `npm test -- chat-content.test.ts`

  Expected: PASS.

### Task 6: Full Verification

**Files:**
- No new production files.

- [ ] **Step 1: Run Agent tests**

  Run: `npm --workspace tgtd-Agent test`

  Expected: all Agent tests pass.
- [ ] **Step 2: Run Backend tests**

  Run: `npm --workspace tgtd-Backend test`

  Expected: all Backend tests pass, including script tests.
- [ ] **Step 3: Run Frontend tests and typechecks**

  Run: `npm test && npm run typecheck`

  Expected: all Frontend tests and workspace typechecks pass.
- [ ] **Step 4: Run production verification**

  Run: `npm run build:webpack`

  Expected: build exits `0` with no route-handler errors.
