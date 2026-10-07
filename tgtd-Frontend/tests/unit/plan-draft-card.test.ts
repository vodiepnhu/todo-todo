/* @vitest-environment jsdom */

import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PlanDraftCard } from "@/components/chat/plan-draft-card";

const { useLocale } = vi.hoisted(() => ({ useLocale: vi.fn() }));

vi.mock("@/lib/i18n", () => ({ useLocale }));

const rawContent = "📍 Bondi Beach\n📅 Tomorrow\n🎯 Walk along the shore\nType CONFIRM";
const fullRawContent = [
  "Draft: Sydney Opera House",
  "📍 Place: Sydney Opera House",
  "🏷 Category: landmark, viewpoint",
  "🔖 Tags: sunset, family",
  "📌 Location: Bennelong Point",
  "🗺️ Google Maps: https://www.google.com/maps/search/?api=1&query=Sydney%20Opera%20House",
  "📅 Date: 09 Oct 2026",
  "🕘 Time: 17:00",
  "🎯 Activities:",
  "- Watch sunset",
  "🧳 Preparation:",
  "- Bring a jacket",
  "🍴 Food:",
  "- Gelato",
  "🚗 Travel:",
  "- Duration: 30 min",
  "✨ Experience:",
  "- Duration: 90 min",
  "✅ To-dos:",
  "- Book tickets",
  "💰 Costs:",
  "- Entry: 20 AUD estimated",
  "📝 Notes:",
  "- Tip: Arrive early",
  "Missing or uncertain:",
  "- Travel time",
  "Type CONFIRM to save this plan.",
  "[Confirm] pending:p1",
].join("\n");

describe("PlanDraftCard", () => {
  afterEach(cleanup);

  beforeEach(() => {
    useLocale.mockReturnValue({
      locale: "en",
      dictionary: {
        chat: {
          planDraft: {
            saved: "Saved plan",
            saving: "Saving plan…",
            confirm: "Confirm plan",
            moreInfo: "More info",
            title: "Plan draft",
            missing: "Missing information:",
            foodToTry: "Food to try:",
            category: "Category",
            tags: "Tags",
            preparation: "Preparation",
            activities: "Activities",
            travel: "Travel",
            experience: "Experience",
            todos: "To-dos",
            costs: "Costs",
            notes: "Notes",
          },
        },
      },
    });
  });

  it("removes the experience chips and keeps draft details", () => {
    render(
      React.createElement(PlanDraftCard, {
        rawContent,
        isConfirmable: true,
        isConfirmed: false,
        isConfirming: false,
        onConfirm: vi.fn(),
      }),
    );

    expect(screen.getByText("Plan draft")).toBeTruthy();
    expect(screen.getByText("Bondi Beach")).toBeTruthy();
    expect(screen.queryByText(/experience|hoạt động trải nghiệm/i)).toBeNull();
    expect(screen.getByRole("button", { name: "Confirm plan" })).toBeTruthy();
  });

  it("uses Vietnamese labels without English duplicates", () => {
    useLocale.mockReturnValue({
      locale: "vi",
      dictionary: {
        chat: {
          planDraft: {
            saved: "Đã lưu kế hoạch",
            saving: "Đang lưu kế hoạch…",
            confirm: "Xác nhận kế hoạch",
            moreInfo: "Thêm thông tin",
            title: "Bản nháp kế hoạch",
            missing: "Thông tin còn thiếu:",
            foodToTry: "Món ngon nên thử:",
            category: "Danh mục",
            tags: "Thẻ",
            preparation: "Chuẩn bị",
            activities: "Hoạt động",
            travel: "Di chuyển",
            experience: "Trải nghiệm",
            todos: "Việc cần làm",
            costs: "Chi phí",
            notes: "Ghi chú",
          },
        },
      },
    });

    render(
      React.createElement(PlanDraftCard, {
        rawContent,
        isConfirmable: true,
        isConfirmed: false,
        isConfirming: false,
        onConfirm: vi.fn(),
      }),
    );

    expect(screen.getByText("Bản nháp kế hoạch")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Xác nhận kế hoạch" })).toBeTruthy();
    expect(screen.queryByText(/Plan Draft|Confirm Plan/i)).toBeNull();
  });

  it("renders every canonical form section and keeps Maps clickable", () => {
    render(
      React.createElement(PlanDraftCard, {
        rawContent: fullRawContent,
        isConfirmable: true,
        isConfirmed: false,
        isConfirming: false,
        onConfirm: vi.fn(),
      }),
    );

    expect(screen.getByText(/landmark/)).toBeTruthy();
    expect(screen.getByText(/viewpoint/)).toBeTruthy();
    expect(screen.getAllByText(/sunset/).length).toBeGreaterThan(0);
    expect(screen.getByText(/family/)).toBeTruthy();
    expect(screen.getByText("Bennelong Point")).toBeTruthy();
    expect(screen.getByText("Bring a jacket")).toBeTruthy();
    expect(screen.getByText("Duration: 30 min")).toBeTruthy();
    expect(screen.getByText("Duration: 90 min")).toBeTruthy();
    expect(screen.getByText("Book tickets")).toBeTruthy();
    expect(screen.getByText("Entry: 20 AUD estimated")).toBeTruthy();
    expect(screen.getByText("Tip: Arrive early")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Maps/ }).getAttribute("href")).toBe(
      "https://www.google.com/maps/search/?api=1&query=Sydney%20Opera%20House",
    );
  });

  it("offers more info without replacing confirm", () => {
    const onMoreInfo = vi.fn();
    useLocale.mockReturnValue({
      locale: "vi",
      dictionary: {
        chat: {
          planDraft: {
            saved: "Đã lưu kế hoạch",
            saving: "Đang lưu kế hoạch…",
            confirm: "Xác nhận kế hoạch",
            moreInfo: "Thêm thông tin",
            title: "Bản nháp kế hoạch",
            missing: "Thông tin còn thiếu:",
            foodToTry: "Món ngon nên thử:",
            category: "Danh mục",
            tags: "Thẻ",
            preparation: "Chuẩn bị",
            activities: "Hoạt động",
            travel: "Di chuyển",
            experience: "Trải nghiệm",
            todos: "Việc cần làm",
            costs: "Chi phí",
            notes: "Ghi chú",
          },
        },
      },
    });
    render(
      React.createElement(PlanDraftCard, {
        rawContent: fullRawContent,
        isConfirmable: true,
        isConfirmed: false,
        isConfirming: false,
        onConfirm: vi.fn(),
        onMoreInfo,
      }),
    );

    screen.getByRole("button", { name: "Thêm thông tin" }).click();
    expect(onMoreInfo).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Xác nhận kế hoạch" })).toBeTruthy();
  });
});
