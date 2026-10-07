// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { ChatModeGuide } from "@/components/chat/chat-mode-guide";

describe("ChatModeGuide", () => {
  it("explains Ask mode and lets user switch to Add", () => {
    const onModeChange = vi.fn();

    render(
      createElement(ChatModeGuide, {
        mode: "ask",
        locale: "vi",
        onModeChange,
      }),
    );

    expect(screen.getByText("Hỏi")).toBeTruthy();
    expect(screen.getByText(/Không có gì được lưu/i)).toBeTruthy();

    fireEvent.click(screen.getByRole("tab", { name: /Thêm/i }));
    expect(onModeChange).toHaveBeenCalledWith("add");
  });

  it("explains Add mode before a draft can be saved", () => {
    render(
      createElement(ChatModeGuide, {
        mode: "add",
        locale: "en",
        onModeChange: () => undefined,
      }),
    );

    expect(screen.getByText("Add")).toBeTruthy();
    expect(screen.getByText(/draft before saving/i)).toBeTruthy();
  });
});
