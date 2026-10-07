import { cn } from "@/lib/utils";

export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-white/80 bg-surface/95 p-4 shadow-[-4px_-4px_12px_rgba(255,255,255,0.95),4px_6px_16px_rgba(147,175,212,0.2)] transition-all duration-200",
        className,
      )}
      {...props}
    />
  );
}

export function Badge({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-primary-soft/80 border border-primary/20 px-2.5 py-0.5 text-xs font-semibold text-primary shadow-xs",
        className,
      )}
      {...props}
    />
  );
}
