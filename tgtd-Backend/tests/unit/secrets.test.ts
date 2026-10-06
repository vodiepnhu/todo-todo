import { describe, expect, it, beforeAll, afterAll } from "vitest";
import {
  encryptSecret,
  decryptSecret,
  maskApiKey,
} from "@/lib/crypto/secrets";

describe("secret encryption", () => {
  const prev = process.env.APP_ENCRYPTION_SECRET;

  beforeAll(() => {
    process.env.APP_ENCRYPTION_SECRET = "test-secret-at-least-16";
  });

  afterAll(() => {
    if (prev === undefined) delete process.env.APP_ENCRYPTION_SECRET;
    else process.env.APP_ENCRYPTION_SECRET = prev;
  });

  it("round-trips API keys", () => {
    const key = "sk-or-v1-super-secret-key-abc123";
    const blob = encryptSecret(key);
    expect(blob).not.toContain(key);
    expect(decryptSecret(blob)).toBe(key);
  });

  it("masks for UI", () => {
    expect(maskApiKey("sk-abcdefgh").display).toBe("••••••••efgh");
  });
});
