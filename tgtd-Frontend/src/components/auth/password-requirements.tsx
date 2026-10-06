"use client";

import { cn } from "@/lib/utils";
import {
  evaluatePassword,
  PASSWORD_REQUIREMENT_LABELS,
  type PasswordStrength,
} from "@/lib/auth/password-policy";

const STRENGTH_LABEL: Record<PasswordStrength, string> = {
  weak: "Weak",
  fair: "Fair",
  strong: "Strong",
};

const STRENGTH_BAR: Record<PasswordStrength, string> = {
  weak: "w-1/3 bg-rose-500",
  fair: "w-2/3 bg-amber-500",
  strong: "w-full bg-emerald-600",
};

export function PasswordRequirements({
  password,
  className,
}: {
  password: string;
  className?: string;
}) {
  const { checks, strength, ok } = evaluatePassword(password);
  const show = password.length > 0;

  if (!show) {
    return (
      <ul className={cn("space-y-1 text-xs text-muted", className)}>
        {PASSWORD_REQUIREMENT_LABELS.map((r) => (
          <li key={r.key}>• {r.label}</li>
        ))}
      </ul>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-muted">Strength</span>
          <span
            className={cn(
              ok ? "text-primary" : "text-muted",
              strength === "weak" && "text-danger",
              strength === "fair" && "text-todo",
            )}
          >
            {STRENGTH_LABEL[strength]}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-primary-soft">
          <div
            className={cn("h-full rounded-full transition-all", STRENGTH_BAR[strength])}
          />
        </div>
      </div>
      <ul className="space-y-1 text-xs">
        {PASSWORD_REQUIREMENT_LABELS.map((r) => {
          const pass = checks[r.key];
          return (
            <li
              key={r.key}
              className={cn(pass ? "text-primary" : "text-muted")}
            >
              {pass ? "✓" : "○"} {r.label}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
