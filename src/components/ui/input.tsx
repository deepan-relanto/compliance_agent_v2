"use client";

import { cn } from "@/lib/utils";
import { forwardRef, type InputHTMLAttributes } from "react";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type = "text", ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        "flex h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900",
        "placeholder:text-zinc-400",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2e3192]/25 focus-visible:border-[#2e3192]/40",
        "disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:opacity-60",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";
