"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { safeMapsHref } from "@/lib/maps/url";
import type {
  BestTime,
  PlanDraft,
  PlanNoteType,
  PlanTodoPriority,
  PlanTodoStatus,
} from "@/lib/plans/plan-schema";
import {
  actualCostTotal,
  estimatedCostTotal,
} from "@/lib/plans/plan-schema";
import {
  isoToWhenParts,
  mergeWhenParts,
  whenPartsToIso,
} from "@/lib/when-local";
import {
  MapPin,
  Calendar,
  Sparkles,
  Luggage,
  Coins,
  ExternalLink,
  Plus,
  Trash2,
  X,
  AlertCircle,
  UtensilsCrossed,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocale } from "@/lib/i18n";

const BEST_TIMES: BestTime[] = [
  "morning",
  "afternoon",
  "sunset",
  "evening",
  "anytime",
];
const TRANSPORTS = ["car", "train", "bus", "walk", "other"] as const;
const NOTE_TYPES: PlanNoteType[] = [
  "general",
  "tip",
  "warning",
  "personal",
  "booking",
  "accessibility",
  "weather",
];
const TODO_STATUSES: PlanTodoStatus[] = ["pending", "done", "skipped"];
const TODO_PRIORITIES: PlanTodoPriority[] = ["high", "medium", "low"];

type AccentColor = "coral" | "teal" | "amber" | "purple" | "emerald";

