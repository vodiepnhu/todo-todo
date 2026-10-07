import type { ActionType } from "../types/database";
import type { RankedCandidate } from "@togo-todo/ai-rag";
import type { PlanFieldSummary } from "../lib/ai/extract-plan";
import type { PlanDraft } from "../lib/plans/plan-schema";
import type { Language } from "./language-agent";

const COPY = {
  en: {
    refuse: "I only help with shared activity planning. That request isn't supported.",
    understood: "Here's what I understood.",
    clarify: "I need a bit more detail before saving anything.",
    clarifyPrompt: "Please clarify:",
    nothingSaved: "Nothing was saved.",
    draft: "Draft",
    unknown: "Unknown",
    place: "Place",
    category: "Category",
    location: "Location",
    googleMaps: "Google Maps",
    activities: "Activities",
    preparation: "Preparation",
    food: "Food",
    travel: "Travel",
    experience: "Experience",
    todos: "To-dos",
    costs: "Costs",
    notes: "Notes",
    missing: "Missing or uncertain:",
    confirm: "Type CONFIRM to save this plan.",
    options: "Here are some options from your plans (nothing saved yet):",
    noMatches: "I couldn't find a matching saved activity yet. Tell me more about what you want, and I'll suggest from your saved plans.",
    refine: "Choose an option by number or place name. Use Add if you want to save it.",
    refineResults: "These options match your time limit. Choose one to continue.",
    scheduleQuestion: (place: string) => `Would you like me to schedule "${place}"? Reply Yes or No.`,
    scheduleDeclined: "Okay — nothing will be scheduled.",
    whereSave: "Where should I save this?",
    projectHint: 'Reply with a project name, or say "new project: <name>".',
    projects: "Your projects:",
    askOnly: "Home chat only answers questions. Use Add to save an activity.",
    addScopeUnavailable: "Adding from All projects is unavailable. Use the + Add button or select a wishlist first. Nothing was saved.",
    webSearchAsk: (query: string) => `I couldn't find a close match in your saved plans for "${query}". Would you like me to search online? Reply Yes or No.`,
    webSearchNone: "I couldn't find a suitable place online either. Nothing was saved.",
    webSearchResults: "Here are places I found online (nothing saved yet):",
  },
  vi: {
    refuse: "Tôi chỉ hỗ trợ lập kế hoạch các hoạt động dùng chung. Yêu cầu này hiện chưa được hỗ trợ.",
    understood: "Tôi đã hiểu như sau:",
    clarify: "Tôi cần thêm một vài thông tin trước khi lưu.",
    clarifyPrompt: "Vui lòng làm rõ:",
    nothingSaved: "Chưa có thay đổi nào được lưu.",
    draft: "Bản nháp",
    unknown: "Chưa xác định",
    place: "Địa điểm",
    category: "Danh mục",
    location: "Địa điểm",
    googleMaps: "Google Maps",
    activities: "Hoạt động",
    preparation: "Chuẩn bị",
    food: "Món ăn",
    travel: "Di chuyển",
    experience: "Trải nghiệm",
    todos: "Việc cần làm",
    costs: "Chi phí",
    notes: "Ghi chú",
    missing: "Thông tin còn thiếu hoặc chưa rõ:",
    confirm: "Nhập CONFIRM để lưu kế hoạch.",
    options: "Đây là một vài lựa chọn phù hợp từ kế hoạch của bạn (chưa có gì được lưu):",
    noMatches: "Chưa tìm thấy hoạt động phù hợp đã lưu. Hãy nói thêm bạn muốn tìm gì để tôi gợi ý từ các kế hoạch đã lưu.",
    refine: "Hãy chọn bằng số hoặc tên địa điểm. Dùng Add nếu muốn lưu.",
    refineResults: "Các lựa chọn này phù hợp giới hạn thời gian. Hãy chọn một lựa chọn để tiếp tục.",
    scheduleQuestion: (place: string) => `Bạn có muốn lên lịch cho "${place}" không? Trả lời Có hoặc Không.`,
    scheduleDeclined: "Được — chưa có kế hoạch nào được tạo.",
    whereSave: "Bạn muốn lưu nội dung này vào dự án nào?",
    projectHint: 'Nhập tên dự án hoặc nói "dự án mới: <tên>".',
    projects: "Các dự án của bạn:",
    askOnly: "Chat trang chủ chỉ dùng để hỏi đáp. Dùng Add nếu muốn lưu hoạt động.",
    addScopeUnavailable: "Không thể dùng /add ở All projects. Hãy dùng nút + Add hoặc chọn một wishlist trước. Chưa có gì được lưu.",
    webSearchAsk: (query: string) => `Chưa tìm thấy lựa chọn phù hợp trong kế hoạch đã lưu cho "${query}". Bạn có muốn tôi tìm trên web không? Trả lời Có hoặc Không.`,
    webSearchNone: "Không tìm thấy địa điểm phù hợp trên web. Chưa có gì được lưu.",
    webSearchResults: "Đây là các địa điểm tìm được trên web (chưa có gì được lưu):",
  },
} as const;

