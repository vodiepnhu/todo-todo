import * as React from "react";
import { cn } from "@/lib/utils";

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

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "flex min-h-[88px] w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none ring-primary placeholder:text-muted focus:ring-2",
      className,
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";
