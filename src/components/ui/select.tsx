import * as React from "react";
import { cn } from "@/lib/utils";
import { fieldClasses } from "@/components/ui/input";

const chevron =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")";

export function Select({ className, style, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      {...props}
      style={{
        backgroundImage: chevron,
        backgroundRepeat: "no-repeat",
        backgroundPosition: "left 0.75rem center",
        ...style,
      }}
      className={cn(fieldClasses, "h-10 cursor-pointer appearance-none pe-9", className)}
    />
  );
}
