import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { AddToPlanForm } from "@/components/plans/add-to-plan-form";
import { emptyPlan } from "@/lib/plans/plan-schema";

afterEach(() => cleanup());

describe("AddToPlanForm", () => {
  it("renders section headings", () => {
    render(
      <AddToPlanForm
        value={emptyPlan()}
        onChange={() => {}}
        onCancel={() => {}}
        onSave={() => {}}
      />,
    );
    expect(screen.getByRole("heading", { name: /ADD TO PLAN/i })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /WHEN/i })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /TRAVEL/i })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /EXPERIENCE/i })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /THINGS TO DO/i })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /^FOOD$/i })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /^PREPARATION$/i })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /^TODO$/i })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /^COST$/i })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /^NOTES$/i })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: /^STATUS$/i })).toBeNull();
  });

  it("readOnly disables place name", () => {
    render(
      <AddToPlanForm
        value={{ ...emptyPlan(), placeName: "X" }}
        onChange={() => {}}
        onCancel={() => {}}
        onSave={() => {}}
        readOnly
      />,
    );
    expect(
      (screen.getByDisplayValue("X") as HTMLInputElement).disabled,
    ).toBe(true);
  });

  it("shows estimated total from costs", () => {
    const value = {
      ...emptyPlan(),
      costs: [
        {
          category: "food",
          estimatedAmount: 40,
          actualAmount: null,
          currency: "AUD",
          note: null,
        },
        {
          category: "transport",
          estimatedAmount: 20,
          actualAmount: null,
          currency: "AUD",
          note: null,
        },
      ],
    };
    render(
      <AddToPlanForm
        value={value}
        onChange={() => {}}
        onCancel={() => {}}
        onSave={() => {}}
      />,
    );
    expect(screen.getByText(/Estimated Total/i).textContent).toMatch(/60/);
  });

  it("Save calls onSave", () => {
    const onSave = vi.fn();
    render(
      <AddToPlanForm
        value={{ ...emptyPlan(), placeName: "Bondi" }}
        onChange={() => {}}
        onCancel={() => {}}
        onSave={onSave}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Save Plan/i }));
    expect(onSave).toHaveBeenCalled();
  });
});