const FORM_COPY = {
  en: {
    heading: "ADD TO PLAN",
    suggested: "✨ AI suggestion — edit freely",
    missing: "Missing information:",
    where: "Where",
    whereSubtitle: "Place name, Google Maps link, and categories",
    selected: "📍 Selected",
    required: "Required",
    placeName: "Place name (Togo) *",
    placePlaceholder: "e.g. Bondi Beach, Cafe Giảng, Hồ Gươm...",
    location: "Address / Location",
    locationPlaceholder: "Street address, suburb...",
    maps: "Google Maps URL",
    openMaps: "Open in Google Maps",
    categories: "Categories",
    categoryPlaceholder: "Cafe, dining, beach, outdoors...",
    tags: "Tags",
    tagsPlaceholder: "chill, date night, check-in, family...",
    when: "When & Transit",
    whenSubtitle: "Schedule and how to get there",
    notScheduled: "Not scheduled",
    clearSchedule: "Clear schedule",
    date: "Date",
    time: "Time",
    from: "From",
    fromPlaceholder: "Home, office...",
    to: "To",
    toPlaceholder: "Destination...",
    transport: "Transport",
    notSelected: "— Not selected —",
    travelMinutes: "Travel time (minutes)",
    departure: "Departure",
    arrival: "Arrival",
    transitNotes: "Transit notes",
    transitPlaceholder: "Parking at B1, traffic is heavy during peak hours...",
    experience: "Experience & Eats",
    experienceSubtitle: "Activities to enjoy and food worth trying",
    activitiesCount: "activities",
    foodsCount: "dishes",
    durationHours: "Estimated duration (hours)",
    idealTime: "Best time",
    anyTime: "Any time",
    activities: "Activities",
    addActivity: "Add activity: Take photos, watch the sunset, swim...",
    food: "Food to try",
    addFood: "Add dish: Salt coffee, banh mi, seafood...",
    prepare: "Prepare & Todo",
    prepareSubtitle: "Things to pack and tasks to finish before the trip",
    preparations: "Preparations",
    preparationsCount: "items",
    addPreparation: "Add item: Sunscreen, power bank, warm jacket...",
    todo: "Todo list",
    todoCount: "tasks",
    addTodo: "Add task",
    task: "Task",
    status: "Status",
    priority: "Priority",
    note: "Note",
    taskPlaceholder: "Book a table, buy tickets...",
    notePlaceholder: "Note...",
    budget: "Budget & Notes",
    budgetSubtitle: "Track estimated costs and important notes",
    estimatedCost: "Estimated costs",
    estimated: "Estimated",
    actual: "Actual",
    addCost: "Add cost",
    cost: "Cost",
    totalEstimated: "Estimated total:",
    spent: "Spent",
    notes: "Notes",
    noteType: "Note type",
    notesPlaceholder: "e.g. Weekends are busy, arrive before 9am...",
    add: "Add",
    cancel: "Cancel",
    save: "Save plan",
    transportOptions: { car: "🚗 Car / Taxi", train: "🚆 Train", bus: "🚌 Bus", walk: "🚶 Walk", other: "Other" },
    bestTimes: { morning: "Morning", afternoon: "Afternoon", sunset: "Sunset", evening: "Evening", anytime: "Any time" },
    statuses: { pending: "Pending", done: "Done", skipped: "Skipped" },
    priorities: { high: "High", medium: "Medium", low: "Low" },
    noteTypes: { general: "General", tip: "Tip", warning: "Warning", personal: "Personal", booking: "Booking", accessibility: "Accessibility", weather: "Weather" },
  },
  vi: {
    heading: "KẾ HOẠCH CHI TIẾT",
    suggested: "✨ Gợi ý từ AI — bạn có thể chỉnh sửa",
    missing: "Thông tin còn thiếu:",
    where: "Đi đâu",
    whereSubtitle: "Tên địa điểm, liên kết Google Maps và danh mục",
    selected: "📍 Đã chọn",
    required: "Bắt buộc",
    placeName: "Tên địa điểm (Togo) *",
    placePlaceholder: "Ví dụ: Hồ Gươm, Cafe Giảng, Bondi Beach...",
    location: "Địa chỉ / vị trí",
    locationPlaceholder: "Số nhà, đường phố, quận/huyện...",
    maps: "Liên kết Google Maps",
    openMaps: "Mở trong Google Maps",
    categories: "Danh mục",
    categoryPlaceholder: "Cà phê, ăn uống, biển, dã ngoại...",
    tags: "Thẻ",
    tagsPlaceholder: "thư giãn, hẹn hò, check-in, gia đình...",
    when: "Thời gian & di chuyển",
    whenSubtitle: "Lịch trình và cách di chuyển đến nơi",
    notScheduled: "Chưa đặt lịch",
    clearSchedule: "Xóa lịch",
    date: "Ngày",
    time: "Giờ",
    from: "Đi từ",
    fromPlaceholder: "Nhà, văn phòng...",
    to: "Đến",
    toPlaceholder: "Điểm hẹn...",
    transport: "Phương tiện",
    notSelected: "— Chưa chọn —",
    travelMinutes: "Thời gian di chuyển (phút)",
    departure: "Khởi hành",
    arrival: "Tới nơi",
    transitNotes: "Ghi chú di chuyển",
    transitPlaceholder: "Gửi xe ở hầm B1, đường dễ kẹt xe giờ cao điểm...",
    experience: "Trải nghiệm & ăn uống",
    experienceSubtitle: "Hoạt động nên thử và món ngon đáng thưởng thức",
    activitiesCount: "hoạt động",
    foodsCount: "món",
    durationHours: "Thời lượng ước tính (giờ)",
    idealTime: "Thời điểm lý tưởng",
    anyTime: "Bất kỳ lúc nào",
    activities: "Hoạt động cần trải nghiệm",
    addActivity: "Thêm hoạt động: Chụp ảnh, ngắm hoàng hôn, tắm biển...",
    food: "Món ngon nên thử",
    addFood: "Thêm món: Cà phê muối, bánh mì chảo, hải sản...",
    prepare: "Chuẩn bị & việc cần làm",
    prepareSubtitle: "Đồ cần mang theo và việc cần hoàn tất trước chuyến đi",
    preparations: "Đồ dùng cần chuẩn bị",
    preparationsCount: "món",
    addPreparation: "Thêm đồ mang theo: Kem chống nắng, sạc dự phòng, áo ấm...",
    todo: "Việc cần làm",
    todoCount: "việc",
    addTodo: "Thêm việc",
    task: "Việc",
    status: "Trạng thái",
    priority: "Ưu tiên",
    note: "Ghi chú",
    taskPlaceholder: "Đặt bàn, mua vé...",
    notePlaceholder: "Ghi chú...",
    budget: "Chi phí & ghi chú",
    budgetSubtitle: "Theo dõi chi phí dự kiến và những lưu ý quan trọng",
    estimatedCost: "Dự toán chi phí",
    estimated: "Ước tính",
    actual: "Thực tế",
    addCost: "Thêm khoản chi",
    cost: "Khoản chi",
    totalEstimated: "Tổng chi phí ước tính:",
    spent: "Đã chi",
    notes: "Ghi chú & lưu ý",
    noteType: "Loại ghi chú",
    notesPlaceholder: "Ví dụ: Cuối tuần rất đông, nên đến sớm trước 9 giờ...",
    add: "Thêm",
    cancel: "Hủy",
    save: "Lưu kế hoạch",
    transportOptions: { car: "🚗 Xe hơi / taxi", train: "🚆 Tàu điện", bus: "🚌 Xe buýt", walk: "🚶 Đi bộ", other: "Khác" },
    bestTimes: { morning: "Buổi sáng", afternoon: "Buổi chiều", sunset: "Hoàng hôn", evening: "Buổi tối", anytime: "Bất kỳ lúc nào" },
    statuses: { pending: "Đang chờ", done: "Đã xong", skipped: "Đã bỏ qua" },
    priorities: { high: "Cao", medium: "Trung bình", low: "Thấp" },
    noteTypes: { general: "Chung", tip: "Mẹo", warning: "Cảnh báo", personal: "Cá nhân", booking: "Đặt chỗ", accessibility: "Tiện nghi", weather: "Thời tiết" },
  },
} as const;

