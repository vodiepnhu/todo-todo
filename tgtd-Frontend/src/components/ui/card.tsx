import { cn } from "@/lib/utils";

export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border/80 bg-surface/90 p-4 shadow-[0_1px_0_0_var(--primary-soft)]",
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
        "inline-flex items-center rounded-lg bg-primary-soft px-2 py-0.5 text-xs font-medium text-foreground",
        className,
      )}
      {...props}
    />
  );
}
