import { describe, expect, it } from "vitest";
import { parsePlannerMessage } from "@/lib/ai/openrouter";

const uid = "00000000-0000-0000-0000-000000000000";

describe("mock planner", () => {
  it("creates TOGO draft for place adds", async () => {
    const { request, mocked } = await parsePlannerMessage({
      message: "add IKEA Tempe for Saturday",
      currentDate: "2026-09-23",
      currentDatetime: "2026-09-23 17:00",
      workspaceTimezone: "Australia/Sydney",
      userId: uid,
    });
    expect(mocked).toBe(true);
    expect(request.intent).toBe("CREATE_ITEM");
    expect(request.items[0].itemType).toBe("ACTIVITY");
  });

  it("logs visit events", async () => {
    const { request } = await parsePlannerMessage({
      message: "we visited Manly yesterday",
      currentDate: "2026-09-23",
      currentDatetime: "2026-09-23 17:00",
      workspaceTimezone: "Australia/Sydney",
      userId: uid,
    });
    expect(request.intent).toBe("LOG_EVENT");
  });

  it("extracts natural-language destinations and reuses recent chat", async () => {
    const first = await parsePlannerMessage({
      message: "I want to visit Bondi Beach this Saturday afternoon and do the coastal walk",
      currentDate: "2026-09-23",
      currentDatetime: "2026-09-23 17:00",
      workspaceTimezone: "Australia/Sydney",
      userId: uid,
    });
    expect(first.request.items[0]?.placeQuery).toMatch(/Bondi Beach/i);

    const second = await parsePlannerMessage({
      message: "Add coastal walk and remind me to bring sunscreen",
      currentDate: "2026-09-23",
      currentDatetime: "2026-09-23 17:00",
      workspaceTimezone: "Australia/Sydney",
      userId: uid,
      recentChat: "USER: I want to go to Bondi Beach on Saturday.",
    });
    expect(second.request.intent).toBe("CREATE_ITEM");
    expect(second.request.items[0]?.placeQuery).toMatch(/Bondi Beach/i);
  });
});
