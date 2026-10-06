import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { HomeShell } from "@/components/home/home-shell";
import type { HomeTree } from "@/services/folder-service";
import { listHomeTree } from "@/services/folder-service";
import type { Workspace } from "@/types/database";
import {
  createInvite,
  setSharingEnabled,
} from "@togo-todo/backend";
import { listHomeActivityStats } from "@/lib/home-activity-stats";

afterEach(() => {
  cleanup();
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getUser: async () => ({ data: { user: { id: "u1" } } }),
    },
    from: (table: string) => {
      if (table === "items") {
        return {
          select: () => ({
            eq: () => ({
              is: () => ({
                maybeSingle: async () => ({
                  data: {
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
                  },
                  error: null,
                }),
              }),
            }),
          }),
          update: () => ({
            eq: () => ({
              eq: () => ({
                select: () => ({
                  maybeSingle: async () => ({ data: null, error: null }),
                }),
              }),
            }),
          }),
        };
      }
      return {};
    },
  }),
}));

vi.mock("@/services/folder-service", () => ({
  listHomeTree: vi.fn(),
}));

vi.mock("@togo-todo/backend", () => ({
  createProject: vi.fn(),
  setSharingEnabled: vi.fn(async (_sb: unknown, _id: string, enabled: boolean) => ({
    sharing_enabled: enabled,
  })),
  createInvite: vi.fn(async () => ({
    token: "invite-token-abc",
  })),
}));

vi.mock("@/lib/home-activity-stats", async () => {
  const actual = await vi.importActual<typeof import("@/lib/home-activity-stats")>(
    "@/lib/home-activity-stats",
  );
  return {
    ...actual,
    listHomeActivityStats: vi.fn(async () => ({
      byWorkspace: {
        w1: {
          activeCount: 2,
          next: {
            id: "i1",
            title: "Bondi swim",
            at: "2026-09-24T09:00:00+10:00",
          },
        },
        w2: { activeCount: 1, next: null },
      },
      today: [
        {
          id: "i1",
          title: "Bondi swim",
          at: "2026-09-24T09:00:00+10:00",
          workspaceId: "w1",
          workspaceName: "Weekend",
        },
      ],
    })),
  };
});

vi.mock("@/components/home/home-chat-client", () => ({
  HomeChatClient: ({
    userId,
    settingsHref,
  }: {
    userId: string;
    settingsHref: string | null;
  }) => (
    <div data-testid="home-chat">
      chat:{userId}:{settingsHref ?? "none"}
    </div>
  ),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

function ws(partial: Partial<Workspace> & Pick<Workspace, "id" | "name">): Workspace {
  return {
    created_by: "u1",
    workspace_type: "PERSONAL",
    sharing_enabled: false,
    description: null,
    tags: [],
    icon: "📌",
    color: "#0ea5e9",
    agentops_full_payload: false,
    created_at: "",
    updated_at: "",
    ...partial,
  };
}

const tree: HomeTree = {
  owned: [ws({ id: "w1", name: "Weekend" })],
  sharedWithMe: [
    ws({
      id: "w2",
      name: "Partner Board",
      color: "#a78bfa",
      icon: null,
      sharing_enabled: true,
      workspace_type: "SHARED",
    }),
  ],
};

describe("HomeShell cards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listHomeTree).mockResolvedValue(tree);
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn(async () => undefined) },
    });
  });

  it("renders project cards, add card, shared section, and chat below", async () => {
    render(<HomeShell userId="u1" initialTree={tree} />);
    expect(screen.getByText(/My projects/i)).toBeTruthy();
    expect(screen.getByRole("link", { name: /Weekend/i }).getAttribute("href")).toBe(
      "/projects/w1",
    );
    expect(screen.getByTestId("new-project-card")).toBeTruthy();
    expect(screen.getByText(/Shared with me/i)).toBeTruthy();
    expect(
      screen.getByRole("link", { name: /Partner Board/i }).getAttribute("href"),
    ).toBe("/projects/w2");
    expect(screen.getByTestId("home-chat").textContent).toBe(
      "chat:u1:/account/llm",
    );
    expect(
      screen.getAllByRole("link", { name: /^Account$/i })[0]?.getAttribute("href"),
    ).toBe("/account");
    expect(screen.queryByRole("link", { name: /^AI Provider$/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Projects$/i })).toBeNull();
    expect(screen.queryByTestId("agentops-card")).toBeNull();

    await waitFor(() => {
      expect(screen.getByTestId("today-strip")).toBeTruthy();
      expect(screen.getByText("Bondi swim")).toBeTruthy();
    });
    expect(listHomeActivityStats).toHaveBeenCalled();
  });

  it("shows Private toggle on owned cards and Shared badge on shared-with-me", async () => {
    render(<HomeShell userId="u1" initialTree={tree} />);
    const toggle = await screen.findByTestId("sharing-toggle-w1");
    expect(toggle.textContent).toMatch(/Private/i);
    expect(screen.queryByTestId("sharing-toggle-w2")).toBeNull();
    expect(screen.getByText(/^Shared$/)).toBeTruthy();
  });

  it("opens confirm modal before sharing and creates invite link", async () => {
    render(<HomeShell userId="u1" initialTree={tree} />);
    fireEvent.click(await screen.findByTestId("sharing-toggle-w1"));
    expect(screen.getByTestId("sharing-confirm-modal")).toBeTruthy();
    expect(setSharingEnabled).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("sharing-confirm-share"));
    await waitFor(() => {
      expect(setSharingEnabled).toHaveBeenCalledWith(expect.anything(), "w1", true);
      expect(createInvite).toHaveBeenCalledWith(expect.anything(), "w1", "u1");
    });
    await waitFor(() => {
      expect(screen.getByTestId("sharing-invite-url")).toBeTruthy();
    });
    expect(
      (screen.getByTestId("sharing-invite-url") as HTMLInputElement).value,
    ).toMatch(/\/join\/invite-token-abc$/);
    expect(screen.getByTestId("sharing-copy-link")).toBeTruthy();
  });

  it("does not toggle when share confirm is cancelled", async () => {
    render(<HomeShell userId="u1" initialTree={tree} />);
    fireEvent.click(await screen.findByTestId("sharing-toggle-w1"));
    fireEvent.click(screen.getByRole("button", { name: /^Cancel$/i }));
    expect(setSharingEnabled).not.toHaveBeenCalled();
    expect(screen.queryByTestId("sharing-confirm-modal")).toBeNull();
  });

  it("opens activity view modal when Today row is clicked", async () => {
    render(<HomeShell userId="u1" initialTree={tree} />);
    await waitFor(() => {
      expect(screen.getByText("Bondi swim")).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId("today-activity-i1"));
    await waitFor(() => {
      expect(screen.getByTestId("edit-item-modal")).toBeTruthy();
    });
    expect(screen.getByTestId("edit-item-modal").getAttribute("data-mode")).toBe(
      "view",
    );
    expect(screen.getByTestId("edit-item-enable-edit")).toBeTruthy();
  });

  it("opens inline create form from New project card", () => {
    render(<HomeShell userId="u1" initialTree={tree} />);
    fireEvent.click(screen.getByTestId("new-project-card"));
    expect(screen.getByPlaceholderText(/Project name/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Create$/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Cancel$/i })).toBeTruthy();
  });

  it("shows None when shared list is empty", () => {
    render(
      <HomeShell
        userId="u1"
        initialTree={{
          owned: [ws({ id: "w1", name: "Solo" })],
          sharedWithMe: [],
        }}
      />,
    );
    expect(screen.getByText(/^None$/)).toBeTruthy();
  });
});
