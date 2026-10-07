import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "flex h-10 w-full rounded-xl border border-border/80 bg-white/95 px-3 py-2 text-sm text-foreground outline-none shadow-[inset_1px_2px_4px_rgba(147,175,212,0.12)] placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/25 transition-all",
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
      "flex min-h-[88px] w-full rounded-xl border border-border/80 bg-white/95 px-3 py-2 text-sm text-foreground outline-none shadow-[inset_1px_2px_4px_rgba(147,175,212,0.12)] placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/25 transition-all",
      className,
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";
