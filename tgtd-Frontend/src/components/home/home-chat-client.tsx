"use client";

import { useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import {
  insertHomeMessage,
  listHomeMessages,
} from "@/services/home-chat-service";
import type { HomeMessage } from "@/types/database";
import { toast } from "sonner";
import { ChatModelBar } from "@/components/chat/chat-model-bar";
import { ChatHistoryMenu } from "@/components/chat/chat-history-menu";
import { PlannerProgress } from "@/components/chat/planner-progress";
import { PlanDraftCard } from "@/components/chat/plan-draft-card";
import {
  consumePlannerStream,
  mergePlannerProgress,
  type PlannerProgressEvent,
} from "@/lib/chat/planner-stream";
import { useLocale } from "@/lib/i18n";
import { splitChatContent } from "@/lib/chat/chat-content";

type LocalMessage = HomeMessage & { pending?: boolean };

export function HomeChatClient({
  userId,
  settingsHref,
  onAdd,
  projects = [],
}: {
  userId: string;
  settingsHref: string | null;
  onAdd?: () => void;
  projects?: Array<{ id: string; name: string }>;
}) {
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [text, setText] = useState("");
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState("");
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [confirmedPendingIds, setConfirmedPendingIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [progressSteps, setProgressSteps] = useState<PlannerProgressEvent[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const { dictionary, locale } = useLocale();

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

    const addMode = /^\/add\b/i.test(trimmed);
    const plannerText = addMode ? trimmed.replace(/^\/add\s*/i, "") : trimmed;
    const outbound = addMode
      ? `/add ${plannerText}`.trim()
      : askPlanner
        ? `@Planner ${plannerText}`
        : plannerText;
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
    setProgressSteps(
      askPlanner ? [{ step: "understand", status: "active" }] : [],
    );
    setStatus(askPlanner ? "Planner is thinking across projects…" : "Sending…");

    try {
      const res = await fetch("/api/ai/home", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: outbound,
          askPlanner,
          mode: addMode ? "add" : "ask",
          workspaceId: selectedWorkspaceId || undefined,
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
        setConfirmedPendingIds((prev) => new Set(prev).add(pendingId));
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
    <div className="flex h-[calc(100dvh-6rem)] flex-col gap-3">
      {/* AI Planner Box matching mockup */}
      <div className="neu-card p-4.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl" aria-hidden>✨</span>
            <div>
              <h2 className="font-heading text-lg font-bold text-foreground">
                {locale === "vi" ? "Hỏi" : "Ask"}
              </h2>
              <p className="text-xs text-muted font-medium mt-0.5">
                {locale === "vi"
                  ? "Hỏi AI xem đi đâu, làm gì."
                  : "Ask AI where to go and what to do."}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <label className="sr-only" htmlFor="home-chat-scope">Chat scope</label>
            <select
              id="home-chat-scope"
              aria-label="Chat scope"
              value={selectedWorkspaceId}
              onChange={(event) => setSelectedWorkspaceId(event.target.value)}
              className="max-w-40 rounded-full border border-white/90 bg-white/90 px-3 py-1.5 text-xs font-bold text-foreground shadow-xs outline-none focus:border-primary focus:ring-2 focus:ring-primary/25"
            >
              <option value="">All projects</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>
            <Button
              type="button"
              size="sm"
              onClick={() => onAdd?.()}
              className="rounded-full shadow-xs"
            >
              <Plus className="h-4 w-4" aria-hidden />
              Add
            </Button>
            <ChatHistoryMenu
              home
              messages={messages}
              onCleared={() => void load()}
            />
          </div>
        </div>

        {/* Suggestion Chips */}
        <div className="mt-3.5 flex flex-wrap gap-2">
          {(locale === "vi"
            ? ["🌿 Tôi muốn chỗ đi dạo vào cuối tuần khoảng 1 tiếng"]
            : ["🌿 I want a spot for a weekend walk for about an hour"]
          ).map((chip) => {
            const promptText = chip.replace(/^[^\s]+\s*/, "");
            return (
              <button
                key={chip}
                type="button"
                onClick={() => setText(promptText)}
                className="rounded-full border border-white/90 bg-white/95 px-3 py-1.5 text-xs font-semibold text-muted shadow-[-2px_-2px_6px_rgba(255,255,255,0.9),2px_3px_8px_rgba(147,175,212,0.18)] transition hover:border-primary/40 hover:text-primary hover:-translate-y-0.5 active:scale-95 cursor-pointer"
              >
                {chip}
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-primary/15 bg-primary/5 px-3 py-2 text-xs font-semibold text-foreground">
          <span className="shrink-0 text-primary" aria-hidden>Tip</span>
          <p>
            {selectedWorkspaceId
              ? locale === "vi"
                ? <>Hỏi trong wishlist đã chọn. Gõ <code className="rounded bg-white/80 px-1.5 py-0.5 font-mono text-primary">/add</code> để thêm hoạt động.</>
                : <>Ask within the selected wishlist. Start with <code className="rounded bg-white/80 px-1.5 py-0.5 font-mono text-primary">/add</code> to add an activity.</>
              : locale === "vi"
                ? <>Hỏi để nhận gợi ý. Muốn thêm, dùng nút <strong>+ Add</strong> hoặc chọn wishlist trước.</>
                : <>Ask for suggestions. To add, use the <strong>+ Add</strong> button or select a wishlist first.</>}
          </p>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="neu-inset flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && !status && (
          <p className="text-[13px] text-muted">
            {dictionary.home.todaySummary}
          </p>
        )}
        {messages.map((m) => {
          const isPlanDraft =
            m.message_type === "AI" &&
            (Boolean(m.linked_entity_id) || m.content.includes("pending:"));
          const isConfirmed =
            Boolean(m.linked_entity_id && confirmedPendingIds.has(m.linked_entity_id));
          const isConfirmable =
            Boolean(m.linked_entity_id && !isConfirmed);
          const isConfirming =
            status === "Confirming…" && confirmingId === m.linked_entity_id;

          return (
            <div
              key={m.id}
              className={`max-w-[88%] rounded-2xl p-3.5 text-[13px] leading-relaxed transition-all ${
                m.message_type === "USER"
                  ? "ml-auto bg-gradient-to-r from-cta to-[#ff8a65] text-white shadow-[-2px_-2px_6px_rgba(255,255,255,0.7),2px_4px_10px_rgba(255,107,74,0.3)] rounded-tr-xs"
                  : isPlanDraft
                    ? "w-full max-w-[95%] sm:max-w-[88%]"
                    : "bg-white/95 border border-white/90 text-foreground shadow-[-2px_-2px_6px_rgba(255,255,255,0.9),2px_3px_8px_rgba(147,175,212,0.15)] rounded-tl-xs"
              } ${m.pending ? "opacity-70" : ""}`}
            >
              {isPlanDraft ? (
                <PlanDraftCard
                  rawContent={m.content}
                  isConfirmable={isConfirmable}
                  isConfirmed={isConfirmed}
                  isConfirming={isConfirming}
                  onConfirm={() =>
                    m.linked_entity_id && confirmPendingFromMessage(m.linked_entity_id)
                  }
                />
              ) : (
                <p className="whitespace-pre-wrap">
                  {splitChatContent(m.content).map((segment, index) =>
                    segment.href ? (
                      <a
                        key={`${index}-${segment.text}`}
                        href={segment.href}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-primary underline underline-offset-2 hover:text-cta"
                      >
                        {segment.text}
                      </a>
                    ) : (
                      <span key={`${index}-${segment.text}`}>{segment.text}</span>
                    ),
                  )}
                </p>
              )}
            </div>
          );
        })}
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

      {/* Composer Card */}
      <div className="neu-card space-y-2.5 p-3.5">
        <ChatModelBar settingsHref={settingsHref} />
        <Textarea
          placeholder={locale === "vi" ? "Hỏi AI xem đi đâu, làm gì…" : "Ask AI where to go and what to do…"}
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
            {sending ? dictionary.chat.sending : dictionary.chat.askPlanner}
          </Button>
        </div>
      </div>
    </div>
  );
}
