"use client";

import { useState } from "react";
import { AppShell } from "@/components/workspace/app-shell";
import { QuickAddModal } from "@/components/items/quick-add-modal";
import { ConfirmProvider } from "@/components/confirmations/confirm-provider";
import { createContext, useContext } from "react";

export type WorkspaceAccess = {
  canAdd: boolean;
  canEdit: boolean;
  canDelete: boolean;
};

const WorkspaceAccessContext = createContext<WorkspaceAccess>({
  canAdd: false,
  canEdit: false,
  canDelete: false,
});

export function useWorkspaceAccess() {
  return useContext(WorkspaceAccessContext);
}

export function WorkspaceLayoutClient({
  workspaceId,
  workspaceName,
  userId,
  access,
  children,
}: {
  workspaceId: string;
  workspaceName: string;
  userId: string;
  access: WorkspaceAccess;
  children: React.ReactNode;
}) {
  const [quickOpen, setQuickOpen] = useState(false);

  return (
    <WorkspaceAccessContext.Provider value={access}>
      <ConfirmProvider workspaceId={workspaceId} userId={userId}>
        <AppShell
          workspaceId={workspaceId}
          workspaceName={workspaceName}
          canAdd={access.canAdd}
          onQuickAdd={() => setQuickOpen(true)}
        >
          {children}
        </AppShell>
        {access.canAdd ? (
          <QuickAddModal
            open={quickOpen}
            onClose={() => setQuickOpen(false)}
            workspaceId={workspaceId}
            userId={userId}
          />
        ) : null}
      </ConfirmProvider>
    </WorkspaceAccessContext.Provider>
  );
}
