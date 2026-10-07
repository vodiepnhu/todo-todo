import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  MemberRole,
  Workspace,
  WorkspaceMember,
  WorkspaceMembership,
} from "../../contracts/database";

const MEMBERSHIP_SELECT =
  "id, workspace_id, profile_id, role, joined_at, last_seen_at, archived_at, can_add, can_edit, can_delete, workspaces(*)";

function throwWorkspaceQueryError(
  error: { message?: string } | Error,
): never {
  if (error instanceof Error) throw error;
  throw new Error(error.message || "Workspace query failed");
}

function mapMembership(row: unknown): WorkspaceMembership {
  const value = row as Partial<WorkspaceMember> & {
    workspaces?: Workspace;
  };
  if (!value.workspaces) {
    throw new Error("Workspace membership query returned no workspace");
  }
  return {
    member: {
      id: value.id as string,
      workspace_id: value.workspace_id as string,
      profile_id: value.profile_id as string,
      role: value.role as MemberRole,
      joined_at: value.joined_at as string,
      last_seen_at: value.last_seen_at ?? null,
      archived_at: value.archived_at ?? null,
      can_add: value.can_add ?? true,
      can_edit: value.can_edit ?? true,
      can_delete: value.can_delete ?? true,
    },
    workspace: value.workspaces,
  };
}

export interface WorkspaceRepository {
  listMemberships(userId: string): Promise<WorkspaceMembership[]>;
  getMembership(
    userId: string,
    workspaceId: string,
  ): Promise<WorkspaceMembership | null>;
  getWorkspace(workspaceId: string): Promise<Workspace | null>;
}

export function createWorkspaceRepository(
  supabase: SupabaseClient,
): WorkspaceRepository {
  return {
    async listMemberships(userId) {
      const { data, error } = await supabase
        .from("workspace_members")
        .select(MEMBERSHIP_SELECT)
        .eq("profile_id", userId)
        .is("archived_at", null);
      if (error) throwWorkspaceQueryError(error);
      return (data ?? []).map(mapMembership);
    },

    async getMembership(userId, workspaceId) {
      const { data, error } = await supabase
        .from("workspace_members")
        .select(MEMBERSHIP_SELECT)
        .eq("profile_id", userId)
        .eq("workspace_id", workspaceId)
        .is("archived_at", null)
        .maybeSingle();
      if (error) throwWorkspaceQueryError(error);
      return data ? mapMembership(data) : null;
    },

    async getWorkspace(workspaceId) {
      const { data, error } = await supabase
        .from("workspaces")
        .select("*")
        .eq("id", workspaceId)
        .maybeSingle();
      if (error) throwWorkspaceQueryError(error);
      return (data as Workspace | null) ?? null;
    },
  };
}
