import * as React from "react";
import { cn } from "@/lib/utils";

/** Shared field chrome for inputs, selects and textareas. */
export const fieldClasses =
  "w-full rounded-xl border border-slate-200 bg-white px-3 text-base text-slate-900 shadow-[inset_0_1px_1px_rgb(16_24_40/0.03)] transition-[border-color,box-shadow] placeholder:text-slate-400 hover:border-slate-300 focus-visible:border-indigo-500 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/12 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-60 aria-[invalid=true]:border-rose-400 aria-[invalid=true]:ring-rose-500/10 sm:text-sm";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(fieldClasses, "flex h-10 py-2", className)}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
