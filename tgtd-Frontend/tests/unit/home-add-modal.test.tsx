import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { HomeAddModal } from "@/components/home/home-add-modal";

afterEach(() => cleanup());

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({}),
}));

vi.mock("@togo-todo/backend", () => ({
  createProject: vi.fn(),
}));

vi.mock("@/components/items/quick-add-modal", () => ({
  QuickAddModal: ({
    workspaceId,
    initialText,
  }: {
    workspaceId: string;
    initialText?: string;
  }) => (
    <div data-testid="quick-add">
      ws:{workspaceId}:text:{initialText ?? ""}
    </div>
  ),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

describe("HomeAddModal", () => {
  it("lists projects then opens quick add", () => {
    render(
      <HomeAddModal
        open
        onClose={() => {}}
        userId="u1"
        projects={[
          { id: "w1", name: "Weekend" },
          { id: "w2", name: "Work" },
        ]}
        initialText="Bondi"
      />,
    );
    expect(screen.getByText(/Add to which project/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^Weekend$/i }));
    expect(screen.getByTestId("quick-add").textContent).toBe(
      "ws:w1:text:Bondi",
    );
  });
});
