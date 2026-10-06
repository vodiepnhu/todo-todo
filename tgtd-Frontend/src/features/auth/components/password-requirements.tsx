"use client";

import { cn } from "@/shared/ui/cn";
import {
  evaluatePassword,
  PASSWORD_REQUIREMENT_LABELS,
  type PasswordStrength,
} from "../domain/password-policy";

const STRENGTH_LABEL: Record<PasswordStrength, string> = {
  weak: "Weak",
  fair: "Fair",
  strong: "Strong",
};

export function PasswordRequirements({
  password,
  className,
}: {
  password: string;
  className?: string;
}) {
  const { checks, strength, ok } = evaluatePassword(password);
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-muted">Strength</span>
        <span className={cn(ok ? "text-primary" : "text-muted")}>{STRENGTH_LABEL[strength]}</span>
      </div>
      <ul className="space-y-1 text-xs">
        {PASSWORD_REQUIREMENT_LABELS.map((requirement) => (
          <li key={requirement.key} className={cn(checks[requirement.key] ? "text-primary" : "text-muted")}>
            {checks[requirement.key] ? "✓" : "○"} {requirement.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
