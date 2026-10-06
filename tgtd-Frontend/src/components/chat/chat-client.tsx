"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import type { WorkspaceMessage } from "@/types/database";
import { toast } from "sonner";
import { ChatModelBar } from "@/components/chat/chat-model-bar";
import { ChatHistoryMenu } from "@/components/chat/chat-history-menu";
import {
  formatBubbleTime,
  formatDayHeading,
  groupMessagesByDay,
} from "@/lib/chat/chat-history";
import { paths } from "@/lib/paths";

type LocalMessage = WorkspaceMessage & { pending?: boolean };

export function ChatClient({
  workspaceId,
  userId,
}: {
  workspaceId: string;
  userId: string;
}) {
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const timeZone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    [],
  );
  const dayGroups = useMemo(
    () => groupMessagesByDay(messages, timeZone) as {
      dayKey: string;
      messages: LocalMessage[];
    }[],
    [messages, timeZone],
  );

  async function load() {
    try {
      const res = await fetch(
        `/api/chat/messages?workspaceId=${encodeURIComponent(workspaceId)}`,
        { cache: "no-store" },
      );
      const json = (await res.json().catch(() => ({}))) as {
        messages?: WorkspaceMessage[];
        error?: string;
      };
      if (!res.ok) {
        toast.error(`Could not load chat: ${json.error || res.statusText}`);
        return;
      }
      setMessages(json.messages ?? []);
    } catch (e) {
      toast.error(
        `Could not load chat: ${e instanceof Error ? e.message : "network error"}`,
      );
    }
  }

  useEffect(() => {
    void load();
    let cancelled = false;
    let channel: ReturnType<ReturnType<typeof createClient>["channel"]> | null =
      null;
    try {
      const supabase = createClient();
      channel = supabase
        .channel(`chat-${workspaceId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "workspace_messages",
            filter: `workspace_id=eq.${workspaceId}`,
          },
          (payload) => {
            if (cancelled) return;
            const row = payload.new as WorkspaceMessage;
            setMessages((prev) => {
              if (prev.some((m) => m.id === row.id)) return prev;
              const withoutTemp = prev.filter(
                (m) =>
                  !(
                    m.pending &&
                    m.message_type === row.message_type &&
                    m.content === row.content
                  ),
              );
              return [...withoutTemp, row];
            });
          },
        )
        .subscribe();
    } catch {
      // ignore
    }
    return () => {
      cancelled = true;
      if (channel) {
        try {
          const supabase = createClient();
          void supabase.removeChannel(channel);
        } catch {
          /* ignore */
        }
      }
    };
  }, [workspaceId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  async function send(askPlanner = false) {
    const trimmed = text.trim();
    if (!trimmed) return;

    const outbound = askPlanner ? `@Planner ${trimmed}` : trimmed;
    const tempId = `temp-${crypto.randomUUID()}`;
    const optimistic: LocalMessage = {
      id: tempId,
      workspace_id: workspaceId,
      sender_profile_id: userId,
      message_type: "USER",
      content: outbound,
      reply_to_message_id: null,
      linked_entity_type: null,
      linked_entity_id: null,
      created_at: new Date().toISOString(),
      edited_at: null,
      deleted_at: null,
      pending: true,
    };

    setMessages((prev) => [...prev, optimistic]);
    setText("");
    setSending(true);
    setStatus(askPlanner ? "Planner is thinking…" : "Sending…");

    try {
      const res = await fetch("/api/ai/planner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          message: outbound,
          askPlanner,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        pendingId?: string;
        mocked?: boolean;
        model?: string;
      };
      if (!res.ok) throw new Error(json.error || `Send failed (${res.status})`);

      if (askPlanner) {
        if (json.mocked) {
          toast.message("Planner replied with a mock model (no API key)");
        } else if (json.model) {
          toast.success(`Planner replied (${json.model})`);
        }
        if (json.pendingId) {
          toast.message("Draft ready — tap Confirm in the chat bubble");
        }
      } else {
        toast.message("Posted to chat (no Planner). Use Ask Planner for AI.");
      }

      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to send");
      await load();
    } finally {
      setSending(false);
      setStatus(null);
    }
  }

  async function confirmPendingFromMessage(pendingId: string) {
    setStatus("Confirming…");
    try {
      const res = await fetch("/api/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pendingId }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Confirm failed");
        return;
      }
      if (json.pending?.state === "EXECUTED") {
        toast.success("Saved");
        window.dispatchEvent(new Event("planner:refresh"));
      } else {
        toast.error("Confirm did not complete");
      }
      await load();
    } finally {
      setStatus(null);
    }
  }

  return (
    <div className="flex h-[calc(100dvh-8rem)] flex-col gap-3 md:h-[calc(100dvh-6rem)]">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-2xl font-semibold">Chat</h2>
        <ChatHistoryMenu
          workspaceId={workspaceId}
          messages={messages}
          onCleared={() => void load()}
        />
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto rounded-2xl border border-border/80 bg-surface/70 p-3">
        {messages.length === 0 && !status && (
          <p className="text-sm text-muted">
            Say hi, or ask Planner:{" "}
            <code className="rounded bg-primary-soft px-1">
              @Planner add IKEA Tempe for Saturday
            </code>
          </p>
        )}
        {dayGroups.map((group) => (
          <div key={group.dayKey} className="space-y-2">
            <p className="sticky top-0 z-10 py-1 text-center text-[11px] font-medium uppercase tracking-wide text-muted">
              {formatDayHeading(group.dayKey, timeZone)}
            </p>
            {group.messages.map((m) => (
              <div
                key={m.id}
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                  m.message_type === "USER"
                    ? m.sender_profile_id === userId
                      ? "ml-auto bg-cta text-white"
                      : "bg-primary-soft text-foreground"
                    : m.message_type === "AI"
                      ? "bg-primary-soft text-foreground"
                      : "bg-primary-soft/50 text-muted italic"
                } ${m.pending ? "opacity-70" : ""}`}
              >
                <p className="whitespace-pre-wrap">{m.content}</p>
                <p
                  className={`mt-1 text-[10px] ${
                    m.message_type === "USER" && m.sender_profile_id === userId
                      ? "text-white/80"
                      : "text-muted"
                  }`}
                >
                  {formatBubbleTime(m.created_at, timeZone)}
                </p>
                {m.linked_entity_type === "pending_action" &&
                  m.linked_entity_id && (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="mt-2"
                      onClick={() =>
                        confirmPendingFromMessage(m.linked_entity_id!)
                      }
                    >
                      Confirm
                    </Button>
                  )}
              </div>
            ))}
          </div>
        ))}
        {status && (
          <p className="text-xs italic text-muted" aria-live="polite">
            {status}
          </p>
        )}
        <div ref={bottomRef} />
      </div>
      <Card className="space-y-2 p-3">
        <ChatModelBar settingsHref={paths.accountLlm()} />
        <Textarea
          placeholder="Ask Planner… (Shift+Enter for newline). Send = message others only."
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={sending}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send(true);
            }
          }}
        />
        <div className="flex gap-2">
          <Button
            className="flex-1"
            disabled={sending}
            onClick={() => void send(true)}
          >
            {sending ? "Sending…" : "Ask Planner"}
          </Button>
          <Button
            variant="secondary"
            disabled={sending}
            onClick={() => void send(false)}
            title="Post to the shared chat without calling Planner"
          >
            Send only
          </Button>
        </div>
      </Card>
    </div>
  );
}
