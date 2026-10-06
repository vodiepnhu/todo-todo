import { describe, expect, it } from "vitest";
import {
  AuthorizationError,
  requireAuthenticatedUser,
} from "../../src/modules/auth/authorization";

describe("requireAuthenticatedUser", () => {
  it("rejects missing or blank IDs", () => {
    for (const value of [null, undefined, ""]) {
      expect(() => requireAuthenticatedUser(value)).toThrowError(
        expect.objectContaining({ code: "UNAUTHENTICATED" }),
      );
    }
  });

  it("returns valid user ID", () => {
    expect(requireAuthenticatedUser("user-1")).toBe("user-1");
  });

  it("exposes stable authorization error code", () => {
    const error = new AuthorizationError("FORBIDDEN", "Denied");
    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe("FORBIDDEN");
  });
});
