import type { SupabaseClient } from "@supabase/supabase-js";
import type { HomeMessage, MessageType } from "../types/database";
import { dayKeyLocal } from "../lib/chat/chat-history";

/** supabase-js sometimes returns a plain { message } on fetch/CORS failure. */
function throwQueryError(error: { message?: string } | Error): never {
  if (error instanceof Error) throw error;
  throw new Error(error.message || "home_messages query failed");
}

export async function listHomeMessages(
  supabase: SupabaseClient,
  userId: string,
  limit = 100,
) {
  const { data, error } = await supabase
    .from("home_messages")
    .select("*")
    .eq("profile_id", userId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throwQueryError(error);
  return (data ?? []) as HomeMessage[];
}

export async function clearHomeMessages(
  supabase: SupabaseClient,
  input: {
    userId: string;
    mode: "all" | "day";
    dayKey?: string;
    timeZone?: string;
  },
): Promise<number> {
  const { data: rows, error } = await supabase
    .from("home_messages")
    .select("id, created_at")
    .eq("profile_id", input.userId)
    .is("deleted_at", null);
  if (error) throwQueryError(error);

  let ids = (rows ?? []).map((r) => r.id as string);
  if (input.mode === "day") {
    const tz = input.timeZone || "UTC";
    const dayKey = input.dayKey;
    if (!dayKey) return 0;
    ids = (rows ?? [])
      .filter((r) => dayKeyLocal(r.created_at as string, tz) === dayKey)
      .map((r) => r.id as string);
  }
  if (ids.length === 0) return 0;

  const now = new Date().toISOString();
  const { error: updErr } = await supabase
    .from("home_messages")
    .update({ deleted_at: now })
    .in("id", ids);
  if (updErr) throwQueryError(updErr);
  return ids.length;
}

export async function insertHomeMessage(
  supabase: SupabaseClient,
  input: {
    profileId: string;
    content: string;
    messageType?: MessageType;
    linkedEntityType?: string;
    linkedEntityId?: string;
  },
) {
  const { data, error } = await supabase
    .from("home_messages")
    .insert({
      profile_id: input.profileId,
      content: input.content,
      message_type: input.messageType ?? "USER",
      linked_entity_type: input.linkedEntityType ?? null,
      linked_entity_id: input.linkedEntityId ?? null,
    })
    .select("*")
    .single();
  if (error) throwQueryError(error);
  return data as HomeMessage;
}
