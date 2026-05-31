import { cn } from "@/lib/utils";

/**
 * Brand mark: a monogram that fuses the letter "F" with a "$".
 * The vertical bar runs past the F's arms (top & middle) so it reads as a
 * dollar sign, while the two arms form the F.
 */
export function LogoMark({
  className,
  rounded = "rounded-xl",
}: {
  className?: string;
  rounded?: string;
}) {
  return (
    <span
      className={cn(
        "relative inline-flex items-center justify-center overflow-hidden bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-sm",
        rounded,
        className ?? "h-9 w-9"
      )}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 48 48"
        fill="none"
        className="h-[62%] w-[62%]"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* shared vertical bar (F stem + $ bar), extends beyond the arms */}
        <path
          d="M19 6 V42"
          stroke="white"
          strokeWidth="5"
          strokeLinecap="round"
        />
        {/* F top arm */}
        <path
          d="M19 14 H36"
          stroke="white"
          strokeWidth="5"
          strokeLinecap="round"
        />
        {/* F middle arm */}
        <path
          d="M19 25 H31"
          stroke="white"
          strokeWidth="5"
          strokeLinecap="round"
        />
        {/* subtle dollar accent stroke */}
        <path
          d="M30 10 H13"
          stroke="white"
          strokeOpacity="0.45"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

export function Logo({
  className,
  markClassName,
  showSubtitle = true,
  subtitle = "المالية الذكية",
}: {
  className?: string;
  markClassName?: string;
  showSubtitle?: boolean;
  subtitle?: string;
}) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <LogoMark className={markClassName} />
      <span className="flex flex-col leading-none">
        <span className="text-lg font-extrabold tracking-tight text-slate-900">
          Fin<span className="text-indigo-600">$</span>ol
        </span>
        {showSubtitle && (
          <span className="mt-0.5 text-[11px] font-medium text-slate-400">
            {subtitle}
          </span>
        )}
      </span>
    </span>
  );
}
