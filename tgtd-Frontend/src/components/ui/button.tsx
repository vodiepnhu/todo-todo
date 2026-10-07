import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-r from-cta to-[#ff8a65] text-white shadow-[-3px_-3px_8px_rgba(255,255,255,0.7),3px_5px_12px_rgba(255,107,74,0.32)] hover:from-cta-hover hover:to-[#ff7a52] hover:shadow-[-4px_-4px_10px_rgba(255,255,255,0.9),4px_6px_14px_rgba(255,107,74,0.4)]",
        secondary:
          "bg-white/95 border border-white text-primary shadow-[-2px_-2px_6px_rgba(255,255,255,0.9),2px_3px_8px_rgba(147,175,212,0.22)] hover:bg-primary-soft/50 hover:text-primary",
        outline:
          "border border-border/80 bg-white/90 text-foreground/80 shadow-xs hover:bg-primary-soft/40 hover:text-foreground",
        ghost: "hover:bg-primary-soft/60 text-foreground/80 hover:text-foreground",
        danger:
          "bg-gradient-to-r from-danger to-rose-500 text-white shadow-sm hover:from-rose-600 hover:to-rose-700",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 rounded-lg px-3 text-xs",
        lg: "h-12 rounded-2xl px-6",
        icon: "h-10 w-10 rounded-xl",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  ),
);
Button.displayName = "Button";