function labels(language: Language = "en") {
  return COPY[language];
}

/** Communication agent — no DB writes. */
export function formatRefuseReply(language: Language = "en"): string {
  return labels(language).refuse;
}

export function formatHelpReply(baseReply?: string, language: Language = "en"): string {
  return baseReply || labels(language).understood;
}

export function formatAskOnlyReply(language: Language = "en"): string {
  return labels(language).askOnly;
}

export function formatAddScopeUnavailableReply(language: Language = "en"): string {
  return labels(language).addScopeUnavailable;
}

export function formatWebSearchConsent(query: string, language: Language = "en"): string {
  return labels(language).webSearchAsk(query);
}

export function formatWebSearchNone(language: Language = "en"): string {
  return labels(language).webSearchNone;
}

export function formatWebSearchResults(
  results: Array<{ name: string; formattedAddress: string; googleMapsUrl: string }>,
  language: Language = "en",
): string {
  const lines: string[] = [labels(language).webSearchResults];
  results.forEach((result, index) => {
    lines.push(`${index + 1}. ${result.name} — ${result.formattedAddress}`);
    lines.push(`   Google Maps: ${result.googleMapsUrl}`);
  });
  lines.push("", language === "vi" ? "Dùng Add nếu muốn lưu địa điểm." : "Use Add if you want to save a place.");
  return lines.join("\n");
}

export function formatClarifyReply(input: {
  baseReply?: string;
  ambiguities?: string[];
  reasons?: string[];
  language?: Language;
}): string {
  const copy = labels(input.language);
  const lines: string[] = [
    input.baseReply || copy.clarify,
  ];
  const points = [
    ...(input.ambiguities ?? []),
    ...(input.reasons ?? []),
  ].filter(Boolean);
  if (points.length) {
    lines.push("", copy.clarifyPrompt);
    points.forEach((p, i) => lines.push(`${i + 1}. ${p}`));
  }
  lines.push("", copy.nothingSaved);
  return lines.join("\n");
}

export function formatMutationReply(input: {
  baseReply?: string;
  draftTitle: string;
  actionType: ActionType;
  pendingId: string;
  plan?: PlanDraft;
  extracted?: PlanFieldSummary[];
  suggestions?: PlanFieldSummary[];
  missing?: string[];
  language?: Language;
}): string {
  const copy = labels(input.language);
  const base = input.baseReply || copy.understood;
  const lines = [base, "", `${copy.draft}: ${input.draftTitle || input.actionType}`];

  if (input.plan) {
    lines.push(`📍 ${copy.place}: ${input.plan.placeName || copy.unknown}`);
    if (input.plan.categories.length)
      lines.push(`🏷 ${copy.category}: ${input.plan.categories.join(", ")}`);
    if (input.plan.tags.length) lines.push(`🔖 Tags: ${input.plan.tags.join(", ")}`);
    if (input.plan.location) lines.push(`📌 ${copy.location}: ${input.plan.location}`);
    if (input.plan.googleMapsUrl) lines.push(`🗺️ ${copy.googleMaps}: ${input.plan.googleMapsUrl}`);
    appendPlanWhen(lines, input.plan.plannedStartAt, input.language);
    if (input.plan.status !== "PLANNING") lines.push(`📊 Status: ${formatLabel(input.plan.status)}`);
    appendListSection(lines, `🎯 ${copy.activities}`, input.plan.activities);
    appendListSection(lines, `🧳 ${copy.preparation}`, input.plan.preparations);
    appendListSection(lines, `🍴 ${copy.food}`, input.plan.foodToTry);
    const travel = input.plan.travel;
    if (travel && [
      travel.from,
      travel.to,
      travel.transportMode,
      travel.estimatedDurationMin,
      travel.departureTime,
      travel.arrivalTime,
      travel.notes,
    ].some(hasDisplayValue)) {
      lines.push(`🚗 ${copy.travel}:`);
      appendDetail(lines, "From", travel.from);
      appendDetail(lines, "To", travel.to);
      appendDetail(lines, "Transport", formatLabel(travel.transportMode));
      appendDetail(lines, "Duration", travel.estimatedDurationMin != null ? `${travel.estimatedDurationMin} min` : null);
      appendDetail(lines, "Departure", travel.departureTime);
      appendDetail(lines, "Arrival", travel.arrivalTime);
      appendDetail(lines, "Notes", travel.notes);
    }
    const experience = input.plan.experience;
    if (experience && [
      experience.estimatedDurationMin,
      experience.recommendedStartTime,
      experience.recommendedEndTime,
      experience.bestTime,
      experience.flexibility,
    ].some(hasDisplayValue)) {
      lines.push(`✨ ${copy.experience}:`);
      appendDetail(lines, "Duration", experience.estimatedDurationMin != null ? `${experience.estimatedDurationMin} min` : null);
      appendDetail(lines, "Recommended start", experience.recommendedStartTime);
      appendDetail(lines, "Recommended end", experience.recommendedEndTime);
      appendDetail(lines, "Best time", formatLabel(experience.bestTime));
      appendDetail(lines, "Flexibility", formatLabel(experience.flexibility));
    }
    if (input.plan.todos.length) {
      lines.push("", `✅ ${copy.todos}:`);
      input.plan.todos.forEach((todo) => lines.push(`- ${[
        todo.task, formatLabel(todo.status), formatLabel(todo.priority), todo.note,
      ].filter(Boolean).join(" · ")}`));
    }
    if (input.plan.costs.length) {
      lines.push("", `💰 ${copy.costs}:`);
      input.plan.costs.forEach((cost) => lines.push(`- ${[
        formatLabel(cost.category), `${cost.estimatedAmount} ${cost.currency} estimated`,
        cost.actualAmount != null && `${cost.actualAmount} ${cost.currency} actual`, cost.note,
      ].filter(Boolean).join(" · ")}`));
    }
    if (input.plan.notes.length) {
      lines.push("", `📝 ${copy.notes}:`);
      input.plan.notes.forEach((note) => lines.push(`- ${formatLabel(note.type)}: ${note.content}`));
    }
  }

  if (input.missing?.length) {
    lines.push("", copy.missing);
    input.missing.forEach((item) => lines.push(`- ${item}`));
  }

  lines.push("", copy.confirm, `[Confirm] pending:${input.pendingId}`);
  return lines.join("\n");
}

