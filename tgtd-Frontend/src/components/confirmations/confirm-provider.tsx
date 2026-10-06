"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { ActionType, PendingAction } from "@/types/database";
import { toast } from "sonner";

type ConfirmContextValue = {
  startConfirm: (input: {
    actionType: ActionType;
    payload: Record<string, unknown>;
    before?: Record<string, unknown> | null;
    after?: Record<string, unknown> | null;
    baseVersion?: number | null;
    previewTitle: string;
    previewBody: string;
  }) => Promise<void>;
};

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm outside provider");
  return ctx;
}

export function ConfirmProvider({
  workspaceId,
  userId,
  children,
}: {
  workspaceId: string;
  userId: string;
  children: React.ReactNode;
}) {
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [preview, setPreview] = useState<{ title: string; body: string } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);

  const startConfirm = useCallback(
    async (input: {
      actionType: ActionType;
      payload: Record<string, unknown>;
      before?: Record<string, unknown> | null;
      after?: Record<string, unknown> | null;
      baseVersion?: number | null;
      previewTitle: string;
      previewBody: string;
    }) => {
      const supabase = createClient();
      const expires = new Date(Date.now() + 30 * 60_000).toISOString();
      const { data, error } = await supabase
        .from("pending_actions")
        .insert({
          workspace_id: workspaceId,
          action_type: input.actionType,
          payload_json: input.payload,
          before_json: input.before ?? null,
          after_json: input.after ?? null,
          base_entity_version: input.baseVersion ?? null,
          initiated_by: userId,
          state: "AWAITING_CONFIRM_2",
          expires_at: expires,
        })
        .select("*")
        .single();
      if (error) {
        toast.error(error.message);
        return;
      }
      setPending(data as PendingAction);
      setPreview({ title: input.previewTitle, body: input.previewBody });
    },
    [workspaceId, userId],
  );

  async function confirmOnce() {
    if (!pending) return;
    setBusy(true);
    try {
      const res = await fetch("/api/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pendingId: pending.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Confirm failed");
      if (json.pending?.state === "EXECUTED") {
        toast.success("Saved");
        setPending(null);
        setPreview(null);
        window.dispatchEvent(new Event("planner:refresh"));
      } else {
        throw new Error("Confirm did not complete");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    if (!pending) return;
    const supabase = createClient();
    await supabase
      .from("pending_actions")
      .update({ state: "CANCELLED" })
      .eq("id", pending.id);
    setPending(null);
    setPreview(null);
  }

  const value = useMemo(() => ({ startConfirm }), [startConfirm]);

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      {pending && preview && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 sm:items-center">
          <Card className="w-full max-w-md space-y-3 p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-primary">
              Confirm
            </p>
            <h2 className="text-lg font-semibold">{preview.title}</h2>
            <p className="whitespace-pre-wrap text-sm text-muted">
              {preview.body}
            </p>
            <p className="text-xs text-muted">Nothing has been saved yet.</p>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={confirmOnce} disabled={busy}>
                {busy ? "Saving…" : "Confirm"}
              </Button>
              <Button variant="outline" onClick={cancel} disabled={busy}>
                Cancel
              </Button>
            </div>
          </Card>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
