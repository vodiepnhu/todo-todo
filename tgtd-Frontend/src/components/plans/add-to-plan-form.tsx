"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
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

function SectionTitle({
  icon,
  children,
}: {
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <h3 className="flex items-center gap-2 border-t border-border pt-3 text-xs font-semibold uppercase tracking-wide text-muted">
      <span aria-hidden>{icon}</span>
      {children}
    </h3>
  );
}

function ChipList({
  items,
  onRemove,
  draft,
  setDraft,
  onAdd,
  placeholder,
}: {
  items: string[];
  onRemove: (v: string) => void;
  draft: string;
  setDraft: (v: string) => void;
  onAdd: () => void;
  placeholder: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap gap-1">
        {items.map((c) => (
          <button
            key={c}
            type="button"
            className="rounded-full bg-primary-soft px-2 py-0.5 text-xs text-foreground"
            onClick={() => onRemove(c)}
          >
            {c} ×
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onAdd();
            }
          }}
        />
        <Button type="button" size="sm" variant="outline" onClick={onAdd}>
          + Add
        </Button>
      </div>
    </div>
  );
}

function ChecklistEditor({
  items,
  onChange,
  addLabel,
}: {
  items: string[];
  onChange: (next: string[]) => void;
  addLabel: string;
}) {
  const [draft, setDraft] = useState("");
  return (
    <div className="space-y-2">
      <ul className="space-y-1">
        {items.map((label, i) => (
          <li key={`${label}-${i}`} className="flex items-center gap-2 text-sm">
            <span className="flex-1 rounded-lg bg-primary-soft/50 px-2 py-1">
              ☐ {label}
            </span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => onChange(items.filter((_, j) => j !== i))}
            >
              Remove
            </Button>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <Input
          value={draft}
          placeholder={addLabel}
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
          onClick={() => {
            const t = draft.trim();
            if (!t) return;
            onChange([...items, t]);
            setDraft("");
          }}
        >
          + Add
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
  heading = "ADD TO PLAN",
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

  return (
    <div className="space-y-3">
      <h2 className="text-center text-lg font-semibold tracking-wide">
        {heading}
      </h2>
      {suggested ? (
        <p className="text-center text-xs text-muted">
          Suggested — edit freely
        </p>
      ) : null}
      {missing && missing.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <p className="font-medium">Missing information</p>
          <ul className="mt-1 list-inside list-disc">
            {missing.map((m) => (
              <li key={m}>⚠ {m}</li>
            ))}
          </ul>
        </div>
      )}

      <fieldset disabled={readOnly} className="min-w-0 space-y-3 border-0 p-0">
      <label className="block space-y-1 text-sm">
        <span className="font-medium text-foreground">📍 Place (Togo)</span>
        <Input
          value={value.placeName}
          placeholder="Bondi Beach"
          disabled={readOnly}
          onChange={(e) => patch({ placeName: e.target.value })}
        />
      </label>

      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">Category</p>
        <ChipList
          items={value.categories}
          onRemove={(c) =>
            patch({ categories: value.categories.filter((x) => x !== c) })
          }
          draft={catDraft}
          setDraft={setCatDraft}
          placeholder="Cafe, Beach, Hiking…"
          onAdd={() => {
            const t = catDraft.trim();
            if (!t || value.categories.includes(t)) return;
            patch({ categories: [...value.categories, t] });
            setCatDraft("");
          }}
        />
      </div>

      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">Tags</p>
        <ChipList
          items={value.tags}
          onRemove={(c) => patch({ tags: value.tags.filter((x) => x !== c) })}
          draft={tagDraft}
          setDraft={setTagDraft}
          placeholder="date, chill, nature…"
          onAdd={() => {
            const t = tagDraft.trim();
            if (!t || value.tags.includes(t)) return;
            patch({ tags: [...value.tags, t] });
            setTagDraft("");
          }}
        />
      </div>

      <label className="block space-y-1 text-sm">
        <span className="font-medium text-foreground">Location</span>
        <Input
          value={value.location ?? ""}
          placeholder="Bondi Beach NSW 2026"
          onChange={(e) => patch({ location: e.target.value || null })}
        />
      </label>

      <div className="space-y-1 text-sm">
        <span className="font-medium text-foreground">Google Maps</span>
        <Input
          value={value.googleMapsUrl ?? ""}
          placeholder="Paste Maps link (or let AI fill when available)"
          onChange={(e) => patch({ googleMapsUrl: e.target.value || null })}
        />
      </div>

      <SectionTitle icon="🗓">WHEN</SectionTitle>
      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-1 text-sm">
          <span>Date</span>
          <Input
            type="date"
            value={whenParts?.date ?? ""}
            onChange={(e) =>
              setWhen({ date: e.target.value || undefined })
            }
          />
        </label>
        <label className="space-y-1 text-sm">
          <span>Time</span>
          <Input
            type="time"
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
          Clear when
        </button>
      ) : null}

      <SectionTitle icon="🚗">TRAVEL</SectionTitle>
      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-1 text-sm">
          <span>From</span>
          <Input
            value={travel.from ?? ""}
            onChange={(e) => patchTravel({ from: e.target.value || null })}
          />
        </label>
        <label className="space-y-1 text-sm">
          <span>To</span>
          <Input
            value={travel.to ?? ""}
            onChange={(e) => patchTravel({ to: e.target.value || null })}
          />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-1 text-sm">
          <span>Transport</span>
          <select
            className="h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm"
            value={travel.transportMode ?? ""}
            onChange={(e) =>
              patchTravel({ transportMode: e.target.value || null })
            }
          >
            <option value="">—</option>
            {TRANSPORTS.map((t) => (
              <option key={t} value={t}>
                {t[0]!.toUpperCase() + t.slice(1)}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span>Travel time (min)</span>
          <Input
            type="number"
            min={0}
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
        <label className="space-y-1 text-sm">
          <span>Departure</span>
          <Input
            placeholder="09:00"
            value={travel.departureTime ?? ""}
            onChange={(e) =>
              patchTravel({ departureTime: e.target.value || null })
            }
          />
        </label>
        <label className="space-y-1 text-sm">
          <span>Arrival</span>
          <Input
            placeholder="09:45"
            value={travel.arrivalTime ?? ""}
            onChange={(e) =>
              patchTravel({ arrivalTime: e.target.value || null })
            }
          />
        </label>
      </div>
      <label className="block space-y-1 text-sm">
        <span>Travel notes</span>
        <Input
          value={travel.notes ?? ""}
          placeholder="Parking difficult on weekends"
          onChange={(e) => patchTravel({ notes: e.target.value || null })}
        />
      </label>

      <SectionTitle icon="⏱">EXPERIENCE</SectionTitle>
      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-1 text-sm">
          <span>Estimated time (hours)</span>
          <Input
            type="number"
            min={0}
            step={0.5}
            value={hours}
            onChange={(e) => {
              const h = e.target.value ? Number(e.target.value) : null;
              patchExperience({
                estimatedDurationMin: h != null ? Math.round(h * 60) : null,
              });
            }}
          />
        </label>
        <label className="space-y-1 text-sm">
          <span>Best time</span>
          <select
            className="h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm"
            value={experience.bestTime ?? ""}
            onChange={(e) =>
              patchExperience({
                bestTime: (e.target.value || null) as BestTime | null,
              })
            }
          >
            <option value="">—</option>
            {BEST_TIMES.map((t) => (
              <option key={t} value={t}>
                {t[0]!.toUpperCase() + t.slice(1)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <SectionTitle icon="✅">THINGS TO DO</SectionTitle>
      <ChecklistEditor
        items={value.activities}
        onChange={(activities) => patch({ activities })}
        addLabel="Add activity"
      />

      <SectionTitle icon="🍜">FOOD</SectionTitle>
      <ChecklistEditor
        items={value.foodToTry}
        onChange={(foodToTry) => patch({ foodToTry })}
        addLabel="Add food to try"
      />

      <SectionTitle icon="🎒">PREPARATION</SectionTitle>
      <ChecklistEditor
        items={value.preparations}
        onChange={(preparations) => patch({ preparations })}
        addLabel="Add preparation"
      />

      <SectionTitle icon="☑️">TODO</SectionTitle>
      <div className="space-y-2">
        <div className="grid grid-cols-[1fr_80px_80px_1fr_auto] gap-1 text-[10px] font-medium uppercase text-muted">
          <span>Task</span>
          <span>Status</span>
          <span>Priority</span>
          <span>Note</span>
          <span />
        </div>
        {value.todos.map((t, i) => (
          <div
            key={i}
            className="grid grid-cols-[1fr_80px_80px_1fr_auto] gap-1"
          >
            <Input
              value={t.task}
              onChange={(e) => {
                const todos = [...value.todos];
                todos[i] = { ...t, task: e.target.value };
                patch({ todos });
              }}
            />
            <select
              className="h-10 rounded-xl border border-border bg-surface px-1 text-xs"
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
                  {s}
                </option>
              ))}
            </select>
            <select
              className="h-10 rounded-xl border border-border bg-surface px-1 text-xs"
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
                  {s}
                </option>
              ))}
            </select>
            <Input
              value={t.note ?? ""}
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
              onClick={() =>
                patch({ todos: value.todos.filter((_, j) => j !== i) })
              }
            >
              ×
            </Button>
          </div>
        ))}
        <Button
          type="button"
          size="sm"
          variant="outline"
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
          + Add task
        </Button>
      </div>

      <SectionTitle icon="💰">COST</SectionTitle>
      <div className="space-y-2">
        <div className="grid grid-cols-[1fr_70px_70px_1fr_auto] gap-1 text-[10px] font-medium uppercase text-muted">
          <span>Category</span>
          <span>Est.</span>
          <span>Actual</span>
          <span>Note</span>
          <span />
        </div>
        {value.costs.map((c, i) => (
          <div
            key={i}
            className="grid grid-cols-[1fr_70px_70px_1fr_auto] gap-1"
          >
            <Input
              value={c.category}
              placeholder="Transport"
              onChange={(e) => {
                const costs = [...value.costs];
                costs[i] = { ...c, category: e.target.value };
                patch({ costs });
              }}
            />
            <Input
              type="number"
              min={0}
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
              value={c.actualAmount ?? ""}
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
              onClick={() =>
                patch({ costs: value.costs.filter((_, j) => j !== i) })
              }
            >
              ×
            </Button>
          </div>
        ))}
        <p className="text-sm font-medium text-foreground">
          Estimated Total ${estTotal}
          {actTotal > 0 ? ` · Actual $${actTotal}` : ""}
        </p>
        <Button
          type="button"
          size="sm"
          variant="outline"
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
          + Add cost
        </Button>
      </div>

      <SectionTitle icon="📝">NOTES</SectionTitle>
      <ul className="space-y-1">
        {value.notes.map((n, i) => (
          <li
            key={i}
            className="flex items-start gap-2 rounded-lg bg-primary-soft/50 px-2 py-1 text-sm"
          >
            <span className="text-xs font-medium uppercase text-muted">
              {n.type}
            </span>
            <span className="flex-1">{n.content}</span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() =>
                patch({ notes: value.notes.filter((_, j) => j !== i) })
              }
            >
              ×
            </Button>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <select
          className="h-10 rounded-xl border border-border bg-surface px-2 text-sm"
          value={noteType}
          onChange={(e) => setNoteType(e.target.value as PlanNoteType)}
        >
          {NOTE_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <Textarea
          className="min-h-[48px] flex-1"
          value={noteDraft}
          placeholder="Crowded on weekends…"
          onChange={(e) => setNoteDraft(e.target.value)}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            const t = noteDraft.trim();
            if (!t) return;
            patch({
              notes: [...value.notes, { type: noteType, content: t }],
            });
            setNoteDraft("");
          }}
        >
          + Add
        </Button>
      </div>

      </fieldset>

      {!hideActions ? (
        <div className="flex gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={onCancel}
            disabled={busy || readOnly}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="flex-1"
            onClick={onSave}
            disabled={busy || readOnly}
          >
            Save Plan
          </Button>
        </div>
      ) : null}
    </div>
  );
}