function formatValue(value: unknown): string {
  if (Array.isArray(value)) return value.join(", ");
  if (value && typeof value === "object") return JSON.stringify(value);
  return String(value ?? "");
}

function hasDisplayValue(value: unknown): boolean {
  return value != null && value !== "";
}

function appendPlanWhen(lines: string[], iso: string | null, language?: Language) {
  if (!iso) return;
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}:\d{2}))?/);
  if (!match) {
    lines.push(`📅 ${language === "vi" ? "Ngày giờ" : "Date & time"}: ${iso}`);
    return;
  }
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  const dateText = new Intl.DateTimeFormat("en-AU", {
    day: "2-digit", month: "short", year: "numeric", timeZone: "UTC",
  }).format(date);
  lines.push(`📅 ${language === "vi" ? "Ngày" : "Date"}: ${dateText}`);
  if (match[4]) lines.push(`🕘 ${language === "vi" ? "Giờ" : "Time"}: ${match[4]}`);
}

function appendListSection(lines: string[], title: string, items: string[]) {
  if (!items.length) return;
  lines.push("", `${title}:`);
  items.forEach((item) => lines.push(`- ${item}`));
}

function appendDetail(lines: string[], label: string, value: unknown) {
  if (value == null || value === "") return;
  lines.push(`- ${label}: ${formatValue(value)}`);
}

function formatLabel(value: unknown): string {
  if (Array.isArray(value)) return value.map(formatLabel).filter(Boolean).join(", ");
  if (value == null || value === "") return "";
  return String(value)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function formatRecommendReply(input: {
  intent: string;
  candidates: RankedCandidate[];
  projectByItemId?: Map<string, string>;
  refining?: boolean;
  language?: Language;
}): string {
  const copy = labels(input.language);
  const lines: string[] = [copy.options];
  const label = (c: RankedCandidate) => {
    const project = input.projectByItemId?.get(c.item.id);
    return project ? `${project} → ${c.item.title}` : c.item.title;
  };
  const publicReasons = (reasons: string[]) =>
    reasons.filter((r) => !/semantic\b|\d+%/i.test(r));

  const slice = input.candidates.slice(0, 5);
  if (slice.length === 0) {
    lines.push(copy.noMatches);
  } else {
    slice.forEach((c, i) => {
      const why = publicReasons(c.reasons);
      const duration =
        c.item.estimated_duration_min != null
          ? ` · ~${c.item.estimated_duration_min} min`
          : "";
      const whyPart = why.length ? ` — ${why.join("; ")}` : "";
      lines.push(`${i + 1}. ${label(c)}${duration}${whyPart}`);
    });
    lines.push("", input.refining ? copy.refineResults : copy.refine);
  }
  return lines.join("\n");
}

export function formatScheduleQuestion(place: string, language?: Language): string {
  return labels(language).scheduleQuestion(place);
}

export function formatScheduleDeclinedReply(language?: Language): string {
  return labels(language).scheduleDeclined;
}

export function formatPickProjectReply(input: {
  baseReply?: string;
  projects: Array<{ id: string; name: string }>;
  language?: Language;
}): string {
  const copy = labels(input.language);
  const lines = [
    input.baseReply || copy.whereSave,
    "",
    copy.projectHint,
    "",
    copy.projects,
  ];
  input.projects.forEach((p, i) => lines.push(`${i + 1}. ${p.name}`));
  lines.push("", copy.nothingSaved);
  return lines.join("\n");
}
