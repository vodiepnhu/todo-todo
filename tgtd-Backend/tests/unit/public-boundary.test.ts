import { describe, expect, it } from "vitest";
import * as backend from "@togo-todo/backend";

describe("backend public boundary", () => {
  it("exports intentional auth, profile, workspace, and Home APIs", () => {
    expect(typeof backend.getAuthenticatedUserId).toBe("function");
    expect(typeof backend.requireAuthenticatedUser).toBe("function");
    expect(typeof backend.getProfile).toBe("function");
    expect(typeof backend.createProfileRepository).toBe("function");
    expect(typeof backend.listUserWorkspaces).toBe("function");
    expect(typeof backend.createWorkspaceRepository).toBe("function");
    expect(typeof backend.listHomeTree).toBe("function");
  });

  it("does not export privileged or seed internals", () => {
    expect("createAdminClient" in backend).toBe(false);
    expect("assertDemoSeedAllowed" in backend).toBe(false);
  });
});
