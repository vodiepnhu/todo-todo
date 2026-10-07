import { safeMapsHref } from "@/lib/maps/url";

export type ChatContentSegment = { text: string; href?: string };

const TOKEN_RE = /(https?:\/\/\S+|javascript:\S+)/gi;

export function splitChatContent(content: string): ChatContentSegment[] {
  const segments: ChatContentSegment[] = [];
  let cursor = 0;

  for (const match of content.matchAll(TOKEN_RE)) {
    const token = match[0];
    const index = match.index ?? 0;
    appendText(segments, content.slice(cursor, index));

    const href = safeMapsHref(token);
    if (href) {
      segments.push({ text: token, href });
    } else {
      appendText(segments, token);
    }
    cursor = index + token.length;
  }

  appendText(segments, content.slice(cursor));
  return segments.length ? segments : [{ text: "" }];
}

export function hasConfirmPendingMarker(content: string): boolean {
  return content.includes("[Confirm] pending:");
}

export function isExecutedConfirmationResponse(response: {
  confirmed?: boolean;
  pending?: { state?: string };
}): boolean {
  return response.confirmed === true && response.pending?.state === "EXECUTED";
}

export function latestConfirmableMessageIds(
  messages: Array<{
    id: string;
    message_type: string;
    content: string;
    linked_entity_type: string | null;
    linked_entity_id: string | null;
  }>,
  confirmedPendingIds: ReadonlySet<string> = new Set(),
): Set<string> {
  const latest = new Map<string, (typeof messages)[number]>();
  for (const message of messages) {
    if (
      message.message_type === "AI" &&
      message.linked_entity_type === "pending_action" &&
      message.linked_entity_id &&
      !confirmedPendingIds.has(message.linked_entity_id)
    ) {
      latest.set(message.linked_entity_id, message);
    }
  }

  return new Set(
    [...latest.values()]
      .filter((message) => hasConfirmPendingMarker(message.content))
      .map((message) => message.id),
  );
}

function appendText(segments: ChatContentSegment[], text: string) {
  if (!text) return;
  const last = segments.at(-1);
  if (last && !last.href) {
    last.text += text;
    return;
  }
  segments.push({ text });
}
