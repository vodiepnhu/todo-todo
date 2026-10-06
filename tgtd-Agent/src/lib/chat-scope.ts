export type ChatRoute = "home" | "project";
export type ChatScope = "project" | "cross";

const CROSS_RE = /(?:^|\s)@all\b|across\s+projects/i;

export function detectChatScope(input: {
  message: string;
  route: ChatRoute;
}): ChatScope {
  if (input.route === "home") return "cross";
  if (CROSS_RE.test(input.message)) return "cross";
  return "project";
}

export function stripAllPrefix(message: string): string {
  return message
    .replace(/@all\b/gi, " ")
    .replace(/across\s+projects/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function shouldAskProjectBeforeMutate(input: {
  scope: ChatScope;
  intent: string;
  resolvedWorkspaceId: string | null;
}): boolean {
  if (input.scope !== "cross") return false;
  const mutate = new Set([
    "CREATE_ITEM",
    "UPDATE_ITEM",
    "DELETE_ITEM",
    "LOG_EVENT",
  ]);
  if (!mutate.has(input.intent)) return false;
  return !input.resolvedWorkspaceId;
}

export function resolveProjectFromMessage(
  message: string,
  projects: Array<{ id: string; name: string }>,
):
  | { kind: "existing"; workspaceId: string }
  | { kind: "create"; name: string }
  | { kind: "none" } {
  const create = message.match(/^new project:\s*(.+)$/i);
  if (create?.[1]?.trim()) {
    return { kind: "create", name: create[1].trim() };
  }
  const normalized = message.trim().toLowerCase();
  const hit = projects.find((p) => p.name.toLowerCase() === normalized);
  if (hit) return { kind: "existing", workspaceId: hit.id };

  const inProj = message.match(/\b(?:in|to)\s+([A-Za-z0-9 _-]{2,40})\s*$/i);
  if (inProj) {
    const name = inProj[1].trim().toLowerCase();
    const h2 = projects.find((p) => p.name.toLowerCase() === name);
    if (h2) return { kind: "existing", workspaceId: h2.id };
  }
  return { kind: "none" };
}
