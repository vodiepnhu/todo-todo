"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  insertHomeMessage,
  listHomeMessages,
} from "@/services/home-chat-service";
import type { HomeMessage } from "@/types/database";
import { toast } from "sonner";
import { ChatModelBar } from "@/components/chat/chat-model-bar";
import { ChatHistoryMenu } from "@/components/chat/chat-history-menu";

type LocalMessage = HomeMessage & { pending?: boolean };

export function HomeChatClient({
  userId,
  settingsHref,
}: {
  userId: string;
  settingsHref: string | null;
}) {
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function load() {
    try {
      const supabase = createClient();
      setMessages(await listHomeMessages(supabase, userId));
    } catch (e) {
      toast.error(
        `Could not load home chat: ${e instanceof Error ? e.message : "error"}`,
      );
    }
  }

  useEffect(() => {
    void load();
  }, [userId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  async function send(askPlanner = true) {
    const trimmed = text.trim();
    if (!trimmed) return;

    const outbound = askPlanner ? `@Planner ${trimmed}` : trimmed;
    const tempId = `temp-${crypto.randomUUID()}`;
    const optimistic: LocalMessage = {
      id: tempId,
      profile_id: userId,
      message_type: "USER",
      content: outbound,
      linked_entity_type: null,
      linked_entity_id: null,
      created_at: new Date().toISOString(),
      deleted_at: null,
      pending: true,
    };

    setMessages((prev) => [...prev, optimistic]);
    setText("");
    setSending(true);
    setStatus(askPlanner ? "Planner is thinking across projects…" : "Sending…");

    try {
      const res = await fetch("/api/ai/home", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: outbound, askPlanner, mode: "ask" }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        pendingId?: string;
      };
      if (!res.ok) throw new Error(json.error || `Send failed (${res.status})`);
      if (json.pendingId) {
        toast.message("Draft ready — tap Confirm in the chat bubble");
      }
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to send");
      try {
        const supabase = createClient();
        await insertHomeMessage(supabase, {
          profileId: userId,
          content: outbound,
        });
      } catch {
        /* ignore */
      }
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
      } else {
        toast.error("Confirm did not complete");
      }
      await load();
    } finally {
      setStatus(null);
    }
  }

  return (
    <div className="flex h-[calc(100dvh-6rem)] flex-col gap-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-xl font-semibold">Home chat</h2>
          <span className="rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-medium text-foreground">
            All projects
          </span>
        </div>
        <ChatHistoryMenu
          home
          messages={messages}
          onCleared={() => void load()}
        />
      </div>
      <div className="flex-1 space-y-1.5 overflow-y-auto rounded-2xl border border-border/80 bg-surface/70 p-2.5">
        {messages.length === 0 && !status && (
          <p className="text-[13px] text-muted">
            Ask across every project. Mutations will ask which project to use.
          </p>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`max-w-[88%] rounded-2xl px-3 py-1.5 text-[13px] leading-5 ${
              m.message_type === "USER"
                ? "ml-auto bg-cta text-white"
                : m.message_type === "AI"
                  ? "bg-primary-soft text-foreground"
                  : "bg-primary-soft/50 text-muted italic"
            } ${m.pending ? "opacity-70" : ""}`}
          >
            <p className="whitespace-pre-wrap">{m.content}</p>
            {m.linked_entity_type === "pending_action" && m.linked_entity_id && (
              <Button
                size="sm"
                variant="secondary"
                className="mt-2"
                onClick={() => confirmPendingFromMessage(m.linked_entity_id!)}
              >
                Confirm
              </Button>
            )}
          </div>
        ))}
        {status && (
          <p className="text-xs italic text-muted" aria-live="polite">
            {status}
          </p>
        )}
        <div ref={bottomRef} />
      </div>
      <Card className="space-y-2 p-2.5">
        <ChatModelBar settingsHref={settingsHref} />
        <Textarea
          placeholder="Ask across all projects…"
          value={text}
          className="text-[13px] leading-5"
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
            className="w-full"
            disabled={sending}
            onClick={() => void send(true)}
          >
            {sending ? "Sending…" : "Ask Planner"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
