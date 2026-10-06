"use client";

import { useEffect, useState } from "react";

/**
 * Indeterminate wait UI with an easing % that asymptotes toward ~92%
 * until the parent unmounts (real completion).
 */
export function PlannerWaitPanel({
  title,
  hint = "Usually a few seconds",
}: {
  title: string;
  hint?: string;
}) {
  const [pct, setPct] = useState(6);

  useEffect(() => {
    const id = window.setInterval(() => {
      setPct((p) => {
        if (p >= 92) return 92;
        const step = Math.max(0.6, (92 - p) * 0.12);
        return Math.min(92, p + step);
      });
    }, 350);
    return () => window.clearInterval(id);
  }, []);

  const shown = Math.round(pct);

  return (
    <div className="space-y-4 py-8 text-center" role="status" aria-live="polite">
      <div className="relative mx-auto h-12 w-12">
        <div className="absolute inset-0 rounded-full border-2 border-primary/20" />
        <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-primary border-r-primary/40" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-xs text-muted">{hint}</p>
      </div>
      <div className="mx-auto w-full max-w-xs space-y-1.5 px-2">
        <div className="h-2 overflow-hidden rounded-full bg-primary-soft">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
            style={{ width: `${shown}%` }}
          />
        </div>
        <p className="text-[11px] tabular-nums text-muted">{shown}%</p>
      </div>
    </div>
  );
}
