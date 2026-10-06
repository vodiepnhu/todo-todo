import type { SupabaseClient } from "@supabase/supabase-js";
import type { MemberRole, Workspace } from "@/types/database";
import { listWorkspaces } from "@/services/workspace-service";

export type HomeMembership = {
  role: MemberRole;
  workspace: Workspace;
};

export type HomeTree = {
  owned: Workspace[];
  sharedWithMe: Workspace[];
};

/** Pure partition — unit-tested. */
export function partitionHomeTree(
  userId: string,
  memberships: HomeMembership[],
): HomeTree {
  const owned: Workspace[] = [];
  const sharedWithMe: Workspace[] = [];
  for (const m of memberships) {
    if (m.workspace.created_by === userId || m.role === "OWNER") {
      owned.push(m.workspace);
    } else {
      sharedWithMe.push(m.workspace);
    }
  }
  owned.sort((a, b) => a.name.localeCompare(b.name));
  sharedWithMe.sort((a, b) => a.name.localeCompare(b.name));
  return { owned, sharedWithMe };
}

export async function listHomeTree(supabase: SupabaseClient, userId: string) {
  const memberships = await listWorkspaces(supabase, userId);
  return partitionHomeTree(userId, memberships);
}
