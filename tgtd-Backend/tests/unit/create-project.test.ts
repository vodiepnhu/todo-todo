import { describe, expect, it, vi } from "vitest";
import { createProject } from "@/services/workspace-service";

describe("createProject", () => {
  it("throws Error with PostgREST message (not opaque fallback)", async () => {
    const single = vi.fn().mockResolvedValue({
      data: null,
      error: {
        message:
          'new row violates row-level security policy for table "workspaces"',
        code: "42501",
        details: null,
        hint: null,
      },
    });
    const select = vi.fn(() => ({ single }));
    const insertWs = vi.fn(() => ({ select }));
    const insertMem = vi.fn();
    const from = vi.fn((table: string) => {
      if (table === "workspaces") return { insert: insertWs };
      return { insert: insertMem };
    });
    const supabase = { from } as never;

    let caught: unknown;
    try {
      await createProject(supabase, "user-1", "Trip");
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toContain("row-level security");
  });
});