const ACCENT_STYLES: Record<
  AccentColor,
  {
    card: string;
    header: string;
    badge: string;
    iconBg: string;
    iconText: string;
  }
> = {
  coral: {
    card: "border-orange-200/90 bg-[#fff9f6]/90 shadow-[0_2px_8px_rgba(223,105,81,0.06)]",
    header: "border-orange-100",
    badge: "bg-orange-100 text-orange-800",
    iconBg: "bg-orange-100/90 text-orange-700",
    iconText: "text-orange-700",
  },
  teal: {
    card: "border-teal-200/90 bg-[#f4faf8]/90 shadow-[0_2px_8px_rgba(14,98,91,0.06)]",
    header: "border-teal-100",
    badge: "bg-teal-100 text-teal-800",
    iconBg: "bg-teal-100/90 text-teal-700",
    iconText: "text-teal-700",
  },
  amber: {
    card: "border-amber-200/90 bg-[#fffdf5]/90 shadow-[0_2px_8px_rgba(245,158,11,0.06)]",
    header: "border-amber-100",
    badge: "bg-amber-100 text-amber-800",
    iconBg: "bg-amber-100/90 text-amber-700",
    iconText: "text-amber-700",
  },
  purple: {
    card: "border-purple-200/90 bg-[#faf7ff]/90 shadow-[0_2px_8px_rgba(147,51,234,0.06)]",
    header: "border-purple-100",
    badge: "bg-purple-100 text-purple-800",
    iconBg: "bg-purple-100/90 text-purple-700",
    iconText: "text-purple-700",
  },
  emerald: {
    card: "border-emerald-200/90 bg-[#f4fbf7]/90 shadow-[0_2px_8px_rgba(16,185,129,0.06)]",
    header: "border-emerald-100",
    badge: "bg-emerald-100 text-emerald-800",
    iconBg: "bg-emerald-100/90 text-emerald-700",
    iconText: "text-emerald-700",
  },
};

