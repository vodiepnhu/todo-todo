"use client";

import { useState } from "react";
import { AppShell } from "@/components/workspace/app-shell";
import { QuickAddModal } from "@/components/items/quick-add-modal";
import { ConfirmProvider } from "@/components/confirmations/confirm-provider";

export function WorkspaceLayoutClient({
  workspaceId,
  workspaceName,
  userId,
  children,
}: {
  workspaceId: string;
  workspaceName: string;
  userId: string;
  children: React.ReactNode;
}) {
  const [quickOpen, setQuickOpen] = useState(false);

  return (
    <ConfirmProvider workspaceId={workspaceId} userId={userId}>
      <AppShell
        workspaceId={workspaceId}
        workspaceName={workspaceName}
        onQuickAdd={() => setQuickOpen(true)}
      >
        {children}
      </AppShell>
      <QuickAddModal
        open={quickOpen}
        onClose={() => setQuickOpen(false)}
        workspaceId={workspaceId}
        userId={userId}
      />
    </ConfirmProvider>
  );
}
