import { describe, expect, it } from "vitest";
import { detectLanguage, runLanguageAgent } from "@/agents/language-agent";
import { formatClarifyReply, formatRecommendReply } from "@/agents/communication-agent";

describe("language-agent", () => {
  it("detects Vietnamese input independently from UI locale", async () => {
    expect(detectLanguage("Thêm hoạt động đi biển vào thứ bảy")).toBe("vi");
    await expect(
      runLanguageAgent({ message: "Please add a beach activity" }),
    ).resolves.toEqual({ language: "en" });
  });

  it("formats fallback planner replies in detected language", () => {
    expect(
      formatClarifyReply({ language: "vi", ambiguities: ["Thiếu ngày"] }),
    ).toContain("Vui lòng làm rõ:");
    expect(
      formatRecommendReply({ language: "vi", intent: "RECOMMEND_TASK", candidates: [] }),
    ).toContain("Chưa tìm thấy hoạt động phù hợp");
  });
});
