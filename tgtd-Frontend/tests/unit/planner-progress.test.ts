// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import * as React from "react";
import { render, screen } from "@testing-library/react";
import { PlannerProgress } from "@/components/chat/planner-progress";

describe("PlannerProgress", () => {
  it("shows playful icons and keeps motion on active step only", () => {
    const { container } = render(
      React.createElement(PlannerProgress, {
        steps: [
          { step: "understand", status: "done" },
          { step: "draft", status: "active" },
        ],
      }),
    );

    expect(screen.getByText("Reading your mind")).toBeTruthy();
    expect(screen.getAllByText("Making it look intentional").length).toBeGreaterThan(0);
    expect(screen.getByTestId("planner-icon-understand")).toBeTruthy();
    expect(screen.getByTestId("planner-icon-draft")).toBeTruthy();
    expect(screen.getByTestId("planner-icon-draft").className).toContain("motion-safe:animate-bounce");
    expect(screen.getByTestId("planner-icon-understand").className).not.toContain("motion-safe:animate-bounce");
    expect(screen.getAllByText("Making it look intentional").at(-1)?.parentElement?.getAttribute("aria-current")).toBe(
      "step",
    );
    expect(container.textContent).toContain("Planner is plotting...");
  });
});
