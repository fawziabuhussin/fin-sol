"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function PayToggle({
  paid,
  pending,
  label,
  onToggle,
  size = "md",
}: {
  paid: boolean;
  pending?: boolean;
  label: string;
  onToggle: () => void;
  size?: "sm" | "md";
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={paid}
      aria-label={paid ? `إلغاء تسجيل دفع ${label}` : `تسجيل دفع ${label}`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle();
      }}
      disabled={pending}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full border-2 transition-all duration-200",
        size === "sm" ? "h-6 w-6" : "h-7 w-7",
        paid
          ? "border-emerald-500 bg-emerald-500 text-white shadow-sm shadow-emerald-500/30"
          : "border-slate-300 bg-white text-transparent hover:border-emerald-400 hover:text-emerald-300",
        pending && "opacity-60"
      )}
    >
      <Check className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} strokeWidth={3} />
    </button>
  );
}
