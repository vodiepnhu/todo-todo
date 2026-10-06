"use client";

import { Input } from "@/components/ui/input";
import {
  PROJECT_COLOR_PRESETS,
  PROJECT_ICON_PRESETS,
  normalizeHex,
} from "@/lib/project-appearance";
import { cn } from "@/lib/utils";

type Props = {
  name: string;
  icon: string;
  color: string;
  onIconChange: (icon: string) => void;
  onColorChange: (color: string) => void;
};

export function ProjectAppearancePicker({
  name,
  icon,
  color,
  onIconChange,
  onColorChange,
}: Props) {
  const accent = normalizeHex(color) ?? "#0f766e";
  const pickerValue = normalizeHex(color) ?? "#0f766e";
  const displayName = name.trim() || "Untitled project";

  return (
    <div className="space-y-3">
      <div
        className="flex items-center gap-3 rounded-2xl border border-border px-3 py-2.5"
        style={{ background: `${accent}14` }}
      >
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl"
          style={{ background: accent }}
          aria-hidden
        >
          {icon || "📁"}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">
            {icon ? `${icon} ` : ""}
            {displayName}
          </p>
          <p className="text-[11px] text-muted">Live preview</p>
        </div>
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <p className="text-xs font-medium text-muted">Icon</p>
          <button
            type="button"
            className="text-[11px] text-muted underline-offset-2 hover:underline"
            onClick={() => onIconChange("")}
          >
            Clear icon
          </button>
        </div>
        <div className="grid grid-cols-8 gap-1.5">
          {PROJECT_ICON_PRESETS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              aria-label={`Set icon ${emoji}`}
              aria-pressed={icon === emoji}
              onClick={() => onIconChange(emoji)}
              className={cn(
                "flex h-9 items-center justify-center rounded-lg border bg-surface text-lg transition",
                icon === emoji
                  ? "border-primary ring-2 ring-primary/30"
                  : "border-border hover:border-primary/50",
              )}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <p className="text-xs font-medium text-muted">Color</p>
          <button
            type="button"
            className="text-[11px] text-muted underline-offset-2 hover:underline"
            onClick={() => onColorChange("")}
          >
            Clear color
          </button>
        </div>
        <div className="mb-2 flex flex-wrap gap-2">
          {PROJECT_COLOR_PRESETS.map((hex) => (
            <button
              key={hex}
              type="button"
              aria-label={`Set color ${hex}`}
              aria-pressed={normalizeHex(color) === hex}
              onClick={() => onColorChange(hex)}
              className={cn(
                "h-7 w-7 rounded-full border border-border transition",
                normalizeHex(color) === hex &&
                  "ring-2 ring-primary ring-offset-2 ring-offset-surface",
              )}
              style={{ background: hex }}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={icon}
          onChange={(e) => onIconChange(e.target.value)}
          placeholder="Custom emoji"
          aria-label="Custom emoji"
          className="min-w-[7rem] flex-1"
        />
        <input
          type="color"
          value={pickerValue}
          aria-label="Pick color"
          onChange={(e) => onColorChange(e.target.value)}
          className="h-10 w-10 cursor-pointer rounded-lg border border-border bg-surface p-1"
        />
        <Input
          value={color}
          onChange={(e) => onColorChange(e.target.value)}
          placeholder="#0f766e"
          aria-label="Color hex"
          className="min-w-[7rem] flex-1 font-mono text-sm"
        />
      </div>
    </div>
  );
}
