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
import {
  hasConfirmPendingMarker,
  isExecutedConfirmationResponse,
  latestConfirmableMessageIds,
  splitChatContent,
} from "@/lib/chat/chat-content";
import { paths } from "@/lib/paths";
import { useLocale } from "@/lib/i18n";
import { PlannerProgress } from "@/components/chat/planner-progress";
import { PlanDraftCard } from "@/components/chat/plan-draft-card";
import {
  consumePlannerStream,
  mergePlannerProgress,
  type PlannerProgressEvent,
} from "@/lib/chat/planner-stream";

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
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [progressSteps, setProgressSteps] = useState<PlannerProgressEvent[]>([]);
  const [confirmedPendingIds, setConfirmedPendingIds] = useState<Set<string>>(
    () => new Set(),
  );
  const { dictionary } = useLocale();
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
  const confirmableMessageIds = useMemo(
    () => latestConfirmableMessageIds(messages, confirmedPendingIds),
    [confirmedPendingIds, messages],
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
    setProgressSteps(
      askPlanner ? [{ step: "understand", status: "active" }] : [],
    );
    setStatus(askPlanner ? dictionary.chat.sending : dictionary.chat.sending);

    try {
      const res = await fetch("/api/ai/planner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          message: outbound,
          askPlanner,
          mode: "ask",
          stream: askPlanner,
        }),
      });
      const json = (askPlanner
        ? await consumePlannerStream(res, (event) =>
            setProgressSteps((current) => mergePlannerProgress(current, event)),
          )
        : await res.json().catch(() => ({}))) as {
        error?: string;
        pendingId?: string;
        confirmed?: boolean;
        pending?: { state?: string };
        mocked?: boolean;
        model?: string;
      };
      if (!res.ok) throw new Error(json.error || `Send failed (${res.status})`);

      if (json.pendingId && isExecutedConfirmationResponse(json)) {
        setConfirmedPendingIds((current) =>
          new Set(current).add(json.pendingId!),
        );
      }

      if (askPlanner) {
        if (json.mocked) {
          toast.message(
            "Planner used fallback model. Check Account > AI settings if needed.",
          );
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
      setProgressSteps([]);
    }
  }

  async function confirmPendingFromMessage(pendingId: string) {
    setConfirmingId(pendingId);
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
        setConfirmedPendingIds((current) =>
          new Set(current).add(pendingId),
        );
        toast.success("Saved");
        window.dispatchEvent(new Event("planner:refresh"));
      } else {
        toast.error("Confirm did not complete");
      }
      await load();
    } finally {
      setStatus(null);
      setConfirmingId(null);
    }
  }

  return (
    <div className="flex h-[calc(100dvh-8rem)] flex-col gap-3 md:h-[calc(100dvh-6rem)]">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-2xl font-semibold">{dictionary.chat.title}</h2>
        <ChatHistoryMenu
          workspaceId={workspaceId}
          messages={messages}
          onCleared={() => void load()}
        />
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto rounded-2xl border border-border/80 bg-surface/75 p-3.5 shadow-inner">
        {messages.length === 0 && !status && (
          <p className="text-sm text-muted">
            {dictionary.chat.empty}{" "}
            <code className="rounded bg-primary-soft px-1">
              @Planner add IKEA Tempe for Saturday
            </code>
          </p>
        )}
        {dayGroups.map((group) => (
          <div key={group.dayKey} className="space-y-3">
            <p className="sticky top-0 z-10 py-1 text-center text-[11px] font-semibold uppercase tracking-wider text-muted backdrop-blur-xs">
              {formatDayHeading(group.dayKey, timeZone)}
            </p>
            {group.messages.map((m) => {
              const isPlanDraft =
                m.message_type === "AI" &&
                (hasConfirmPendingMarker(m.content) ||
                  m.linked_entity_type === "pending_action");
              const isConfirmable =
                isPlanDraft &&
                confirmableMessageIds.has(m.id) &&
                Boolean(m.linked_entity_id);
              const isConfirmed =
                m.linked_entity_type === "pending_action" &&
                Boolean(m.linked_entity_id && confirmedPendingIds.has(m.linked_entity_id));
              const isConfirming =
                status === "Confirming…" && confirmingId === m.linked_entity_id;

              return (
                <div
                  key={m.id}
                  className={`max-w-[88%] rounded-2xl p-3 text-sm transition-all ${
                    m.message_type === "USER"
                      ? m.sender_profile_id === userId
                        ? "ml-auto bg-cta text-white shadow-xs rounded-tr-xs"
                        : "bg-surface border border-border text-foreground rounded-tl-xs shadow-xs"
                      : isPlanDraft
                        ? "w-full max-w-[95%] sm:max-w-[85%]"
                        : "bg-surface/90 border border-border/80 text-foreground shadow-xs rounded-tl-xs"
                  } ${m.pending ? "opacity-70" : ""}`}
                >
                  {isPlanDraft ? (
                    <PlanDraftCard
                      rawContent={m.content}
                      isConfirmable={isConfirmable}
                      isConfirmed={isConfirmed}
                      isConfirming={isConfirming}
                      onConfirm={() =>
                        m.linked_entity_id &&
                        confirmPendingFromMessage(m.linked_entity_id)
                      }
                    />
                  ) : (
                    <p className="whitespace-pre-wrap leading-relaxed">
                      {splitChatContent(m.content).map((segment, index) =>
                        segment.href ? (
                          <a
                            key={`${index}-${segment.text}`}
                            href={segment.href}
                            target="_blank"
                            rel="noreferrer"
                            className="underline underline-offset-2 font-medium"
                          >
                            {segment.text}
                          </a>
                        ) : (
                          <span key={`${index}-${segment.text}`}>{segment.text}</span>
                        ),
                      )}
                    </p>
                  )}
                  <p
                    className={`mt-1.5 text-[10px] ${
                      m.message_type === "USER" && m.sender_profile_id === userId
                        ? "text-white/80"
                        : "text-muted"
                    }`}
                  >
                    {formatBubbleTime(m.created_at, timeZone)}
                  </p>
                </div>
              );
            })}
          </div>
        ))}
        {sending && progressSteps.length > 0 && (
          <PlannerProgress steps={progressSteps} />
        )}
        {status && !sending && (
          <p className="text-xs italic text-muted" aria-live="polite">
            {status}
          </p>
        )}
        <div ref={bottomRef} />
      </div>
      <Card className="space-y-2 p-3">
        <ChatModelBar settingsHref={paths.accountLlm()} />
        <Textarea
          placeholder={dictionary.chat.plannerPlaceholder}
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
        <div>
          <Button
            className="w-full"
            disabled={sending}
            onClick={() => void send(true)}
          >
            {sending ? dictionary.chat.sending : dictionary.chat.askPlanner}
          </Button>
        </div>
      </Card>
    </div>
  );
}
