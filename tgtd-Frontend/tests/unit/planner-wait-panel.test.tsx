import { describe, expect, it, vi, afterEach, beforeEach, afterAll } from "vitest";
import { render, screen, act, cleanup } from "@testing-library/react";
import { PlannerWaitPanel } from "@/components/ui/planner-wait-panel";

afterEach(() => cleanup());

describe("PlannerWaitPanel", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterAll(() => {
    vi.useRealTimers();
  });

  it("shows title and climbing percent", () => {
    render(<PlannerWaitPanel title="Planner is drafting your activity…" />);
    expect(screen.getByText(/Planner is drafting/i)).toBeTruthy();
    expect(screen.getByText(/6%/)).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    const pct = screen.getByText(/%$/);
    expect(pct.textContent).not.toBe("6%");
    const n = Number(pct.textContent?.replace("%", ""));
    expect(n).toBeGreaterThan(6);
    expect(n).toBeLessThanOrEqual(92);
  });
});
