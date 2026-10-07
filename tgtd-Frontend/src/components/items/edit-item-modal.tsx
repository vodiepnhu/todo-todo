"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  ActivityPlanPanel,
  type ActivityPlanSave,
  type EditItemModalMode,
} from "@/components/items/activity-plan-panel";
import type { Item } from "@/types/database";

export type { EditItemModalMode, ActivityPlanSave };
/** @deprecated Use ActivityPlanSave */
export type EditItemSavePayload = ActivityPlanSave;

export function EditItemModal({
  item,
  onClose,
  onSave,
  initialMode = "edit",
  projectName,
  onDelete,
  canEdit = true,
  canDelete = true,
}: {
  item: Item;
  onClose: () => void;
  onSave: (payload: ActivityPlanSave) => void | Promise<void>;
  initialMode?: EditItemModalMode;
  projectName?: string | null;
  onDelete?: (item: Item) => void | Promise<void>;
  canEdit?: boolean;
  canDelete?: boolean;
}) {
  const [mode, setMode] = useState<EditItemModalMode>(initialMode);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode, item.id]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-[2px]"
      data-testid="edit-item-modal"
      data-mode={mode}
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <ActivityPlanPanel
        item={item}
        mode={mode}
        onModeChange={setMode}
        onSave={onSave}
        onClose={onClose}
        openedAs={initialMode}
        projectName={projectName}
        onDelete={onDelete}
        canEdit={canEdit}
        canDelete={canDelete}
      />
    </div>,
    document.body,
  );
}
