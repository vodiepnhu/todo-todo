import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createViewLink } from "@/services/workspace-service";

describe("public project view links", () => {
  it("creates a view-only link through the protected RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: "view-token",
      error: null,
    });
    const supabase = { rpc } as unknown as SupabaseClient;

    await expect(createViewLink(supabase, "workspace-1")).resolves.toEqual({
      token: "view-token",
    });
    expect(rpc).toHaveBeenCalledWith("create_workspace_view_link", {
      ws: "workspace-1",
    });
  });
});
