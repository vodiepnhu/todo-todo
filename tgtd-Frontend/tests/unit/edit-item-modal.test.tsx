import { describe, expect, it, afterEach, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { EditItemModal } from "@/components/items/edit-item-modal";
import { emptyPlan } from "@/lib/plans/plan-schema";
import type { Item } from "@/types/database";

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({}),
}));

vi.mock("@/services/plan-persist-service", () => ({
  loadPlanDraft: vi.fn(async (_sb: unknown, itemId: string) => ({
    ...emptyPlan(),
    placeName: itemId === "i1" ? "Bondi swim" : "Place",
  })),
}));

afterEach(() => cleanup());

function item(partial: Partial<Item> = {}): Item {
  return {
    id: "i1",
    workspace_id: "w1",
    item_type: "ACTIVITY",
    subtype: "TASK",
    title: "Bondi swim",
    description: null,
    category: null,
    category_label: null,
    priority: null,
    status: "ACTIVE",
    repeat_mode: "ONE_OFF",
    due_at: "2026-09-24T09:00:00+10:00",
    planned_start_at: null,
    time_precision: "UNKNOWN",
    estimated_duration_min: 60,
    duration_source: null,
    plan_status: null,
    best_time: null,
    created_by: "u1",
    last_updated_by: null,
    version: 1,
    source_text: null,
    created_at: "",
    updated_at: "",
    deleted_at: null,
    ...partial,
  };
}

describe("EditItemModal view/edit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("opens in view mode with Edit and read-only place", async () => {
    render(
      <EditItemModal
        item={item()}
        initialMode="view"
        projectName="Sydney Weekends"
        onClose={() => undefined}
        onSave={async () => undefined}
      />,
    );
    expect(screen.getByTestId("edit-item-modal").getAttribute("data-mode")).toBe(
      "view",
    );
    expect(screen.getByText("Sydney Weekends")).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByDisplayValue("Bondi swim")).toBeTruthy();
    });
    expect(
      (screen.getByDisplayValue("Bondi swim") as HTMLInputElement).disabled,
    ).toBe(true);
    expect(screen.getByTestId("edit-item-enable-edit")).toBeTruthy();
    expect(screen.queryByTestId("edit-item-save")).toBeNull();
    expect(screen.getByRole("heading", { name: /WHEN/i })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /^FOOD$/i })).toBeTruthy();
  });

  it("unlocks fields when Edit is clicked", async () => {
    render(
      <EditItemModal
        item={item()}
        initialMode="view"
        onClose={() => undefined}
        onSave={async () => undefined}
      />,
    );
    await waitFor(() => screen.getByDisplayValue("Bondi swim"));
    fireEvent.click(screen.getByTestId("edit-item-enable-edit"));
    expect(screen.getByTestId("edit-item-modal").getAttribute("data-mode")).toBe(
      "edit",
    );
    expect(
      (screen.getByDisplayValue("Bondi swim") as HTMLInputElement).disabled,
    ).toBe(false);
    expect(screen.getByTestId("edit-item-save")).toBeTruthy();
  });
});
