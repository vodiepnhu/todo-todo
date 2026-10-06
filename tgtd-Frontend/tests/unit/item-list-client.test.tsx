import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import {
  render,
  screen,
  cleanup,
  waitFor,
  fireEvent,
} from "@testing-library/react";
import { ItemListClient } from "@/components/items/item-list-client";

afterEach(() => cleanup());

const sampleItem = {
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
  due_at: "2099-09-24T09:00:00+10:00",
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
  item_places: [],
};

vi.mock("@/components/confirmations/confirm-provider", () => ({
  useConfirm: () => ({ startConfirm: vi.fn(async () => undefined) }),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) },
    channel: () => ({
      on: function () {
        return this;
      },
      subscribe: () => ({}),
    }),
    removeChannel: async () => undefined,
    from: (table: string) => {
      if (table === "items") {
        return {
          select: () => ({
            eq: () => ({
              is: () => ({
                order: async () => ({ data: [sampleItem] }),
              }),
            }),
          }),
        };
      }
      if (table === "item_events") {
        return {
          select: () => ({
            eq: () => ({
              eq: async () => ({ data: [] }),
            }),
          }),
        };
      }
      return { select: () => ({ eq: async () => ({ data: [] }) }) };
    },
  }),
}));

vi.mock("@/services/plan-persist-service", () => ({
  loadPlanDraft: vi.fn(async () => ({
    placeName: "Bondi swim",
    categories: [],
    tags: [],
    location: null,
    googleMapsUrl: null,
    status: "PLANNING",
    plannedStartAt: null,
    activities: [],
    foodToTry: [],
    preparations: [],
    notes: [],
    todos: [],
    costs: [],
    travel: null,
    experience: null,
    food: null,
    sourceText: null,
  })),
  updatePlan: vi.fn(async () => undefined),
}));

describe("ItemListClient", () => {
  beforeEach(() => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (q: string) => ({
        matches: q.includes("768"),
        media: q,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }),
    });
  });

  it("opens and collapses the activity form from the card", async () => {
    render(<ItemListClient workspaceId="w1" title="Lists" />);
    await waitFor(() => {
      expect(screen.getByTestId("list-filter-all")).toBeTruthy();
    });
    expect(screen.getByTestId("list-filter-upcoming")).toBeTruthy();
    expect(screen.getByTestId("list-filter-visited")).toBeTruthy();
    expect(screen.queryByText("Done")).toBeNull();
    expect(screen.queryByText("With place")).toBeNull();
    await waitFor(() => expect(screen.getByTestId("item-open-i1")).toBeTruthy());
    expect(screen.queryByTestId("edit-item-enable-edit")).toBeNull();
    expect(screen.queryByTestId("item-status-i1")).toBeNull();
    expect(screen.queryByTestId("item-delete-i1")).toBeNull();
    fireEvent.click(screen.getByTestId("item-open-i1"));
    await waitFor(() => {
      expect(screen.getByTestId("edit-item-enable-edit")).toBeTruthy();
    });
    expect(screen.getByTestId("item-status-i1")).toBeTruthy();
    expect(screen.getByTestId("item-delete-i1")).toBeTruthy();
    expect(screen.queryByText("Select an activity")).toBeNull();
    fireEvent.click(screen.getByTestId("item-open-i1"));
    await waitFor(() => {
      expect(screen.queryByTestId("edit-item-enable-edit")).toBeNull();
    });
    expect(screen.queryByTestId("item-status-i1")).toBeNull();
    expect(screen.queryByTestId("item-delete-i1")).toBeNull();
  });
});
