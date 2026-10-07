import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  acceptInvite,
  createInvite,
  createProject,
  listWorkspaces,
  setSharingEnabled,
} from "@/services/workspace-service";

type Ws = {
  id: string;
  name: string;
  workspace_type: string;
  sharing_enabled: boolean;
  created_by: string;
};

type Member = {
  workspace_id: string;
  profile_id: string;
  role: string;
  archived_at: string | null;
  can_add: boolean;
  can_edit: boolean;
  can_delete: boolean;
};

type Invite = {
  id: string;
  token: string;
  workspace_id: string;
  created_by: string;
  email: string | null;
  role: string;
  can_add: boolean;
  can_edit: boolean;
  can_delete: boolean;
  expires_at: string;
  accepted_at: string | null;
};

type State = {
  workspaces: Record<string, Ws>;
  members: Member[];
  invites: Invite[];
};

function createMockSupabase(state: State): SupabaseClient {
  const from = (table: string) => {
    if (table === "workspaces") {
      let pendingInsert: Ws | null = null;
      let idFilter: string | null = null;

      const chain: {
        select: (cols?: string) => typeof chain;
        insert: (row: Record<string, unknown>) => typeof chain;
        eq: (col: string, val: string) => typeof chain;
        single: () => Promise<{ data: unknown; error: unknown }>;
      } = {
        select: () => chain,
        insert: (row) => {
          const id = `ws-${Object.keys(state.workspaces).length + 1}`;
          pendingInsert = {
            id,
            name: String(row.name),
            workspace_type: String(row.workspace_type),
            sharing_enabled: Boolean(row.sharing_enabled),
            created_by: String(row.created_by),
          };
          state.workspaces[id] = pendingInsert;
          return chain;
        },
        eq: (col, val) => {
          if (col === "id") idFilter = val;
          return chain;
        },
        single: async () => {
          if (pendingInsert) {
            const data = pendingInsert;
            pendingInsert = null;
            return { data, error: null };
          }
          const ws = idFilter ? state.workspaces[idFilter] : null;
          return {
            data: ws,
            error: ws ? null : { message: "not found" },
          };
        },
      };
      return chain;
    }

    if (table === "workspace_members") {
      let profileId: string | null = null;
      const chain = {
        select: () => chain,
        insert: async (row: Member) => {
          state.members.push({
            ...row,
            archived_at: row.archived_at ?? null,
          });
          return { data: row, error: null };
        },
        eq: (col: string, val: string) => {
          if (col === "profile_id") profileId = val;
          return chain;
        },
        is: (_col: string, _val: null) => ({
          then: (
            onfulfilled: (v: unknown) => unknown,
            onrejected?: (e: unknown) => unknown,
          ) =>
            Promise.resolve({
              data: state.members
                .filter(
                  (m) =>
                    (!profileId || m.profile_id === profileId) &&
                    m.archived_at === null,
                )
                .map((m) => ({
                  workspace_id: m.workspace_id,
                  role: m.role,
                  workspaces: state.workspaces[m.workspace_id],
                })),
              error: null,
            }).then(onfulfilled, onrejected),
        }),
      };
      return chain;
    }

    if (table === "workspace_invites") {
      const chain = {
        select: () => chain,
        insert: (row: Record<string, unknown>) => {
          const inv: Invite = {
            id: `inv-${state.invites.length + 1}`,
            token: `tok-${state.invites.length + 1}`,
            workspace_id: String(row.workspace_id),
            created_by: String(row.created_by),
            email: (row.email as string | null) ?? null,
            role: String(row.role ?? "MEMBER"),
            can_add: Boolean(row.can_add),
            can_edit: Boolean(row.can_edit),
            can_delete: Boolean(row.can_delete),
            expires_at: new Date(Date.now() + 86400000).toISOString(),
            accepted_at: null,
          };
          state.invites.push(inv);
          return {
            select: () => ({
              single: async () => ({ data: inv, error: null }),
            }),
          };
        },
      };
      return chain;
    }

    throw new Error(`unexpected table ${table}`);
  };

  const rpc = vi.fn(async (fn: string, args: Record<string, unknown>) => {
    if (fn === "set_workspace_sharing") {
      const wsId = String(args.ws);
      const enabled = Boolean(args.enabled);
      const ws = state.workspaces[wsId];
      if (!ws) return { data: null, error: { message: "missing" } };
      ws.sharing_enabled = enabled;
      ws.workspace_type = enabled ? "SHARED" : "PERSONAL";
      if (!enabled) {
        for (const m of state.members) {
          if (m.workspace_id === wsId && m.role !== "OWNER") {
            m.archived_at = new Date().toISOString();
          }
        }
        for (const inv of state.invites) {
          if (inv.workspace_id === wsId && !inv.accepted_at) {
            inv.expires_at = new Date(0).toISOString();
          }
        }
      }
      return { data: ws, error: null };
    }
    if (fn === "accept_workspace_invite") {
      const token = String(args.invite_token);
      const inv = state.invites.find((i) => i.token === token && !i.accepted_at);
      if (!inv) return { data: null, error: { message: "Invite not found" } };
      if (new Date(inv.expires_at) < new Date()) {
        return { data: null, error: { message: "Invite expired" } };
      }
      const ws = state.workspaces[inv.workspace_id];
      if (!ws?.sharing_enabled) {
        return {
          data: null,
          error: { message: "Sharing is disabled for this project" },
        };
      }
      const existing = state.members.find(
        (m) => m.workspace_id === inv.workspace_id && m.profile_id === "user-b",
      );
      if (existing) {
        existing.archived_at = null;
        existing.role = inv.role;
      } else {
        state.members.push({
          workspace_id: inv.workspace_id,
          profile_id: "user-b",
          role: inv.role,
          can_add: inv.can_add,
          can_edit: inv.can_edit,
          can_delete: inv.can_delete,
          archived_at: null,
        });
      }
      inv.accepted_at = new Date().toISOString();
      return { data: inv.workspace_id, error: null };
    }
    return { data: null, error: { message: `unknown rpc ${fn}` } };
  });

  return { from, rpc } as unknown as SupabaseClient;
}

