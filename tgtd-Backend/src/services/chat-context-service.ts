import type { SupabaseClient } from "@supabase/supabase-js";

/** Recent non-deleted chat lines for planner context (newest last). */
export async function listRecentChatContext(
  supabase: SupabaseClient,
  workspaceId: string,
  opts?: { excludeMessageId?: string; limit?: number },
): Promise<string> {
  const limit = opts?.limit ?? 20;
  let q = supabase
    .from("workspace_messages")
    .select("id, message_type, content, created_at")
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(limit + (opts?.excludeMessageId ? 1 : 0));

  const { data, error } = await q;
  if (error || !data?.length) return "";

  const rows = data
    .filter((m) => m.id !== opts?.excludeMessageId)
    .slice(0, limit)
    .reverse();

  return rows
    .map((m) => {
      const who =
        m.message_type === "USER"
          ? "User"
          : m.message_type === "AI"
            ? "Planner"
            : m.message_type;
      const text = String(m.content ?? "").replace(/\s+/g, " ").trim();
      return `${who}: ${text.slice(0, 400)}`;
    })
    .filter((line) => !line.endsWith(":"))
    .join("\n");
}
