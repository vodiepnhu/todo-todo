import { describe, expect, it } from "vitest";
import { flattenOwned } from "@/lib/home-projects";
import type { HomeTree } from "@/services/folder-service";
import type { Workspace } from "@/types/database";

function ws(partial: Partial<Workspace> & Pick<Workspace, "id" | "name">): Workspace {
  return {
    created_by: "u1",
    workspace_type: "PERSONAL",
    sharing_enabled: false,
    description: null,
    tags: [],
    icon: null,
    color: null,
    agentops_full_payload: false,
    created_at: "",
    updated_at: "",
    ...partial,
  };
}

describe("flattenOwned", () => {
  it("returns owned sorted by name", () => {
    const tree: HomeTree = {
      owned: [
        ws({ id: "w2", name: "Zebra" }),
        ws({ id: "w1", name: "Alpha" }),
      ],
      sharedWithMe: [ws({ id: "w9", name: "Shared" })],
    };
    const owned = flattenOwned(tree);
    expect(owned.map((p) => p.id)).toEqual(["w1", "w2"]);
  });

  it("ignores sharedWithMe", () => {
    const tree: HomeTree = {
      owned: [],
      sharedWithMe: [ws({ id: "w9", name: "Shared" })],
    };
    expect(flattenOwned(tree)).toEqual([]);
  });
});
