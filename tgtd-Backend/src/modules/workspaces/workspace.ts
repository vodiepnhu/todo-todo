import { requireAuthenticatedUser } from "../auth/authorization";
import type { WorkspaceMembership } from "../../contracts/database";
import type { WorkspaceRepository } from "./workspace.repository";

export async function listUserWorkspaces(
  repository: WorkspaceRepository,
  userId: string,
): Promise<WorkspaceMembership[]> {
  return repository.listMemberships(requireAuthenticatedUser(userId));
}

export async function getUserWorkspaceMembership(
  repository: WorkspaceRepository,
  userId: string,
  workspaceId: string,
): Promise<WorkspaceMembership | null> {
  return repository.getMembership(
    requireAuthenticatedUser(userId),
    workspaceId,
  );
}
