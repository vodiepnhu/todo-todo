export type HomeChatMode = "ask" | "add";

/** Bias NL planner without skipping consultation or schedule confirmation. */
export function applyHomeModeBias(
  message: string,
  mode: HomeChatMode,
): string {
  const trimmed = message.trim();
  if (!trimmed) return trimmed;
  if (mode === "add") {
    return `${trimmed}\n\n(Context: Home Add mode — use selected project as destination. For vague place requests, recommend first, ask which place, then ask whether to schedule. Only an explicit yes or explicit add/save/schedule request may create a plan.)`;
  }
  return `${trimmed}\n\n(Context: Home Ask mode — consult first. For place requests, recommend options, ask which place, then ask whether to schedule. Only an explicit yes or explicit add/save/schedule request may create a plan.)`;
}
