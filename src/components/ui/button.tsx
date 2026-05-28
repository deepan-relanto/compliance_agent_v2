"use client";

import { cn } from "@/lib/utils";
import { forwardRef, type ButtonHTMLAttributes } from "react";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline" | "accent";
  size?: "sm" | "md" | "lg";
}

const variants = {
  primary:
    "bg-[#2e3192] text-white hover:bg-[#3d42a8] border border-[#2e3192] shadow-sm",
  accent:
    "bg-[#f15a24] text-white hover:bg-[#ff6b35] border border-[#f15a24] shadow-sm",
  secondary:
    "bg-white text-zinc-800 hover:bg-zinc-50 border border-zinc-200 shadow-sm",
  ghost: "bg-transparent text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900",
  danger:
    "bg-red-50 text-red-700 hover:bg-red-100 border border-red-200",
  outline:
    "bg-white text-zinc-700 border border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50",
};

const sizes = {
  sm: "h-8 px-3 text-xs gap-1.5 rounded-md",
  md: "h-9 px-4 text-sm gap-2 rounded-md",
  lg: "h-10 px-5 text-sm gap-2 rounded-md",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", disabled, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled}
      className={cn(
        "inline-flex items-center justify-center font-medium tracking-tight transition-colors duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2e3192]/40 focus-visible:ring-offset-2",
        "disabled:pointer-events-none disabled:opacity-40",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = "Button";