function StudioCard({
  icon,
  title,
  subtitle,
  badge,
  accent = "teal",
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  badge?: string;
  accent?: AccentColor;
  children: React.ReactNode;
}) {
  const styles = ACCENT_STYLES[accent];
  return (
    <section
      className={cn(
        "rounded-2xl border p-4 transition-all duration-150 backdrop-blur-xs",
        styles.card,
      )}
    >
      <div
        className={cn(
          "mb-3 flex items-center justify-between border-b pb-2.5",
          styles.header,
        )}
      >
        <div className="flex items-center gap-2.5">
          <span
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-xl",
              styles.iconBg,
            )}
            aria-hidden
          >
            {icon}
          </span>
          <div>
            <h3 className="font-heading text-sm font-bold tracking-tight text-foreground">
              {title}
            </h3>
            {subtitle ? (
              <p className="text-[11px] font-medium text-foreground/60">
                {subtitle}
              </p>
            ) : null}
          </div>
        </div>
        {badge ? (
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums",
              styles.badge,
            )}
          >
            {badge}
          </span>
        ) : null}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function ChipList({
  items,
  onRemove,
  draft,
  setDraft,
  onAdd,
  placeholder,
  addLabel,
  pillColor = "bg-primary-soft text-foreground",
}: {
  items: string[];
  onRemove: (v: string) => void;
  draft: string;
  setDraft: (v: string) => void;
  onAdd: () => void;
  placeholder: string;
  addLabel: string;
  pillColor?: string;
}) {
  return (
    <div className="space-y-1.5">
      {items.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {items.map((c) => (
            <span
              key={c}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border border-border/80 px-2.5 py-0.5 text-xs font-medium shadow-xs",
                pillColor,
              )}
            >
              <span>{c}</span>
              <button
                type="button"
                className="ml-0.5 text-foreground/50 transition hover:text-foreground focus:outline-none"
                onClick={() => onRemove(c)}
                aria-label={`Remove ${c}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      ) : null}
      <div className="flex gap-2">
        <Input
          value={draft}
          placeholder={placeholder}
          className="h-9 bg-surface/90 text-xs"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onAdd();
            }
          }}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-9 shrink-0 gap-1 rounded-xl text-xs"
          onClick={onAdd}
        >
          <Plus className="h-3.5 w-3.5" /> {addLabel}
        </Button>
      </div>
    </div>
  );
}

function ChecklistEditor({
  items,
  onChange,
  addLabel,
  addButtonLabel,
  icon = "☐",
}: {
  items: string[];
  onChange: (next: string[]) => void;
  addLabel: string;
  addButtonLabel: string;
  icon?: string;
}) {
  const [draft, setDraft] = useState("");
  return (
    <div className="space-y-2">
      {items.length > 0 ? (
        <ul className="space-y-1.5">
          {items.map((label, i) => (
            <li
              key={`${label}-${i}`}
              className="group flex items-center gap-2 rounded-xl border border-border/70 bg-surface/85 px-3 py-1.5 text-xs font-medium text-foreground transition hover:border-primary/40 hover:bg-surface"
            >
              <span className="shrink-0 text-foreground/50" aria-hidden>
                {icon}
              </span>
              <span className="min-w-0 flex-1 break-words">{label}</span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0 text-foreground/40 opacity-70 transition hover:text-danger hover:opacity-100"
                onClick={() => onChange(items.filter((_, j) => j !== i))}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex gap-2">
        <Input
          value={draft}
          placeholder={addLabel}
          className="h-9 bg-surface/90 text-xs"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              const t = draft.trim();
              if (!t) return;
              onChange([...items, t]);
              setDraft("");
            }
          }}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-9 shrink-0 gap-1 rounded-xl text-xs"
          onClick={() => {
            const t = draft.trim();
            if (!t) return;
            onChange([...items, t]);
            setDraft("");
          }}
        >
          <Plus className="h-3.5 w-3.5" /> {addButtonLabel}
        </Button>
      </div>
    </div>
  );
}

export function AddToPlanForm({
  value,
  onChange,
  onCancel,
  onSave,
  busy,
  heading,
  missing,
  suggested = false,
  readOnly = false,
  hideActions = false,
}: {
  value: PlanDraft;
  onChange: (next: PlanDraft) => void;
  onCancel: () => void;
  onSave: () => void;
  busy?: boolean;
  heading?: string;
  missing?: string[];
  suggested?: boolean;
  readOnly?: boolean;
  /** Hide Save/Cancel footer (parent owns chrome). */
  hideActions?: boolean;
}) {
  const { locale } = useLocale();
  const copy = FORM_COPY[locale];
  const [catDraft, setCatDraft] = useState("");
  const [tagDraft, setTagDraft] = useState("");
  const [noteType, setNoteType] = useState<PlanNoteType>("general");
  const [noteDraft, setNoteDraft] = useState("");

  const travel = value.travel ?? {
    from: null,
    to: null,
    transportMode: null,
    estimatedDurationMin: null,
    departureTime: null,
    arrivalTime: null,
    notes: null,
  };
  const experience = value.experience ?? {
    estimatedDurationMin: null,
    recommendedStartTime: null,
    recommendedEndTime: null,
    bestTime: null,
    flexibility: null,
  };
  const hours =
    experience.estimatedDurationMin != null
      ? experience.estimatedDurationMin / 60
      : "";
  const whenParts = isoToWhenParts(value.plannedStartAt);
  const mapsHref = safeMapsHref(value.googleMapsUrl);

  function patch(partial: Partial<PlanDraft>) {
    if (readOnly) return;
    onChange({ ...value, ...partial });
  }
  function patchTravel(partial: Partial<NonNullable<PlanDraft["travel"]>>) {
    patch({ travel: { ...travel, ...partial } });
  }
  function patchExperience(
    partial: Partial<NonNullable<PlanDraft["experience"]>>,
  ) {
    patch({ experience: { ...experience, ...partial } });
  }
  function setWhen(patchWhen: { date?: string; time?: string } | null) {
    if (readOnly) return;
    if (patchWhen === null) {
      patch({ plannedStartAt: null });
      return;
    }
    const merged = mergeWhenParts(whenParts, patchWhen);
    if (!merged.date) {
      patch({ plannedStartAt: null });
      return;
    }
    patch({ plannedStartAt: whenPartsToIso(merged) });
  }

  const estTotal = estimatedCostTotal(value);
  const actTotal = actualCostTotal(value);
  const headingText = heading ?? copy.heading;

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h2 className="font-heading text-lg font-bold tracking-tight text-foreground">
          {headingText}
        </h2>
        {suggested ? (
          <p className="mt-0.5 text-xs font-medium text-primary">
            {copy.suggested}
          </p>
        ) : null}
      </div>

      {missing && missing.length > 0 && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-amber-300 bg-amber-50/90 p-3 text-xs text-amber-900 shadow-xs">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-amber-950">{copy.missing}</p>
            <ul className="mt-1 list-inside list-disc space-y-0.5">
              {missing.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <fieldset disabled={readOnly} className="min-w-0 space-y-4 border-0 p-0">
        {/* CARD 1: WHERE */}
        <StudioCard
          icon={<MapPin className="h-4 w-4" />}
          title={copy.where}
          subtitle={copy.whereSubtitle}
          badge={value.placeName ? copy.selected : copy.required}
          accent="coral"
        >
          <label className="block space-y-1 text-xs font-semibold text-foreground">
            <span>{copy.placeName}</span>
            <Input
              value={value.placeName}
              placeholder={copy.placePlaceholder}
              disabled={readOnly}
              className="bg-surface font-medium text-sm"
              onChange={(e) => patch({ placeName: e.target.value })}
            />
          </label>

          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block space-y-1 text-xs font-semibold text-foreground">
              <span>{copy.location}</span>
              <Input
                value={value.location ?? ""}
                placeholder={copy.locationPlaceholder}
                className="bg-surface text-xs"
                onChange={(e) => patch({ location: e.target.value || null })}
              />
            </label>
            <div className="space-y-1 text-xs">
              <span className="font-semibold text-foreground">
                {copy.maps}
              </span>
              <div className="flex gap-1.5">
                <Input
                  value={value.googleMapsUrl ?? ""}
                  placeholder="https://maps.google.com/..."
                  className="bg-surface text-xs"
                  onChange={(e) =>
                    patch({ googleMapsUrl: e.target.value || null })
                  }
                />
                {mapsHref && (
                  <a
                    href={mapsHref}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-9 shrink-0 items-center justify-center rounded-xl border border-border bg-surface px-2.5 text-xs font-medium text-primary shadow-xs transition hover:bg-primary-soft"
                    title={copy.openMaps}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-xs font-semibold text-foreground">{copy.categories}</p>
            <ChipList
              items={value.categories}
              onRemove={(c) =>
                patch({ categories: value.categories.filter((x) => x !== c) })
              }
              draft={catDraft}
              setDraft={setCatDraft}
              placeholder={copy.categoryPlaceholder}
              addLabel={copy.add}
              pillColor="bg-orange-100/90 text-orange-900 border-orange-200"
              onAdd={() => {
                const t = catDraft.trim();
                if (!t || value.categories.includes(t)) return;
                patch({ categories: [...value.categories, t] });
                setCatDraft("");
              }}
            />
          </div>

          <div className="space-y-1">
            <p className="text-xs font-semibold text-foreground">{copy.tags}</p>
            <ChipList
              items={value.tags}
              onRemove={(c) =>
                patch({ tags: value.tags.filter((x) => x !== c) })
              }
              draft={tagDraft}
              setDraft={setTagDraft}
              placeholder={copy.tagsPlaceholder}
              addLabel={copy.add}
              pillColor="bg-surface text-foreground border-border"
              onAdd={() => {
                const t = tagDraft.trim();
                if (!t || value.tags.includes(t)) return;
                patch({ tags: [...value.tags, t] });
                setTagDraft("");
              }}
            />
          </div>
        </StudioCard>

        {/* CARD 2: WHEN & TRANSIT */}
        <StudioCard
          icon={<Calendar className="h-4 w-4" />}
          title={copy.when}
          subtitle={copy.whenSubtitle}
          badge={whenParts?.date ? `${whenParts.date} ${whenParts.time || ""}` : copy.notScheduled}
          accent="teal"
        >
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1 text-xs font-semibold text-foreground">
              <span>{copy.date}</span>
              <Input
                type="date"
                className="bg-surface text-xs"
                value={whenParts?.date ?? ""}
                onChange={(e) =>
                  setWhen({ date: e.target.value || undefined })
                }
              />
            </label>
            <label className="space-y-1 text-xs font-semibold text-foreground">
              <span>{copy.time}</span>
              <Input
                type="time"
                className="bg-surface text-xs"
                value={whenParts?.time ?? ""}
                onChange={(e) =>
                  setWhen({ time: e.target.value || undefined })
                }
              />
            </label>
          </div>
          {value.plannedStartAt ? (
            <button
              type="button"
              className="text-xs text-muted underline-offset-2 hover:underline"
              onClick={() => setWhen(null)}
            >
              {copy.clearSchedule}
            </button>
          ) : null}

          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-teal-100">
            <label className="space-y-1 text-xs font-semibold text-foreground">
              <span>{copy.from}</span>
              <Input
                placeholder={copy.fromPlaceholder}
                className="bg-surface text-xs"
                value={travel.from ?? ""}
                onChange={(e) => patchTravel({ from: e.target.value || null })}
              />
            </label>
            <label className="space-y-1 text-xs font-semibold text-foreground">
              <span>{copy.to}</span>
              <Input
                placeholder={copy.toPlaceholder}
                className="bg-surface text-xs"
                value={travel.to ?? ""}
                onChange={(e) => patchTravel({ to: e.target.value || null })}
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1 text-xs font-semibold text-foreground">
              <span>{copy.transport}</span>
              <select
                className="h-10 w-full rounded-xl border border-border bg-surface px-3 text-xs"
                value={travel.transportMode ?? ""}
                onChange={(e) =>
                  patchTravel({ transportMode: e.target.value || null })
                }
              >
                <option value="">{copy.notSelected}</option>
                {TRANSPORTS.map((t) => (
                  <option key={t} value={t}>
                    {copy.transportOptions[t]}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-xs font-semibold text-foreground">
              <span>{copy.travelMinutes}</span>
              <Input
                type="number"
                min={0}
                placeholder="30"
                className="bg-surface text-xs"
                value={travel.estimatedDurationMin ?? ""}
                onChange={(e) =>
                  patchTravel({
                    estimatedDurationMin: e.target.value
                      ? Number(e.target.value)
                      : null,
                  })
                }
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1 text-xs font-semibold text-foreground">
              <span>{copy.departure}</span>
              <Input
                placeholder="09:00"
                className="bg-surface text-xs"
                value={travel.departureTime ?? ""}
                onChange={(e) =>
                  patchTravel({ departureTime: e.target.value || null })
                }
              />
            </label>
            <label className="space-y-1 text-xs font-semibold text-foreground">
              <span>{copy.arrival}</span>
              <Input
                placeholder="09:45"
                className="bg-surface text-xs"
                value={travel.arrivalTime ?? ""}
                onChange={(e) =>
                  patchTravel({ arrivalTime: e.target.value || null })
                }
              />
            </label>
          </div>

          <label className="block space-y-1 text-xs font-semibold text-foreground">
            <span>{copy.transitNotes}</span>
            <Input
              value={travel.notes ?? ""}
              className="bg-surface text-xs"
              placeholder={copy.transitPlaceholder}
              onChange={(e) => patchTravel({ notes: e.target.value || null })}
            />
          </label>
        </StudioCard>

        {/* CARD 3: EXPERIENCE & EATS */}
        <StudioCard
          icon={<Sparkles className="h-4 w-4" />}
          title={copy.experience}
          subtitle={copy.experienceSubtitle}
          badge={`${value.activities.length} ${copy.activitiesCount} · ${value.foodToTry.length} ${copy.foodsCount}`}
          accent="amber"
        >
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1 text-xs font-semibold text-foreground">
              <span>{copy.durationHours}</span>
              <Input
                type="number"
                min={0}
                step={0.5}
                placeholder="1.5"
                className="bg-surface text-xs"
                value={hours}
                onChange={(e) => {
                  const h = e.target.value ? Number(e.target.value) : null;
                  patchExperience({
                    estimatedDurationMin: h != null ? Math.round(h * 60) : null,
                  });
                }}
              />
            </label>
            <label className="space-y-1 text-xs font-semibold text-foreground">
              <span>{copy.idealTime}</span>
              <select
                className="h-10 w-full rounded-xl border border-border bg-surface px-3 text-xs"
                value={experience.bestTime ?? ""}
                onChange={(e) =>
                  patchExperience({
                    bestTime: (e.target.value || null) as BestTime | null,
                  })
                }
              >
                <option value="">— {copy.anyTime} —</option>
                {BEST_TIMES.map((t) => (
                  <option key={t} value={t}>
                    {copy.bestTimes[t]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="space-y-1.5 pt-1 border-t border-amber-100">
            <p className="flex items-center gap-1.5 text-xs font-bold text-foreground">
              <CheckCircle2 className="h-3.5 w-3.5 text-amber-600" /> {copy.activities}
            </p>
            <ChecklistEditor
              items={value.activities}
              onChange={(activities) => patch({ activities })}
              addLabel={copy.addActivity}
              addButtonLabel={copy.add}
              icon="🎯"
            />
          </div>

          <div className="space-y-1.5 pt-1 border-t border-amber-100">
            <p className="flex items-center gap-1.5 text-xs font-bold text-foreground">
              <UtensilsCrossed className="h-3.5 w-3.5 text-amber-600" /> {copy.food}
            </p>
            <ChecklistEditor
              items={value.foodToTry}
              onChange={(foodToTry) => patch({ foodToTry })}
              addLabel={copy.addFood}
              addButtonLabel={copy.add}
              icon="🍜"
            />
          </div>
        </StudioCard>

        {/* CARD 4: PREPARE & TODO */}
        <StudioCard
          icon={<Luggage className="h-4 w-4" />}
          title={copy.prepare}
          subtitle={copy.prepareSubtitle}
          badge={`${value.preparations.length} ${copy.preparationsCount} · ${value.todos.length} ${copy.todoCount}`}
          accent="purple"
        >
          <div className="space-y-1.5">
            <p className="text-xs font-bold text-foreground">{copy.preparations}</p>
            <ChecklistEditor
              items={value.preparations}
              onChange={(preparations) => patch({ preparations })}
              addLabel={copy.addPreparation}
              addButtonLabel={copy.add}
              icon="🎒"
            />
          </div>

          <div className="space-y-2 pt-2 border-t border-purple-100">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-foreground">{copy.todo}</p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 text-xs rounded-lg"
                onClick={() =>
                  patch({
                    todos: [
                      ...value.todos,
                      {
                        task: "",
                        status: "pending",
                        priority: "medium",
                        note: null,
                      },
                    ],
                  })
                }
              >
                <Plus className="h-3 w-3 mr-1" /> {copy.addTodo}
              </Button>
            </div>

            {value.todos.length > 0 ? (
              <div className="space-y-2">
                <div className="grid grid-cols-[1fr_80px_80px_1fr_auto] gap-1 text-[10px] font-semibold uppercase text-muted">
                  <span>{copy.task}</span>
                  <span>{copy.status}</span>
                  <span>{copy.priority}</span>
                  <span>{copy.note}</span>
                  <span />
                </div>
                {value.todos.map((t, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-[1fr_80px_80px_1fr_auto] items-center gap-1 rounded-xl border border-border/60 bg-surface/80 p-1.5"
                  >
                    <Input
                      value={t.task}
                      placeholder={copy.taskPlaceholder}
                      className="h-8 bg-surface text-xs"
                      onChange={(e) => {
                        const todos = [...value.todos];
                        todos[i] = { ...t, task: e.target.value };
                        patch({ todos });
                      }}
                    />
                    <select
                      className="h-8 rounded-lg border border-border bg-surface px-1 text-[11px]"
                      value={t.status}
                      onChange={(e) => {
                        const todos = [...value.todos];
                        todos[i] = {
                          ...t,
                          status: e.target.value as PlanTodoStatus,
                        };
                        patch({ todos });
                      }}
                    >
                      {TODO_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {copy.statuses[s]}
                        </option>
                      ))}
                    </select>
                    <select
                      className="h-8 rounded-lg border border-border bg-surface px-1 text-[11px]"
                      value={t.priority ?? "medium"}
                      onChange={(e) => {
                        const todos = [...value.todos];
                        todos[i] = {
                          ...t,
                          priority: e.target.value as PlanTodoPriority,
                        };
                        patch({ todos });
                      }}
                    >
                      {TODO_PRIORITIES.map((s) => (
                        <option key={s} value={s}>
                          {copy.priorities[s]}
                        </option>
                      ))}
                    </select>
                    <Input
                      value={t.note ?? ""}
                      placeholder={copy.notePlaceholder}
                      className="h-8 bg-surface text-xs"
                      onChange={(e) => {
                        const todos = [...value.todos];
                        todos[i] = { ...t, note: e.target.value || null };
                        patch({ todos });
                      }}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-8 w-7 p-0 text-foreground/40 hover:text-danger"
                      onClick={() =>
                        patch({ todos: value.todos.filter((_, j) => j !== i) })
                      }
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </StudioCard>

        {/* CARD 5: BUDGET & NOTES */}
        <StudioCard
          icon={<Coins className="h-4 w-4" />}
          title={copy.budget}
          subtitle={copy.budgetSubtitle}
          badge={`${copy.estimated} $${estTotal}${actTotal > 0 ? ` · ${copy.actual} $${actTotal}` : ""}`}
          accent="emerald"
        >
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-foreground">{copy.estimatedCost}</p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 text-xs rounded-lg"
                onClick={() =>
                  patch({
                    costs: [
                      ...value.costs,
                      {
                        category: "",
                        estimatedAmount: 0,
                        actualAmount: null,
                        currency: "AUD",
                        note: null,
                      },
                    ],
                  })
                }
              >
                <Plus className="h-3 w-3 mr-1" /> {copy.addCost}
              </Button>
            </div>

            {value.costs.length > 0 ? (
              <div className="space-y-2">
                <div className="grid grid-cols-[1fr_70px_70px_1fr_auto] gap-1 text-[10px] font-semibold uppercase text-muted">
                  <span>{copy.cost}</span>
                  <span>{copy.estimated}</span>
                  <span>{copy.actual}</span>
                  <span>{copy.note}</span>
                  <span />
                </div>
                {value.costs.map((c, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-[1fr_70px_70px_1fr_auto] items-center gap-1 rounded-xl border border-border/60 bg-surface/80 p-1.5"
                  >
                    <Input
                      value={c.category}
                      placeholder={locale === "vi" ? "Vé vào cổng, ăn trưa..." : "Entry tickets, lunch..."}
                      className="h-8 bg-surface text-xs"
                      onChange={(e) => {
                        const costs = [...value.costs];
                        costs[i] = { ...c, category: e.target.value };
                        patch({ costs });
                      }}
                    />
                    <Input
                      type="number"
                      min={0}
                      className="h-8 bg-surface text-xs tabular-nums"
                      value={c.estimatedAmount}
                      onChange={(e) => {
                        const costs = [...value.costs];
                        costs[i] = {
                          ...c,
                          estimatedAmount: Number(e.target.value) || 0,
                        };
                        patch({ costs });
                      }}
                    />
                    <Input
                      type="number"
                      min={0}
                      className="h-8 bg-surface text-xs tabular-nums"
                      value={c.actualAmount ?? ""}
                      placeholder="—"
                      onChange={(e) => {
                        const costs = [...value.costs];
                        costs[i] = {
                          ...c,
                          actualAmount: e.target.value
                            ? Number(e.target.value)
                            : null,
                        };
                        patch({ costs });
                      }}
                    />
                    <Input
                      value={c.note ?? ""}
                      placeholder={copy.notePlaceholder}
                      className="h-8 bg-surface text-xs"
                      onChange={(e) => {
                        const costs = [...value.costs];
                        costs[i] = { ...c, note: e.target.value || null };
                        patch({ costs });
                      }}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-8 w-7 p-0 text-foreground/40 hover:text-danger"
                      onClick={() =>
                        patch({ costs: value.costs.filter((_, j) => j !== i) })
                      }
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="rounded-xl bg-emerald-50/80 px-3 py-2 text-xs font-semibold text-emerald-950 flex items-center justify-between border border-emerald-200/80">
              <span>{copy.totalEstimated}</span>
              <span className="tabular-nums text-sm font-bold text-emerald-800">
                ${estTotal} {actTotal > 0 ? `(${copy.spent}: $${actTotal})` : ""}
              </span>
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-emerald-100">
            <p className="text-xs font-bold text-foreground">{copy.notes}</p>
            {value.notes.length > 0 ? (
              <ul className="space-y-1.5">
                {value.notes.map((n, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 rounded-xl border border-border/60 bg-surface/85 px-3 py-1.5 text-xs text-foreground"
                  >
                    <span className="mt-0.5 rounded-md bg-primary-soft px-1.5 py-0.5 text-[10px] font-bold uppercase text-primary">
                      {copy.noteTypes[n.type]}
                    </span>
                    <span className="flex-1 break-words">{n.content}</span>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-5 w-5 p-0 text-foreground/40 hover:text-danger"
                      onClick={() =>
                        patch({ notes: value.notes.filter((_, j) => j !== i) })
                      }
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </li>
                ))}
              </ul>
            ) : null}

            <div className="flex gap-2">
              <label className="sr-only" htmlFor="plan-note-type">{copy.noteType}</label>
              <select
                id="plan-note-type"
                className="h-9 rounded-xl border border-border bg-surface px-2 text-xs"
                value={noteType}
                onChange={(e) => setNoteType(e.target.value as PlanNoteType)}
              >
                {NOTE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {copy.noteTypes[t]}
                  </option>
                ))}
              </select>
              <Textarea
                className="min-h-[40px] flex-1 bg-surface text-xs"
                value={noteDraft}
                placeholder={copy.notesPlaceholder}
                onChange={(e) => setNoteDraft(e.target.value)}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-9 shrink-0 gap-1 rounded-xl text-xs"
                onClick={() => {
                  const t = noteDraft.trim();
                  if (!t) return;
                  patch({
                    notes: [...value.notes, { type: noteType, content: t }],
                  });
                  setNoteDraft("");
                }}
              >
                <Plus className="h-3.5 w-3.5" /> {copy.add}
              </Button>
            </div>
          </div>
        </StudioCard>
      </fieldset>

      {!hideActions ? (
        <div className="flex gap-2.5 pt-2">
          <Button
            type="button"
            variant="outline"
            className="flex-1 rounded-xl"
            onClick={onCancel}
            disabled={busy || readOnly}
          >
            {copy.cancel}
          </Button>
          <Button
            type="button"
            className="flex-1 rounded-xl bg-cta text-white hover:bg-cta-hover shadow-sm"
            onClick={onSave}
            disabled={busy || readOnly}
          >
            {copy.save}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
