import type { ActionType } from "../types/database";
import type { RankedCandidate } from "@togo-todo/ai-rag";

/** Communication agent — English replies only. No DB writes. */
export function formatRefuseReply(): string {
  return "I only help with shared activity planning. That request isn't supported.";
}

export function formatHelpReply(baseReply?: string): string {
  return baseReply || "Here's what I understood.";
}

export function formatClarifyReply(input: {
  baseReply?: string;
  ambiguities?: string[];
  reasons?: string[];
}): string {
  const lines: string[] = [
    input.baseReply || "I need a bit more detail before saving anything.",
  ];
  const points = [
    ...(input.ambiguities ?? []),
    ...(input.reasons ?? []),
  ].filter(Boolean);
  if (points.length) {
    lines.push("", "Please clarify:");
    points.forEach((p, i) => lines.push(`${i + 1}. ${p}`));
  }
  lines.push("", "Nothing was saved.");
  return lines.join("\n");
}

export function formatMutationReply(input: {
  baseReply?: string;
  draftTitle: string;
  actionType: ActionType;
  pendingId: string;
}): string {
  const base = input.baseReply || "Here's what I understood.";
  return `${base}\n\nDraft: ${input.draftTitle || input.actionType}\nType CONFIRM to save this plan.\n[Confirm] pending:${input.pendingId}`;
}

export function formatRecommendReply(input: {
  intent: string;
  candidates: RankedCandidate[];
  projectByItemId?: Map<string, string>;
}): string {
  const lines: string[] = [
    "Here are some options from your plans (nothing saved yet):",
  ];
  const label = (c: RankedCandidate) => {
    const project = input.projectByItemId?.get(c.item.id);
    return project ? `${project} → ${c.item.title}` : c.item.title;
  };
  const publicReasons = (reasons: string[]) =>
    reasons.filter((r) => !/semantic\b|\d+%/i.test(r));

  const slice = input.candidates.slice(0, 5);
  if (slice.length === 0) {
    lines.push("I couldn't find matching items yet. Add a TODO or TOGO first?");
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
    lines.push("", "Say which option you want, or ask me to refine.");
  }
  return lines.join("\n");
}

export function formatPickProjectReply(input: {
  baseReply?: string;
  projects: Array<{ id: string; name: string }>;
}): string {
  const lines = [
    input.baseReply || "Where should I save this?",
    "",
    'Reply with a project name, or say "new project: <name>".',
    "",
    "Your projects:",
  ];
  input.projects.forEach((p, i) => lines.push(`${i + 1}. ${p.name}`));
  lines.push("", "Nothing was saved.");
  return lines.join("\n");
}
