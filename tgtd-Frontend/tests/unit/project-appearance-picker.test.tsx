import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ProjectAppearancePicker } from "@/components/workspace/project-appearance-picker";

afterEach(() => {
  cleanup();
});

describe("ProjectAppearancePicker", () => {
  it("calls onIconChange / onColorChange when presets are clicked", () => {
    const onIconChange = vi.fn();
    const onColorChange = vi.fn();
    render(
      <ProjectAppearancePicker
        name="Japan Trip"
        icon=""
        color=""
        onIconChange={onIconChange}
        onColorChange={onColorChange}
      />,
    );
    expect(screen.getByText("Japan Trip")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Set icon ✈️" }));
    expect(onIconChange).toHaveBeenCalledWith("✈️");
    fireEvent.click(screen.getByRole("button", { name: "Set color #0ea5e9" }));
    expect(onColorChange).toHaveBeenCalledWith("#0ea5e9");
  });

  it("clear buttons wipe icon and color", () => {
    const onIconChange = vi.fn();
    const onColorChange = vi.fn();
    render(
      <ProjectAppearancePicker
        name="X"
        icon="✈️"
        color="#0ea5e9"
        onIconChange={onIconChange}
        onColorChange={onColorChange}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Clear icon" }));
    expect(onIconChange).toHaveBeenCalledWith("");
    fireEvent.click(screen.getByRole("button", { name: "Clear color" }));
    expect(onColorChange).toHaveBeenCalledWith("");
  });
});
