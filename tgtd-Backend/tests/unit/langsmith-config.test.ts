import { describe, expect, it } from "vitest";
import { readLangsmithConfig } from "@/lib/langsmith/config";

describe("readLangsmithConfig", () => {
  it("returns null when key missing", () => {
    expect(
      readLangsmithConfig({
        LANGSMITH_PROJECT: "stuart-ai",
      } as unknown as NodeJS.ProcessEnv),
    ).toBeNull();
  });

  it("reads key + project", () => {
    expect(
      readLangsmithConfig({
        LANGSMITH_API_KEY: "lsv2_x",
        LANGSMITH_PROJECT: "stuart-ai",
      } as unknown as NodeJS.ProcessEnv),
    ).toEqual({
      apiKey: "lsv2_x",
      project: "stuart-ai",
      endpoint: undefined,
    });
  });
});
