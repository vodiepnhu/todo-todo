import type {
  Workspace,
  WorkspaceMembership,
} from "../../contracts/database";
import { listUserWorkspaces } from "./workspace";
import type { WorkspaceRepository } from "./workspace.repository";

export interface HomeTree {
  owned: Workspace[];
  sharedWithMe: Workspace[];
}

export function partitionHomeTree(
  userId: string,
  memberships: WorkspaceMembership[],
): HomeTree {
  const owned: Workspace[] = [];
  const sharedWithMe: Workspace[] = [];

  for (const membership of memberships) {
    if (membership.member.archived_at !== null) continue;
    if (
      membership.workspace.created_by === userId ||
      membership.member.role === "OWNER"
    ) {
      owned.push(membership.workspace);
    } else {
      sharedWithMe.push(membership.workspace);
    }
  }

  owned.sort((a, b) => a.name.localeCompare(b.name));
  sharedWithMe.sort((a, b) => a.name.localeCompare(b.name));
  return { owned, sharedWithMe };
}

export async function listHomeTree(
  repository: WorkspaceRepository,
  userId: string,
): Promise<HomeTree> {
  return partitionHomeTree(userId, await listUserWorkspaces(repository, userId));
}
