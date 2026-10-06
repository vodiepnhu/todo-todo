export type HomeChatMode = "ask" | "add";

/** Bias NL planner without hard-locking intent. */
export function applyHomeModeBias(
  message: string,
  mode: HomeChatMode,
): string {
  const trimmed = message.trim();
  if (!trimmed) return trimmed;
  if (mode === "add") {
    return `${trimmed}\n\n(Context: Home Add mode — prefer CREATE_ITEM / saving an activity; if project is unclear, ask which project or offer new project.)`;
  }
  return `${trimmed}\n\n(Context: Home Ask mode — prefer recommendations and search across projects; only mutate if the user clearly asks to save/add.)`;
}
