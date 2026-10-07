import type { SupabaseClient } from "@supabase/supabase-js";
import type { Item, Workspace, WorkspaceMember } from "../types/database";

/** supabase-js may return a plain { message } (CORS/RLS) — not an Error instance. */
function throwQueryError(error: { message?: string } | Error): never {
  if (error instanceof Error) throw error;
  throw new Error(error.message || "workspace query failed");
}

export async function listWorkspaces(supabase: SupabaseClient, userId: string) {
  const { data: memberships, error } = await supabase
    .from("workspace_members")
    .select("workspace_id, role, workspaces(*)")
    .eq("profile_id", userId)
    .is("archived_at", null);
  if (error) throwQueryError(error);
  return (memberships ?? []).map((m) => ({
    role: m.role as WorkspaceMember["role"],
    workspace: m.workspaces as unknown as Workspace,
  }));
}

export async function createProject(
  supabase: SupabaseClient,
  userId: string,
  name: string,
  meta?: {
    description?: string;
    tags?: string[];
    icon?: string;
    color?: string;
  },
) {
  const { data: ws, error } = await supabase
    .from("workspaces")
    .insert({
      name,
      workspace_type: "PERSONAL",
      sharing_enabled: false,
      created_by: userId,
      description: meta?.description ?? null,
      tags: meta?.tags ?? [],
      icon: meta?.icon ?? null,
      color: meta?.color ?? null,
    })
    .select("*")
    .single();
  if (error) throwQueryError(error);
  const { error: memErr } = await supabase.from("workspace_members").insert({
    workspace_id: ws.id,
    profile_id: userId,
    role: "OWNER",
  });
  if (memErr) throwQueryError(memErr);
  return ws as Workspace;
}

export async function updateProjectMetadata(
  supabase: SupabaseClient,
  workspaceId: string,
  patch: Partial<
    Pick<
      Workspace,
      "name" | "description" | "tags" | "icon" | "color"
    >
  >,
) {
  const { data, error } = await supabase
    .from("workspaces")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", workspaceId)
    .select("*")
    .single();
  if (error) throw error;
  return data as Workspace;
}

/** Rename helper — thin wrapper around updateProjectMetadata. */
export async function renameProject(
  supabase: SupabaseClient,
  workspaceId: string,
  name: string,
) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Project name required");
  return updateProjectMetadata(supabase, workspaceId, { name: trimmed });
}

/** Owner-only hard delete (cascades items, chat, members). */
export async function deleteProject(
  supabase: SupabaseClient,
  workspaceId: string,
) {
  const { error } = await supabase.rpc("delete_workspace", { ws: workspaceId });
  if (error) throw error;
}


/** @deprecated Prefer createProject; kept for callers expecting SHARED creation */
export async function createSharedWorkspace(
  supabase: SupabaseClient,
  userId: string,
  name: string,
) {
  const { data: ws, error } = await supabase
    .from("workspaces")
    .insert({
      name,
      workspace_type: "SHARED",
      sharing_enabled: true,
      created_by: userId,
    })
    .select("*")
    .single();
  if (error) throw error;
  const { error: memErr } = await supabase.from("workspace_members").insert({
    workspace_id: ws.id,
    profile_id: userId,
    role: "OWNER",
  });
  if (memErr) throw memErr;
  return ws as Workspace;
}

export async function setSharingEnabled(
  supabase: SupabaseClient,
  workspaceId: string,
  enabled: boolean,
) {
  const { data, error } = await supabase.rpc("set_workspace_sharing", {
    ws: workspaceId,
    enabled,
  });
  if (error) throw error;
  return data as Workspace;
}

export type InvitePermissions = {
  canAdd: boolean;
  canEdit: boolean;
  canDelete: boolean;
};

export async function createInvite(
  supabase: SupabaseClient,
  workspaceId: string,
  userId: string,
  email: string,
  permissions: InvitePermissions,
) {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) throw new Error("Invite email required");
  const { data: ws, error: wsErr } = await supabase
    .from("workspaces")
    .select("sharing_enabled")
    .eq("id", workspaceId)
    .single();
  if (wsErr) throw wsErr;
  if (!ws?.sharing_enabled) {
    throw new Error("Sharing is disabled for this project");
  }

  const { data, error } = await supabase
    .from("workspace_invites")
    .insert({
      workspace_id: workspaceId,
      created_by: userId,
      email: normalizedEmail,
      role: "MEMBER",
      can_add: permissions.canAdd,
      can_edit: permissions.canEdit,
      can_delete: permissions.canDelete,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function createViewLink(
  supabase: SupabaseClient,
  workspaceId: string,
) {
  const { data, error } = await supabase.rpc("create_workspace_view_link", {
    ws: workspaceId,
  });
  if (error) throwQueryError(error);
  return { token: data as string };
}

export async function acceptInvite(
  supabase: SupabaseClient,
  token: string,
  _userId: string,
) {
  const { data, error } = await supabase.rpc("accept_workspace_invite", {
    invite_token: token,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function listItems(
  supabase: SupabaseClient,
  workspaceId: string,
  filters?: { itemType?: string; status?: string; subtype?: string },
) {
  let q = supabase
    .from("items")
    .select("*")
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });
  if (filters?.itemType) q = q.eq("item_type", filters.itemType);
  if (filters?.status) q = q.eq("status", filters.status);
  if (filters?.subtype) q = q.eq("subtype", filters.subtype);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Item[];
}

export async function searchWorkspace(
  supabase: SupabaseClient,
  workspaceId: string,
  query: string,
) {
  const q = `%${query}%`;
  const [items, places, messages] = await Promise.all([
    supabase
      .from("items")
      .select("id, title, item_type, subtype")
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null)
      .ilike("title", q)
      .limit(20),
    supabase
      .from("places")
      .select("id, name")
      .eq("workspace_id", workspaceId)
      .ilike("name", q)
      .limit(10),
    supabase
      .from("workspace_messages")
      .select("id, content, created_at")
      .eq("workspace_id", workspaceId)
      .ilike("content", q)
      .limit(10),
  ]);
  return {
    items: items.data ?? [],
    places: places.data ?? [],
    messages: messages.data ?? [],
  };
}
