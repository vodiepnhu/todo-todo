import { cn } from "./cn";

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
