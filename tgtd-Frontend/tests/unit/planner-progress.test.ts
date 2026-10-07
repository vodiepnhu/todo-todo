// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import * as React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { PlannerProgress } from "@/components/chat/planner-progress";

describe("PlannerProgress", () => {
  it("shows playful bouncing indicator and smooth colored progress without cluttered icons/text", () => {
    const onStop = vi.fn();
    const { container } = render(
      React.createElement(PlannerProgress, {
        steps: [
          { step: "understand", status: "done" },
          { step: "draft", status: "active" },
        ],
        onStop,
      }),
    );

    // Shows title
    expect(container.textContent).toContain("Planner is plotting...");

    // Shows bouncing indicator ("cái nhảy nhảy")
    const bouncingIndicator = screen.getByTestId("planner-bouncing-indicator");
    expect(bouncingIndicator).toBeTruthy();
    expect(bouncingIndicator.className).toContain("motion-safe:animate-bounce");
    expect(bouncingIndicator.textContent).toBe("🪄");

    // Shows colored progress fill ("tô màu thành tiến trình")
    const progressFill = screen.getByTestId("planner-progress-fill");
    expect(progressFill).toBeTruthy();
    expect(progressFill.className).toContain("bg-gradient-to-r");

    // Shows progress percentage
    const percentBadge = screen.getByTestId("planner-progress-percent");
    expect(percentBadge).toBeTruthy();
    expect(percentBadge.textContent).toContain("%");

    fireEvent.click(screen.getByRole("button", { name: "Stop" }));
    expect(onStop).toHaveBeenCalledOnce();

    // Does NOT render cluttered icon buttons or repetitive step texts
    expect(screen.queryByTestId("planner-icon-understand")).toBeNull();
  });
});
