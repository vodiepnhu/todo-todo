// @vitest-environment jsdom
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HomePlacesSection } from "@/components/home/home-places-section";

describe("HomePlacesSection", () => {
  it("calls add handler from section button", () => {
    const onAdd = vi.fn();
    const onOpen = vi.fn();

    render(
      React.createElement(HomePlacesSection, {
        activities: [
          {
            id: "i1",
            title: "Bondi swim",
            workspaceName: "Weekend",
            at: "2026-09-24T09:00:00+10:00",
            planStatus: "PLANNING",
            categoryLabel: "Beach",
            estimatedDurationMin: 60,
          },
        ],
        locale: "en",
        onAdd,
        onOpen,
      }),
    );

    expect(screen.getByText("Places & Activities")).toBeTruthy();
    fireEvent.click(screen.getByTestId("home-places-add"));
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it("collapses long activity lists until user expands them", () => {
    const activities = Array.from({ length: 6 }, (_, index) => ({
      id: `i${index + 1}`,
      title: `Place ${index + 1}`,
      workspaceName: "Weekend",
      at: null,
      planStatus: "PLANNING" as const,
      categoryLabel: null,
      estimatedDurationMin: null,
    }));

    render(
      React.createElement(HomePlacesSection, {
        activities,
        locale: "en",
        onAdd: vi.fn(),
        onOpen: vi.fn(),
      }),
    );

    expect(screen.getByText("Place 1")).toBeTruthy();
    expect(screen.queryByText("Place 6")).toBeNull();

    fireEvent.click(screen.getByTestId("home-places-toggle"));

    expect(screen.getByText("Place 6")).toBeTruthy();
  });

  it("opens an activity when its row is clicked", () => {
    const onOpen = vi.fn();
    const activity = {
      id: "i1",
      title: "Bondi swim",
      workspaceName: "Weekend",
      at: null,
      planStatus: "PLANNING" as const,
      categoryLabel: "Beach",
      estimatedDurationMin: null,
    };

    render(
      React.createElement(HomePlacesSection, {
        activities: [activity],
        locale: "en",
        onAdd: vi.fn(),
        onOpen,
      }),
    );

    fireEvent.click(screen.getAllByTestId("home-place-activity-i1").at(-1)!);
    expect(onOpen).toHaveBeenCalledWith(activity);
  });

  it("filters skipped activities", () => {
    render(
      React.createElement(HomePlacesSection, {
        activities: [
          {
            id: "planning-1",
            title: "Planned place",
            workspaceName: "Weekend",
            at: null,
            planStatus: "PLANNING",
            categoryLabel: null,
            estimatedDurationMin: null,
          },
          {
            id: "skipped-1",
            title: "Skipped place",
            workspaceName: "Weekend",
            at: null,
            planStatus: "SKIPPED",
            categoryLabel: null,
            estimatedDurationMin: null,
          },
        ],
        locale: "en",
        onAdd: vi.fn(),
        onOpen: vi.fn(),
      }),
    );

    fireEvent.click(screen.getByRole("tab", { name: "Skipped (1)" }));

    expect(screen.getByText("Skipped place")).toBeTruthy();
    expect(screen.queryByText("Planned place")).toBeNull();
  });
});
