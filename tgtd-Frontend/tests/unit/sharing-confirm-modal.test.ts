/* @vitest-environment jsdom */

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  SharingConfirmModal,
  type SharingInvite,
} from "@/components/home/sharing-confirm-modal";

const project = {
  id: "workspace-1",
  name: "Weekend",
  workspace_type: "PERSONAL" as const,
  sharing_enabled: false,
  created_by: "user-1",
  description: null,
  tags: [],
  icon: null,
  color: null,
  agentops_full_payload: false,
  created_at: "",
  updated_at: "",
};

describe("SharingConfirmModal", () => {
  it("creates view-only link without asking for an email", () => {
    const onConfirmView = vi.fn();
    const onConfirmShare = vi.fn<(invite: SharingInvite) => void>();

    render(
      React.createElement(SharingConfirmModal, {
        project,
        mode: "share",
        inviteUrl: null,
        busy: false,
        onCancel: vi.fn(),
        onConfirmShare,
        onConfirmView,
        onConfirmPrivate: vi.fn(),
        onDone: vi.fn(),
      }),
    );

    fireEvent.click(screen.getByTestId("sharing-choice-view"));
    expect(screen.queryByTestId("sharing-email")).toBeNull();
    fireEvent.click(screen.getByTestId("sharing-confirm-view"));

    expect(onConfirmView).toHaveBeenCalledOnce();
    expect(onConfirmShare).not.toHaveBeenCalled();
  });
});
