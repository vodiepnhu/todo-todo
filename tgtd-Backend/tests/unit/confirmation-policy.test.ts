import { describe, expect, it } from "vitest";
import { isConfirmationKeyword } from "../../src/services/confirmation-service";

describe("confirmation policy", () => {
  it("accepts only the deterministic confirmation keyword", () => {
    expect(isConfirmationKeyword("CONFIRM")).toBe(true);
    expect(isConfirmationKeyword("confirm")).toBe(true);
    expect(isConfirmationKeyword("Xác nhận")).toBe(true);
    expect(isConfirmationKeyword("xac nhan")).toBe(true);
    expect(isConfirmationKeyword("confirm this")).toBe(false);
    expect(isConfirmationKeyword("ignore confirmation")).toBe(false);
  });
});