describe("project sharing lifecycle", () => {
  it("private → enable → invite/accept → disable loses access → re-invite restores", async () => {
    const state: State = { workspaces: {}, members: [], invites: [] };
    const supabase = createMockSupabase(state);

    const project = await createProject(supabase, "user-a", "Trip");
    expect(project.sharing_enabled).toBe(false);
    expect(
      state.members.some(
        (m) => m.profile_id === "user-a" && m.role === "OWNER",
      ),
    ).toBe(true);

    await setSharingEnabled(supabase, project.id, true);
    expect(state.workspaces[project.id].sharing_enabled).toBe(true);

    const invite = await createInvite(supabase, project.id, "user-a", "person@example.com", {
      canAdd: true,
      canEdit: false,
      canDelete: true,
    });
    expect(invite.token).toBeTruthy();
    expect(invite.email).toBe("person@example.com");
    expect(invite.can_add).toBe(true);
    expect(invite.can_edit).toBe(false);
    expect(invite.can_delete).toBe(true);

    const joinedId = await acceptInvite(supabase, invite.token, "user-b");
    expect(joinedId).toBe(project.id);
    expect(
      state.members.find((m) => m.profile_id === "user-b")?.archived_at,
    ).toBeNull();

    await setSharingEnabled(supabase, project.id, false);
    expect(state.workspaces[project.id].sharing_enabled).toBe(false);
    expect(
      state.members.find((m) => m.profile_id === "user-b")?.archived_at,
    ).toBeTruthy();

    const forB = await listWorkspaces(supabase, "user-b");
    expect(forB.find((s) => s.workspace.id === project.id)).toBeUndefined();

    await expect(createInvite(supabase, project.id, "user-a", "person@example.com", {
      canAdd: true,
      canEdit: true,
      canDelete: true,
    })).rejects.toThrow(
      /Sharing is disabled/,
    );

    await setSharingEnabled(supabase, project.id, true);
    const invite2 = await createInvite(supabase, project.id, "user-a", "person@example.com", {
      canAdd: true,
      canEdit: true,
      canDelete: true,
    });
    await acceptInvite(supabase, invite2.token, "user-b");
    expect(
      state.members.find((m) => m.profile_id === "user-b")?.archived_at,
    ).toBeNull();

    const restored = await listWorkspaces(supabase, "user-b");
    expect(restored.some((s) => s.workspace.id === project.id)).toBe(true);
  });

  it("reject accept when sharing disabled", async () => {
    const state: State = {
      workspaces: {
        ws1: {
          id: "ws1",
          name: "X",
          workspace_type: "PERSONAL",
          sharing_enabled: false,
          created_by: "user-a",
        },
      },
      members: [
        {
          workspace_id: "ws1",
          profile_id: "user-a",
          role: "OWNER",
          can_add: true,
          can_edit: true,
          can_delete: true,
          archived_at: null,
        },
      ],
      invites: [
        {
          id: "inv1",
          token: "tok-dead",
          workspace_id: "ws1",
          created_by: "user-a",
          email: null,
          role: "MEMBER",
          can_add: true,
          can_edit: true,
          can_delete: true,
          expires_at: new Date(Date.now() + 86400000).toISOString(),
          accepted_at: null,
        },
      ],
    };
    const supabase = createMockSupabase(state);
    await expect(acceptInvite(supabase, "tok-dead", "user-b")).rejects.toThrow(
      /Sharing is disabled/,
    );
  });

  it("rejects account invites without an email", async () => {
    const state: State = { workspaces: {}, members: [], invites: [] };
    const supabase = createMockSupabase(state);
    const project = await createProject(supabase, "user-a", "Trip");
    await setSharingEnabled(supabase, project.id, true);

    await expect(
      createInvite(supabase, project.id, "user-a", "", {
        canAdd: true,
        canEdit: false,
        canDelete: false,
      }),
    ).rejects.toThrow(/Invite email required/);
  });
});
