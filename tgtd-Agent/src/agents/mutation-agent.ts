import type { PlannerRequest } from "../schemas/planner";
import type { ActionType } from "../types/database";

const INTENT_TO_ACTION: Record<
  "CREATE_ITEM" | "UPDATE_ITEM" | "DELETE_ITEM" | "LOG_EVENT",
  ActionType
> = {
  CREATE_ITEM: "CREATE",
  UPDATE_ITEM: "UPDATE",
  DELETE_ITEM: "DELETE",
  LOG_EVENT: "LOG_EVENT",
};

export type MutationDraft = {
  actionType: ActionType;
  payload: Record<string, unknown>;
  draftTitle: string;
};

/** Mutation agent — builds pending_action payload. Does not write until confirm. */
export function buildMutationDraft(input: {
  intent: "CREATE_ITEM" | "UPDATE_ITEM" | "DELETE_ITEM" | "LOG_EVENT";
  message: string;
  items: PlannerRequest["items"];
  event?: PlannerRequest["event"];
  targetReference?: string | null;
  extractMapsUrl: (text: string) => string | undefined;
}): MutationDraft {
  const item = input.items[0] ?? {};
  const maps =
    item.googleMapsUrl || input.extractMapsUrl(input.message) || undefined;
  const actionType = INTENT_TO_ACTION[input.intent];
  const payload: Record<string, unknown> = {
    ...item,
    googleMapsUrl: maps,
    eventType: input.event?.eventType,
    occurredAt: input.event?.occurredAt,
    note: input.event?.note,
    sourceText: input.message,
  };
  const draftTitle =
    (item.title as string | undefined) ||
    input.targetReference ||
    actionType;

  return { actionType, payload, draftTitle };
}
