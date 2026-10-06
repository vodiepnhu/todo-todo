import { describe, expect, it } from "vitest";
import { formatRecommendReply } from "@/agents/communication-agent";

it("cites project name when map provided and strips semantic %", () => {
  const text = formatRecommendReply({
    intent: "RECOMMEND_PLACE",
    candidates: [
      {
        item: {
          id: "i1",
          title: "IKEA",
          item_type: "ACTIVITY",
          estimated_duration_min: 90,
        } as never,
        score: 1,
        reasons: ["Already planned", "semantic 80%"],
      },
    ],
    projectByItemId: new Map([["i1", "Couple"]]),
  });
  expect(text).toContain("Couple → IKEA");
  expect(text).toContain("Already planned");
  expect(text).not.toMatch(/semantic/i);
  expect(text).not.toMatch(/80%/);
});
