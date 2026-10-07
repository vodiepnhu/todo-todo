"use client";

import type { Locale } from "@/lib/i18n";

export type ChatMode = "ask" | "add";

const COPY = {
  en: {
    ask: "Ask",
    add: "Add",
    askHint: "Ask questions or get suggestions from your saved plans. Nothing is saved.",
    addHint: "Add a place or activity. Planner prepares a draft before saving.",
    askExample: "Try: Where should I go this weekend?",
    addExample: "Try: Add Opera House for Saturday",
  },
  vi: {
    ask: "Hỏi",
    add: "Thêm",
    askHint: "Hỏi đáp hoặc nhận gợi ý từ các kế hoạch đã lưu. Không có gì được lưu.",
    addHint: "Thêm địa điểm hoặc hoạt động. Planner tạo bản nháp trước khi lưu.",
    askExample: "Thử: Cuối tuần này tôi nên đi đâu?",
    addExample: "Thử: Thêm Opera House vào thứ bảy",
  },
} as const;

export function ChatModeGuide({
  mode,
  locale,
  onModeChange,
}: {
  mode: ChatMode;
  locale: Locale;
  onModeChange: (mode: ChatMode) => void;
}) {
  const copy = COPY[locale];
  const isAsk = mode === "ask";

  return (
    <div className="rounded-2xl border border-primary/15 bg-primary-soft/45 p-2.5">
      <div
        className="flex gap-1 rounded-xl bg-white/70 p-1 shadow-xs"
        role="tablist"
        aria-label={locale === "vi" ? "Chế độ chat" : "Chat mode"}
      >
        {(["ask", "add"] as const).map((value) => {
          const active = mode === value;
          return (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onModeChange(value)}
              className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                active
                  ? "bg-primary text-white shadow-sm"
                  : "text-muted hover:bg-white hover:text-foreground"
              }`}
            >
              {value === "ask" ? copy.ask : copy.add}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-xs font-semibold text-foreground">
        {isAsk ? copy.askHint : copy.addHint}
      </p>
      <p className="mt-1 text-[11px] text-muted">
        {isAsk ? copy.askExample : copy.addExample}
      </p>
    </div>
  );
}
