import { cn } from "@/lib/utils";
import { subscriptionVisual } from "@/lib/subscription-brands";

export function ServiceAvatar({
  title,
  className,
  muted,
}: {
  title: string;
  className?: string;
  muted?: boolean;
}) {
  const { color, initials } = subscriptionVisual(title);
  return (
    <span
      aria-hidden
      className={cn(
        "flex h-10 w-10 shrink-0 select-none items-center justify-center rounded-xl text-sm font-bold text-white shadow-sm ring-1 ring-black/5 transition-opacity",
        muted && "opacity-45 grayscale-[35%]",
        className
      )}
      style={{ backgroundColor: color }}
    >
      {initials}
    </span>
  );
}
