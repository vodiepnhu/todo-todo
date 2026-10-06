import { describe, expect, it } from "vitest";
import type {
  MemberRole,
  Workspace,
  WorkspaceMember,
  WorkspaceMembership,
} from "../../src/contracts/database";
import {
  canAccessWorkspace,
  canAdministerWorkspace,
  canDeleteWorkspace,
  requireWorkspaceMembership,
} from "../../src/modules/workspaces/authorization";
import {
  getUserWorkspaceMembership,
  listUserWorkspaces,
} from "../../src/modules/workspaces/workspace";

const workspace: Workspace = {
  id: "workspace-1",
  name: "Demo Space",
  workspace_type: "SHARED",
  sharing_enabled: true,
  created_by: "owner-1",
  description: null,
  tags: [],
  icon: null,
  color: null,
  agentops_full_payload: false,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

function membership(role: MemberRole, archivedAt: string | null = null): WorkspaceMembership {
  const member: WorkspaceMember = {
    id: "member-1",
    workspace_id: workspace.id,
    profile_id: "user-1",
    role,
    joined_at: "2026-01-01T00:00:00Z",
    last_seen_at: null,
    archived_at: archivedAt,
  };
  return { member, workspace };
}

describe("workspace authorization", () => {
  it("allows active MEMBER access but not administration or deletion", () => {
    const value = membership("MEMBER");
    expect(canAccessWorkspace(value)).toBe(true);
    expect(canAdministerWorkspace(value)).toBe(false);
    expect(canDeleteWorkspace(value)).toBe(false);
  });

  it("allows ADMIN administration but not deletion", () => {
    const value = membership("ADMIN");
    expect(canAccessWorkspace(value)).toBe(true);
    expect(canAdministerWorkspace(value)).toBe(true);
    expect(canDeleteWorkspace(value)).toBe(false);
  });

  it("allows OWNER access, administration, and deletion", () => {
    const value = membership("OWNER");
    expect(canAccessWorkspace(value)).toBe(true);
    expect(canAdministerWorkspace(value)).toBe(true);
    expect(canDeleteWorkspace(value)).toBe(true);
  });

  it("denies archived membership", () => {
    const value = membership("OWNER", "2026-02-01T00:00:00Z");
    expect(canAccessWorkspace(value)).toBe(false);
    expect(canAdministerWorkspace(value)).toBe(false);
    expect(canDeleteWorkspace(value)).toBe(false);
    expect(() => requireWorkspaceMembership(value)).toThrowError(
      expect.objectContaining({ code: "FORBIDDEN" }),
    );
  });

  it("rejects missing membership", () => {
    expect(() => requireWorkspaceMembership(null)).toThrowError(
      expect.objectContaining({ code: "FORBIDDEN" }),
    );
  });

  it("requires authenticated user before workspace repository access", async () => {
    let called = false;
    const repository = {
      listMemberships: async () => {
        called = true;
        return [];
      },
      getMembership: async () => null,
      getWorkspace: async () => null,
    };

    await expect(listUserWorkspaces(repository, "")).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
    });
    expect(called).toBe(false);
  });

  it("delegates authenticated workspace membership lookup", async () => {
    const value = membership("MEMBER");
    const repository = {
      listMemberships: async () => [value],
      getMembership: async () => value,
      getWorkspace: async () => workspace,
    };

    await expect(listUserWorkspaces(repository, "user-1")).resolves.toEqual([value]);
    await expect(
      getUserWorkspaceMembership(repository, "user-1", workspace.id),
    ).resolves.toEqual(value);
  });
});
