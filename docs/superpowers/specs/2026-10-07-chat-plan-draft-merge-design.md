# Project Chat Plan Draft Merge

**Date:** 2026-10-07  
**Status:** Design approved in chat; implementation pending

## Goal

Project Chat should turn a planner request into an editable plan draft, show what was extracted and generated, accept follow-up corrections in natural language, and save only after explicit `CONFIRM`.

## Scope

- Project Chat only: `tgtd-Frontend/src/components/chat/chat-client.tsx` and its planner route.
- Existing Add / Continue with Planner extraction contract remains the source of truth for plan fields.
- Home Chat behavior remains unchanged.
- Existing pending-action confirmation and canonical `PlanSchema` persistence remain in use.

## User-visible behavior

1. User sends a planner request in Project Chat.
2. Planner extracts explicit facts, generates editable suggestions for missing fields, and returns a readable draft containing:
   - extracted facts;
   - generated suggestions;
   - missing or uncertain fields;
   - Google Maps link when trusted input or search provides one;
   - `Type CONFIRM to save this plan.`
3. Planner creates one `AWAITING_CONFIRM_2` pending action containing the complete canonical plan.
4. User sends a follow-up correction such as `make it Saturday afternoon, remove swimming, add bring sunscreen`.
5. Planner loads the active pending plan and recent chat context, merges the correction into the existing plan, and returns the updated summary.
6. The same pending-action ID is updated and linked to the new AI message. No duplicate pending action is created.
7. Latest explicit user input wins. Fields not mentioned in the correction remain unchanged. Generated suggestions remain unless replaced or explicitly removed.
8. Only exact `CONFIRM` executes the latest pending plan. No automatic save.

## Plan merge contract

The pending payload remains JSONB with the existing shape:

```text
{
  schema: "plan",
  title,
  placeQuery,
  googleMapsUrl,
  plan: PlanSchema
}
```

For a follow-up correction:

- Load newest non-expired pending action for current user, project, and `AWAITING_CONFIRM_2` state.
- Require `payload.schema === "plan"` and validate current `payload.plan` with `PlanSchema` before merging.
- Send existing plan plus recent chat plus latest request to the existing extraction workflow.
- Ask the model to return a complete plan, not a patch. Preserve unchanged values and replace only explicitly changed values.
- Validate merged output with `PlanSchema`; reject invalid output without changing pending data.
- Update the existing pending payload and expiry timestamp atomically enough for current single-user flow; keep `initiated_by`, project, action type, and pending ID unchanged.

Non-plan mutations continue through the existing mutation path.

## Google Maps behavior

Use the same behavior as Continue with Planner:

- Preserve a trusted Google Maps URL pasted by the user.
- If no trusted URL exists, call the existing `runMapsSearchAgent` for the current place name.
- Copy URL, place ID, coordinates, and formatted address from the first trusted search hit.
- Run search on initial draft and again when a correction changes the place.
- Never fabricate a Google Maps URL or place ID.
- If search is unavailable, keep the place name and return a concise degraded note; draft remains editable.
- Preserve the previous place metadata when correction does not change place.

## Layer changes

### Agent

- Extend planner orchestration dependencies with load/update operations for an active pending plan.
- Add a small merge input to the shared plan extraction prompt so Chat and Continue use the same schema and normalization.
- Format mutation replies with readable plan sections and pending link metadata.
- Keep fallback model/error details internal to AgentOps; user sees an editable draft and actionable failure text, not secrets.

### Backend

- Add service methods to find and update an active plan pending action, scoped by user and project.
- Reuse existing `pending_actions.payload_json`; no migration.
- Preserve confirmation guardrails and canonical `persistPlan` execution.

### Frontend

- Keep current Chat send and confirm controls.
- Render planner draft text with extracted/generated/missing sections and a clickable trusted Maps URL.
- Follow-up messages should invoke planner while an active draft exists; normal chat behavior stays unchanged.
- Keep confirmation linked to the latest AI message and same pending ID.

## Error handling

- No active plan: treat planner message as a new draft.
- Expired or malformed pending plan: ignore it for merge and create a new draft.
- LLM/provider failure: keep existing draft unchanged; return the existing fallback behavior with a clear retry instruction.
- Invalid merged plan: keep existing draft unchanged; report schema failure in trace/AgentOps.
- Untrusted Maps URL: discard URL and continue with place name.
- Confirmation always revalidates payload and current pending state before persistence.

## Acceptance tests

- Initial Project Chat request creates one plan pending action and reply shows extracted facts, generated suggestions, missing fields, and confirmation instruction.
- Follow-up correction updates same pending ID, preserves untouched fields, replaces explicitly changed fields, and reply shows merged plan.
- Follow-up place change refreshes Maps metadata through `runMapsSearchAgent`; unchanged place does not lose prior metadata.
- `CONFIRM` persists merged plan once; repeated confirmation is rejected.
- Invalid model merge does not mutate pending payload.
- Pasted untrusted URL is not stored; trusted URL remains clickable.
- Existing Add / Continue extraction and Home Chat tests remain green.

## Non-goals

- No new LLM provider, API key, or database migration.
- No auto-confirm, partial field-level save, or multi-draft UI.
- No changes to Home Chat or unrelated chat history behavior.
- No Google Maps API requirement beyond existing search agent behavior.
