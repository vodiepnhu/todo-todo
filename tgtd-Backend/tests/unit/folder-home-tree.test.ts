import { describe, expect, it } from "vitest";
import { partitionHomeTree } from "@/services/folder-service";

describe("partitionHomeTree", () => {
  it("puts owned projects under owned; shared under sharedWithMe", () => {
    const memberships = [
      {
        role: "OWNER" as const,
        workspace: {
          id: "w1",
          name: "Weekend",
          created_by: "u1",
          workspace_type: "PERSONAL" as const,
          sharing_enabled: false,
          description: null,
          tags: [],
          icon: null,
          color: null,
          agentops_full_payload: false,
          created_at: "",
          updated_at: "",
        },
      },
      {
        role: "MEMBER" as const,
        workspace: {
          id: "w2",
          name: "Partner Board",
          created_by: "u2",
          workspace_type: "SHARED" as const,
          sharing_enabled: true,
          description: null,
          tags: [],
          icon: null,
          color: null,
          agentops_full_payload: false,
          created_at: "",
          updated_at: "",
        },
      },
      {
        role: "OWNER" as const,
        workspace: {
          id: "w3",
          name: "Errands",
          created_by: "u1",
          workspace_type: "PERSONAL" as const,
          sharing_enabled: false,
          description: null,
          tags: [],
          icon: null,
          color: null,
          agentops_full_payload: false,
          created_at: "",
          updated_at: "",
        },
      },
    ];
    const tree = partitionHomeTree("u1", memberships);
    expect(tree.owned.map((p) => p.id)).toEqual(["w3", "w1"]);
    expect(tree.sharedWithMe.map((p) => p.id)).toEqual(["w2"]);
  });
});
