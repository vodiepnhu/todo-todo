"use client";

import { useMemo } from "react";
import { splitChatContent } from "@/lib/chat/chat-content";
import { useLocale } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import {
  MapPin,
  Calendar,
  Sparkles,
  AlertCircle,
  ExternalLink,
  Check,
  Loader2,
  CheckCircle2,
} from "lucide-react";

type ListSection = "activities" | "preparations" | "foodList" | "travel" | "experience" | "todos" | "costs" | "notes";

type ParsedDraft = {
  placeName: string | null;
  location: string | null;
  mapsUrl: string | null;
  whenStr: string | null;
  status: string | null;
  categories: string[];
  tags: string[];
  activities: string[];
  preparations: string[];
  foodList: string[];
  travel: string[];
  experience: string[];
  todos: string[];
  costs: string[];
  notes: string[];
  missing: string[];
  generalNotes: string[];
  hasStructure: boolean;
};

const SECTION_RULES: Array<{ key: ListSection; pattern: RegExp }> = [
  { key: "activities", pattern: /^(?:🎯\s*)?(?:activities|hoạt động)\s*:/i },
  { key: "preparations", pattern: /^(?:🧳\s*)?(?:preparation|preparations|chuẩn bị)\s*:/i },
  { key: "foodList", pattern: /^(?:🍴|🍜)?\s*(?:food|food to try|món ngon(?: nên thử)?)\s*:/i },
  { key: "travel", pattern: /^(?:🚗\s*)?(?:travel|di chuyển)\s*:/i },
  { key: "experience", pattern: /^(?:✨\s*)?(?:experience|trải nghiệm)\s*:/i },
  { key: "todos", pattern: /^(?:✅\s*)?(?:to-?dos?|việc cần làm)\s*:/i },
  { key: "costs", pattern: /^(?:💰\s*)?(?:costs?|chi phí)\s*:/i },
  { key: "notes", pattern: /^(?:📝\s*)?(?:notes?|ghi chú)\s*:/i },
];

function splitInline(value: string): string[] {
  return value.split(",").map((part) => part.trim()).filter(Boolean);
}

function stripBullet(value: string): string {
  return value.replace(/^[-•\s]+/, "").trim();
}

