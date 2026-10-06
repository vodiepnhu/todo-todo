import type { WorkspaceMessage } from "@/types/database";

export function dayKeyLocal(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

export function formatBubbleTime(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat(undefined, {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatDayHeading(dayKey: string, timeZone: string): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, d!, 12));
  return new Intl.DateTimeFormat(undefined, {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function groupMessagesByDay(
  messages: WorkspaceMessage[],
  timeZone: string,
): { dayKey: string; messages: WorkspaceMessage[] }[] {
  const map = new Map<string, WorkspaceMessage[]>();
  for (const m of messages) {
    const key = dayKeyLocal(m.created_at, timeZone);
    const list = map.get(key) ?? [];
    list.push(m);
    map.set(key, list);
  }
  return [...map.entries()].map(([dayKey, msgs]) => ({
    dayKey,
    messages: msgs,
  }));
}

/** Soft-delete targets for a confirmed pending: linked msgs + reply_to / prior USER. */
export function messageIdsForPendingThread(
  messages: WorkspaceMessage[],
  pendingId: string,
): string[] {
  const ids = new Set<string>();
  const sorted = [...messages].sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

  for (let i = 0; i < sorted.length; i++) {
    const m = sorted[i]!;
    if (
      m.linked_entity_type === "pending_action" &&
      m.linked_entity_id === pendingId
    ) {
      ids.add(m.id);
      if (m.reply_to_message_id) ids.add(m.reply_to_message_id);
      for (let j = i - 1; j >= 0; j--) {
        const prev = sorted[j]!;
        if (prev.message_type === "USER") {
          ids.add(prev.id);
          break;
        }
      }
    }
  }
  return [...ids];
}

export type ClearChatScope =
  | { mode: "all" }
  | { mode: "day"; dayKey: string; timeZone: string }
  | { mode: "pending"; pendingId: string };
