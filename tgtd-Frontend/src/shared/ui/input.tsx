import * as React from "react";
import { cn } from "./cn";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "flex h-10 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none ring-primary placeholder:text-muted focus:ring-2",
      className,
    )}
    {...props}
  />
));
Input.displayName = "Input";
