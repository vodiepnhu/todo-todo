import { describe, expect, it } from "vitest";
import { cosineSimilarity, mockEmbed, EMBEDDING_DIM } from "@/services/embedding-service";
import { buildItemChunkText } from "@/services/rag-service";

describe("embedding-service", () => {
  it("returns fixed-dim normalized mock vectors", () => {
    const a = mockEmbed("buy milk");
    const b = mockEmbed("buy milk");
    const c = mockEmbed("completely different topic xyz");
    expect(a).toHaveLength(EMBEDDING_DIM);
    expect(cosineSimilarity(a, b)).toBeGreaterThan(0.99);
    expect(cosineSimilarity(a, c)).toBeLessThan(cosineSimilarity(a, b));
  });

  it("gives higher similarity for shared tokens", () => {
    const q = mockEmbed("grocery shopping");
    const hit = mockEmbed("Buy groceries at Woolies");
    const miss = mockEmbed("Schedule dentist appointment");
    expect(cosineSimilarity(q, hit)).toBeGreaterThan(cosineSimilarity(q, miss));
  });
});

describe("rag-service chunk text", () => {
  it("includes title and type", () => {
    const text = buildItemChunkText({
      title: "IKEA Tempe",
      item_type: "ACTIVITY",
      subtype: "TASK",
      description: "Get shelves",
      category_label: null,
    });
    expect(text).toContain("IKEA Tempe");
    expect(text).toContain("ACTIVITY");
    expect(text).toContain("Get shelves");
  });
});
