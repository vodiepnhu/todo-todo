"use client";

import {
  Check,
  type LucideIcon,
  Brain,
  MessagesSquare,
  MapPinned,
  WandSparkles,
  ShieldCheck,
  Crown,
} from "lucide-react";
import type { PlannerProgressEvent } from "@/lib/chat/planner-stream";
import { cn } from "@/lib/utils";
import { useLocale, type Dictionary } from "@/lib/i18n";

const STEPS: Array<{
  step: PlannerProgressEvent["step"];
  key: keyof Dictionary["chat"]["progress"];
  icon: LucideIcon;
}> = [
  { step: "understand", key: "understand", icon: Brain },
  { step: "context", key: "context", icon: MessagesSquare },
  { step: "places", key: "places", icon: MapPinned },
  { step: "draft", key: "draft", icon: WandSparkles },
  { step: "check", key: "check", icon: ShieldCheck },
  { step: "save", key: "save", icon: Crown },
];

const FUNNY_STEP_EMOJIS: Record<PlannerProgressEvent["step"], string> = {
  understand: "🔮", // Đọc vị ý tưởng
  context: "🕵️",    // Hóng hớt dự án
  places: "📍",     // Triệu hồi địa điểm
  draft: "🪄",      // Phù phép lịch trình
  check: "🛡️",      // Phòng chống drama
  save: "👑",       // Chờ ngài phê duyệt
  complete: "🎉",   // Hoàn thành
};

export function PlannerProgress({
  steps,
}: {
  steps: PlannerProgressEvent[];
}) {
  const { dictionary } = useLocale();
  const state = new Map(steps.map((event) => [event.step, event.status]));
  const active = steps.find((event) => event.status === "active")?.step;
  const activeIndex = STEPS.findIndex((s) => s.step === active);
  const activeStepObj = STEPS[activeIndex >= 0 ? activeIndex : 0];
  const activeEmoji = active ? FUNNY_STEP_EMOJIS[active] : "🧭";

  const doneCount = steps.filter((s) => s.status === "done").length;
  const railProgressPct = Math.min(
    100,
    Math.max(8, (((activeIndex >= 0 ? activeIndex : doneCount) + 0.5) / STEPS.length) * 100),
  );

  return (
    <div
      className="neu-card overflow-hidden p-3.5 transition-all duration-200"
      role="status"
      aria-live="polite"
    >
      {/* Top row: Animated funny emoji + active step quote + counter */}
      <div className="mb-2.5 flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xl motion-safe:animate-bounce" aria-hidden="true">
            {activeEmoji}
          </span>
          <div className="min-w-0">
            <span className="text-[10px] font-black uppercase tracking-wider text-primary">
              {dictionary.chat.progress.title}
            </span>
            <p className="truncate text-xs font-extrabold text-foreground">
              {active ? dictionary.chat.progress[activeStepObj.key] : "..."}
            </p>
          </div>
        </div>
        <span className="rounded-full bg-primary-soft px-2.5 py-0.5 text-[11px] font-extrabold text-primary shrink-0 shadow-2xs">
          {activeIndex >= 0 ? `${activeIndex + 1} / ${STEPS.length}` : `${doneCount} / ${STEPS.length}`}
        </span>
      </div>

      {/* Stepper Rail (Compact Flight Track) */}
      <div className="neu-inset relative flex items-center justify-between px-3 py-2">
        {/* Rail background bar */}
        <div className="absolute inset-x-6 top-1/2 h-1 -translate-y-1/2 rounded-full bg-slate-200" />
        {/* Progress highlight bar */}
        <div
          className="absolute left-6 top-1/2 h-1 -translate-y-1/2 rounded-full bg-gradient-to-r from-primary via-secondary to-cta transition-all duration-300"
          style={{ width: `calc(${railProgressPct}% - 1.5rem)` }}
        />

        {STEPS.map(({ step, key }) => {
          const status = state.get(step);
          const isActive = active === step;
          return (
            <div
              key={step}
              aria-current={isActive ? "step" : undefined}
              className="relative z-10 flex flex-col items-center"
            >
              <span
                data-testid={`planner-icon-${step}`}
                className={cn(
                  "grid size-7 shrink-0 place-items-center rounded-full border text-xs transition-all duration-200",
                  status === "done" && "border-mint bg-mint text-white shadow-xs",
                  isActive &&
                    "border-cta bg-cta text-white shadow-md ring-4 ring-cta/25 motion-safe:animate-bounce scale-110",
                  !status && "border-slate-200 bg-white text-muted",
                )}
                aria-hidden="true"
              >
                {status === "done" ? (
                  <Check className="size-3.5 stroke-[3]" />
                ) : (
                  <span>{FUNNY_STEP_EMOJIS[step]}</span>
                )}
              </span>
              <span className="sr-only sm:not-sr-only sm:mt-1 sm:text-[9.5px] sm:font-bold sm:text-muted truncate max-w-[55px] text-center">
                {dictionary.chat.progress[key]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