function parsePlanDraftContent(rawContent: string): ParsedDraft {
  const parsed: ParsedDraft = {
    placeName: null,
    location: null,
    mapsUrl: null,
    whenStr: null,
    status: null,
    categories: [],
    tags: [],
    activities: [],
    preparations: [],
    foodList: [],
    travel: [],
    experience: [],
    todos: [],
    costs: [],
    notes: [],
    missing: [],
    generalNotes: [],
    hasStructure: false,
  };

  for (const segment of splitChatContent(rawContent)) {
    if (segment.href && !parsed.mapsUrl) parsed.mapsUrl = segment.href;
  }

  let section: ListSection | null = null;
  let inMissing = false;
  const lines = rawContent
    .split("\n")
    .filter((line) => !line.trim().startsWith("[Confirm] pending:"));

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (
      trimmed.startsWith("⚠️") ||
      /^(?:missing|missing or uncertain|thông tin còn thiếu)/i.test(trimmed)
    ) {
      section = null;
      inMissing = true;
      parsed.hasStructure = true;
      continue;
    }

    if (inMissing && (trimmed.startsWith("-") || trimmed.startsWith("•"))) {
      parsed.missing.push(stripBullet(trimmed));
      continue;
    }

    const sectionMatch = SECTION_RULES.find(({ pattern }) => pattern.test(trimmed));
    if (sectionMatch) {
      section = sectionMatch.key;
      inMissing = false;
      parsed.hasStructure = true;
      const inline = trimmed.replace(sectionMatch.pattern, "").trim();
      if (inline && !inline.startsWith("-")) parsed[section].push(...splitInline(inline));
      continue;
    }

    const category = trimmed.match(/^(?:🏷\s*)?(?:category|categories|danh mục)\s*:\s*(.*)$/i);
    if (category) {
      section = null;
      inMissing = false;
      parsed.categories = splitInline(category[1]);
      parsed.hasStructure = true;
      continue;
    }

    const tags = trimmed.match(/^(?:🔖\s*)?tags?\s*:\s*(.*)$/i);
    if (tags) {
      section = null;
      inMissing = false;
      parsed.tags = splitInline(tags[1]);
      parsed.hasStructure = true;
      continue;
    }

    const location = trimmed.match(/^(?:📌\s*)?(?:location|địa chỉ)\s*:\s*(.*)$/i);
    if (location) {
      section = null;
      inMissing = false;
      parsed.location = location[1].trim();
      parsed.hasStructure = true;
      continue;
    }

    if (trimmed.startsWith("📍")) {
      section = null;
      inMissing = false;
      parsed.placeName = trimmed.replace(/^📍\s*/, "").replace(/^place:\s*/i, "").trim();
      parsed.hasStructure = true;
      continue;
    }

    const place = trimmed.match(/^(?:place|địa điểm)\s*:\s*(.*)$/i);
    if (place) {
      section = null;
      inMissing = false;
      parsed.placeName = place[1].trim();
      parsed.hasStructure = true;
      continue;
    }

    if (trimmed.startsWith("📅") || /^(?:when|date & time|ngày giờ)\s*:/i.test(trimmed)) {
      section = null;
      inMissing = false;
      const value = trimmed.replace(/^📅\s*/, "").replace(/^(?:when|date & time|ngày giờ)\s*:\s*/i, "").trim();
      parsed.whenStr = parsed.whenStr ? `${parsed.whenStr} · ${value}` : value;
      parsed.hasStructure = true;
      continue;
    }

    if (trimmed.startsWith("🕘") || /^(?:time|giờ)\s*:/i.test(trimmed)) {
      section = null;
      inMissing = false;
      const value = trimmed.replace(/^🕘\s*/, "").replace(/^(?:time|giờ)\s*:\s*/i, "").trim();
      parsed.whenStr = parsed.whenStr ? `${parsed.whenStr} · ${value}` : value;
      parsed.hasStructure = true;
      continue;
    }

    const status = trimmed.match(/^(?:📊\s*)?(?:status|trạng thái)\s*:\s*(.*)$/i);
    if (status) {
      section = null;
      inMissing = false;
      parsed.status = status[1].trim();
      parsed.hasStructure = true;
      continue;
    }

    if (trimmed.startsWith("🗺️") || /^google maps|^bản đồ/i.test(trimmed)) continue;

    if (trimmed.startsWith("-") || trimmed.startsWith("•")) {
      if (section) parsed[section].push(stripBullet(trimmed));
      else parsed.generalNotes.push(stripBullet(trimmed));
      continue;
    }

    if (/^(?:draft:|type confirm|gõ confirm|here(?:'|’)s what i understood|tôi đã hiểu)/i.test(trimmed)) continue;
    if (section) parsed[section].push(trimmed);
    else parsed.generalNotes.push(trimmed);
  }

  parsed.hasStructure ||= Boolean(
    parsed.placeName || parsed.whenStr || parsed.location || parsed.categories.length ||
      parsed.tags.length || parsed.activities.length || parsed.preparations.length ||
      parsed.foodList.length || parsed.travel.length || parsed.experience.length ||
      parsed.todos.length || parsed.costs.length || parsed.notes.length ||
      parsed.missing.length || parsed.generalNotes.length,
  );
  return parsed;
}

function ConfirmAction({
  copy,
  isConfirmed,
  isConfirming,
  isConfirmable,
  onConfirm,
  onMoreInfo,
}: {
  copy: { saved: string; saving: string; confirm: string; moreInfo: string };
  isConfirmed: boolean;
  isConfirming: boolean;
  isConfirmable: boolean;
  onConfirm?: () => void;
  onMoreInfo?: () => void;
}) {
  if (isConfirmed) {
    return <div className="flex items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800"><CheckCircle2 className="h-4 w-4 text-emerald-600" />{copy.saved} ✓</div>;
  }
  if (isConfirming) {
    return <Button size="sm" disabled className="w-full rounded-xl bg-primary/80 text-white text-xs font-semibold"><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />{copy.saving}</Button>;
  }
  if (!isConfirmable) return null;
  return <div className="grid grid-cols-2 gap-2">
    <Button size="sm" variant="outline" className="rounded-xl border-primary/30 text-xs font-semibold" onClick={onMoreInfo}>{copy.moreInfo}</Button>
    <Button size="sm" className="rounded-xl bg-cta text-white hover:bg-cta-hover shadow-xs text-xs font-semibold transition" onClick={onConfirm}><Check className="mr-1.5 h-3.5 w-3.5" />{copy.confirm}</Button>
  </div>;
}

export function PlanDraftCard({
  rawContent,
  isConfirmable,
  isConfirmed,
  isConfirming,
  onConfirm,
  onMoreInfo,
}: {
  rawContent: string;
  isConfirmable: boolean;
  isConfirmed: boolean;
  isConfirming: boolean;
  onConfirm?: () => void;
  onMoreInfo?: () => void;
}) {
  const { dictionary } = useLocale();
  const copy = dictionary.chat.planDraft;
  const parsed = useMemo(() => parsePlanDraftContent(rawContent), [rawContent]);

  if (!parsed.hasStructure) {
    const cleanContent = rawContent.replace(/\n*\[Confirm\]\s*pending:\S+/g, "").trim();
    return <div className="space-y-2"><p className="whitespace-pre-wrap leading-relaxed text-foreground">{splitChatContent(cleanContent).map((segment, index) => segment.href ? <a key={`${index}-${segment.text}`} href={segment.href} target="_blank" rel="noreferrer" className="font-medium text-primary underline underline-offset-2 hover:text-cta">{segment.text}</a> : <span key={`${index}-${segment.text}`}>{segment.text}</span>)}</p><ConfirmAction copy={copy} isConfirmed={isConfirmed} isConfirming={isConfirming} isConfirmable={isConfirmable} onConfirm={onConfirm} onMoreInfo={onMoreInfo} /></div>;
  }

  const renderList = (title: string, icon: string, values: string[]) => values.length ? (
    <div className="space-y-1.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground/60">{icon} {title}</p>
      <ul className="space-y-0.5 text-xs text-foreground/80">{values.map((value, index) => <li key={`${value}-${index}`} className="rounded-lg bg-slate-50 px-2.5 py-1.5">{value}</li>)}</ul>
    </div>
  ) : null;

  return (
    <div className="space-y-3.5 rounded-2xl border border-sky-100 bg-white p-4 text-foreground shadow-[-3px_-3px_10px_rgba(255,255,255,0.95),3px_5px_15px_rgba(147,175,212,0.18)]">
      <div className="flex items-center justify-between border-b border-sky-100/70 pb-2.5"><span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-cta"><Sparkles className="h-3.5 w-3.5" />{copy.title}</span>{parsed.mapsUrl ? <a href={parsed.mapsUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-0.5 text-[10px] font-semibold text-sky-800 hover:bg-sky-100 transition shadow-xs"><ExternalLink className="h-3 w-3" /> Maps</a> : null}</div>
      <div className="space-y-1.5">{parsed.placeName ? <div className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-cta" /><span className="font-heading text-sm font-bold tracking-tight">{parsed.placeName}</span></div> : null}{parsed.location ? <p className="pl-6 text-xs text-foreground/65">{parsed.location}</p> : null}{parsed.whenStr ? <div className="flex items-center gap-2 text-xs font-medium text-foreground/75"><Calendar className="h-3.5 w-3.5 shrink-0 text-primary" /><span>{parsed.whenStr}</span></div> : null}{parsed.status ? <p className="pl-6 text-xs font-medium text-foreground/65">{parsed.status}</p> : null}</div>
      {parsed.categories.length || parsed.tags.length ? <div className="flex flex-wrap gap-1.5">{parsed.categories.map((value) => <span key={`category-${value}`} className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-800">🏷 {value}</span>)}{parsed.tags.map((value) => <span key={`tag-${value}`} className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800">🔖 {value}</span>)}</div> : null}
      {renderList(copy.activities, "🎯", parsed.activities)}
      {renderList(copy.preparation, "🧳", parsed.preparations)}
      {parsed.foodList.length ? <div className="space-y-1"><p className="text-[11px] font-semibold uppercase tracking-wide text-foreground/60">🍴 {copy.foodToTry}</p><div className="flex flex-wrap gap-1.5">{parsed.foodList.map((food, index) => <span key={`${food}-${index}`} className="inline-flex items-center rounded-full border border-orange-200 bg-orange-50 px-2.5 py-0.5 text-[11px] font-medium text-orange-900">🍜 {food}</span>)}</div></div> : null}
      {renderList(copy.travel, "🚗", parsed.travel)}
      {renderList(copy.experience, "✨", parsed.experience)}
      {renderList(copy.todos, "✅", parsed.todos)}
      {renderList(copy.costs, "💰", parsed.costs)}
      {renderList(copy.notes, "📝", parsed.notes)}
      {parsed.missing.length ? <div className="rounded-xl border border-amber-300 bg-amber-50/90 p-2.5 text-xs text-amber-900"><div className="flex items-center gap-1.5 font-semibold text-amber-950"><AlertCircle className="h-3.5 w-3.5 text-amber-600" /><span>{copy.missing}</span></div><ul className="mt-1 list-inside list-disc space-y-0.5 text-[11px]">{parsed.missing.map((value, index) => <li key={`${value}-${index}`}>{value}</li>)}</ul></div> : null}
      {parsed.generalNotes.length ? <div className="space-y-1 border-t border-orange-100/70 pt-2 text-xs text-foreground/70">{parsed.generalNotes.map((note, index) => <p key={`${note}-${index}`}>{note}</p>)}</div> : null}
      <ConfirmAction copy={copy} isConfirmed={isConfirmed} isConfirming={isConfirming} isConfirmable={isConfirmable} onConfirm={onConfirm} onMoreInfo={onMoreInfo} />
    </div>
  );
}
