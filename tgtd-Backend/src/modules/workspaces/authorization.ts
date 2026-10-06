import type { WorkspaceMembership } from "../../contracts/database";
import { AuthorizationError } from "../auth/authorization";

export function canAccessWorkspace(
  membership: WorkspaceMembership | null | undefined,
): boolean {
  return Boolean(membership && membership.member.archived_at === null);
}

export function canAdministerWorkspace(
  membership: WorkspaceMembership | null | undefined,
): boolean {
  return Boolean(
    canAccessWorkspace(membership) &&
      (membership?.member.role === "OWNER" || membership?.member.role === "ADMIN"),
  );
}

export function canDeleteWorkspace(
  membership: WorkspaceMembership | null | undefined,
): boolean {
  return Boolean(canAccessWorkspace(membership) && membership?.member.role === "OWNER");
}

export function requireWorkspaceMembership(
  membership: WorkspaceMembership | null | undefined,
): WorkspaceMembership {
  if (!membership || !canAccessWorkspace(membership)) {
    throw new AuthorizationError("FORBIDDEN", "Active workspace membership required");
  }
  return membership;
}
