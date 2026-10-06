"use client";

import { useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { HomeMessage, WorkspaceMessage } from "@/types/database";
import { dayKeyLocal, groupMessagesByDay } from "@/lib/chat/chat-history";
import { toast } from "sonner";

type PendingOption = { id: string; label: string };
type ChatMsg = WorkspaceMessage | HomeMessage;

export function ChatHistoryMenu({
  workspaceId,
  home,
  messages,
  onCleared,
}: {
  /** Project chat — clear via /api/chat/messages */
  workspaceId?: string;
  /** Home chat — clear via /api/home/messages */
  home?: boolean;
  messages: ChatMsg[];
  onCleared: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<"main" | "day" | "pending">("main");
  const [busy, setBusy] = useState(false);
  const timeZone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    [],
  );

  const days = useMemo(
    () =>
      groupMessagesByDay(messages as WorkspaceMessage[], timeZone)
        .map((g) => g.dayKey)
        .reverse(),
    [messages, timeZone],
  );

  const pendingOptions = useMemo(() => {
    if (home || !workspaceId) return [] as PendingOption[];
    const map = new Map<string, PendingOption>();
    for (const m of messages) {
      if (
        m.linked_entity_type === "pending_action" &&
        m.linked_entity_id &&
        !map.has(m.linked_entity_id)
      ) {
        const snippet = m.content.replace(/\s+/g, " ").slice(0, 48);
        map.set(m.linked_entity_id, {
          id: m.linked_entity_id,
          label: snippet || m.linked_entity_id.slice(0, 8),
        });
      }
    }
    return [...map.values()];
  }, [messages, home, workspaceId]);

  async function clear(
    body:
      | { mode: "all" }
      | { mode: "day"; dayKey: string }
      | { mode: "pending"; pendingId: string },
  ) {
    setBusy(true);
    try {
      const url = home ? "/api/home/messages" : "/api/chat/messages";
      const payload = home
        ? body.mode === "pending"
          ? null
          : {
              ...body,
              ...(body.mode === "day" ? { timeZone } : {}),
            }
        : {
            workspaceId,
            ...body,
            ...(body.mode === "day" ? { timeZone } : {}),
          };
      if (!payload) throw new Error("Unsupported clear mode");

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json().catch(() => ({}))) as {
        deleted?: number;
        error?: string;
      };
      if (!res.ok) throw new Error(json.error || "Clear failed");
      toast.success(
        json.deleted ? `Cleared ${json.deleted} messages` : "Nothing to clear",
      );
      setOpen(false);
      setPanel("main");
      onCleared();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Clear failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative">
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="gap-1.5"
        onClick={() => {
          setOpen((o) => !o);
          setPanel("main");
        }}
      >
        <Trash2 className="h-3.5 w-3.5" aria-hidden />
        Clear chat
      </Button>
      {open && (
        <Card className="absolute right-0 z-20 mt-1 w-64 space-y-1 p-2 shadow-lg">
          {panel === "main" && (
            <>
              <Button
                size="sm"
                variant="ghost"
                className="w-full justify-start"
                disabled={busy || messages.length === 0}
                onClick={() => {
                  if (
                    !window.confirm(
                      home
                        ? "Delete all home chat messages? Projects stay."
                        : "Soft-delete all chat messages in this workspace? Plans stay.",
                    )
                  ) {
                    return;
                  }
                  void clear({ mode: "all" });
                }}
              >
                Delete all chat
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="w-full justify-start"
                disabled={busy || days.length === 0}
                onClick={() => setPanel("day")}
              >
                Delete by day…
              </Button>
              {!home && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="w-full justify-start"
                  disabled={busy || pendingOptions.length === 0}
                  onClick={() => setPanel("pending")}
                >
                  Delete by confirmed task…
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={() => setOpen(false)}
              >
                Close
              </Button>
            </>
          )}
          {panel === "day" && (
            <>
              <p className="px-1 text-xs font-medium text-muted">Pick a day</p>
              {days.map((dayKey) => (
                <Button
                  key={dayKey}
                  size="sm"
                  variant="ghost"
                  className="w-full justify-start"
                  disabled={busy}
                  onClick={() => {
                    if (
                      !window.confirm(
                        `Soft-delete chat for ${dayKey}? Plans stay.`,
                      )
                    ) {
                      return;
                    }
                    void clear({ mode: "day", dayKey });
                  }}
                >
                  {dayKey}
                  {dayKey === dayKeyLocal(new Date().toISOString(), timeZone)
                    ? " (today)"
                    : ""}
                </Button>
              ))}
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={() => setPanel("main")}
              >
                Back
              </Button>
            </>
          )}
          {panel === "pending" && (
            <>
              <p className="px-1 text-xs font-medium text-muted">
                Chat thread for task (keeps the plan)
              </p>
              {pendingOptions.map((p) => (
                <Button
                  key={p.id}
                  size="sm"
                  variant="ghost"
                  className="w-full justify-start text-left"
                  disabled={busy}
                  onClick={() => {
                    if (
                      !window.confirm(
                        "Soft-delete chat for this task thread? The saved plan stays.",
                      )
                    ) {
                      return;
                    }
                    void clear({ mode: "pending", pendingId: p.id });
                  }}
                >
                  {p.label}
                </Button>
              ))}
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={() => setPanel("main")}
              >
                Back
              </Button>
            </>
          )}
        </Card>
      )}
    </div>
  );
}
