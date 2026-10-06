import { describe, expect, it } from "vitest";
import type {
  MemberRole,
  Workspace,
  WorkspaceMembership,
} from "../../src/contracts/database";
import {
  listHomeTree,
  partitionHomeTree,
} from "../../src/modules/workspaces/home";

function membership(
  id: string,
  name: string,
  createdBy: string,
  role: MemberRole,
): WorkspaceMembership {
  const workspace: Workspace = {
    id,
    name,
    workspace_type: role === "OWNER" && createdBy === "user-1" ? "PERSONAL" : "SHARED",
    sharing_enabled: role !== "OWNER" || createdBy !== "user-1",
    created_by: createdBy,
    description: null,
    tags: [],
    icon: null,
    color: null,
    agentops_full_payload: false,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
  return {
    workspace,
    member: {
      id: "member-" + id,
      workspace_id: id,
      profile_id: "user-1",
      role,
      joined_at: "2026-01-01T00:00:00Z",
      last_seen_at: null,
      archived_at: null,
    },
  };
}

describe("Home workspace partition", () => {
  it("partitions creator-owned and shared workspaces alphabetically", () => {
    const result = partitionHomeTree("user-1", [
      membership("shared-1", "Zulu", "user-2", "MEMBER"),
      membership("owned-1", "Bravo", "user-1", "OWNER"),
      membership("owned-2", "Alpha", "user-1", "OWNER"),
    ]);

    expect(result.owned.map(({ name }) => name)).toEqual(["Alpha", "Bravo"]);
    expect(result.sharedWithMe.map(({ name }) => name)).toEqual(["Zulu"]);
  });

  it("treats OWNER membership as owned when creator differs", () => {
    const result = partitionHomeTree("user-1", [
      membership("owned-1", "Shared Owner", "user-2", "OWNER"),
    ]);

    expect(result.owned.map(({ name }) => name)).toEqual(["Shared Owner"]);
    expect(result.sharedWithMe).toEqual([]);
  });

  it("loads Home tree through authenticated repository use case", async () => {
    const repository = {
      listMemberships: async () => [
        membership("owned-1", "Home", "user-1", "OWNER"),
      ],
      getMembership: async () => null,
      getWorkspace: async () => null,
    };

    await expect(listHomeTree(repository, "user-1")).resolves.toMatchObject({
      owned: [{ name: "Home" }],
      sharedWithMe: [],
    });
    await expect(listHomeTree(repository, "")).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
    });
  });
});
