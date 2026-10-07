import { describe, expect, it } from "vitest";
import { parsePlannerMessage } from "@/lib/ai/openrouter";

const uid = "00000000-0000-0000-0000-000000000000";

describe("mock planner", () => {
  it("classifies food recommendations as read-only saved-data lookup", async () => {
    const { request } = await parsePlannerMessage({
      message: "I want to go somewhere for food, any recommendations?",
      currentDate: "2026-09-23",
      currentDatetime: "2026-09-23 17:00",
      workspaceTimezone: "Australia/Sydney",
      userId: uid,
    });

    expect(request.intent).toBe("RECOMMEND_TASK");
    expect(request.items).toHaveLength(0);
    expect(request.recommendationQuery).toContain("food");
  });

  it("ignores Home Add mode context when classifying a recommendation", async () => {
    const { request } = await parsePlannerMessage({
      message: "I want to go somewhere for food, any recommendations?\n\n(Context: Home Add mode — prefer CREATE_ITEM / saving an activity.)",
      currentDate: "2026-09-23",
      currentDatetime: "2026-09-23 17:00",
      workspaceTimezone: "Australia/Sydney",
      userId: uid,
    });

    expect(request.intent).toBe("RECOMMEND_TASK");
    expect(request.recommendationQuery).not.toContain("Home Add mode");
  });

  it("keeps explicit add requests mutable even when recommendation is mentioned", async () => {
    const { request } = await parsePlannerMessage({
      message: "Recommend a restaurant and add it to my plan",
      currentDate: "2026-09-23",
      currentDatetime: "2026-09-23 17:00",
      workspaceTimezone: "Australia/Sydney",
      userId: uid,
    });

    expect(request.intent).toBe("CREATE_ITEM");
  });

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

  it("keeps mock planner reply in detected Vietnamese", async () => {
    const { request } = await parsePlannerMessage({
      message: "Thêm đi biển vào thứ bảy",
      currentDate: "2026-09-23",
      currentDatetime: "2026-09-23 17:00",
      workspaceTimezone: "Australia/Sydney",
      userId: uid,
    });
    expect(request.reply).toContain("bản nháp hoạt động");
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

  it("keeps an open-ended place request in consultation mode", async () => {
    const { request } = await parsePlannerMessage({
      message: "I want a spot for a weekend walk for about an hour",
      currentDate: "2026-09-23",
      currentDatetime: "2026-09-23 17:00",
      workspaceTimezone: "Australia/Sydney",
      userId: uid,
    });

    expect(request.intent).toBe("RECOMMEND_PLACE");
    expect(request.items).toHaveLength(0);
  });

  it("routes Vietnamese where-to-go questions to recommendations, not project selection", async () => {
    const { request } = await parsePlannerMessage({
      message: "Đi đâu cuối tuần này, tôi có khoảng 1 tiếng",
      currentDate: "2026-09-23",
      currentDatetime: "2026-09-23 17:00",
      workspaceTimezone: "Australia/Sydney",
      userId: uid,
    });

    expect(request.intent).toBe("RECOMMEND_PLACE");
    expect(request.items).toHaveLength(0);
  });

  it("keeps Vietnamese health destination questions read-only", async () => {
    const { request } = await parsePlannerMessage({
      message: "Tôi muốn kiểm tra sức khoẻ, nên đi đâu",
      currentDate: "2026-09-23",
      currentDatetime: "2026-09-23 17:00",
      workspaceTimezone: "Australia/Sydney",
      userId: uid,
    });

    expect(request.intent).toBe("RECOMMEND_PLACE");
    expect(request.items).toHaveLength(0);
  });

  it("ignores collapsed Home Ask context when classifying recommendations", async () => {
    const { request } = await parsePlannerMessage({
      message:
        "Tôi muốn kiểm tra sức khoẻ, nên đi đâu (Context: Home Ask mode — consult first. Only an explicit add/save/schedule request may create a plan.)",
      currentDate: "2026-09-23",
      currentDatetime: "2026-09-23 17:00",
      workspaceTimezone: "Australia/Sydney",
      userId: uid,
    });

    expect(request.intent).toBe("RECOMMEND_PLACE");
    expect(request.recommendationQuery).toBe("Tôi muốn kiểm tra sức khoẻ, nên đi đâu");
  });

  it("classifies activity list questions as read-only", async () => {
    const { request } = await parsePlannerMessage({
      message: "Show all activities in Sydney (Context: Home Ask mode — consult first.)",
      currentDate: "2026-09-23",
      currentDatetime: "2026-09-23 17:00",
      workspaceTimezone: "Australia/Sydney",
      userId: uid,
    });

    expect(request.intent).toBe("LIST_ITEMS");
    expect(request.items).toHaveLength(0);
  });

  it("recognizes Vietnamese nearby-place suggestions as read-only", async () => {
    const { request } = await parsePlannerMessage({
      message: "Tôi muốn đi vòng ở Sydney, cỡ 3 tiếng, gợi ý cho tôi 2 chỗ gần nhau tôi có thể đi",
      currentDate: "2026-09-23",
      currentDatetime: "2026-09-23 17:00",
      workspaceTimezone: "Australia/Sydney",
      userId: uid,
    });

    expect(request.intent).toBe("RECOMMEND_TASK");
    expect(request.items).toHaveLength(0);
  });
});
