import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Workspace,
  WorkspaceMembership,
} from "../../src/contracts/database";
import { createWorkspaceRepository } from "../../src/modules/workspaces/workspace.repository";

const workspace: Workspace = {
  id: "workspace-1",
  name: "Demo Space",
  workspace_type: "PERSONAL",
  sharing_enabled: false,
  created_by: "user-1",
  description: null,
  tags: [],
  icon: null,
  color: null,
  agentops_full_payload: false,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const row = {
  id: "member-1",
  workspace_id: workspace.id,
  profile_id: "user-1",
  role: "OWNER",
  joined_at: "2026-01-01T00:00:00Z",
  last_seen_at: null,
  archived_at: null,
  workspaces: workspace,
};

function clientFor(result: { data: unknown; error: { message?: string } | null }) {
  const calls: string[] = [];
  const query = {
    select(fields: string) {
      calls.push("select:" + fields);
      return query;
    },
    eq(column: string, value: string) {
      calls.push("eq:" + column + ":" + value);
      return query;
    },
    is(column: string, value: null) {
      calls.push("is:" + column + ":" + value);
      return query;
    },
    maybeSingle: async () => result,
    then: (resolve: (value: typeof result) => unknown) =>
      Promise.resolve(result).then(resolve),
  };
  const client = {
    from(table: string) {
      calls.push("from:" + table);
      return query;
    },
  } as unknown as SupabaseClient;
  return { client, calls };
}

describe("workspace repository", () => {
  it("maps active membership rows and filters archived members", async () => {
    const { client, calls } = clientFor({ data: [row], error: null });
    const repository = createWorkspaceRepository(client);

    const result = await repository.listMemberships("user-1");

    expect(result).toEqual([
      {
        member: {
          id: row.id,
          workspace_id: row.workspace_id,
          profile_id: row.profile_id,
          role: "OWNER",
          joined_at: row.joined_at,
          last_seen_at: null,
          archived_at: null,
        },
        workspace,
      } satisfies WorkspaceMembership,
    ]);
    expect(calls).toContain("is:archived_at:null");
  });

  it("gets one membership and one workspace", async () => {
    const membershipClient = clientFor({ data: row, error: null });
    const workspaceClient = clientFor({ data: workspace, error: null });
    const membershipRepository = createWorkspaceRepository(membershipClient.client);
    const workspaceRepository = createWorkspaceRepository(workspaceClient.client);

    await expect(membershipRepository.getMembership("user-1", workspace.id)).resolves.toEqual({
      member: {
        id: row.id,
        workspace_id: row.workspace_id,
        profile_id: row.profile_id,
        role: "OWNER",
        joined_at: row.joined_at,
        last_seen_at: null,
        archived_at: null,
      },
      workspace,
    });
    await expect(workspaceRepository.getWorkspace(workspace.id)).resolves.toEqual(workspace);
  });

  it("normalizes plain Supabase errors", async () => {
    const { client } = clientFor({
      data: null,
      error: { message: "workspace query failed" },
    });

    await expect(createWorkspaceRepository(client).getWorkspace(workspace.id)).rejects.toThrow(
      "workspace query failed",
    );
  });
});
