"use client";

import type { PlannerProgressEvent } from "@/lib/chat/planner-stream";
import { useLocale } from "@/lib/i18n";

const TOTAL_STEPS = 6;

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
  onStop,
}: {
  steps: PlannerProgressEvent[];
  onStop?: () => void;
}) {
  const { dictionary } = useLocale();
  const activeEvent = steps.find((event) => event.status === "active");
  const active = activeEvent?.step;
  const doneCount = steps.filter((s) => s.status === "done").length;

  const stepOrder: Array<PlannerProgressEvent["step"]> = [
    "understand",
    "context",
    "places",
    "draft",
    "check",
    "save",
  ];
  const activeIndex = active ? stepOrder.indexOf(active) : -1;
  const currentStepNum = activeIndex >= 0 ? activeIndex + 1 : doneCount;

  // Tỷ lệ hoàn thành (tối thiểu 15% khi bắt đầu để thấy dải màu tiến trình)
  const progressPct = Math.min(
    100,
    Math.max(15, (currentStepNum / TOTAL_STEPS) * 100),
  );

  const activeEmoji = active ? FUNNY_STEP_EMOJIS[active] : "🧭";

  return (
    <div
      data-testid="planner-progress"
      className="neu-card overflow-hidden rounded-2xl p-3 transition-all duration-300"
      role="status"
      aria-live="polite"
    >
      {/* Hàng trên: Mascot/Icon nhảy nhảy ("cái nhảy nhảy") + Title + Phần trăm tiến trình */}
      <div className="mb-2 flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2 min-w-0">
          <span
            data-testid="planner-bouncing-indicator"
            className="text-lg leading-none motion-safe:animate-bounce select-none inline-block drop-shadow-xs"
            aria-hidden="true"
          >
            {activeEmoji}
          </span>
          <span className="text-xs font-black uppercase tracking-wider text-primary truncate">
            {dictionary.chat.progress.title}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span
            data-testid="planner-progress-percent"
            className="rounded-full bg-primary-soft px-2.5 py-0.5 text-[11px] font-extrabold text-primary shadow-2xs tabular-nums"
          >
            {Math.round(progressPct)}%
          </span>
          {active && onStop ? (
            <button
              type="button"
              onClick={onStop}
              className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-[11px] font-bold text-rose-700 transition hover:bg-rose-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
            >
              {dictionary.chat.progress.stop}
            </button>
          ) : null}
        </div>
      </div>

      {/* Thanh tiến trình tô màu ("tô màu thành tiến trình") - Tinh gọn, không icon & chữ rườm rà */}
      <div
        className="neu-inset relative h-2.5 w-full overflow-hidden rounded-full bg-slate-200/80 p-0.5"
        role="progressbar"
        aria-valuenow={Math.round(progressPct)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          data-testid="planner-progress-fill"
          className="h-full rounded-full bg-gradient-to-r from-primary via-[#0ea5e9] to-cta transition-all duration-500 ease-out shadow-xs relative"
          style={{ width: `${progressPct}%` }}
        >
          {/* Vệt sáng lấp lánh nhẹ nhàng khi đang chạy */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent motion-safe:animate-pulse" />
        </div>
      </div>
    </div>
  );
}
