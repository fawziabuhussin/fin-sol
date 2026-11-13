import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold leading-4 ring-1 ring-inset",
  {
    variants: {
      variant: {
        default: "bg-slate-50 text-slate-600 ring-slate-200",
        success: "bg-emerald-50 text-emerald-700 ring-emerald-600/15",
        warning: "bg-rose-50 text-rose-700 ring-rose-600/15",
        attention: "bg-amber-50 text-amber-800 ring-amber-600/20",
        brand: "bg-indigo-50 text-indigo-700 ring-indigo-600/15",
        outline: "bg-transparent text-slate-600 ring-slate-200",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

function Badge({
  className,
  variant,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof badgeVariants>) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
