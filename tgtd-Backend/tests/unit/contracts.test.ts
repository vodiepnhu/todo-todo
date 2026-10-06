import { describe, expect, it } from "vitest";
import type {
  MemberRole,
  Profile,
  Workspace,
  WorkspaceMember,
  WorkspaceMembership,
  WorkspaceType,
} from "../../src/contracts/database";

describe("backend database contracts", () => {
  it("represents profile and active workspace membership rows", () => {
    const workspaceType: WorkspaceType = "PERSONAL";
    const role: MemberRole = "OWNER";
    const profile: Profile = {
      id: "user-1",
      display_name: "Demo",
      avatar_url: null,
      timezone: "UTC",
      default_travel_mode: "driving",
      agentops_full_payload: false,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };
    const workspace: Workspace = {
      id: "workspace-1",
      name: "Demo Space",
      workspace_type: workspaceType,
      sharing_enabled: false,
      created_by: profile.id,
      description: null,
      tags: [],
      icon: null,
      color: null,
      agentops_full_payload: false,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };
    const member: WorkspaceMember = {
      id: "member-1",
      workspace_id: workspace.id,
      profile_id: profile.id,
      role,
      joined_at: "2026-01-01T00:00:00Z",
      last_seen_at: null,
      archived_at: null,
    };
    const membership: WorkspaceMembership = {
      member,
      workspace,
    };

    expect(membership.member.role).toBe("OWNER");
    expect(membership.workspace.created_by).toBe(profile.id);
  });
});
